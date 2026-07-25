import './focus-analysis-popup-core.mjs?v=20260723-live-board-link1';
import './lichess-position-training.mjs?v=20260725-position-training3';
import './lichess-position-training-interactions.mjs?v=20260725-board-interaction1';
import './lichess-position-training-grid-layout.mjs?v=20260725-grid-rows1';

const root = document.documentElement;
if (root.dataset.embed !== '1' && root.dataset.boardOnly !== '1') {
  const actions = document.querySelector('.site-intro-actions');
  if (actions && !actions.querySelector('[data-live-board-link]')) {
    const link = document.createElement('a');
    link.className = 'site-intro-button';
    link.href = './live-board.html';
    link.textContent = 'Live Board';
    link.setAttribute('data-live-board-link', '');
    link.setAttribute('aria-label', 'Open the synchronized teacher and student Live Board');
    actions.appendChild(link);
  }
}
