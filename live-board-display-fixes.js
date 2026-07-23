const board = document.getElementById('liveBoard');
const resetButton = document.getElementById('resetButton');

function boardIsVisible() {
  return board && !board.closest('[hidden]') && board.getClientRects().length > 0;
}

function ensureInitialTeacherPosition() {
  if (!boardIsVisible()) return;
  if (document.documentElement.dataset.role !== 'teacher') return;
  if (board.querySelector('.piece')) return;
  if (!resetButton || resetButton.disabled) return;
  resetButton.click();
}

queueMicrotask(ensureInitialTeacherPosition);
requestAnimationFrame(() => requestAnimationFrame(ensureInitialTeacherPosition));

if (board) {
  const observer = new MutationObserver(ensureInitialTeacherPosition);
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['hidden', 'data-role'],
    childList: true,
    subtree: true,
  });
  window.setTimeout(() => observer.disconnect(), 10000);
}
