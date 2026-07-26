import { validateFen } from './vendor/chess.js';
import { validatePositionSetExport } from './lesson-position-export-validation.mjs';

const LAST_SET_STORAGE_KEY = 'lesson-position-builder-v1:last-set';
const EXPORT_ACTIONS = new Set([
  'lesson-builder-export-csv',
  'lesson-builder-export-xlsx',
]);

function readJson(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function currentPositions() {
  const last = readJson(LAST_SET_STORAGE_KEY);
  const payload = last?.key ? readJson(last.key) : null;
  return Array.isArray(payload?.positions) ? payload.positions : [];
}

function showError(message) {
  const panel = document.getElementById('lessonPositionBuilderPanel');
  if (!panel) return;
  let banner = panel.querySelector('#positionSetExportValidation');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'positionSetExportValidation';
    const header = panel.querySelector('.lesson-builder-header') || panel.querySelector('.lesson-builder-inner');
    header?.prepend(banner);
  }
  if (banner) {
    banner.className = 'banner danger position-set-interop-status';
    banner.textContent = message;
    banner.hidden = false;
  }
  const status = document.getElementById('lessonFileStatus');
  if (status) status.textContent = message;
}

function clearError() {
  const banner = document.getElementById('positionSetExportValidation');
  if (banner) banner.hidden = true;
}

function handleClick(event) {
  const actionElement = event.target?.closest?.('[data-action]');
  const action = actionElement?.dataset?.action || '';
  if (!EXPORT_ACTIONS.has(action)) return;

  const validation = validatePositionSetExport(currentPositions(), { validateFen });
  if (validation.ok) {
    clearError();
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();
  showError(validation.errors.join(' '));
}

document.addEventListener('click', handleClick, true);
