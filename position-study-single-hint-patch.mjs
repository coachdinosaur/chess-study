import { PositionTrainingLearning } from './lichess-position-training-learning.mjs';

const PATCH_FLAG = Symbol.for('position-study-single-hint-patch');
const LAUNCHER_COPY = 'Train against dynamic defence with adaptive difficulty, a one-use piece hint, mistake review, and theme performance tracking. The existing Endgame vs Stockfish trainer remains unchanged.';

function installLearningPatch() {
  const prototype = PositionTrainingLearning.prototype;
  if (prototype[PATCH_FLAG]) return;

  const originalNextHint = prototype.nextHint;
  const originalHintLevel = prototype.hintLevel;
  if (typeof originalNextHint !== 'function' || typeof originalHintLevel !== 'function') return;

  Object.defineProperty(prototype, PATCH_FLAG, { value: true });

  prototype.nextHint = function nextSinglePieceHint(options = {}) {
    const move = String(options.bestMove || '').trim().toLowerCase();
    const validMove = /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move);
    if (!validMove) return { level: 0, from: '', to: '', text: '' };
    if ((this.attempt?.hints || 0) >= 1) return { level: 4, from: '', to: '', text: '' };

    originalNextHint.call(this, options);
    return { level: 4, from: move.slice(0, 2), to: '', text: '' };
  };

  prototype.hintLevel = function singleHintLevel() {
    return originalHintLevel.call(this) > 0 ? 4 : 0;
  };

  prototype.buildSuccessExplanation = function disableGenericSuccessExplanation() {
    return null;
  };

  prototype.buildMistakeExplanation = function disableGenericMistakeExplanation() {
    return null;
  };
}

let preserveFeedback = false;
let feedbackBeforeHint = '';

function restoreFeedbackAfterHint() {
  if (!preserveFeedback || !feedbackBeforeHint) return;
  const feedback = document.querySelector('[data-pt-feedback]');
  if (!feedback) return;

  const current = feedback.textContent.trim();
  if (!current) {
    feedback.textContent = feedbackBeforeHint;
  } else if (current !== feedbackBeforeHint) {
    preserveFeedback = false;
    feedbackBeforeHint = '';
  }
}

function refreshPositionStudyUi() {
  const hintButton = document.querySelector('.position-training-overlay [data-pt-action="hint"]');
  if (hintButton) {
    const used = /Hint\s+4\s+of\s+4/i.test(hintButton.textContent) || hintButton.textContent.trim() === 'Hint used';
    const label = used ? 'Hint used' : 'Hint';
    if (hintButton.textContent !== label) hintButton.textContent = label;
  }

  const explanation = document.querySelector('[data-pt-explanation]');
  if (explanation) {
    explanation.hidden = true;
    if (explanation.childNodes.length) explanation.replaceChildren();
  }

  const launcher = document.querySelector('[data-position-training-launcher]');
  if (launcher) {
    const description = [...launcher.querySelectorAll('p')]
      .find((paragraph) => !paragraph.classList.contains('position-training-eyebrow')
        && !paragraph.classList.contains('position-training-library-count'));
    if (description && description.textContent !== LAUNCHER_COPY) description.textContent = LAUNCHER_COPY;
  }

  restoreFeedbackAfterHint();
}

installLearningPatch();

document.addEventListener('click', (event) => {
  const button = event.target.closest?.('.position-training-overlay [data-pt-action="hint"]');
  if (!button || button.disabled) return;

  const feedback = document.querySelector('[data-pt-feedback]');
  feedbackBeforeHint = feedback?.textContent.trim() || '';
  preserveFeedback = Boolean(feedbackBeforeHint);
  queueMicrotask(refreshPositionStudyUi);
}, true);

const observer = new MutationObserver(refreshPositionStudyUi);
observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
queueMicrotask(refreshPositionStudyUi);
