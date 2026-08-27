import { normalizeEditableText } from './text-normalization.mjs';

const STORAGE_PREFIX = 'lesson-position-builder-v1';
const LAST_SET_STORAGE_KEY = `${STORAGE_PREFIX}:last-set`;
const STORAGE_VERSION = 1;

const CANONICAL_COLUMNS = Object.freeze([
  'order', 'id', 'title', 'fen', 'orientation', 'teacher_note', 'is_default',
]);

const FIELD_ALIASES = Object.freeze({
  order: ['order', 'position_order', 'number', 'no'],
  id: ['id', 'position_id', 'slug'],
  title: ['title', 'position_title', 'name'],
  fen: ['fen', 'position_fen'],
  orientation: ['orientation', 'board_orientation'],
  teacherNote: ['teacher_note', 'note', 'instruction'],
  isDefault: ['is_default', 'default', 'initial'],
});

const LEGACY_FIELDS = Object.freeze([
  'difficulty', 'level_tier', 'goal_type', 'lesson_text', 'mode', 'endgame_position', 'status',
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

function isBlankRow(row) {
  return !row || row.every((cell) => String(cell ?? '').trim() === '');
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
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJsonStorage(key, payload) {
  const storage = safeLocalStorage();
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(payload));
  } catch {
    /* storage disabled or full */
  }
}

function removeJsonStorage(key) {
  const storage = safeLocalStorage();
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    /* */
  }
}

function baseFileName(fileName) {
  return String(fileName || 'lesson-positions')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '') || 'lesson-positions';
}

function isXlsxFile(file) {
  const name = String(file?.name || '').toLowerCase();
  const type = String(file?.type || '').toLowerCase();
  return name.endsWith('.xlsx')
    || name.endsWith('.xls')
    || type.includes('spreadsheet')
    || type.includes('excel');
}

let xlsxLoadingPromise = null;
async function ensureXlsxLoaded() {
  const XLSX = globalThis.XLSX;
  if (XLSX?.read && XLSX?.utils?.sheet_to_json && XLSX?.utils?.aoa_to_sheet && XLSX?.writeFile) {
    return XLSX;
  }
  if (xlsxLoadingPromise) {
    return xlsxLoadingPromise;
  }

  xlsxLoadingPromise = new Promise((resolve, reject) => {
    if (typeof document !== 'undefined') {
      const existing = document.querySelector('script[data-vendor="xlsx"]');
      if (existing) {
        existing.addEventListener('load', () => resolve(globalThis.XLSX));
        existing.addEventListener('error', () => {
          xlsxLoadingPromise = null;
          reject(new Error('Failed to load vendor/xlsx.full.min.js'));
        });
        return;
      }
      const script = document.createElement('script');
      script.src = new URL('./vendor/xlsx.full.min.js', import.meta.url).href;
      script.dataset.vendor = 'xlsx';
      script.onload = () => resolve(globalThis.XLSX);
      script.onerror = () => {
        xlsxLoadingPromise = null;
        reject(new Error('Failed to load vendor/xlsx.full.min.js'));
      };
      document.head.appendChild(script);
    } else {
      resolve(globalThis.XLSX);
    }
  });

  return xlsxLoadingPromise;
}

async function readXlsxRows(file) {
  try {
    await ensureXlsxLoaded();
  } catch (err) {
    throw new Error('XLSX support did not load. Check vendor/xlsx.full.min.js.');
  }
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
      inQuotes = true;
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

function slugify(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'untitled';
}

function kebabFromTitle(title) {
  return slugify(title || '');
}

function generateUniqueId(existingIds, baseId) {
  if (!existingIds.has(baseId)) return baseId;
  let counter = 2;
  while (existingIds.has(`${baseId}-${counter}`)) {
    counter += 1;
  }
  return `${baseId}-${counter}`;
}

function equalIgnoreCase(a, b) {
  return String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase();
}

function normalizeDefaultFlag(value) {
  const v = String(value ?? '').trim().toLowerCase();
  return v === 'yes' || v === 'true' || v === '1' || v === 'default';
}

function normalizeOrientation(value) {
  const v = String(value ?? '').trim().toLowerCase();
  return v === 'black' ? 'black' : 'white';
}

function findAliasColumn(headers, aliases) {
  const normalizedHeaders = headers.map(normalizeHeader);
  return aliases
    .map(normalizeHeader)
    .map((alias) => normalizedHeaders.indexOf(alias))
    .find((index) => index >= 0);
}

function buildColumnMap(headers) {
  const map = {};
  Object.entries(FIELD_ALIASES).forEach(([field, aliases]) => {
    const index = findAliasColumn(headers, aliases);
    if (index >= 0) map[field] = index;
  });
  return map;
}

/* ─────────────────────────────────────────────────────────────
 *  Main controller factory
 * ───────────────────────────────────────────────────────────── */

export function createLessonPositionBuilder({ host, fileInput, callbacks = {} } = {}) {
  const state = {
    active: false,
    host,
    fileInput,
    callbacks,
    setName: '',
    sourceFileName: '',
    positions: [],
    selectedPositionId: '',
    message: '',
    messageKind: 'success',
    validationErrors: {},
    importedFromExcel: false,
  };

  /* ── Derived / helpers ─────────────────────────────────── */

  function selectedIndex() {
    if (!state.selectedPositionId) return -1;
    return state.positions.findIndex((p) => p.id === state.selectedPositionId);
  }

  function selectedPosition() {
    const idx = selectedIndex();
    return idx >= 0 ? state.positions[idx] : null;
  }

  function nextOrder() {
    return state.positions.length + 1;
  }

  function allIds() {
    return new Set(state.positions.map((p) => p.id));
  }

  function uniqueIdFromTitle(title) {
    return generateUniqueId(allIds(), kebabFromTitle(title) || 'position');
  }

  function defaultCount() {
    return state.positions.filter((p) => p.isDefault).length;
  }

  function firstPosition() {
    return state.positions.length ? state.positions[0] : null;
  }

  function resolvedDefault() {
    return state.positions.find((p) => p.isDefault) || firstPosition();
  }

  function saveSetKey() {
    return `${STORAGE_PREFIX}:${baseFileName(state.setName || 'untitled')}`;
  }

  /* ── Persistence ───────────────────────────────────────── */

  function saveState() {
    const positions = state.positions.map((p) => ({
      id: p.id,
      title: p.title,
      fen: p.fen,
      orientation: p.orientation,
      teacherNote: p.teacherNote,
      isDefault: p.isDefault,
    }));

    const payload = {
      version: STORAGE_VERSION,
      setName: state.setName,
      sourceFileName: state.sourceFileName,
      selectedPositionId: state.selectedPositionId,
      positions,
      savedAt: new Date().toISOString(),
    };

    const key = saveSetKey();
    writeJsonStorage(key, payload);
    writeJsonStorage(LAST_SET_STORAGE_KEY, {
      key,
      setName: state.setName,
      sourceFileName: state.sourceFileName,
      savedAt: payload.savedAt,
    });
  }

  function restoreState() {
    const lastSet = parseJsonStorage(LAST_SET_STORAGE_KEY);
    if (!lastSet?.key) return false;

    const payload = parseJsonStorage(lastSet.key);
    if (!payload || payload.version !== STORAGE_VERSION) return false;

    if (Array.isArray(payload.positions)) {
      payload.positions.forEach((p) => {
        p.orientation = normalizeOrientation(p.orientation);
        p.isDefault = Boolean(p.isDefault);
        p.teacherNote = String(p.teacherNote ?? '');
      });

      state.positions = payload.positions;
      state.setName = String(payload.setName || '');
      state.sourceFileName = String(payload.sourceFileName || '');
      state.selectedPositionId = String(payload.selectedPositionId ?? '');

      if (state.selectedPositionId && !state.positions.some((p) => p.id === state.selectedPositionId)) {
        state.selectedPositionId = state.positions.length ? state.positions[0].id : '';
      }

      ensureOneDefault();
      saveState();
      return true;
    }
    return false;
  }

  /* ── Validation ────────────────────────────────────────── */

  function validatePositions() {
    const errors = {};
    const ids = new Set();
    const dupes = new Set();
    let hasBlankId = false;
    let hasBlankTitle = false;
    let hasBlankFen = false;
    let hasInvalidFen = false;

    state.positions.forEach((p) => {
      const fieldErrors = [];

      if (!String(p.title ?? '').trim()) {
        fieldErrors.push('Title is required.');
        hasBlankTitle = true;
      }

      if (!String(p.id ?? '').trim()) {
        fieldErrors.push('ID is required.');
        hasBlankId = true;
      } else if (ids.has(p.id)) {
        dupes.add(p.id);
        fieldErrors.push('Duplicate ID.');
      } else {
        ids.add(p.id);
      }

      if (!String(p.fen ?? '').trim()) {
        fieldErrors.push('FEN is required.');
        hasBlankFen = true;
      } else {
        const validation = callbacks.validateFen?.(p.fen);
        if (validation && !validation.ok) {
          fieldErrors.push(validation.error || 'Invalid FEN.');
          hasInvalidFen = true;
        }
      }

      if (fieldErrors.length) {
        errors[p.id] = fieldErrors;
      }
    });

    state.validationErrors = errors;
    return {
      ok: Object.keys(errors).length === 0,
      errors,
      hasBlankId,
      hasBlankTitle,
      hasBlankFen,
      hasInvalidFen,
      duplicateIds: [...dupes],
    };
  }

  function exportable() {
    const validation = validatePositions();
    const hasPositions = state.positions.length > 0;
    const hasDefault = Boolean(resolvedDefault());

    const summary = [];
    if (!hasPositions) summary.push('No positions to export.');
    if (validation.hasBlankTitle) summary.push('One or more positions are missing a title.');
    if (validation.hasBlankId) summary.push('One or more positions are missing an ID.');
    if (validation.duplicateIds.length) {
      summary.push(`Duplicate IDs: ${validation.duplicateIds.join(', ')}.`);
    }
    if (validation.hasBlankFen) summary.push('One or more positions are missing a FEN.');
    if (validation.hasInvalidFen) summary.push('One or more positions have an invalid FEN.');
    if (!hasDefault && hasPositions) summary.push('No default position resolved. Set one default position before export.');

    const ok = hasPositions
      && !validation.hasBlankTitle
      && !validation.hasBlankId
      && validation.duplicateIds.length === 0
      && !validation.hasBlankFen
      && !validation.hasInvalidFen
      && hasDefault;

    return { ok, summary: summary.length ? summary.join(' ') : '' };
  }

  /* ── Internal operations ───────────────────────────────── */

  function ensureOneDefault() {
    if (state.positions.length === 0) return;
    const defaults = state.positions.filter((p) => p.isDefault);
    if (defaults.length === 0) {
      state.positions[0].isDefault = true;
    } else if (defaults.length > 1) {
      defaults.forEach((p, i) => {
        if (i > 0) p.isDefault = false;
      });
    }
  }

  function normalizeFen(fen) {
    return String(fen ?? '').trim().replace(/\s+/g, ' ');
  }

  function selectPosition(id) {
    if (!id || !state.positions.some((p) => p.id === id)) {
      state.selectedPositionId = state.positions.length ? state.positions[0].id : '';
    } else {
      state.selectedPositionId = id;
    }
  }

  function loadPositionOntoBoard(position) {
    if (!position) return { ok: false, error: 'No position selected.' };
    const fen = normalizeFen(position.fen);
    if (!fen) return { ok: false, error: 'Position has no FEN.' };

    const validation = callbacks.validateFen?.(fen);
    if (validation && !validation.ok) {
      return { ok: false, error: validation.error || 'Invalid FEN.' };
    }

    const loadResult = callbacks.loadFenToBoard?.(fen);
    if (!loadResult || !loadResult.ok) {
      return { ok: false, error: loadResult?.error || 'Unable to load position onto board.' };
    }

    callbacks.setBoardOrientation?.(position.orientation);
    return { ok: true, fen };
  }

  function newPositionFromBoard(title) {
    const fen = callbacks.getCurrentFen ? String(callbacks.getCurrentFen() ?? '').trim() : '';
    const validation = callbacks.validateFen?.(fen);
    const validFen = validation?.ok ? normalizeFen(validation.fen ?? fen) : normalizeFen(fen);
    const orientation = callbacks.getBoardOrientation ? callbacks.getBoardOrientation() : 'white';
    const id = uniqueIdFromTitle(title);

    return {
      id,
      title: String(title || `Position ${nextOrder()}`),
      fen: validFen,
      orientation,
      teacherNote: '',
      isDefault: false,
    };
  }

  /* ── CRUD operations ───────────────────────────────────── */

  function addCurrentBoard() {
    const title = `Position ${nextOrder()}`;
    const pos = newPositionFromBoard(title);
    if (state.positions.length === 0) pos.isDefault = true;
    state.positions.push(pos);
    state.selectedPositionId = pos.id;
    state.validationErrors = {};
    state.message = `Added "${pos.title}".`;
    state.messageKind = 'success';
    saveState();
    render();
    return pos;
  }

  function loadSelected() {
    const pos = selectedPosition();
    if (!pos) {
      state.message = 'No position selected.';
      state.messageKind = 'danger';
      render();
      return { ok: false, error: 'No position selected.' };
    }
    const result = loadPositionOntoBoard(pos);
    if (!result.ok) {
      state.message = result.error || 'Failed to load position.';
      state.messageKind = 'danger';
      render();
      return result;
    }
    state.message = `Loaded "${pos.title}".`;
    state.messageKind = 'success';
    render();
    return result;
  }

  function updateFromCurrentBoard() {
    const pos = selectedPosition();
    if (!pos) {
      state.message = 'No position selected.';
      state.messageKind = 'danger';
      render();
      return;
    }

    const fen = callbacks.getCurrentFen ? String(callbacks.getCurrentFen() ?? '').trim() : '';
    const validation = callbacks.validateFen?.(fen);
    pos.fen = validation?.ok ? normalizeFen(validation.fen ?? fen) : normalizeFen(fen);
    pos.orientation = callbacks.getBoardOrientation ? callbacks.getBoardOrientation() : 'white';
    state.validationErrors = {};
    state.message = `Updated "${pos.title}" from board.`;
    state.messageKind = 'success';
    saveState();
    render();
  }

  function duplicate() {
    const pos = selectedPosition();
    if (!pos) {
      state.message = 'No position selected.';
      state.messageKind = 'danger';
      render();
      return;
    }
    const idx = selectedIndex();
    const copy = {
      id: uniqueIdFromTitle(`${pos.title}-copy`),
      title: `${pos.title} Copy`,
      fen: pos.fen,
      orientation: pos.orientation,
      teacherNote: pos.teacherNote,
      isDefault: false,
    };
    state.positions.splice(idx + 1, 0, copy);
    state.selectedPositionId = copy.id;
    state.validationErrors = {};
    state.message = `Duplicated "${pos.title}" as "${copy.title}".`;
    state.messageKind = 'success';
    saveState();
    render();
  }

  function deleteSelected() {
    const pos = selectedPosition();
    if (!pos) {
      state.message = 'No position selected.';
      state.messageKind = 'danger';
      render();
      return;
    }
    if (!confirm(`Delete "${pos.title}"? This cannot be undone.`)) return;

    const idx = selectedIndex();
    const wasDefault = pos.isDefault;
    state.positions.splice(idx, 1);

    if (state.positions.length === 0) {
      state.selectedPositionId = '';
    } else {
      const nextIdx = Math.min(idx, state.positions.length - 1);
      state.selectedPositionId = state.positions[nextIdx].id;
    }

    if (wasDefault) {
      ensureOneDefault();
    }

    state.validationErrors = {};
    state.message = `Deleted "${pos.title}".`;
    state.messageKind = 'success';
    saveState();
    render();
  }

  function moveSelectedUp() {
    const idx = selectedIndex();
    if (idx <= 0) return;
    [state.positions[idx - 1], state.positions[idx]] = [state.positions[idx], state.positions[idx - 1]];
    state.validationErrors = {};
    state.message = `Moved "${state.positions[idx - 1].title}" up.`;
    state.messageKind = 'success';
    saveState();
    render();
  }

  function moveSelectedDown() {
    const idx = selectedIndex();
    if (idx < 0 || idx >= state.positions.length - 1) return;
    [state.positions[idx], state.positions[idx + 1]] = [state.positions[idx + 1], state.positions[idx]];
    state.validationErrors = {};
    state.message = `Moved "${state.positions[idx].title}" down.`;
    state.messageKind = 'success';
    saveState();
    render();
  }

  function setDefault() {
    const pos = selectedPosition();
    if (!pos) {
      state.message = 'No position selected.';
      state.messageKind = 'danger';
      render();
      return;
    }
    state.positions.forEach((p) => { p.isDefault = false; });
    pos.isDefault = true;
    state.validationErrors = {};
    state.message = `"${pos.title}" is now the default.`;
    state.messageKind = 'success';
    saveState();
    render();
  }

  /* ── New Set ───────────────────────────────────────────── */

  function newSet(name) {
    const setName = String(name ?? '').trim() || `lesson-set-${Date.now()}`;
    if (state.positions.length > 0 && !confirm('Replace the current position set with a new empty set?')) return;

    state.positions = [];
    state.selectedPositionId = '';
    state.setName = setName;
    state.sourceFileName = '';
    state.message = `New set "${setName}" created. Add positions to begin.`;
    state.messageKind = 'success';
    state.validationErrors = {};
    state.importedFromExcel = false;
    saveState();
    render();
  }

  /* ── Import ────────────────────────────────────────────── */

  async function importFile(file) {
    if (!file) return;

    try {
      const rawRows = isXlsxFile(file)
        ? await readXlsxRows(file)
        : parseCsvRows(await file.text());

      const imported = parseImportRows(rawRows);
      const warnings = [];
      const errors = [];

      if (imported.warnings.length) {
        warnings.push(...imported.warnings);
      }

      if (imported.positions.length === 0) {
        state.message = 'No valid positions found in the file.';
        state.messageKind = 'danger';
        render();
        return;
      }

      if (state.positions.length > 0 && !confirm(`Import will replace the current set (${state.positions.length} positions). Continue?`)) return;

      state.positions = imported.positions;
      state.setName = baseFileName(file.name);
      state.sourceFileName = file.name;
      state.importedFromExcel = isXlsxFile(file);
      state.validationErrors = {};

      ensureOneDefault();

      if (!imported.defaultFound) {
        const def = resolvedDefault();
        if (def) {
          warnings.push(`No default position was specified. Using "${def.title}" as default.`);
        }
      }
      if (imported.multipleDefaults) {
        warnings.push('Multiple default positions found. Only the first was retained.');
      }
      if (imported.duplicateIds > 0) {
        warnings.push(`${imported.duplicateIds} duplicate ID(s) were renamed to be unique.`);
      }
      if (imported.legacyColumnsFound.length) {
        warnings.push(`Unsupported columns ignored: ${imported.legacyColumnsFound.join(', ')}.`);
      }

      const validPositions = state.positions.filter((p) => {
        const v = callbacks.validateFen?.(p.fen);
        return v && v.ok;
      });

      const messageParts = [`Imported ${state.positions.length} position(s) from ${file.name}.`];
      if (errors.length) messageParts.push(...errors);
      if (warnings.length) messageParts.push(warnings.join(' '));
      state.message = messageParts.join(' ');
      state.messageKind = errors.length ? 'danger' : warnings.length ? 'warning' : 'success';

      state.selectedPositionId = validPositions.length ? validPositions[0].id
        : state.positions.length ? state.positions[0].id : '';

      saveState();
      render();

      if (validPositions.length) {
        const first = state.positions.find((p) => p.id === state.selectedPositionId);
        if (first) {
          loadPositionOntoBoard(first);
        }
      }
    } catch (error) {
      state.message = error?.message || 'Unable to import that file.';
      state.messageKind = 'danger';
      render();
    }
  }

  function parseImportRows(rawRows) {
    const warningMsgs = [];
    if (!rawRows.length || isBlankRow(rawRows[0])) {
      throw new Error('The file does not contain a header row.');
    }

    const maxWidth = Math.max(...rawRows.map((r) => Array.isArray(r) ? r.length : 0), 0);
    const headers = Array.from({ length: maxWidth }, (_, i) => {
      const h = String(rawRows[0]?.[i] ?? '').replace(/^\ufeff/, '').trim();
      return h || `column_${i + 1}`;
    });

    const dataRows = rawRows
      .slice(1)
      .filter((r) => !isBlankRow(r))
      .map((r) => Array.from({ length: headers.length }, (_, i) => String(r?.[i] ?? '')));

    if (!dataRows.length) {
      throw new Error('The file does not contain any data rows.');
    }

    const columnMap = buildColumnMap(headers);

    /* Detect legacy columns */
    const legacyColumnsFound = [];
    LEGACY_FIELDS.forEach((legacy) => {
      const aliases = [legacy, legacy.replace('_', ''), legacy.replace('_', '-')];
      aliases.forEach((alias) => {
        const idx = headers.findIndex((h) => normalizeHeader(h) === alias);
        if (idx >= 0) {
          legacyColumnsFound.push(headers[idx]);
        }
      });
    });

    const positions = [];
    let defaultFound = false;
    let multipleDefaults = false;
    let duplicateIds = 0;
    const usedIds = new Set();

    dataRows.forEach((row) => {
      const getCol = (field) => {
        const idx = columnMap[field];
        return Number.isInteger(idx) ? String(row[idx] ?? '') : '';
      };

      let title = String(getCol('title') ?? '').trim();
      let id = String(getCol('id') ?? '').trim();
      let fen = normalizeFen(getCol('fen'));
      let orientation = normalizeOrientation(getCol('orientation'));
      let teacherNote = String(getCol('teacherNote') ?? '');
      let isDefault = normalizeDefaultFlag(getCol('isDefault'));

      if (!title && !id && !fen && !teacherNote) return;

      if (id && usedIds.has(id)) {
        id = generateUniqueId(usedIds, id);
        duplicateIds += 1;
      }
      if (!id) {
        id = kebabFromTitle(title) || `pos-${positions.length + 1}`;
        id = generateUniqueId(usedIds, id);
      }
      if (!title) {
        title = id;
      }

      usedIds.add(id);

      if (isDefault) {
        if (defaultFound) multipleDefaults = true;
        defaultFound = true;
      }

      positions.push({ id, title, fen, orientation, teacherNote, isDefault });
    });

    /* Try to sort by numeric order */
    const orderIdx = columnMap.order;
    if (Number.isInteger(orderIdx)) {
      positions.sort((a, b) => {
        const oa = parseInt(dataRows[positions.indexOf(a)]?.[orderIdx], 10) || 0;
        const ob = parseInt(dataRows[positions.indexOf(b)]?.[orderIdx], 10) || 0;
        return oa - ob;
      });
    }

    if (multipleDefaults) {
      const firstDefault = positions.findIndex((p) => p.isDefault);
      positions.forEach((p, i) => {
        if (i !== firstDefault) p.isDefault = false;
      });
    }

    return {
      positions,
      warnings: warningMsgs,
      defaultFound,
      multipleDefaults,
      duplicateIds,
      legacyColumnsFound: [...new Set(legacyColumnsFound)],
    };
  }

  /* ── Export ────────────────────────────────────────────── */

  function exportCsv() {
    const check = exportable();
    if (!check.ok) {
      state.message = check.summary || 'Cannot export CSV.';
      state.messageKind = 'danger';
      render();
      return;
    }

    const rows = buildExportRows();
    const csv = serializeCsv(CANONICAL_COLUMNS, rows);
    const fileName = `${baseFileName(state.setName || 'lesson-positions')}.csv`;
    callbacks.downloadText?.(fileName, csv, 'text/csv;charset=utf-8');
    state.message = `Exported ${fileName}.`;
    state.messageKind = 'success';
    render();
  }

  async function exportXlsx() {
    const check = exportable();
    if (!check.ok) {
      state.message = check.summary || 'Cannot export Excel.';
      state.messageKind = 'danger';
      render();
      return;
    }

    try {
      await ensureXlsxLoaded();
    } catch {
      state.message = 'XLSX support did not load. Check vendor/xlsx.full.min.js.';
      state.messageKind = 'danger';
      render();
      return;
    }

    const XLSX = globalThis.XLSX;
    if (!XLSX?.utils?.aoa_to_sheet || !XLSX?.utils?.book_new || !XLSX?.writeFile) {
      state.message = 'XLSX support did not load. Check vendor/xlsx.full.min.js.';
      state.messageKind = 'danger';
      render();
      return;
    }

    const rows = buildExportRows();
    const sheetData = [CANONICAL_COLUMNS, ...rows];
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Positions');
    const fileName = `${baseFileName(state.setName || 'lesson-positions')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    state.message = `Exported ${fileName}.`;
    state.messageKind = 'success';
    render();
  }

  function buildExportRows() {
    return state.positions.map((p, index) => [
      String(index + 1),
      String(p.id),
      String(p.title),
      normalizeFen(p.fen),
      p.orientation === 'black' ? 'black' : 'white',
      String(p.teacherNote ?? ''),
      p.isDefault ? 'yes' : 'no',
    ]);
  }

  /* ── Editing (field changes, immediate persist) ────────── */

  function updateSelectedField(field, value) {
    const pos = selectedPosition();
    if (!pos) return;

    switch (field) {
      case 'title':
        pos.title = String(value ?? '').trim();
        break;
      case 'id': {
        const newId = String(value ?? '').trim();
        if (!newId) break;
        const existing = state.positions.find((p) => p.id === newId && p !== pos);
        if (existing) {
          state.validationErrors[newId] = ['Duplicate ID.'];
          render();
          return;
        }
        delete state.validationErrors[pos.id];
        state.validationErrors = { ...state.validationErrors };
        const oldId = pos.id;
        pos.id = newId;
        state.selectedPositionId = newId;
        break;
      }
      case 'fen':
        pos.fen = normalizeFen(value);
        state.validationErrors = {};
        break;
      case 'orientation':
        pos.orientation = normalizeOrientation(value);
        break;
      case 'teacherNote':
        pos.teacherNote = String(value ?? '');
        break;
      default:
        return;
    }

    saveState();
    render();
  }

  function toggleDefaultFromEditor() {
    const pos = selectedPosition();
    if (!pos) return;
    if (pos.isDefault) return;
    state.positions.forEach((p) => { p.isDefault = false; });
    pos.isDefault = true;
    state.message = `"${pos.title}" set as default.`;
    state.messageKind = 'success';
    state.validationErrors = {};
    saveState();
    render();
  }

  /* ── Open / Close ──────────────────────────────────────── */

  function open() {
    state.active = true;
    callbacks.setActive?.(true);

    if (state.positions.length === 0) {
      restoreState();
    }

    render();
  }

  function close() {
    saveState();
    state.active = false;
    callbacks.setActive?.(false);
  }

  /* ── Rendering ─────────────────────────────────────────── */

  function render() {
    if (!state.host) return;
    if (!state.positions.length && !state.setName) {
      renderEmptyState();
    } else {
      renderBuilder();
    }
  }

  function renderEmptyState() {
    const name = state.setName || 'Untitled Set';
    state.host.innerHTML = `
      <div class="lesson-builder-inner">
        <article class="lesson-section lesson-builder-header">
          <div class="lesson-section-header">
            <div>
              <p class="eyebrow lesson-section-eyebrow">Lesson Position Builder</p>
              <h3 class="lesson-section-title">${escapeHtml(name)}</h3>
              <p class="section-copy">Create an ordered collection of named chess positions.</p>
            </div>
          </div>
          ${bannerMarkup(state.message, state.messageKind)}
          <div class="lesson-builder-field">
            <label class="field-label" for="lessonBuilderSetNameInput">Lesson Set Name</label>
            <input id="lessonBuilderSetNameInput" class="field-input" type="text" value="${escapeAttribute(name)}" data-lb-field="setName">
          </div>
          <div class="action-row lesson-builder-file-actions">
            <button type="button" class="action-button primary" data-action="lesson-builder-new-set">New Position Set</button>
            <button type="button" class="action-button tonal" data-action="lesson-builder-import">Import CSV / Excel</button>
          </div>
        </article>
      </div>
    `;
  }

  function renderBuilder() {
    const check = exportable();
    const sel = selectedPosition();
    const def = resolvedDefault();

    state.host.innerHTML = `
      <div class="lesson-builder-inner">
        <div class="lesson-builder-header">
          <div class="lesson-section-header">
            <div>
              <p class="eyebrow lesson-section-eyebrow">Lesson Position Builder</p>
              <h3 class="lesson-section-title lesson-builder-section-title">${escapeHtml(state.setName || 'Untitled Set')}</h3>
              <p class="section-copy">${state.positions.length} position${state.positions.length === 1 ? '' : 's'}</p>
            </div>
          </div>
          ${bannerMarkup(state.message, state.messageKind)}
          <div class="lesson-builder-field">
            <label class="field-label" for="lessonBuilderSetNameInput">Lesson Set Name</label>
            <input id="lessonBuilderSetNameInput" class="field-input" type="text" value="${escapeAttribute(state.setName)}" data-lb-field="setName">
          </div>
          <div class="action-row lesson-builder-file-actions">
            <button type="button" class="action-button tonal" data-action="lesson-builder-new-set">New Set</button>
            <button type="button" class="action-button tonal" data-action="lesson-builder-import">Import CSV / Excel</button>
            <button type="button" class="action-button tonal" data-action="lesson-builder-export-csv">Download CSV</button>
            <button type="button" class="action-button tonal" data-action="lesson-builder-export-xlsx">Download Excel</button>
          </div>
          ${check.ok ? '' : `<div class="lesson-builder-validation-summary banner warning">${escapeHtml(check.summary)}</div>`}
        </div>

        <div class="lesson-builder-layout">
          <div class="lesson-builder-list-panel">
            <article class="lesson-section">
              <div class="lesson-section-header">
                <h3 class="lesson-section-title">Prepared Positions</h3>
              </div>
              <div class="lesson-builder-position-list" role="listbox" aria-label="Prepared positions">
                ${state.positions.map((p, i) => renderPositionItem(p, i, def)).join('')}
              </div>
              <div class="action-row" style="margin-top: 0.5rem;">
                <button type="button" class="action-button primary" data-action="lesson-builder-add-board">Add Current Board</button>
              </div>
            </article>
          </div>

          <div class="lesson-builder-editor">
            ${sel ? renderEditor(sel, check) : '<p class="muted-copy">Select a position to edit.</p>'}
          </div>
        </div>

        <div class="lesson-builder-actions action-row">
          <button type="button" class="action-button" data-action="lesson-builder-load" ${sel ? '' : 'disabled'}>Load Selected</button>
          <button type="button" class="action-button tonal" data-action="lesson-builder-update" ${sel ? '' : 'disabled'}>Update from Current Board</button>
          <button type="button" class="action-button tonal" data-action="lesson-builder-duplicate" ${sel ? '' : 'disabled'}>Duplicate</button>
          <button type="button" class="action-button danger" data-action="lesson-builder-delete" ${sel ? '' : 'disabled'}>Delete</button>
          <button type="button" class="action-button" data-action="lesson-builder-move-up" ${sel && selectedIndex() > 0 ? '' : 'disabled'}>Move Up</button>
          <button type="button" class="action-button" data-action="lesson-builder-move-down" ${sel && selectedIndex() < state.positions.length - 1 ? '' : 'disabled'}>Move Down</button>
          <button type="button" class="action-button tonal" data-action="lesson-builder-set-default" ${sel && !sel.isDefault ? '' : 'disabled'}>Set as Default</button>
        </div>
      </div>
    `;
  }

  function renderPositionItem(p, index, def) {
    const isDefault = p.isDefault;
    const isSelected = p.id === state.selectedPositionId;
    const errs = state.validationErrors[p.id];
    const hasError = Boolean(errs && errs.length);
    return `
      <button
        type="button"
        class="lesson-builder-position-item ${isSelected ? 'is-selected' : ''} ${hasError ? 'has-error' : ''}"
        data-action="lesson-builder-select"
        data-id="${escapeAttribute(p.id)}"
        role="option"
        aria-selected="${isSelected ? 'true' : 'false'}"
      >
        <span class="lesson-builder-position-number">${index + 1}</span>
        <span class="lesson-builder-position-title">${escapeHtml(p.title)}</span>
        <span class="lesson-builder-position-meta">
          ${p.orientation === 'black' ? 'Black' : 'White'}
          ${isDefault ? '<span class="lesson-builder-default-badge">Default</span>' : ''}
          ${hasError ? '<span class="lesson-builder-error-indicator">Error</span>' : ''}
        </span>
      </button>
    `;
  }

  function renderEditor(pos, check) {
    const errs = state.validationErrors[pos.id];
    const fenValidation = pos.fen ? callbacks.validateFen?.(pos.fen) : null;
    const fenError = fenValidation && !fenValidation.ok ? fenValidation.error : '';

    return `
      <article class="lesson-section">
        <div class="lesson-section-header">
          <h3 class="lesson-section-title">Edit Position</h3>
        </div>
        ${errs && errs.length ? `<div class="banner danger">${errs.map((e) => escapeHtml(e)).join('<br>')}</div>` : ''}
        ${fenError ? `<div class="banner danger">FEN: ${escapeHtml(fenError)}</div>` : ''}

        <div class="lesson-builder-field">
          <label class="field-label" for="lessonBuilderTitleInput">Position Title</label>
          <input id="lessonBuilderTitleInput" class="field-input" type="text" value="${escapeAttribute(pos.title)}" data-lb-field="title">
        </div>

        <div class="lesson-builder-field">
          <label class="field-label" for="lessonBuilderIdInput">Position ID</label>
          <input id="lessonBuilderIdInput" class="field-input" type="text" value="${escapeAttribute(pos.id)}" data-lb-field="id">
        </div>

        <div class="lesson-builder-field">
          <label class="field-label" for="lessonBuilderFenInput">FEN</label>
          <textarea id="lessonBuilderFenInput" class="field-textarea lesson-builder-fen-input" spellcheck="false" data-lb-field="fen">${escapeHtml(pos.fen)}</textarea>
        </div>

        <div class="lesson-builder-field">
          <label class="field-label" for="lessonBuilderOrientationInput">Orientation</label>
          <select id="lessonBuilderOrientationInput" class="field-input" data-lb-field="orientation">
            <option value="white" ${pos.orientation === 'white' ? 'selected' : ''}>White</option>
            <option value="black" ${pos.orientation === 'black' ? 'selected' : ''}>Black</option>
          </select>
        </div>

        <div class="lesson-builder-field">
          <label class="field-label" for="lessonBuilderTeacherNoteInput">Teacher Note</label>
          <textarea id="lessonBuilderTeacherNoteInput" class="field-textarea lesson-builder-note-input" data-lb-field="teacherNote">${escapeHtml(pos.teacherNote)}</textarea>
        </div>

        <div class="lesson-builder-field">
          <label class="field-label">Default Position</label>
          <div>
            <button type="button" class="action-button tonal" data-action="lesson-builder-set-default" ${pos.isDefault ? 'disabled' : ''}>
              ${pos.isDefault ? 'Default' : 'Set as Default'}
            </button>
            ${pos.isDefault ? '<span class="lesson-builder-default-badge" style="margin-left:0.5rem">Default</span>' : ''}
          </div>
        </div>
      </article>
    `;
  }

  function bannerMarkup(message, kind = 'warning') {
    if (!message) return '';
    return `<div class="banner ${kind} lesson-builder-banner"><div>${escapeHtml(String(message))}</div></div>`;
  }

  /* ── Event handlers ────────────────────────────────────── */

  function handleAction(actionEl) {
    const action = actionEl?.dataset?.action || '';
    if (!action.startsWith('lesson-builder-')) return false;

    switch (action) {
      case 'lesson-builder-new-set':
        requestNewSetName();
        break;
      case 'lesson-builder-import':
        if (state.fileInput) {
          state.fileInput.value = '';
          state.fileInput.click();
        }
        break;
      case 'lesson-builder-export-csv':
        exportCsv();
        break;
      case 'lesson-builder-export-xlsx':
        exportXlsx();
        break;
      case 'lesson-builder-add-board':
        addCurrentBoard();
        break;
      case 'lesson-builder-load':
        loadSelected();
        break;
      case 'lesson-builder-update':
        updateFromCurrentBoard();
        break;
      case 'lesson-builder-duplicate':
        duplicate();
        break;
      case 'lesson-builder-delete':
        deleteSelected();
        break;
      case 'lesson-builder-move-up':
        moveSelectedUp();
        break;
      case 'lesson-builder-move-down':
        moveSelectedDown();
        break;
      case 'lesson-builder-set-default':
        setDefault();
        break;
      case 'lesson-builder-select': {
        const id = actionEl.dataset.id;
        if (id && id !== state.selectedPositionId) {
          state.selectedPositionId = id;
          state.validationErrors = {};
          const pos = selectedPosition();
          if (pos) {
            loadPositionOntoBoard(pos);
          }
          state.message = '';
          saveState();
          render();
        }
        break;
      }
      default:
        return false;
    }
    return true;
  }

  function requestNewSetName() {
    const currentName = state.setName || '';
    const name = prompt('Enter a name for the new position set:', currentName);
    if (name === null) return;
    newSet(name.trim() || `lesson-set-${Date.now()}`);
  }

  function updateDomTitle() {
    const el = state.host?.querySelector('.lesson-builder-section-title');
    if (el) el.textContent = state.setName || 'Untitled Set';
  }

  function updateDomBanner(message, kind) {
    const existing = state.host?.querySelector('.lesson-builder-banner');
    if (existing) {
      if (message) {
        existing.textContent = String(message);
        existing.className = `banner lesson-builder-banner ${kind}`;
        existing.hidden = false;
      } else {
        existing.hidden = true;
      }
    }
  }

  function handleInput(event) {
    const field = event.target?.dataset?.lbField;
    if (!field) return false;

    if (field === 'setName') {
      state.setName = String(event.target?.value ?? '').trim();
      saveState();
      updateDomTitle();
      return true;
    }

    /* Editor fields */
    const pos = selectedPosition();
    if (!pos) return false;

    const value = event.target?.value ?? '';

    switch (field) {
      case 'title':
        pos.title = String(value).trim();
        saveState();
        return true;
      case 'id': {
        const newId = String(value).trim();
        if (newId === '' || newId === pos.id) return true;
        const existing = state.positions.find((p) => p.id === newId && p !== pos);
        if (existing) {
          state.validationErrors[newId] = ['Duplicate ID.'];
          state.validationErrors = { ...state.validationErrors };
        } else {
          delete state.validationErrors[pos.id];
          delete state.validationErrors[newId];
          state.validationErrors = { ...state.validationErrors };
          const oldId = pos.id;
          pos.id = newId;
          if (state.selectedPositionId === oldId) state.selectedPositionId = newId;
        }
        saveState();
        return true;
      }
      case 'fen': {
        pos.fen = normalizeFen(value);
        state.validationErrors = {};
        saveState();
        if (value.trim()) {
          const validation = callbacks.validateFen?.(pos.fen);
          if (validation && !validation.ok) {
            state.validationErrors[pos.id] = [validation.error || 'Invalid FEN.'];
          }
        }
        const editorBanner = state.host?.querySelector('.lesson-builder-editor .banner.danger');
        if (editorBanner) {
          editorBanner.hidden = true;
        }
        return true;
      }
      case 'orientation':
        pos.orientation = normalizeOrientation(value);
        saveState();
        return true;
      case 'teacherNote':
        pos.teacherNote = String(value);
        saveState();
        return true;
      default:
        return false;
    }
  }

  /* ── Public API ────────────────────────────────────────── */

  return {
    open,
    close,
    importFile,
    exportCsv,
    exportXlsx,
    newSet,
    addCurrentBoard,
    loadSelected,
    updateFromCurrentBoard,
    duplicate,
    deleteSelected,
    moveSelectedUp,
    moveSelectedDown,
    setDefault,
    saveState,
    restoreState,
    handleAction,
    handleInput,
    isActive: () => state.active,
  };
}
