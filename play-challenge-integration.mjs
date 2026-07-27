import {
  buildPlayChallengeLink,
  readPlayChallenge,
} from './play-challenge-link.mjs?v=20260727-student-game-link2';

const DRAFT_STORAGE_KEY = 'setup-analysis-draft-v1';
const INITIAL_POSITION = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const COPY_BUTTON_ID = 'copyStudentGameLinkButton';
const NOTICE_ID = 'playChallengePreparedNotice';
const ERROR_ID = 'playChallengeErrorNotice';
const STATUS_ID = 'playChallengeCopyStatus';

let preparedChallenge = null;
let preparedChallengeError = '';
let preparedChallengeApplied = false;
let preparedChallengeApplying = false;
let playPanelObserver = null;
let copyResetTimer = null;

try {
  preparedChallenge = readPlayChallenge(window.location);
} catch (error) {
  preparedChallengeError = error?.message || 'This prepared game link is invalid.';
}

if (preparedChallenge || preparedChallengeError) {
  protectExistingBrowserDraft();
}

function protectExistingBrowserDraft() {
  const nativeSetItem = Storage.prototype.setItem;
  const nativeRemoveItem = Storage.prototype.removeItem;

  Storage.prototype.setItem = function setItem(key, value) {
    if (this === window.localStorage && String(key) === DRAFT_STORAGE_KEY) {
      return undefined;
    }
    return nativeSetItem.call(this, key, value);
  };

  Storage.prototype.removeItem = function removeItem(key) {
    if (this === window.localStorage && String(key) === DRAFT_STORAGE_KEY) {
      return undefined;
    }
    return nativeRemoveItem.call(this, key);
  };
}

function nextFrame() {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
}

async function waitForElement(selector, timeoutMs = 2500) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const element = document.querySelector(selector);
    if (element) {
      return element;
    }
    await nextFrame();
  }
  return null;
}

async function clickTab(tab) {
  const button = document.querySelector(`[data-action="set-tab"][data-tab="${tab}"]`);
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`The ${tab} tab is unavailable.`);
  }
  if (button.disabled) {
    throw new Error(`The ${tab} tab is locked before the prepared game can be loaded.`);
  }
  button.click();
  await nextFrame();
}

async function setSelectValue(id, value) {
  const select = await waitForElement(`#${id}`);
  if (!(select instanceof HTMLSelectElement)) {
    throw new Error(`The prepared game control ${id} is unavailable.`);
  }
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await nextFrame();
}

async function applyPreparedChallenge() {
  if (!preparedChallenge || preparedChallengeApplied || preparedChallengeApplying) {
    return;
  }
  preparedChallengeApplying = true;

  try {
    await clickTab('setup');
    const fenInput = await waitForElement('#fenInput');
    if (!(fenInput instanceof HTMLTextAreaElement)) {
      throw new Error('The board setup field is unavailable.');
    }
    fenInput.value = preparedChallenge.fen;
    fenInput.dispatchEvent(new Event('input', { bubbles: true }));

    const applyFenButton = await waitForElement('[data-action="apply-fen"]');
    if (!(applyFenButton instanceof HTMLButtonElement)) {
      throw new Error('The board setup action is unavailable.');
    }
    applyFenButton.click();
    await nextFrame();

    const loadedFen = document.getElementById('setupFenCode')?.textContent?.trim().replace(/\s+/g, ' ');
    if (loadedFen !== preparedChallenge.fen) {
      throw new Error('The prepared starting position is invalid.');
    }

    await clickTab('play');

    const skillSlider = await waitForElement('#engineSkillSlider');
    if (!(skillSlider instanceof HTMLInputElement)) {
      throw new Error('The engine strength control is unavailable.');
    }
    skillSlider.value = String(preparedChallenge.skill);
    skillSlider.dispatchEvent(new Event('input', { bubbles: true }));
    await nextFrame();

    await setSelectValue('playStartPositionSelect-native', 'setup');
    await setSelectValue('playSideSelect-native', preparedChallenge.side);
    await setSelectValue('playTimeSelect-native', preparedChallenge.timeControl);
    await setSelectValue('playSpeedSelect-native', preparedChallenge.thinkingSpeed);

    preparedChallengeApplied = true;
    preparedChallengeError = '';
    document.documentElement.dataset.playChallenge = 'prepared';
  } catch (error) {
    preparedChallengeApplied = false;
    preparedChallengeError = error?.message || 'The prepared game could not be loaded.';
    document.documentElement.dataset.playChallenge = 'error';
    await clickTab('play').catch(() => {});
  } finally {
    preparedChallengeApplying = false;
    enhancePlayPanel();
  }
}

function readControlValue(id, fallback = '') {
  const control = document.getElementById(id);
  return control instanceof HTMLInputElement || control instanceof HTMLSelectElement
    ? control.value
    : fallback;
}

function resolvedStartingFen() {
  const startPosition = readControlValue('playStartPositionSelect-native', 'current');
  if (startPosition === 'initial') {
    return INITIAL_POSITION;
  }
  const sourceId = startPosition === 'setup' ? 'setupFenCode' : 'currentFenCode';
  const fen = document.getElementById(sourceId)?.textContent?.trim();
  if (!fen) {
    throw new Error('The selected starting position is unavailable.');
  }
  return fen;
}

function currentPreparedConfig() {
  return {
    fen: resolvedStartingFen(),
    skill: readControlValue('engineSkillSlider', '1000'),
    side: readControlValue('playSideSelect-native', 'white'),
    timeControl: readControlValue('playTimeSelect-native', 'none'),
    thinkingSpeed: readControlValue('playSpeedSelect-native', 'normal'),
  };
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) {
    throw new Error('The browser blocked clipboard access.');
  }
}

function setCopyStatus(message, isError = false) {
  const status = document.getElementById(STATUS_ID);
  if (!status) {
    return;
  }
  status.textContent = message;
  status.classList.toggle('is-error', isError);
}

async function handleCopyStudentLink(button) {
  try {
    const link = buildPlayChallengeLink(currentPreparedConfig(), window.location);
    await copyText(link);
    button.textContent = 'Link copied';
    setCopyStatus('Reusable student game link copied.');
    window.clearTimeout(copyResetTimer);
    copyResetTimer = window.setTimeout(() => {
      button.textContent = 'Copy student game link';
      setCopyStatus('');
    }, 2200);
  } catch (error) {
    setCopyStatus(error?.message || 'Unable to create the student game link.', true);
  }
}

function ensureCoachCopyControl(playPanel) {
  if (preparedChallenge || preparedChallengeError) {
    return;
  }
  const startRow = playPanel.querySelector('.play-start-action-row');
  if (!startRow || startRow.querySelector(`#${COPY_BUTTON_ID}`)) {
    return;
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.id = COPY_BUTTON_ID;
  button.className = 'action-button tonal';
  button.textContent = 'Copy student game link';
  button.addEventListener('click', () => void handleCopyStudentLink(button));
  startRow.appendChild(button);

  const status = document.createElement('p');
  status.id = STATUS_ID;
  status.className = 'section-copy play-challenge-copy-status';
  status.setAttribute('aria-live', 'polite');
  startRow.insertAdjacentElement('afterend', status);
}

function lockPreparedControls(playPanel) {
  if (!preparedChallengeApplied || preparedChallengeError) {
    return;
  }

  const ids = [
    'engineSkillSlider',
    'playStartPositionSelect-native',
    'playSideSelect-native',
    'playTimeSelect-native',
    'playSpeedSelect-native',
  ];
  for (const id of ids) {
    const control = document.getElementById(id);
    if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement) {
      control.disabled = true;
      control.setAttribute('aria-disabled', 'true');
    }
  }

  playPanel.querySelectorAll('.custom-select-trigger').forEach((trigger) => {
    trigger.disabled = true;
    trigger.setAttribute('aria-disabled', 'true');
  });

  const startPositionLabel = playPanel.querySelector('[data-select-id="playStartPositionSelect"] .custom-select-value');
  if (startPositionLabel && startPositionLabel.textContent !== 'Prepared position') {
    startPositionLabel.textContent = 'Prepared position';
  }

  document.querySelectorAll('[data-action="set-tab"]').forEach((button) => {
    if (button.dataset.tab !== 'play') {
      button.disabled = true;
      button.setAttribute('aria-disabled', 'true');
      button.title = 'This link opens a game prepared by your coach.';
    }
  });
}

function removeNotice(playPanel, id) {
  playPanel.querySelector(`#${id}`)?.remove();
}

function ensurePreparedNotice(playPanel) {
  if (!preparedChallengeApplied || preparedChallengeError) {
    removeNotice(playPanel, NOTICE_ID);
    return;
  }
  if (playPanel.querySelector(`#${NOTICE_ID}`)) {
    return;
  }
  const article = playPanel.querySelector('.lesson-section');
  const header = article?.querySelector('.lesson-section-header');
  if (!article || !header) {
    return;
  }

  const notice = document.createElement('div');
  notice.id = NOTICE_ID;
  notice.className = 'banner success';
  notice.innerHTML = `
    <div>
      <strong>Game prepared by your coach</strong>
      <div>The position and Stockfish settings are locked. Click Start Game when you are ready.</div>
    </div>
  `;
  header.insertAdjacentElement('afterend', notice);
}

function ensureErrorNotice(playPanel) {
  if (!preparedChallengeError) {
    removeNotice(playPanel, ERROR_ID);
    return;
  }
  if (playPanel.querySelector(`#${ERROR_ID}`)) {
    return;
  }
  const article = playPanel.querySelector('.lesson-section');
  const header = article?.querySelector('.lesson-section-header');
  if (!article || !header) {
    return;
  }

  const notice = document.createElement('div');
  notice.id = ERROR_ID;
  notice.className = 'banner danger';
  const title = document.createElement('strong');
  title.textContent = 'Prepared game link could not be loaded';
  const message = document.createElement('div');
  message.textContent = preparedChallengeError;
  const wrapper = document.createElement('div');
  wrapper.append(title, message);
  notice.append(wrapper);
  header.insertAdjacentElement('afterend', notice);
}

function enhancePlayPanel() {
  const playPanel = document.getElementById('playPanel');
  if (!playPanel) {
    return;
  }
  ensureCoachCopyControl(playPanel);
  ensurePreparedNotice(playPanel);
  ensureErrorNotice(playPanel);
  lockPreparedControls(playPanel);
}

function observePlayPanel() {
  const playPanel = document.getElementById('playPanel');
  if (!playPanel || playPanelObserver) {
    return;
  }
  playPanelObserver = new MutationObserver(() => enhancePlayPanel());
  playPanelObserver.observe(playPanel, { childList: true, subtree: true });
}

async function initialize() {
  await waitForElement('#playPanel');
  observePlayPanel();

  if (preparedChallenge) {
    await applyPreparedChallenge();
  } else if (preparedChallengeError) {
    await clickTab('play').catch(() => {});
    enhancePlayPanel();
  } else {
    enhancePlayPanel();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void initialize(), { once: true });
} else {
  void initialize();
}
