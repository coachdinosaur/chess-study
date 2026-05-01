const REVIEW_STORAGE_PREFIX = 'guided-lesson-row-review-v1';
const LAST_SESSION_STORAGE_KEY = `${REVIEW_STORAGE_PREFIX}:last-session`;
const AI_CHAT_STORAGE_SUFFIX = ':ai-chat';
const AI_CHAT_ENDPOINT = 'http://localhost:3001/api/lesson-chat';
const AI_SERVER_OFFLINE_MESSAGE = 'Local AI server is not running. Start it with npm run ai-server.';

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
const AI_RESPONSE_FIELDS = Object.freeze([
  'assistant_message',
  'suggested_title',
  'suggested_lesson_text',
  'suggested_difficulty',
  'suggested_goal_type',
  'notes',
  'chess_concerns',
  'csv_warnings',
]);
const AI_SUGGESTION_FIELDS = Object.freeze([
  'suggested_title',
  'suggested_lesson_text',
  'suggested_difficulty',
  'suggested_goal_type',
  'notes',
  'chess_concerns',
  'csv_warnings',
]);
const AI_APPLY_FIELD_MAP = Object.freeze({
  title: ['title', 'suggested_title'],
  lessonText: ['lessonText', 'suggested_lesson_text'],
  difficulty: ['difficulty', 'suggested_difficulty'],
  goalType: ['goalType', 'suggested_goal_type'],
});
const AI_QUICK_ACTIONS = Object.freeze([
  {
    key: 'check',
    label: 'Check Current Lesson',
    message: 'Check the current lesson for clarity, chess accuracy, and CSV safety. Suggest changes if needed.',
  },
  {
    key: 'improve',
    label: 'Improve Current Lesson',
    message: 'Improve the current lesson text, but keep it as one continuous paragraph with no blank lines.',
  },
  {
    key: 'beginner',
    label: 'Make More Beginner-Friendly',
    message: 'Make the current lesson more beginner-friendly while preserving the chess idea.',
  },
  {
    key: 'intermediate',
    label: 'Make More Intermediate',
    message: 'Make the current lesson more suitable for an intermediate player while keeping it concise and accurate.',
  },
  {
    key: 'csv',
    label: 'Clean for CSV',
    message: 'Clean the lesson_text for CSV by removing paragraph breaks and blank lines. Do not deeply rewrite unless necessary.',
  },
  {
    key: 'logic',
    label: 'Check Chess Logic',
    message: 'Check the chess logic of this row against any available Stockfish or tablebase information. Be cautious where analysis is missing.',
  },
  {
    key: 'shorten',
    label: 'Shorten Lesson Text',
    message: 'Shorten the current lesson_text while preserving the key chess idea, notation, and CSV safety.',
  },
]);

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

function normalizeAiMessage(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return null;
  }
  const role = entry.role === 'assistant' ? 'assistant' : 'user';
  const content = String(entry.content ?? '').trim();
  if (!content) {
    return null;
  }
  return {
    role,
    content,
    createdAt: String(entry.createdAt || ''),
  };
}

function createEmptyAiChat() {
  return {
    messages: [],
    suggestion: null,
    loading: false,
    error: '',
    previousResponseId: '',
  };
}

function normalizeAiSuggestion(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }
  const suggestion = {};
  AI_SUGGESTION_FIELDS.forEach((field) => {
    suggestion[field] = String(payload[field] ?? '');
  });
  return AI_SUGGESTION_FIELDS.some((field) => suggestion[field].trim()) ? suggestion : null;
}

function normalizeAiChat(value) {
  const chat = createEmptyAiChat();
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return chat;
  }
  chat.messages = Array.isArray(value.messages)
    ? value.messages.map(normalizeAiMessage).filter(Boolean).slice(-40)
    : [];
  chat.suggestion = normalizeAiSuggestion(value.suggestion);
  chat.error = String(value.error || '');
  chat.previousResponseId = String(value.previousResponseId || '');
  return chat;
}

function normalizeAiResponsePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Invalid AI response format.');
  }
  const normalized = {};
  AI_RESPONSE_FIELDS.forEach((field) => {
    if (typeof payload[field] !== 'string') {
      throw new Error('Invalid AI response format.');
    }
    normalized[field] = payload[field];
  });
  normalized.previous_response_id = String(payload.previous_response_id || '');
  return normalized;
}

function aiSuggestionHasAnyEditableField(suggestion) {
  return Boolean(
    suggestion?.suggested_title?.trim()
    || suggestion?.suggested_lesson_text?.trim()
    || suggestion?.suggested_difficulty?.trim()
    || suggestion?.suggested_goal_type?.trim()
  );
}

function formatAiTimestamp(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

async function readErrorMessage(response) {
  try {
    const payload = await response.json();
    if (payload?.error) {
      return String(payload.error);
    }
  } catch {}
  try {
    const text = await response.text();
    if (text) {
      return text;
    }
  } catch {}
  return `AI request failed (${response.status}).`;
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
    ai: {
      expanded: true,
      includeAnalysis: true,
      chats: {},
    },
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

  function aiChatStorageKey() {
    return state.storageKey ? `${state.storageKey}${AI_CHAT_STORAGE_SUFFIX}` : '';
  }

  function currentAiChat() {
    const key = String(state.activeIndex);
    if (!state.ai.chats[key]) {
      state.ai.chats[key] = createEmptyAiChat();
    }
    return state.ai.chats[key];
  }

  function saveAiChatProgress() {
    const key = aiChatStorageKey();
    if (!key) {
      return;
    }
    const chats = {};
    Object.entries(state.ai.chats).forEach(([rowKey, chat]) => {
      const normalized = normalizeAiChat(chat);
      chats[rowKey] = {
        messages: normalized.messages,
        suggestion: normalized.suggestion,
        previousResponseId: normalized.previousResponseId,
      };
    });
    writeJsonStorage(key, {
      fileName: state.sourceFileName,
      headerSignature: state.headerSignature,
      includeAnalysis: state.ai.includeAnalysis,
      chats,
      savedAt: new Date().toISOString(),
    });
  }

  function restoreAiChatProgress() {
    const key = aiChatStorageKey();
    if (!key) {
      state.ai.chats = {};
      return;
    }
    const payload = parseJsonStorage(key);
    if (!payload || payload.headerSignature !== state.headerSignature) {
      state.ai.chats = {};
      return;
    }
    state.ai.includeAnalysis = payload.includeAnalysis !== false;
    const chats = {};
    if (payload.chats && typeof payload.chats === 'object' && !Array.isArray(payload.chats)) {
      Object.entries(payload.chats).forEach(([rowKey, chat]) => {
        chats[String(rowKey)] = normalizeAiChat(chat);
      });
    }
    state.ai.chats = chats;
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
    saveAiChatProgress();
  }

  function restoreReviewProgress() {
    if (!state.storageKey) {
      state.lastSession = parseJsonStorage(LAST_SESSION_STORAGE_KEY);
      return;
    }
    const payload = parseJsonStorage(state.storageKey);
    if (!payload || payload.headerSignature !== state.headerSignature) {
      restoreAiChatProgress();
      return;
    }
    if (Number.isFinite(payload.activeIndex)) {
      state.activeIndex = Math.min(Math.max(0, Math.trunc(payload.activeIndex)), Math.max(0, rowCount() - 1));
    }
    if (payload.drafts && typeof payload.drafts === 'object' && !Array.isArray(payload.drafts)) {
      state.drafts = payload.drafts;
    }
    restoreAiChatProgress();
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
      state.ai.chats = {};
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

  function buildAiRequestPayload(userMessage, chatHistory, values) {
    const analysisContext = state.ai.includeAnalysis
      ? (callbacks.getAnalysisContext?.(values.fen) || {})
      : {};
    return {
      row_number: state.activeIndex + 1,
      title: values.title,
      fen: values.fen,
      difficulty: values.difficulty,
      goal_type: values.goalType,
      lesson_text: values.lessonText,
      status: values.status,
      side_to_move: analysisContext.side_to_move || '',
      best_move: analysisContext.best_move || '',
      stockfish_summary: analysisContext.stockfish_summary || '',
      tablebase_summary: analysisContext.tablebase_summary || '',
      user_message: userMessage,
      chat_history: chatHistory,
      previous_response_id: currentAiChat().previousResponseId || '',
    };
  }

  async function sendAiMessage(preparedMessage = '') {
    if (!hasRows()) {
      state.message = 'Import a lesson file before using Local AI Lesson Chat.';
      state.messageKind = 'danger';
      renderCurrentLessonRow();
      return;
    }

    const chat = currentAiChat();
    const input = state.host?.querySelector('#guidedAiChatInput');
    const userMessage = String(preparedMessage || input?.value || '').trim();
    if (!userMessage) {
      chat.error = 'Enter a chat message before sending.';
      saveAiChatProgress();
      renderCurrentLessonRow();
      return;
    }

    const values = currentFormValues();
    const chatHistory = chat.messages
      .filter((entry) => entry.role === 'user' || entry.role === 'assistant')
      .map((entry) => ({ role: entry.role, content: entry.content }))
      .slice(-12);

    chat.messages.push({
      role: 'user',
      content: userMessage,
      createdAt: new Date().toISOString(),
    });
    chat.loading = true;
    chat.error = '';
    chat.suggestion = null;
    if (input && !preparedMessage) {
      input.value = '';
    }
    saveAiChatProgress();
    renderCurrentLessonRow();

    try {
      const response = await window.fetch(AI_CHAT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildAiRequestPayload(userMessage, chatHistory, values)),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      const payload = normalizeAiResponsePayload(await response.json());
      chat.messages.push({
        role: 'assistant',
        content: payload.assistant_message,
        createdAt: new Date().toISOString(),
      });
      chat.suggestion = normalizeAiSuggestion(payload);
      chat.previousResponseId = payload.previous_response_id || chat.previousResponseId || '';
      chat.error = '';
    } catch (error) {
      chat.error = error instanceof TypeError
        ? AI_SERVER_OFFLINE_MESSAGE
        : (error?.message || 'Local AI Lesson Chat failed.');
    } finally {
      chat.loading = false;
      saveAiChatProgress();
      renderCurrentLessonRow();
    }
  }

  function clearCurrentAiChat() {
    state.ai.chats[String(state.activeIndex)] = createEmptyAiChat();
    saveAiChatProgress();
    renderCurrentLessonRow();
  }

  function applySuggestionField(field, value) {
    const normalizedValue = field === 'lessonText'
      ? cleanLessonTextForCsv(value)
      : String(value ?? '').trim();
    if (!normalizedValue) {
      return false;
    }
    const input = state.host?.querySelector(`[data-guided-field="${field}"]`);
    if (input) {
      input.value = normalizedValue;
    }
    setDraftField(field, normalizedValue);
    if (field === 'lessonText') {
      updateLessonTextWarning(normalizedValue);
    }
    return true;
  }

  function applyAiSuggestion(kind) {
    const chat = currentAiChat();
    const suggestion = chat.suggestion;
    if (!suggestion) {
      return;
    }

    const fieldsToApply = kind === 'all'
      ? Object.keys(AI_APPLY_FIELD_MAP)
      : [kind].filter((field) => Object.prototype.hasOwnProperty.call(AI_APPLY_FIELD_MAP, field));
    const applied = fieldsToApply.filter((field) => {
      const [draftField, suggestionField] = AI_APPLY_FIELD_MAP[field];
      return applySuggestionField(draftField, suggestion[suggestionField]);
    });

    if (!applied.length) {
      chat.error = 'This suggestion has no value for that field.';
      saveAiChatProgress();
      renderCurrentLessonRow();
      return;
    }

    chat.suggestion = null;
    chat.error = '';
    state.message = `Applied AI suggestion to row ${state.activeIndex + 1}. Save the row to keep it in the export.`;
    state.messageKind = 'success';
    saveReviewProgress();
    renderCurrentLessonRow();
  }

  function rejectAiSuggestion() {
    const chat = currentAiChat();
    chat.suggestion = null;
    chat.error = '';
    saveAiChatProgress();
    renderCurrentLessonRow();
  }

  function renderAiSuggestionField(label, value) {
    const text = String(value || '').trim();
    if (!text) {
      return '';
    }
    return `
      <div class="guided-ai-suggestion-field">
        <span class="guided-ai-suggestion-label">${escapeHtml(label)}</span>
        <div class="guided-ai-suggestion-text">${escapeHtml(text)}</div>
      </div>
    `;
  }

  function renderAiSuggestionMarkup(chat) {
    const suggestion = chat.suggestion;
    if (!suggestion) {
      return '';
    }
    const editable = aiSuggestionHasAnyEditableField(suggestion);
    return `
      <div class="guided-ai-suggestion">
        <div class="guided-ai-suggestion-head">
          <h4 class="lesson-subtitle">Suggestion Preview</h4>
          <button type="button" class="action-button danger guided-review-small-button" data-action="guided-ai-reject">Reject Suggestion</button>
        </div>
        <div class="guided-ai-suggestion-grid">
          ${renderAiSuggestionField('Suggested Title', suggestion.suggested_title)}
          ${renderAiSuggestionField('Suggested Lesson Text', suggestion.suggested_lesson_text)}
          ${renderAiSuggestionField('Suggested Difficulty', suggestion.suggested_difficulty)}
          ${renderAiSuggestionField('Suggested Goal Type', suggestion.suggested_goal_type)}
          ${renderAiSuggestionField('Notes', suggestion.notes)}
          ${renderAiSuggestionField('Chess Concerns', suggestion.chess_concerns)}
          ${renderAiSuggestionField('CSV Warnings', suggestion.csv_warnings)}
        </div>
        ${editable ? `
          <div class="action-row action-row-compact guided-ai-apply-row">
            <button type="button" class="action-button tonal guided-review-small-button" data-action="guided-ai-apply" data-apply="title">Apply Title Only</button>
            <button type="button" class="action-button tonal guided-review-small-button" data-action="guided-ai-apply" data-apply="lessonText">Apply Lesson Text Only</button>
            <button type="button" class="action-button tonal guided-review-small-button" data-action="guided-ai-apply" data-apply="difficulty">Apply Difficulty Only</button>
            <button type="button" class="action-button tonal guided-review-small-button" data-action="guided-ai-apply" data-apply="goalType">Apply Goal Type Only</button>
            <button type="button" class="action-button primary guided-review-small-button" data-action="guided-ai-apply" data-apply="all">Apply All Suggested Changes</button>
          </div>
        ` : ''}
      </div>
    `;
  }

  function renderAiChatPanel() {
    const chat = currentAiChat();
    const rowNumber = state.activeIndex + 1;
    const quickActions = AI_QUICK_ACTIONS.map((action) => `
      <button
        type="button"
        class="action-button tonal guided-review-small-button"
        data-action="guided-ai-quick"
        data-prompt="${escapeAttribute(action.message)}"
        ${chat.loading ? 'disabled' : ''}
      >${escapeHtml(action.label)}</button>
    `).join('');
    const messageMarkup = chat.messages.length
      ? chat.messages.map((message) => {
          const time = formatAiTimestamp(message.createdAt);
          return `
            <div class="guided-ai-message is-${message.role}">
              <div class="guided-ai-message-meta">${escapeHtml(message.role === 'assistant' ? 'AI' : 'You')}${time ? ` &middot; ${escapeHtml(time)}` : ''}</div>
              <div class="guided-ai-message-body">${escapeHtml(message.content)}</div>
            </div>
          `;
        }).join('')
      : '<p class="muted-copy guided-ai-empty">No messages for this row yet.</p>';

    return `
      <article class="lesson-section guided-ai-chat">
        <div class="lesson-section-header">
          <div>
            <h3 class="lesson-section-title">Local AI Lesson Chat</h3>
            <p class="section-copy">Row ${rowNumber} only</p>
          </div>
          <button type="button" class="action-button tonal" data-action="guided-ai-toggle">${state.ai.expanded ? 'Hide' : 'Open'}</button>
        </div>

        ${state.ai.expanded ? `
          ${chat.error ? bannerMarkup(chat.error, 'danger') : ''}
          <div class="action-row action-row-compact guided-ai-quick-actions">
            ${quickActions}
          </div>
          <div class="guided-ai-message-list" aria-live="polite">
            ${messageMarkup}
            ${chat.loading ? `
              <div class="guided-ai-message is-assistant is-loading">
                <div class="guided-ai-message-meta">AI</div>
                <div class="guided-ai-message-body">Thinking...</div>
              </div>
            ` : ''}
          </div>
          ${renderAiSuggestionMarkup(chat)}
          <div class="guided-ai-compose">
            <label class="field-label" for="guidedAiChatInput">Message</label>
            <textarea id="guidedAiChatInput" class="field-textarea guided-ai-input" ${chat.loading ? 'disabled' : ''}></textarea>
            <div class="guided-ai-compose-footer">
              <label class="checkbox-chip guided-ai-checkbox">
                <input type="checkbox" data-guided-ai-input="include-analysis" ${state.ai.includeAnalysis ? 'checked' : ''}>
                <span>Include Stockfish/Tablebase Info</span>
              </label>
              <div class="action-row action-row-compact">
                <button type="button" class="action-button tonal" data-action="guided-ai-clear" ${chat.loading ? 'disabled' : ''}>Clear Chat</button>
                <button type="button" class="action-button primary" data-action="guided-ai-send" ${chat.loading ? 'disabled' : ''}>Send</button>
              </div>
            </div>
          </div>
        ` : ''}
      </article>
    `;
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
        ${renderAiChatPanel()}
        ${renderRowNavigator()}
      </section>
    `;
  }

  function handleInput(event) {
    const field = event.target?.dataset?.guidedField;
    if (field && EDITOR_FIELDS.includes(field)) {
      setDraftField(field, event.target.value);
      if (field === 'lessonText') {
        updateLessonTextWarning(event.target.value);
      }
      saveReviewProgress();
      return true;
    }

    const aiInput = event.target?.dataset?.guidedAiInput;
    if (aiInput === 'include-analysis') {
      state.ai.includeAnalysis = Boolean(event.target.checked);
      saveAiChatProgress();
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
      case 'guided-ai-toggle':
        state.ai.expanded = !state.ai.expanded;
        saveAiChatProgress();
        renderCurrentLessonRow();
        break;
      case 'guided-ai-send':
        void sendAiMessage();
        break;
      case 'guided-ai-quick':
        void sendAiMessage(actionEl.dataset.prompt || '');
        break;
      case 'guided-ai-clear':
        clearCurrentAiChat();
        break;
      case 'guided-ai-apply':
        applyAiSuggestion(actionEl.dataset.apply || '');
        break;
      case 'guided-ai-reject':
        rejectAiSuggestion();
        break;
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
