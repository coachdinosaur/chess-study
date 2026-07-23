const board = document.getElementById('liveBoard');
const resetButton = document.getElementById('resetButton');
const sessionBar = document.getElementById('sessionBar');
const roomCodeLabel = document.getElementById('roomCodeLabel');
const fenInput = document.getElementById('fenInput');

function boardIsVisible() {
  return Boolean(board && !board.closest('[hidden]') && board.getClientRects().length > 0);
}

function hasActiveTeacherRoom() {
  return document.documentElement.dataset.role === 'teacher'
    && sessionBar
    && !sessionBar.hidden
    && Boolean(roomCodeLabel?.textContent.trim());
}

function boardHasRenderedPosition() {
  if (!board) return false;
  const squareCount = board.querySelectorAll('.square').length;
  return squareCount === 64 && Boolean(fenInput?.value.trim());
}

function ensureInitialTeacherPosition() {
  if (!hasActiveTeacherRoom() || !boardIsVisible()) return;
  if (boardHasRenderedPosition()) return;
  if (!resetButton) return;
  resetButton.click();
}

queueMicrotask(ensureInitialTeacherPosition);
requestAnimationFrame(() => requestAnimationFrame(ensureInitialTeacherPosition));

const observer = new MutationObserver(ensureInitialTeacherPosition);
observer.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['hidden', 'data-role'],
  childList: true,
  subtree: true,
});

window.addEventListener('pageshow', ensureInitialTeacherPosition);
window.addEventListener('focus', ensureInitialTeacherPosition);
window.setTimeout(ensureInitialTeacherPosition, 100);
window.setTimeout(ensureInitialTeacherPosition, 350);
window.setTimeout(ensureInitialTeacherPosition, 1000);
window.setTimeout(() => observer.disconnect(), 15000);