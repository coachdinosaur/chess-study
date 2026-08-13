import './focus-analysis-popup-core.mjs?v=20260723-live-board-link1';
import './lesson-position-interoperability-export-guard.mjs?v=20260726-stage2-validation1';
import './lesson-position-interoperability.mjs?v=20260726-stage2';
import './lesson-picker-search.mjs?v=20260813-lesson-search1';
import './lichess-position-training.mjs?v=20260726-position-study-wording1';
import './position-study-single-hint-patch.mjs?v=20260726-single-hint1';
import './lichess-position-training-interactions.mjs?v=20260725-board-interaction1';
import './lichess-position-training-grid-layout.mjs?v=20260725-grid-rows1';
import './lichess-position-training-style-refresh.mjs?v=20260726-post-answer-layout1';
import './play-challenge-integration.mjs?v=20260727-student-game-link2';

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
