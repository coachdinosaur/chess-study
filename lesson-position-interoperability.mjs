import {
  appendPositionsToAppDraft,
  enrichPositionSet,
  metadataRowsFromTable,
  parseCsvRows,
  spreadsheetMatrixForPositionSet,
} from './lesson-position-interoperability-core.mjs';

const APP_DRAFT_KEY = 'setup-analysis-draft-v1';
const BUILDER_LAST_SET_KEY = 'lesson-position-builder-v1:last-set';
const METADATA_STORAGE_KEY = 'lesson-position-interoperability-v1';
const RELOAD_STATUS_KEY = 'lesson-position-interoperability-status-v1';

const root = document.documentElement;
const disabledForEmbed = root.dataset.embed === '1' || root.dataset.boardOnly === '1';

function safeStorage(kind = 'local') {
  try {
    return kind === 'session' ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

function readJson(key, fallback = null, kind = 'local') {
  const storage = safeStorage(kind);
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value, kind = 'local') {
  const storage = safeStorage(kind);
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function currentBuilderContext() {
  const last = readJson(BUILDER_LAST_SET_KEY);
  const key = String(last?.key || '');
  const payload = key ? readJson(key) : null;
  if (!key || !payload || !Array.isArray(payload.positions)) {
    return null;
  }
  return { key, payload };
}

function metadataStore() {
  const value = readJson(METADATA_STORAGE_KEY, {});
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { version: 1, sets: { ...(value.sets || {}) } }
    : { version: 1, sets: {} };
}

function metadataForContext(context) {
  const store = metadataStore();
  return {
    store,
    set: {
      positions: {
        ...(store.sets?.[context?.key]?.positions || {}),
      },
    },
  };
}

function savePositionMetadata(positionId, patch) {
  const context = currentBuilderContext();
  if (!context || !positionId) return;
  const { store, set } = metadataForContext(context);
  const current = set.positions[positionId] || {};
  set.positions[positionId] = {
    ...current,
    ...patch,
  };
  store.sets[context.key] = set;
  writeJson(METADATA_STORAGE_KEY, store);
}

function combinedPositions(context = currentBuilderContext()) {
  if (!context) return [];
  const { set } = metadataForContext(context);
  return enrichPositionSet(context.payload.positions, set.positions);
}

function selectedPosition(context = currentBuilderContext()) {
  if (!context) return null;
  const positions = combinedPositions(context);
  return positions.find((position) => position.id === context.payload.selectedPositionId)
    || positions[0]
    || null;
}

function escapeCsv(value) {
  const text = String(value ?? '');
  const escaped = text.replace(/"/g, '""');
  return /[",\r\n]/.test(text) ? `"${escaped}"` : escaped;
}

function downloadBlob(fileName, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function baseFileName(value) {
  return String(value || 'position-set')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '') || 'position-set';
}

function exportEnhancedCsv() {
  const context = currentBuilderContext();
  if (!context || context.payload.positions.length === 0) {
    showStatus('No positions are available to export.', 'danger');
    return;
  }
  const matrix = spreadsheetMatrixForPositionSet(
    context.payload.positions,
    metadataForContext(context).set.positions,
  );
  const csv = matrix.map((row) => row.map(escapeCsv).join(',')).join('\r\n');
  const fileName = `${baseFileName(context.payload.setName || 'position-set')}.csv`;
  downloadBlob(fileName, `\ufeff${csv}`, 'text/csv;charset=utf-8');
  showStatus(`Exported ${fileName} with interoperability metadata.`, 'success');
}

function exportEnhancedXlsx() {
  const context = currentBuilderContext();
  if (!context || context.payload.positions.length === 0) {
    showStatus('No positions are available to export.', 'danger');
    return;
  }
  const XLSX = globalThis.XLSX;
  if (!XLSX?.utils?.aoa_to_sheet || !XLSX?.utils?.book_new || !XLSX?.writeFile) {
    showStatus('Excel support did not load.', 'danger');
    return;
  }
  const matrix = spreadsheetMatrixForPositionSet(
    context.payload.positions,
    metadataForContext(context).set.positions,
  );
  const sheet = XLSX.utils.aoa_to_sheet(matrix);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Positions');
  const fileName = `${baseFileName(context.payload.setName || 'position-set')}.xlsx`;
  XLSX.writeFile(workbook, fileName);
  showStatus(`Exported ${fileName} with interoperability metadata.`, 'success');
}

async function rowsFromFile(file) {
  const name = String(file?.name || '').toLowerCase();
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const XLSX = globalThis.XLSX;
    if (!XLSX?.read || !XLSX?.utils?.sheet_to_json) return [];
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const sheetName = workbook.SheetNames?.[0];
    if (!sheetName) return [];
    return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      header: 1,
      raw: false,
      defval: '',
      blankrows: false,
    });
  }
  return parseCsvRows(await file.text());
}

function applyImportedMetadata(rows) {
  const metadataRows = metadataRowsFromTable(rows);
  if (!metadataRows.length) return;
  const context = currentBuilderContext();
  if (!context) return;
  const { store, set } = metadataForContext(context);
  context.payload.positions.forEach((position, index) => {
    const byId = metadataRows.find((row) => row.id && row.id === position.id);
    const metadata = byId || metadataRows[index];
    if (!metadata) return;
    set.positions[position.id] = {
      studentPrompt: metadata.studentPrompt || '',
      tags: metadata.tags || [],
      sourceLessonId: metadata.sourceLessonId || null,
      sourceNodeId: metadata.sourceNodeId || null,
    };
  });
  store.sets[context.key] = set;
  writeJson(METADATA_STORAGE_KEY, store);
  syncBuilderUi();
  showStatus('Imported optional prompts, tags, and source references.', 'success');
}

function showStatus(message, kind = 'success') {
  const panel = document.getElementById('lessonPositionBuilderPanel');
  if (panel && !panel.hidden) {
    let status = panel.querySelector('#positionSetInteropStatus');
    if (!status) {
      status = document.createElement('div');
      status.id = 'positionSetInteropStatus';
      status.className = 'banner position-set-interop-status';
      const header = panel.querySelector('.lesson-builder-header') || panel.querySelector('.lesson-builder-inner');
      header?.prepend(status);
    }
    if (status) {
      status.className = `banner ${kind} position-set-interop-status`;
      status.textContent = message;
      status.hidden = !message;
    }
  }
  const fileStatus = document.getElementById('lessonFileStatus');
  if (fileStatus) fileStatus.textContent = message;
}

function tabButton(tab) {
  return document.querySelector(`[data-action="set-tab"][data-tab="${tab}"]`);
}

function waitForSelector(selector, attempts = 30) {
  return new Promise((resolve) => {
    const find = (remaining) => {
      const element = document.querySelector(selector);
      if (element || remaining <= 0) {
        resolve(element || null);
        return;
      }
      window.requestAnimationFrame(() => find(remaining - 1));
    };
    find(attempts);
  });
}

async function addCurrentPositionToSet() {
  tabButton('lessons')?.click();
  const addButton = await waitForSelector('[data-action="lesson-builder-add-board"]');
  if (!addButton) {
    showStatus('Position Set Builder did not open.', 'danger');
    return;
  }
  addButton.click();
  showStatus('Added the current board to the active Position Set.', 'success');
}

async function openSelectedIn(tab) {
  const loadButton = document.querySelector('[data-action="lesson-builder-load"]');
  if (!loadButton || !selectedPosition()) {
    showStatus('Select a position first.', 'danger');
    return;
  }
  loadButton.click();
  await new Promise((resolve) => window.requestAnimationFrame(resolve));
  tabButton(tab)?.click();
}

function persistCurrentDraft() {
  window.dispatchEvent(new Event('beforeunload'));
  return readJson(APP_DRAFT_KEY);
}

function createLessonsFromPositions(positions, options = {}) {
  const draft = persistCurrentDraft();
  const result = appendPositionsToAppDraft(draft, positions, {
    activeTab: options.activeTab || 'analysis',
  });
  if (!writeJson(APP_DRAFT_KEY, result.draft)) {
    throw new Error('Browser storage rejected the updated lesson book.');
  }
  writeJson(RELOAD_STATUS_KEY, {
    message: options.message || `Added ${result.addedLessonIds.length} lesson${result.addedLessonIds.length === 1 ? '' : 's'} from Position Sets.`,
  }, 'session');
  window.location.reload();
}

function createSelectedLesson() {
  const position = selectedPosition();
  if (!position) {
    showStatus('Select a position first.', 'danger');
    return;
  }
  try {
    createLessonsFromPositions([position], {
      activeTab: 'analysis',
      message: `Created lesson "${position.title}" and opened it in Analysis.`,
    });
  } catch (error) {
    showStatus(error?.message || 'Unable to create the lesson.', 'danger');
  }
}

function createLessonsFromSet() {
  const positions = combinedPositions();
  if (!positions.length) {
    showStatus('The Position Set is empty.', 'danger');
    return;
  }
  if (!window.confirm(`Create ${positions.length} lesson${positions.length === 1 ? '' : 's'} from this Position Set? Existing lessons will be preserved.`)) {
    return;
  }
  try {
    createLessonsFromPositions(positions, {
      activeTab: 'analysis',
      message: `Created ${positions.length} lessons from the Position Set.`,
    });
  } catch (error) {
    showStatus(error?.message || 'Unable to create lessons from this set.', 'danger');
  }
}

function fieldMarkup(id, label, field, value, multilineField = false) {
  const wrapper = document.createElement('div');
  wrapper.className = 'lesson-builder-field position-set-interop-field';
  const labelElement = document.createElement('label');
  labelElement.className = 'field-label';
  labelElement.htmlFor = id;
  labelElement.textContent = label;
  const input = multilineField ? document.createElement('textarea') : document.createElement('input');
  input.id = id;
  input.className = multilineField ? 'field-textarea lesson-builder-note-input' : 'field-input';
  input.dataset.interopField = field;
  input.value = value;
  wrapper.append(labelElement, input);
  return wrapper;
}

function injectEditorFields() {
  const context = currentBuilderContext();
  const position = selectedPosition(context);
  const editor = document.querySelector('#lessonPositionBuilderPanel .lesson-builder-editor article');
  if (!editor || !position) return;
  const existingPrompt = editor.querySelector('[data-interop-field="studentPrompt"]');
  if (!existingPrompt) {
    const prompt = fieldMarkup(
      'positionSetStudentPromptInput',
      'Student Prompt',
      'studentPrompt',
      position.studentPrompt || '',
      true,
    );
    const tags = fieldMarkup(
      'positionSetTagsInput',
      'Tags',
      'tags',
      (position.tags || []).join(', '),
      false,
    );
    const defaultField = Array.from(editor.querySelectorAll('.lesson-builder-field'))
      .find((field) => field.textContent.includes('Default Position'));
    if (defaultField) {
      editor.insertBefore(prompt, defaultField);
      editor.insertBefore(tags, defaultField);
    } else {
      editor.append(prompt, tags);
    }
  }
}

function button(action, label, className = 'action-button tonal') {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = className;
  element.dataset.action = action;
  element.textContent = label;
  return element;
}

function injectBuilderActions() {
  const panel = document.getElementById('lessonPositionBuilderPanel');
  if (!panel || panel.hidden) return;
  const fileActions = panel.querySelector('.lesson-builder-file-actions');
  if (fileActions && !fileActions.querySelector('[data-action="position-set-create-lessons"]')) {
    fileActions.append(button('position-set-create-lessons', 'Create Lessons from Set'));
  }
  const actions = panel.querySelector('.lesson-builder-actions');
  if (actions && !actions.querySelector('[data-action="position-set-open-study"]')) {
    actions.prepend(
      button('position-set-open-study', 'Open in Study'),
      button('position-set-open-analysis', 'Open in Analysis'),
      button('position-set-create-lesson', 'Create New Lesson', 'action-button primary'),
    );
  }
}

function renameBuilderUi() {
  const tab = tabButton('lessons');
  if (tab) {
    tab.textContent = 'Positions';
    tab.setAttribute('aria-label', 'Open Positions');
  }
  const panel = document.getElementById('lessonPositionBuilderPanel');
  panel?.setAttribute('aria-label', 'Position Set Builder');
  panel?.querySelectorAll('.lesson-section-eyebrow').forEach((element) => {
    if (element.textContent.includes('Lesson Position Builder')) {
      element.textContent = 'Position Set Builder';
    }
  });
  panel?.querySelectorAll('label').forEach((element) => {
    if (element.textContent.trim() === 'Lesson Set Name') {
      element.textContent = 'Position Set Name';
    }
  });
}

function syncBuilderUi() {
  renameBuilderUi();
  injectEditorFields();
  injectBuilderActions();
}

function injectGlobalAction() {
  if (document.querySelector('[data-action="position-set-add-current"]')) return;
  const copyFen = document.getElementById('copyFenButton');
  const menu = copyFen?.parentElement;
  if (!menu) return;
  const action = button(
    'position-set-add-current',
    'Add current position to Position Set',
    'lesson-overflow-item',
  );
  action.setAttribute('role', 'menuitem');
  copyFen.insertAdjacentElement('afterend', action);
}

function injectStyles() {
  if (document.getElementById('positionSetInteropStyles')) return;
  const style = document.createElement('style');
  style.id = 'positionSetInteropStyles';
  style.textContent = `
    .position-set-interop-status { margin-bottom: .75rem; }
    .position-set-interop-field textarea { min-height: 5rem; }
    .lesson-builder-actions [data-action^="position-set-"] { white-space: nowrap; }
  `;
  document.head.appendChild(style);
}

function handleClick(event) {
  const actionElement = event.target?.closest?.('[data-action]');
  const action = actionElement?.dataset?.action || '';
  if (action === 'lesson-builder-export-csv') {
    event.preventDefault();
    event.stopImmediatePropagation();
    exportEnhancedCsv();
    return;
  }
  if (action === 'lesson-builder-export-xlsx') {
    event.preventDefault();
    event.stopImmediatePropagation();
    exportEnhancedXlsx();
    return;
  }
  if (!action.startsWith('position-set-')) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  switch (action) {
    case 'position-set-add-current':
      void addCurrentPositionToSet();
      break;
    case 'position-set-open-study':
      void openSelectedIn('study');
      break;
    case 'position-set-open-analysis':
      void openSelectedIn('analysis');
      break;
    case 'position-set-create-lesson':
      createSelectedLesson();
      break;
    case 'position-set-create-lessons':
      createLessonsFromSet();
      break;
    default:
      break;
  }
}

function handleInput(event) {
  const field = event.target?.dataset?.interopField;
  if (!field) return;
  const context = currentBuilderContext();
  const positionId = context?.payload?.selectedPositionId;
  if (!positionId) return;
  if (field === 'tags') {
    savePositionMetadata(positionId, {
      tags: String(event.target.value || '').split(/[;,]/g).map((value) => value.trim()).filter(Boolean),
    });
  } else {
    savePositionMetadata(positionId, { [field]: String(event.target.value || '') });
  }
}

function handleFileChange(event) {
  if (event.target?.id !== 'lessonPositionFileInput' || !event.target.files?.[0]) return;
  const file = event.target.files[0];
  void rowsFromFile(file)
    .then((rows) => {
      window.setTimeout(() => applyImportedMetadata(rows), 180);
      window.setTimeout(() => applyImportedMetadata(rows), 500);
    })
    .catch((error) => console.warn('[Position Set interoperability] metadata import failed', error));
}

function showReloadStatus() {
  const status = readJson(RELOAD_STATUS_KEY, null, 'session');
  if (!status?.message) return;
  safeStorage('session')?.removeItem(RELOAD_STATUS_KEY);
  window.setTimeout(() => showStatus(status.message, 'success'), 0);
}

function initialize() {
  if (disabledForEmbed) return;
  injectStyles();
  injectGlobalAction();
  renameBuilderUi();
  const panel = document.getElementById('lessonPositionBuilderPanel');
  if (panel) {
    new MutationObserver(syncBuilderUi).observe(panel, { childList: true, subtree: true });
  }
  document.addEventListener('click', handleClick, true);
  document.addEventListener('input', handleInput, true);
  document.addEventListener('change', handleFileChange, true);
  showReloadStatus();
}

initialize();
