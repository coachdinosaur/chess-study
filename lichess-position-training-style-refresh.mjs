const STYLE_URL = './lichess-position-training-premium-layout.css?v=20260824-landscape-board1';

function installLatestTrainerStyles() {
  for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
    const href = link.getAttribute('href') || '';
    if (
      href.includes('lichess-position-training-desktop-fit.css')
      || href.includes('lichess-position-training-post-answer-fix.css')
      || href.includes('lichess-position-training-premium-layout.css')
    ) {
      link.remove();
    }
  }

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = STYLE_URL;
  link.dataset.positionTrainingStableLayout = '1';
  document.head.appendChild(link);
}

queueMicrotask(installLatestTrainerStyles);
