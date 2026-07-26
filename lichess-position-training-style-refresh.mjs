const STYLE_URL = './lichess-position-training-desktop-fit.css?v=20260726-terminal-layout1';

function installLatestTrainerStyles() {
  for (const link of document.querySelectorAll('link[rel="stylesheet"][href*="lichess-position-training-desktop-fit.css"]')) {
    link.remove();
  }

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = STYLE_URL;
  link.dataset.positionTrainingStableLayout = '1';
  document.head.appendChild(link);
}

queueMicrotask(installLatestTrainerStyles);
