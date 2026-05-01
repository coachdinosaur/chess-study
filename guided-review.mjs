const REVIEW_STORAGE_PREFIX = 'guided-lesson-row-review-v1';
const LAST_SESSION_STORAGE_KEY = `${REVIEW_STORAGE_PREFIX}:last-session`;

const FIELD_ALIASES = Object.freeze({
  title: ['title', 'lesson_title', 'name'],
  fen: ['fen'],
  difficulty: ['difficulty', 'level'],
  goalType: ['goal_type', 'goal', 'objective'],
  lessonText: ['lesson_text', 'text', 'description'],
  status: ['status', 'review_status'],
});

const FIELD_CANONICAL_HEADERS = Object.freeze({
  title: 'title',
  fen: 'fen',
  difficulty: 'difficulty',
  goalType: 'goal_type',
  lessonText: 'lesson_text',
  status: 'status',
});

const FIELD_LABELS = Object.freeze({
  title: 'Title',
  fen: 'FEN',
  difficulty: 'Difficulty',
  goalType: 'Goal type',
  lessonText: 'Lesson text',
  status: 'Status',
});

const REQUIRED_FIELDS = Object.freeze(['fen', 'lessonText']);
const EDITOR_FIELDS = Object.freeze(['title', 'fen', 'difficulty', 'goalType', 'lessonText', 'status']);

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/\r?\n/g, '&#10;');
}

function normalizeHeader(value) {
  return String(value ?? '')
    .replace(/^\ufeff/, '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function normalizeStatusValue(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function statusKind(value) {
  const normalized = normalizeStatusValue(value);
  if (!normalized) {
    return 'empty';
  }
  if (['done', 'checked', 'complete', 'completed'].includes(normalized)) {
    return 'done';
  }
  if (['needs_review', 'review', 'needs_work', 'todo'].includes(normalized)) {
    return 'needs-review';
  }
  return 'other';
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function safeStorageKeyPart(value) {
  return String(value || 'untitled')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'untitled';
}

function buildHeaderSignature(headers) {
  return headers.map(normalizeHeader).join('|');
}

function buildStorageKey(fileName, headerSignature) {
  return `${REVIEW_STORAGE_PREFIX}:${safeStorageKeyPart(fileName)}:${hashString(headerSignature)}`;
}

function safeLocalStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function parseJsonStorage(key) {
  const storage = safeLocalStorage();
  if (!storage) {
    return null;
  }
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJsonStorage(key, payload) {
  const storage = safeLocalStorage();
  if (!storage) {
    return;
  }
  try {
    storage.setItem(key, JSON.stringify(payload));
  } catch {
    // Browser storage can be disabled or full. The editor still works in memory.
  }
}

function isBlankRow(row) {
  return !row || row.every((cell) => String(cell ?? '').trim() === '');
}

function normalizeTableRows(rawRows) {
  const rows = Array.isArray(rawRows) ? rawRows : [];
  if (!rows.length || isBlankRow(rows[0])) {
    throw new Error('The file does not contain a header row.');
  }

  const maxWidth = Math.max(...rows.map((row) => Array.isArray(row) ? row.length : 0), 0);
  const headers = Array.from({ length: maxWidth }, (_, index) => {
    const original = String(rows[0]?.[index] ?? '').replace(/^\ufeff/, '').trim();
    return original || `column_${index + 1}`;
  });

  const dataRows = rows
    .slice(1)
    .filter((row) => !isBlankRow(row))
    .map((row) => Array.from({ length: headers.length }, (_, index) => String(row?.[index] ?? '')));

  if (!dataRows.length) {
    throw new Error('The file does not contain any lesson rows.');
  }

  return { headers, rows: dataRows };
}

function parseCsvRows(text) {
  const input = String(text ?? '').replace(/^\ufeff/, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let index = 0;

  while (index < input.length) {
    const char = input[index];

    if (inQuotes) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        inQuotes = false;
        index += 1;
        continue;
      }
      field += char;
      index += 1;
      continue;
    }

    if (char === '"') {
      if (field.length === 0) {
        inQuotes = true;
      } else {
        field += char;
      }
      index += 1;
      continue;
    }

    if (char === ',') {
      row.push(field);
      field = '';
      index += 1;
      continue;
    }

    if (char === '\r' || char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      index += char === '\r' && input[index + 1] === '\n' ? 2 : 1;
      continue;
    }

    field += char;
    index += 1;
  }

  if (inQuotes) {
    throw new Error('CSV has an unterminated quoted field.');
  }

  if (field !== '' || row.length || input.length === 0 || !/[\r\n]$/.test(input)) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function serializeCsvCell(value) {
  const text = String(value ?? '');
  const escaped = text.replace(/"/g, '""');
  return /[",\r\n]/.test(text) ? `"${escaped}"` : escaped;
}

function serializeCsv(headers, rows) {
  const allRows = [headers, ...rows];
  return allRows
    .map((row) => headers.map((_, index) => serializeCsvCell(row?.[index] ?? '')).join(','))
    .join('\r\n');
}

function lessonTextIssue(value) {
  const text = String(value ?? '');
  if (!text) {
    return '';
  }
  if (/\r?\n\s*\r?\n/.test(text)) {
    return 'Lesson text contains blank lines or paragraph breaks. Clean it before export.';
  }
  if (/\r{2,}|\n{2,}/.test(text)) {
    return 'Lesson text contains repeated newlines. Clean it before export.';
  }
  if (/[\r\n]/.test(text)) {
    return 'Lesson text contains line breaks. Keep it as one continuous paragraph.';
  }
  return '';
}

function cleanLessonTextForCsv(value) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]*\n+[ \t]*/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function baseFileName(fileName) {
  return String(fileName || 'lessons')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '') || 'lessons';
}

function isXlsxFile(file) {
  const name = String(file?.name || '').toLowerCase();
  const type = String(file?.type || '').toLowerCase();
  return name.endsWith('.xlsx')
    || name.endsWith('.xls')
    || type.includes('spreadsheet')
    || type.includes('excel');
}

async function readXlsxRows(file) {
  const XLSX = globalThis.XLSX;
  if (!XLSX?.read || !XLSX?.utils?.sheet_to_json) {
    throw new Error('XLSX support did not load. Check vendor/xlsx.full.min.js.');
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames?.[0];
  if (!firstSheetName) {
    throw new Error('The workbook does not contain any worksheets.');
  }
  const worksheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: false,
    defval: '',
    blankrows: false,
  });
}

function buildColumnMap(headers) {
  const normalizedHeaders = headers.map(normalizeHeader);
  const map = {};
  Object.entries(FIELD_ALIASES).forEach(([field, aliases]) => {
    const aliasSet = new Set(aliases.map(normalizeHeader));
    const columnIndex = normalizedHeaders.findIndex((header) => aliasSet.has(header));
    if (columnIndex >= 0) {
      map[field] = columnIndex;
    }
  });
  return map;
}

function missingFieldNames(columnMap, fields) {
  return fields
    .filter((field) => !Number.isInteger(columnMap[field]))
    .map((field) => FIELD_CANONICAL_HEADERS[field]);
}

function fieldInputMarkup(field, value, options = {}) {
  const inputId = `guidedReview${field[0].toUpperCase()}${field.slice(1)}Input`;
  const label = FIELD_LABELS[field];
  const missingCopy = options.missing
    ? `<p class="muted-copy">Column not found. Saving a non-empty value creates ${escapeHtml(FIELD_CANONICAL_HEADERS[field])}.</p>`
    : '';

  if (field === 'fen') {
    return `
      <div class="field-row">
        <label class="field-label" for="${inputId}">${label}</label>
        <textarea id="${inputId}" class="field-textarea guided-review-fen-input" spellcheck="false" data-guided-field="${field}">${escapeHtml(value)}</textarea>
        ${missingCopy}
      </div>
    `;
  }

  if (field === 'lessonText') {
    return `
      <div class="field-row">
        <div class="guided-review-label-row">
          <label class="field-label" for="${inputId}">${label}</label>
          <button type="button" class="action-button tonal guided-review-small-button" data-action="guided-clean-text">Clean Lesson Text</button>
        </div>
        <textarea id="${inputId}" class="field-textarea guided-review-textarea" data-guided-field="${field}">${escapeHtml(value)}</textarea>
        <p id="guidedTextWarning" class="guided-review-inline-warning">${escapeHtml(lessonTextIssue(value))}</p>
        ${missingCopy}
      </div>
    `;
  }

  if (field === 'status') {
    return `
      <div class="field-row">
        <label class="field-label" for="${inputId}">${label}</label>
        <input id="${inputId}" class="field-input" type="text" list="guidedReviewStatusOptions" value="${escapeAttribute(value)}" data-guided-field="${field}">
        <datalist id="guidedReviewStatusOptions">
          <option value="checked"></option>
          <option value="needs_review"></option>
          <option value="done"></option>
        </datalist>
        ${missingCopy}
      </div>
    `;
  }

  return `
    <div class="field-row">
      <label class="field-label" for="${inputId}">${label}</label>
      <input id="${inputId}" class="field-input" type="text" value="${escapeAttribute(value)}" data-guided-field="${field}">
      ${missingCopy}
    </div>
  `;
}

function bannerMarkup(message, kind = 'warning') {
  if (!message) {
    return '';
  }
  return `
    <div class="banner ${kind}">
      <div>${escapeHtml(message)}</div>
    </div>
  `;
}

function rowStatusLabel(value) {
  return String(value || 'unsaved').trim() || 'unsaved';
}

export function createGuidedReviewController({ host, fileInput, callbacks = {} } = {}) {
  const state = {
    active: false,
    host,
    fileInput,
    headers: [],
    rows: [],
    columnMap: {},
    sourceFileName: '',
    headerSignature: '',
    storageKey: '',
    activeIndex: 0,
    drafts: {},
    message: '',
    messageKind: 'warning',
    fenError: '',
    lastSession: null,
  };

  function rowCount() {
    return state.rows.length;
  }

  function hasRows() {
    return rowCount() > 0;
  }

  function currentDraft() {
    return state.drafts[String(state.activeIndex)] || null;
  }

  function hasDraftForCurrentRow() {
    return Boolean(currentDraft());
  }

  function setDraftField(field, value) {
    const key = String(state.activeIndex);
    const draft = state.drafts[key] || {};
    draft[field] = String(value ?? '');
    state.drafts[key] = draft;
  }

  function clearDraft(index = state.activeIndex) {
    delete state.drafts[String(index)];
  }

  function getSavedFieldValue(rowIndex, field) {
    const columnIndex = state.columnMap[field];
    if (!Number.isInteger(columnIndex)) {
      return '';
    }
    return String(state.rows[rowIndex]?.[columnIndex] ?? '');
  }

  function getFieldValue(rowIndex, field) {
    const draft = state.drafts[String(rowIndex)];
    if (draft && Object.prototype.hasOwnProperty.call(draft, field)) {
      return String(draft[field] ?? '');
    }
    return getSavedFieldValue(rowIndex, field);
  }

  function currentFormValues() {
    const values = {};
    EDITOR_FIELDS.forEach((field) => {
      const input = state.host?.querySelector(`[data-guided-field="${field}"]`);
      values[field] = input ? String(input.value ?? '') : getFieldValue(state.activeIndex, field);
    });
    return values;
  }

  function ensureColumnForField(field) {
    if (Number.isInteger(state.columnMap[field])) {
      return state.columnMap[field];
    }
    state.headers.push(FIELD_CANONICAL_HEADERS[field]);
    state.rows.forEach((row) => {
      row.push('');
    });
    state.columnMap = buildColumnMap(state.headers);
    return state.columnMap[field];
  }

  function saveReviewProgress() {
    if (!hasRows() || !state.storageKey) {
      state.lastSession = parseJsonStorage(LAST_SESSION_STORAGE_KEY);
      return;
    }
    const payload = {
      fileName: state.sourceFileName,
      headerSignature: state.headerSignature,
      activeIndex: state.activeIndex,
      drafts: state.drafts,
      savedAt: new Date().toISOString(),
    };
    writeJsonStorage(state.storageKey, payload);
    writeJsonStorage(LAST_SESSION_STORAGE_KEY, {
      fileName: state.sourceFileName,
      headerSignature: state.headerSignature,
      activeIndex: state.activeIndex,
      savedAt: payload.savedAt,
    });
  }

  function restoreReviewProgress() {
    if (!state.storageKey) {
      state.lastSession = parseJsonStorage(LAST_SESSION_STORAGE_KEY);
      return;
    }
    const payload = parseJsonStorage(state.storageKey);
    if (!payload || payload.headerSignature !== state.headerSignature) {
      return;
    }
    if (Number.isFinite(payload.activeIndex)) {
      state.activeIndex = Math.min(Math.max(0, Math.trunc(payload.activeIndex)), Math.max(0, rowCount() - 1));
    }
    if (payload.drafts && typeof payload.drafts === 'object' && !Array.isArray(payload.drafts)) {
      state.drafts = payload.drafts;
    }
  }

  function closeGuidedReviewMode() {
    saveReviewProgress();
    state.active = false;
    callbacks.setActive?.(false);
  }

  function openGuidedReviewMode() {
    state.active = true;
    callbacks.setActive?.(true);
    restoreReviewProgress();
    renderCurrentLessonRow();
  }

  async function importLessonRows(file) {
    if (!file) {
      return;
    }

    try {
      const rawRows = isXlsxFile(file)
        ? await readXlsxRows(file)
        : parseCsvRows(await file.text());
      const normalized = normalizeTableRows(rawRows);
      state.headers = normalized.headers;
      state.rows = normalized.rows;
      state.columnMap = buildColumnMap(state.headers);
      state.sourceFileName = file.name || 'lessons';
      state.headerSignature = buildHeaderSignature(state.headers);
      state.storageKey = buildStorageKey(state.sourceFileName, state.headerSignature);
      state.activeIndex = 0;
      state.drafts = {};
      state.fenError = '';
      state.message = `Imported ${state.rows.length} row${state.rows.length === 1 ? '' : 's'} from ${state.sourceFileName}.`;
      state.messageKind = 'success';
      restoreReviewProgress();
      saveReviewProgress();
      renderCurrentLessonRow();
      loadCurrentFenToBoard();
    } catch (error) {
      state.message = error?.message || 'Unable to import that file.';
      state.messageKind = 'danger';
      renderCurrentLessonRow();
      callbacks.setStatus?.(state.message);
    }
  }

  function loadCurrentFenToBoard() {
    if (!hasRows()) {
      return { ok: false, error: 'No imported row is active.' };
    }
    const fen = getFieldValue(state.activeIndex, 'fen').trim();
    if (!fen) {
      state.fenError = 'This row has no FEN value.';
      renderCurrentLessonRow();
      return { ok: false, error: state.fenError };
    }
    const result = callbacks.loadFenToBoard?.(fen) || { ok: false, error: 'Board FEN loader is unavailable.' };
    if (!result.ok) {
      state.fenError = result.error || 'Unable to load this row FEN.';
      callbacks.setStatus?.(state.fenError);
      renderCurrentLessonRow();
      return result;
    }
    state.fenError = '';
    callbacks.updateTitle?.(getFieldValue(state.activeIndex, 'title'));
    return result;
  }

  function saveCurrentLessonRow(options = {}) {
    const { status = null, render = true, skipBoardLoad = false, quiet = false } = options;
    if (!hasRows()) {
      state.message = 'Import a CSV or XLSX lesson file before saving.';
      state.messageKind = 'danger';
      if (render) {
        renderCurrentLessonRow();
      }
      return false;
    }

    const values = currentFormValues();
    if (status !== null) {
      values.status = status;
    }

    const row = state.rows[state.activeIndex];
    ['title', 'fen', 'difficulty', 'goalType', 'lessonText'].forEach((field) => {
      const value = values[field] ?? '';
      if (Number.isInteger(state.columnMap[field]) || value !== '') {
        row[ensureColumnForField(field)] = value;
      }
    });

    if (Number.isInteger(state.columnMap.status) || values.status !== '') {
      row[ensureColumnForField('status')] = values.status;
    }

    clearDraft();
    state.message = quiet ? state.message : `Saved row ${state.activeIndex + 1}.`;
    state.messageKind = quiet ? state.messageKind : 'success';
    saveReviewProgress();

    if (!skipBoardLoad) {
      loadCurrentFenToBoard();
    }
    if (render) {
      renderCurrentLessonRow();
    }
    return true;
  }

  function goToRow(index) {
    if (!hasRows()) {
      return;
    }
    const nextIndex = Math.min(Math.max(0, index), rowCount() - 1);
    if (nextIndex === state.activeIndex) {
      return;
    }
    state.activeIndex = nextIndex;
    state.fenError = '';
    state.message = `Loaded row ${state.activeIndex + 1}.`;
    state.messageKind = 'success';
    saveReviewProgress();
    renderCurrentLessonRow();
    loadCurrentFenToBoard();
  }

  function updateLessonTextWarning(value) {
    const warningEl = state.host?.querySelector('#guidedTextWarning');
    if (!warningEl) {
      return;
    }
    warningEl.textContent = lessonTextIssue(value);
  }

  function markStatus(status) {
    const input = state.host?.querySelector('[data-guided-field="status"]');
    if (input) {
      input.value = status;
      setDraftField('status', status);
    }
    saveCurrentLessonRow({ status });
  }

  function exportUpdatedLessons() {
    if (!hasRows()) {
      state.message = 'Import a lesson file before exporting.';
      state.messageKind = 'danger';
      renderCurrentLessonRow();
      return;
    }

    if (hasDraftForCurrentRow()) {
      saveCurrentLessonRow({ render: false, skipBoardLoad: true, quiet: true });
    }

    const lessonTextColumn = state.columnMap.lessonText;
    const unsafeCount = Number.isInteger(lessonTextColumn)
      ? state.rows.filter((row) => lessonTextIssue(row[lessonTextColumn])).length
      : 0;

    const csv = serializeCsv(state.headers, state.rows);
    const fileName = `${baseFileName(state.sourceFileName)}-guided-review-updated.csv`;
    callbacks.downloadText?.(fileName, csv, 'text/csv;charset=utf-8');
    state.message = unsafeCount
      ? `Exported ${fileName}. ${unsafeCount} row${unsafeCount === 1 ? '' : 's'} still contain lesson text line breaks.`
      : `Exported ${fileName}.`;
    state.messageKind = unsafeCount ? 'warning' : 'success';
    callbacks.setStatus?.(state.message);
    saveReviewProgress();
    renderCurrentLessonRow();
  }

  function renderRowNavigator() {
    return `
      <article class="lesson-section guided-review-row-nav">
        <div class="lesson-section-header">
          <div>
            <h3 class="lesson-section-title">Rows</h3>
            <p class="section-copy">Jump to one lesson row at a time.</p>
          </div>
        </div>
        <div class="guided-review-row-list" role="listbox" aria-label="Imported lesson rows">
          ${state.rows.map((_, index) => {
            const title = getFieldValue(index, 'title') || `Row ${index + 1}`;
            const status = getFieldValue(index, 'status');
            const kind = statusKind(status);
            const current = index === state.activeIndex;
            const unsaved = Boolean(state.drafts[String(index)]);
            return `
              <button
                type="button"
                class="guided-review-row-item ${current ? 'is-current' : ''} is-${kind} ${unsaved ? 'has-unsaved-draft' : ''}"
                data-action="guided-select-row"
                data-index="${index}"
                role="option"
                aria-selected="${current ? 'true' : 'false'}"
              >
                <span class="guided-review-row-number">${index + 1}</span>
                <span class="guided-review-row-title">${escapeHtml(title)}</span>
                <span class="guided-review-row-status">${escapeHtml(rowStatusLabel(status))}</span>
              </button>
            `;
          }).join('')}
        </div>
      </article>
    `;
  }

  function renderEmptyState() {
    const last = state.lastSession || parseJsonStorage(LAST_SESSION_STORAGE_KEY);
    const lastMarkup = last?.fileName
      ? bannerMarkup(`Last guided review file: ${last.fileName}, row ${(Number(last.activeIndex) || 0) + 1}. Re-import that file to continue at the saved row.`, 'warning')
      : '';
    state.host.innerHTML = `
      <section class="guided-review-panel-inner">
        <article class="lesson-section">
          <div class="lesson-section-header">
            <div>
              <p class="eyebrow lesson-section-eyebrow">Guided Review</p>
              <h3 class="lesson-section-title">Lesson Row Review</h3>
              <p class="section-copy">Import an existing CSV or XLSX lesson spreadsheet, then review and save one row at a time.</p>
            </div>
            <button type="button" class="action-button tonal" data-action="guided-close">Close</button>
          </div>
          ${bannerMarkup(state.message, state.messageKind)}
          ${lastMarkup}
          <div class="action-row">
            <button type="button" class="action-button primary" data-action="guided-import-file">Import CSV/XLSX</button>
          </div>
        </article>
      </section>
    `;
  }

  function renderCurrentLessonRow() {
    if (!state.host) {
      return;
    }

    if (!hasRows()) {
      renderEmptyState();
      return;
    }

    const rowNumber = state.activeIndex + 1;
    const title = getFieldValue(state.activeIndex, 'title') || `Row ${rowNumber}`;
    const status = getFieldValue(state.activeIndex, 'status');
    const requiredMissing = missingFieldNames(state.columnMap, REQUIRED_FIELDS);
    const optionalMissing = missingFieldNames(state.columnMap, ['title', 'difficulty', 'goalType']);
    const textWarning = lessonTextIssue(getFieldValue(state.activeIndex, 'lessonText'));
    const statusClass = statusKind(status);

    const requiredWarning = requiredMissing.length
      ? `Missing required columns: ${requiredMissing.join(', ')}. The editor stays open, and saving a non-empty field creates the canonical column.`
      : '';
    const optionalWarning = optionalMissing.length
      ? `Optional columns not found: ${optionalMissing.join(', ')}.`
      : '';

    state.host.innerHTML = `
      <section class="guided-review-panel-inner">
        <article class="lesson-section">
          <div class="lesson-section-header">
            <div>
              <p class="eyebrow lesson-section-eyebrow">Guided Review</p>
              <h3 class="lesson-section-title">${escapeHtml(title)}</h3>
              <p class="section-copy">${escapeHtml(state.sourceFileName)} &middot; Row ${rowNumber} of ${rowCount()}</p>
            </div>
            <button type="button" class="action-button tonal" data-action="guided-close">Close</button>
          </div>

          <div class="guided-review-meta-row">
            <span class="pill pill-primary">Row ${rowNumber} / ${rowCount()}</span>
            <span class="guided-review-status-pill is-${statusClass}">${escapeHtml(rowStatusLabel(status))}</span>
            ${hasDraftForCurrentRow() ? '<span class="guided-review-draft-pill">Unsaved draft</span>' : ''}
          </div>

          ${bannerMarkup(state.message, state.messageKind)}
          ${bannerMarkup(requiredWarning, 'danger')}
          ${bannerMarkup(optionalWarning, 'warning')}
          ${bannerMarkup(state.fenError, 'danger')}
          ${bannerMarkup(textWarning, 'warning')}

          <div class="guided-review-editor-grid">
            ${fieldInputMarkup('title', getFieldValue(state.activeIndex, 'title'), { missing: !Number.isInteger(state.columnMap.title) })}
            ${fieldInputMarkup('fen', getFieldValue(state.activeIndex, 'fen'), { missing: !Number.isInteger(state.columnMap.fen) })}
            <div class="two-col guided-review-two-col">
              ${fieldInputMarkup('difficulty', getFieldValue(state.activeIndex, 'difficulty'), { missing: !Number.isInteger(state.columnMap.difficulty) })}
              ${fieldInputMarkup('goalType', getFieldValue(state.activeIndex, 'goalType'), { missing: !Number.isInteger(state.columnMap.goalType) })}
            </div>
            ${fieldInputMarkup('lessonText', getFieldValue(state.activeIndex, 'lessonText'), { missing: !Number.isInteger(state.columnMap.lessonText) })}
            ${fieldInputMarkup('status', getFieldValue(state.activeIndex, 'status'), { missing: !Number.isInteger(state.columnMap.status) })}
          </div>

          <div class="action-row guided-review-actions">
            <button type="button" class="action-button" data-action="guided-prev" ${state.activeIndex === 0 ? 'disabled' : ''}>Previous</button>
            <button type="button" class="action-button" data-action="guided-next" ${state.activeIndex >= rowCount() - 1 ? 'disabled' : ''}>Next</button>
            <button type="button" class="action-button tonal" data-action="guided-save">Save</button>
            <button type="button" class="action-button primary" data-action="guided-save-next" ${state.activeIndex >= rowCount() - 1 ? 'disabled' : ''}>Save &amp; Next</button>
            <button type="button" class="action-button tonal" data-action="guided-mark-done">Mark Done</button>
            <button type="button" class="action-button tonal" data-action="guided-mark-needs-review">Mark Needs Review</button>
            <button type="button" class="action-button" data-action="guided-export">Export Updated File</button>
            <button type="button" class="action-button" data-action="guided-import-file">Import Different File</button>
          </div>
        </article>
        ${renderRowNavigator()}
      </section>
    `;
  }

  function handleInput(event) {
    const field = event.target?.dataset?.guidedField;
    if (!field || !EDITOR_FIELDS.includes(field)) {
      return false;
    }
    setDraftField(field, event.target.value);
    if (field === 'lessonText') {
      updateLessonTextWarning(event.target.value);
    }
    saveReviewProgress();
    return true;
  }

  function handleAction(actionEl) {
    const action = actionEl?.dataset?.action || '';
    if (!action.startsWith('guided-')) {
      return false;
    }

    switch (action) {
      case 'guided-import-file':
        if (state.fileInput) {
          state.fileInput.value = '';
          state.fileInput.click();
        }
        break;
      case 'guided-close':
        closeGuidedReviewMode();
        break;
      case 'guided-prev':
        goToRow(state.activeIndex - 1);
        break;
      case 'guided-next':
        goToRow(state.activeIndex + 1);
        break;
      case 'guided-save':
        saveCurrentLessonRow();
        break;
      case 'guided-save-next':
        if (saveCurrentLessonRow({ render: false })) {
          goToRow(state.activeIndex + 1);
        }
        break;
      case 'guided-mark-done':
        markStatus('done');
        break;
      case 'guided-mark-needs-review':
        markStatus('needs_review');
        break;
      case 'guided-clean-text': {
        const input = state.host?.querySelector('[data-guided-field="lessonText"]');
        if (input) {
          input.value = cleanLessonTextForCsv(input.value);
          setDraftField('lessonText', input.value);
          state.message = 'Cleaned lesson text for this row. Save the row to keep it in the export.';
          state.messageKind = 'success';
          saveReviewProgress();
          renderCurrentLessonRow();
        }
        break;
      }
      case 'guided-export':
        exportUpdatedLessons();
        break;
      case 'guided-select-row':
        goToRow(Number.parseInt(actionEl.dataset.index, 10));
        break;
      default:
        break;
    }

    return true;
  }

  return {
    openGuidedReviewMode,
    importLessonRows,
    renderCurrentLessonRow,
    saveCurrentLessonRow,
    loadCurrentFenToBoard,
    cleanLessonTextForCsv,
    exportUpdatedLessons,
    saveReviewProgress,
    restoreReviewProgress,
    handleAction,
    handleInput,
    closeGuidedReviewMode,
    isActive: () => state.active,
  };
}
