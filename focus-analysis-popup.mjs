import './focus-analysis-popup-core.mjs?v=20260723-live-board-link1';

function loadPositionTrainingStyles() {
  const stylesheets = [
    {
      id: 'position-training-theme-styles',
      href: './lichess-position-training.css?v=20260725-theme-board2',
    },
    {
      id: 'position-training-piece-styles',
      href: './lichess-position-training-piece-assets.css?v=20260725-theme-board2',
    },
  ];

  for (const { id, href } of stylesheets) {
    let link = document.getElementById(id);
    if (!link) {
      link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    link.setAttribute('href', href);
  }
}

loadPositionTrainingStyles();
void import('./lichess-position-training.mjs?v=20260725-position-training2').catch((error) => {
  console.error('Unable to load Lichess position training.', error);
});

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
