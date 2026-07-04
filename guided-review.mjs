import { normalizeEditableText } from './text-normalization.mjs';

const REVIEW_STORAGE_PREFIX = 'guided-lesson-row-review-v1';
const REVIEW_DATA_STORAGE_SUFFIX = ':data';
const LAST_SESSION_STORAGE_KEY = `${REVIEW_STORAGE_PREFIX}:last-session`;

const FIELD_ALIASES = Object.freeze({
  title: ['title', 'lesson_title', 'name'],
  fen: ['fen'],
  difficulty: ['level_tier', 'difficulty', 'level'],
  goalType: ['goal_type', 'goal', 'objective'],
  lessonText: ['lesson_text', 'text', 'description'],
  mode: ['mode'],
  endgamePosition: ['endgame_position'],
  status: ['status', 'review_status'],
});

const FIELD_CANONICAL_HEADERS = Object.freeze({
  title: 'title',
  fen: 'fen',
  difficulty: 'level_tier',
  goalType: 'goal_type',
  lessonText: 'lesson_text',
  mode: 'mode',
  endgamePosition: 'endgame_position',
  status: 'status',
});

const FIELD_LABELS = Object.freeze({
  title: 'Title',
  fen: 'FEN',
  difficulty: 'Difficulty',
  goalType: 'Goal type',
  lessonText: 'Lesson text',
  mode: 'Mode',
  endgamePosition: 'Endgame position',
  status: 'Status',
});

const REQUIRED_FIELDS = Object.freeze(['fen']);
const DEFAULT_EDITOR_FIELDS = Object.freeze(['title', 'fen', 'difficulty', 'goalType', 'lessonText', 'status']);
const ALTERNATE_EDITOR_FIELDS = Object.freeze(['title', 'fen', 'difficulty', 'mode', 'endgamePosition', 'status']);

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

function normalizeTextControlValue(control) {
  const originalValue = String(control?.value ?? '');
  const normalizedValue = normalizeEditableText(originalValue);
  if (!control || normalizedValue === originalValue) {
    return normalizedValue;
  }

  const selectionStart = control.selectionStart;
  const selectionEnd = control.selectionEnd;
  control.value = normalizedValue;
  if (
    document.activeElement === control
    && typeof control.setSelectionRange === 'function'
    && Number.isInteger(selectionStart)
    && Number.isInteger(selectionEnd)
  ) {
    control.setSelectionRange(
      Math.min(selectionStart, normalizedValue.length),
      Math.min(selectionEnd, normalizedValue.length),
    );
  }
  return normalizedValue;
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
    const original = normalizeEditableText(rows[0]?.[index]).replace(/^\ufeff/, '').trim();
    return original || `column_${index + 1}`;
  });

  const dataRows = rows
    .slice(1)
    .filter((row) => !isBlankRow(row))
    .map((row) => Array.from({ length: headers.length }, (_, index) => normalizeEditableText(row?.[index])));

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
  const text = normalizeEditableText(value);
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
  const text = normalizeEditableText(value);
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
  return normalizeEditableText(value)
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
    const columnIndex = aliases
      .map(normalizeHeader)
      .map((alias) => normalizedHeaders.findIndex((header) => header === alias))
      .find((index) => index >= 0);
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

function usesAlternatePatternFields(columnMap) {
  return !Number.isInteger(columnMap.goalType) && !Number.isInteger(columnMap.lessonText);
}

function editorFieldsForColumnMap(columnMap) {
  return usesAlternatePatternFields(columnMap) ? ALTERNATE_EDITOR_FIELDS : DEFAULT_EDITOR_FIELDS;
}

function visiblePatternFieldsForColumnMap(columnMap) {
  return usesAlternatePatternFields(columnMap)
    ? ['mode', 'endgamePosition']
    : ['goalType', 'lessonText'];
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

  if (field === 'endgamePosition') {
    return `
      <div class="field-row">
        <label class="field-label" for="${inputId}">${label}</label>
        <input id="${inputId}" class="field-input" type="text" list="guidedReviewEndgamePositionOptions" value="${escapeAttribute(value)}" data-guided-field="${field}">
        <datalist id="guidedReviewEndgamePositionOptions">
          <option value="yes"></option>
          <option value="no"></option>
        </datalist>
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
  return normalizeEditableText(value || '').trim() || '\u2014';
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
    fileHandle: null,
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
    draft[field] = normalizeEditableText(value);
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
    return normalizeEditableText(state.rows[rowIndex]?.[columnIndex]);
  }

  function getFieldValue(rowIndex, field) {
    const draft = state.drafts[String(rowIndex)];
    if (draft && Object.prototype.hasOwnProperty.call(draft, field)) {
      return normalizeEditableText(draft[field]);
    }
    return getSavedFieldValue(rowIndex, field);
  }

  function currentFormValues() {
    const values = {};
    editorFieldsForColumnMap(state.columnMap).forEach((field) => {
      const input = state.host?.querySelector(`[data-guided-field="${field}"]`);
      values[field] = input ? normalizeTextControlValue(input) : getFieldValue(state.activeIndex, field);
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
      storageKey: state.storageKey,
      fileName: state.sourceFileName,
      headerSignature: state.headerSignature,
      activeIndex: state.activeIndex,
      savedAt: payload.savedAt,
    });
    writeJsonStorage(`${state.storageKey}${REVIEW_DATA_STORAGE_SUFFIX}`, {
      headerSignature: state.headerSignature,
      headers: state.headers,
      rows: state.rows,
      sourceFileName: state.sourceFileName,
      savedAt: new Date().toISOString(),
    });
  }

  function restoreReviewProgress() {
    if (!state.storageKey) {
      state.lastSession = parseJsonStorage(LAST_SESSION_STORAGE_KEY);
      return;
    }
    const savedData = parseJsonStorage(`${state.storageKey}${REVIEW_DATA_STORAGE_SUFFIX}`);
    if (savedData && savedData.headerSignature === state.headerSignature) {
      if (Array.isArray(savedData.rows) && savedData.rows.length) {
        state.rows = savedData.rows;
      }
      if (Array.isArray(savedData.headers) && savedData.headers.length) {
        state.headers = savedData.headers;
      }
      if (savedData.sourceFileName) {
        state.sourceFileName = savedData.sourceFileName;
      }
      state.columnMap = buildColumnMap(state.headers);
    }
    const payload = parseJsonStorage(state.storageKey);
    if (!payload || payload.headerSignature !== state.headerSignature) {
      return;
    }
    if (Number.isFinite(payload.activeIndex)) {
      state.activeIndex = Math.min(Math.max(0, Math.trunc(payload.activeIndex)), Math.max(0, rowCount() - 1));
    }
    if (payload.drafts && typeof payload.drafts === 'object' && !Array.isArray(payload.drafts)) {
      state.drafts = Object.fromEntries(
        Object.entries(payload.drafts)
          .filter((entry) => entry[1] && typeof entry[1] === 'object' && !Array.isArray(entry[1]))
          .map(([rowKey, draft]) => [
            String(rowKey),
            Object.fromEntries(
              Object.entries(draft).map(([field, value]) => [field, normalizeEditableText(value)]),
            ),
          ]),
      );
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

    if (!hasRows() && !state.storageKey) {
      const last = state.lastSession || parseJsonStorage(LAST_SESSION_STORAGE_KEY);
      if (last?.storageKey) {
        const savedData = parseJsonStorage(`${last.storageKey}${REVIEW_DATA_STORAGE_SUFFIX}`);
        if (savedData?.headerSignature === last.headerSignature) {
          state.storageKey = last.storageKey;
          state.sourceFileName = savedData.sourceFileName || last.fileName || 'lessons';
          state.headerSignature = savedData.headerSignature;
          state.rows = savedData.rows || [];
          state.headers = savedData.headers || [];
          state.columnMap = buildColumnMap(state.headers);
          state.activeIndex = Math.min(Math.max(0, Number(last.activeIndex) || 0), Math.max(0, state.rows.length - 1));
          state.message = `Restored ${state.rows.length} row${state.rows.length === 1 ? '' : 's'} from ${state.sourceFileName}.`;
          state.messageKind = 'success';
        }
      }
    }

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

  function initializeBlankLessonSet() {
    const defaultHeaders = DEFAULT_EDITOR_FIELDS.map((field) => FIELD_CANONICAL_HEADERS[field]);
    const blankRow = defaultHeaders.map(() => '');
    state.headers = defaultHeaders;
    state.rows = [blankRow];
    state.columnMap = buildColumnMap(state.headers);
    state.sourceFileName = 'new-lessons';
    state.headerSignature = buildHeaderSignature(state.headers);
    state.storageKey = buildStorageKey(state.sourceFileName, state.headerSignature);
    state.activeIndex = 0;
    state.drafts = {};
    state.fenError = '';
    state.message = 'Created a new blank lesson set. Fill in the first row and save.';
    state.messageKind = 'success';
    state.fileHandle = null;
    saveReviewProgress();
    renderCurrentLessonRow();
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
    editorFieldsForColumnMap(state.columnMap).forEach((field) => {
      if (field === 'status') {
        return;
      }
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

  function addNewLessonRow() {
    const blankRow = state.headers.map(() => '');
    state.rows.push(blankRow);
    state.activeIndex = state.rows.length - 1;
    delete state.drafts[String(state.activeIndex)];
    state.fenError = '';
    state.message = `Added new row ${state.activeIndex + 1}. Fill in the fields and save.`;
    state.messageKind = 'success';
    saveReviewProgress();
    renderCurrentLessonRow();
  }

  function deleteCurrentLessonRow() {
    if (!hasRows()) {
      return;
    }
    if (rowCount() <= 1) {
      state.message = 'Cannot delete the only remaining row.';
      state.messageKind = 'danger';
      renderCurrentLessonRow();
      return;
    }
    const title = getFieldValue(state.activeIndex, 'title') || `Row ${state.activeIndex + 1}`;
    if (!confirm(`Delete "${title}" (row ${state.activeIndex + 1})? This cannot be undone.`)) {
      return;
    }
    state.rows.splice(state.activeIndex, 1);
    if (state.activeIndex >= rowCount()) {
      state.activeIndex = rowCount() - 1;
    }
    const newDrafts = {};
    Object.entries(state.drafts).forEach(([key, value]) => {
      const numKey = Number(key);
      if (numKey === state.activeIndex || numKey === state.activeIndex + 1) {
        return;
      }
      newDrafts[numKey > state.activeIndex + 1 ? String(numKey - 1) : key] = value;
    });
    state.drafts = newDrafts;
    state.fenError = '';
    state.message = `Deleted row ${state.activeIndex + 1}.`;
    state.messageKind = 'success';
    saveReviewProgress();
    renderCurrentLessonRow();
    loadCurrentFenToBoard();
  }

  function moveRowUp() {
    if (!hasRows() || state.activeIndex <= 0) {
      return;
    }
    if (hasDraftForCurrentRow()) {
      saveCurrentLessonRow({ render: false, skipBoardLoad: true, quiet: true });
    }
    const prev = state.activeIndex - 1;
    [state.rows[prev], state.rows[state.activeIndex]] = [state.rows[state.activeIndex], state.rows[prev]];
    const prevDraft = state.drafts[String(prev)];
    state.drafts[String(prev)] = state.drafts[String(state.activeIndex)];
    state.drafts[String(state.activeIndex)] = prevDraft;
    state.activeIndex = prev;
    state.message = `Moved row up.`;
    state.messageKind = 'success';
    saveReviewProgress();
    renderCurrentLessonRow();
    loadCurrentFenToBoard();
  }

  function moveRowDown() {
    if (!hasRows() || state.activeIndex >= rowCount() - 1) {
      return;
    }
    if (hasDraftForCurrentRow()) {
      saveCurrentLessonRow({ render: false, skipBoardLoad: true, quiet: true });
    }
    const next = state.activeIndex + 1;
    [state.rows[next], state.rows[state.activeIndex]] = [state.rows[state.activeIndex], state.rows[next]];
    const nextDraft = state.drafts[String(next)];
    state.drafts[String(next)] = state.drafts[String(state.activeIndex)];
    state.drafts[String(state.activeIndex)] = nextDraft;
    state.activeIndex = next;
    state.message = `Moved row down.`;
    state.messageKind = 'success';
    saveReviewProgress();
    renderCurrentLessonRow();
    loadCurrentFenToBoard();
  }

  async function saveToOriginalFile() {
    if (!hasRows()) {
      state.message = 'No rows to save.';
      state.messageKind = 'danger';
      renderCurrentLessonRow();
      return;
    }

    if (hasDraftForCurrentRow()) {
      saveCurrentLessonRow({ render: false, skipBoardLoad: true, quiet: true });
    }

    const csv = serializeCsv(state.headers, state.rows);
    const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' });

    if (state.fileHandle) {
      try {
        const writable = await state.fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        state.message = `Saved ${state.sourceFileName}.`;
        state.messageKind = 'success';
        renderCurrentLessonRow();
        saveReviewProgress();
        return;
      } catch {
        // Permission expired or other error — fall through to prompt
      }
    }

    try {
      const suggestedName = `${baseFileName(state.sourceFileName)}.csv`;
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: [{ description: 'CSV', accept: { 'text/csv': ['.csv'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      state.fileHandle = handle;
      state.sourceFileName = handle.name;
      state.headerSignature = buildHeaderSignature(state.headers);
      state.storageKey = buildStorageKey(state.sourceFileName, state.headerSignature);
      state.message = `Saved ${handle.name}.`;
      state.messageKind = 'success';
      renderCurrentLessonRow();
      saveReviewProgress();
    } catch {
      // User cancelled the save dialog
    }
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

    const lessonTextColumn = editorFieldsForColumnMap(state.columnMap).includes('lessonText')
      ? state.columnMap.lessonText
      : null;
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
              <p class="section-copy">Import an existing CSV or XLSX lesson spreadsheet, or start a blank lesson set from scratch.</p>
            </div>
            <button type="button" class="action-button tonal" data-action="guided-close">Close</button>
          </div>
          ${bannerMarkup(state.message, state.messageKind)}
          ${lastMarkup}
          <div class="action-row">
            <button type="button" class="action-button primary" data-action="guided-import-file">Import CSV/XLSX</button>
            <button type="button" class="action-button tonal" data-action="guided-start-blank">Start Blank</button>
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
    const visiblePatternFields = visiblePatternFieldsForColumnMap(state.columnMap);
    const optionalMissing = missingFieldNames(
      state.columnMap,
      ['title', 'difficulty', ...visiblePatternFields],
    );
    const textWarning = visiblePatternFields.includes('lessonText')
      ? lessonTextIssue(getFieldValue(state.activeIndex, 'lessonText'))
      : '';
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
              ${fieldInputMarkup(
                visiblePatternFields[0],
                getFieldValue(state.activeIndex, visiblePatternFields[0]),
                { missing: !Number.isInteger(state.columnMap[visiblePatternFields[0]]) },
              )}
            </div>
            ${fieldInputMarkup(
              visiblePatternFields[1],
              getFieldValue(state.activeIndex, visiblePatternFields[1]),
              { missing: !Number.isInteger(state.columnMap[visiblePatternFields[1]]) },
            )}
            ${fieldInputMarkup('status', getFieldValue(state.activeIndex, 'status'), { missing: !Number.isInteger(state.columnMap.status) })}
          </div>

          <div class="action-row guided-review-actions">
            <button type="button" class="action-button" data-action="guided-prev" ${state.activeIndex === 0 ? 'disabled' : ''}>Previous</button>
            <button type="button" class="action-button" data-action="guided-next" ${state.activeIndex >= rowCount() - 1 ? 'disabled' : ''}>Next</button>
            <button type="button" class="action-button tonal" data-action="guided-save">Save</button>
            <button type="button" class="action-button primary" data-action="guided-save-next" ${state.activeIndex >= rowCount() - 1 ? 'disabled' : ''}>Save &amp; Next</button>
            <button type="button" class="action-button tonal" data-action="guided-mark-done">Mark Done</button>
            <button type="button" class="action-button tonal" data-action="guided-mark-needs-review">Mark Needs Review</button>
            <button type="button" class="action-button tonal" data-action="guided-add-row">Add Row</button>
            <button type="button" class="action-button tonal" data-action="guided-delete-row">Delete Row</button>
            <button type="button" class="action-button" data-action="guided-move-up" ${state.activeIndex === 0 ? 'disabled' : ''}>Move Up</button>
            <button type="button" class="action-button" data-action="guided-move-down" ${state.activeIndex >= rowCount() - 1 ? 'disabled' : ''}>Move Down</button>
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
    if (field && editorFieldsForColumnMap(state.columnMap).includes(field)) {
      const value = normalizeTextControlValue(event.target);
      setDraftField(field, value);
      if (field === 'lessonText') {
        updateLessonTextWarning(value);
      }
      saveReviewProgress();
      return true;
    }

    return false;
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
        saveToOriginalFile();
        break;
      case 'guided-save-next':
        saveToOriginalFile().then(() => {
          if (state.activeIndex < rowCount() - 1) {
            goToRow(state.activeIndex + 1);
          }
        });
        break;
      case 'guided-mark-done':
        markStatus('done');
        break;
      case 'guided-mark-needs-review':
        markStatus('needs_review');
        break;
      case 'guided-start-blank':
        initializeBlankLessonSet();
        break;
      case 'guided-add-row':
        addNewLessonRow();
        break;
      case 'guided-delete-row':
        deleteCurrentLessonRow();
        break;
      case 'guided-move-up':
        moveRowUp();
        break;
      case 'guided-move-down':
        moveRowDown();
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
    addNewLessonRow,
    deleteCurrentLessonRow,
    moveRowUp,
    moveRowDown,
    saveToOriginalFile,
    initializeBlankLessonSet,
    isActive: () => state.active,
  };
}
