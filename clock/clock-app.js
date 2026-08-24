/**
 * ClockApp — Main UI Controller for the Digital Chess Clock
 * Connects ClockEngine and ClockAudio to DOM, handles mobile ergonomics,
 * Fullscreen API, Screen Wake Lock API, and Keyboard shortcuts.
 */

import { ClockEngine, CLOCK_STATES, TIMING_MODES, PRESET_TIME_CONTROLS } from './clock-engine.mjs';
import {
  playMoveSound,
  playFlagFallAlarm,
  playLowTimeTick,
  isAudioMuted,
  toggleAudioMuted,
  getSoundType,
  setSoundType,
  isHapticsEnabled,
  setHapticsEnabled,
  SOUND_TYPES
} from './clock-audio.mjs';

const STORAGE_KEY_SETTINGS = 'chess-clock-custom-settings-v1';
const STORAGE_KEY_THEME = 'chess-clock-theme-v1';
const STORAGE_KEY_UNMIRRORED = 'chess-clock-unmirrored-v1';

// App State
let engine = null;
let currentConfig = null;
let wakeLock = null;
let tickTimerId = null;
let previousSnapshot = null;
let lowTimeAlertTriggered = { 1: false, 2: false };

// DOM Elements
const shell = document.getElementById('clockShell');
const zone1 = document.getElementById('clockZone1');
const zone2 = document.getElementById('clockZone2');
const timeDigits1 = document.getElementById('timeDigits1');
const timeDigits2 = document.getElementById('timeDigits2');
const movesLabel1 = document.getElementById('movesLabel1');
const movesLabel2 = document.getElementById('movesLabel2');
const promptLabel1 = document.getElementById('promptLabel1');
const promptLabel2 = document.getElementById('promptLabel2');
const delayBadge1 = document.getElementById('delayBadge1');
const delayBadge2 = document.getElementById('delayBadge2');

// HUD Buttons & Icons
const btnPlayPause = document.getElementById('btnPlayPause');
const iconPlay = document.getElementById('iconPlay');
const iconPause = document.getElementById('iconPause');
const btnReset = document.getElementById('btnReset');
const btnSound = document.getElementById('btnSound');
const iconSoundOn = document.getElementById('iconSoundOn');
const iconSoundOff = document.getElementById('iconSoundOff');
const btnFullscreen = document.getElementById('btnFullscreen');
const iconEnterFullscreen = document.getElementById('iconEnterFullscreen');
const iconExitFullscreen = document.getElementById('iconExitFullscreen');
const btnSettings = document.getElementById('btnSettings');
const headerSettingsBtn = document.getElementById('headerSettingsBtn');
const headerShortcutsBtn = document.getElementById('headerShortcutsBtn');
const activeTimeControlLabel = document.getElementById('activeTimeControlLabel');

// Flag Overlay
const flagOverlay = document.getElementById('flagOverlay');
const flagMessage = document.getElementById('flagMessage');
const btnFlagRestart = document.getElementById('btnFlagRestart');
const btnFlagClose = document.getElementById('btnFlagClose');

// Modals
const settingsModalBackdrop = document.getElementById('settingsModalBackdrop');
const btnCloseSettings = document.getElementById('btnCloseSettings');
const presetsGrid = document.getElementById('presetsGrid');
const customMinutes = document.getElementById('customMinutes');
const customSeconds = document.getElementById('customSeconds');
const customIncrement = document.getElementById('customIncrement');
const customMode = document.getElementById('customMode');
const btnApplySettings = document.getElementById('btnApplySettings');
const toggleRotateOpponent = document.getElementById('toggleRotateOpponent');
const toggleHaptics = document.getElementById('toggleHaptics');

const resetModalBackdrop = document.getElementById('resetModalBackdrop');
const btnConfirmReset = document.getElementById('btnConfirmReset');
const btnCancelReset = document.getElementById('btnCancelReset');

const shortcutsModalBackdrop = document.getElementById('shortcutsModalBackdrop');
const btnCloseShortcuts = document.getElementById('btnCloseShortcuts');

/**
 * Initialize application
 */
function init() {
  loadStoredTheme();
  loadStoredMirrorState();
  loadStoredSettings();
  
  initEngine();
  populatePresets();
  bindEvents();
  updateSoundIcon();
  updateFullscreenIcon();
  
  startTickLoop();
}

/**
 * Load theme from storage
 */
function loadStoredTheme() {
  try {
    const savedTheme = localStorage.getItem(STORAGE_KEY_THEME) || 'midnight';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeSelection(savedTheme);
  } catch {}
}

/**
 * Load mirror state
 */
function loadStoredMirrorState() {
  try {
    const isUnmirrored = localStorage.getItem(STORAGE_KEY_UNMIRRORED) === 'true';
    if (toggleRotateOpponent) toggleRotateOpponent.checked = !isUnmirrored;
    if (shell) shell.classList.toggle('is-unmirrored', isUnmirrored);
  } catch {}
}

/**
 * Load initial clock settings
 */
function loadStoredSettings() {
  const defaultSettings = {
    presetId: 'blitz-5-3',
    label: 'Blitz 5+3',
    baseMinutes: 5,
    baseSeconds: 0,
    increment: 3,
    mode: TIMING_MODES.FISCHER
  };

  try {
    const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (saved) {
      currentConfig = JSON.parse(saved);
    } else {
      currentConfig = defaultSettings;
    }
  } catch {
    currentConfig = defaultSettings;
  }
}

/**
 * Initialize Clock Engine
 */
function initEngine() {
  engine = new ClockEngine({
    baseMinutes: currentConfig.baseMinutes,
    baseSeconds: currentConfig.baseSeconds,
    increment: currentConfig.increment,
    mode: currentConfig.mode
  });

  lowTimeAlertTriggered = { 1: false, 2: false };
  updateTimeControlBadge();
  renderSnapshot(engine.getSnapshot(), true);
}

/**
 * Update time control label in header
 */
function updateTimeControlBadge() {
  if (activeTimeControlLabel && currentConfig) {
    activeTimeControlLabel.textContent = currentConfig.label || `${currentConfig.baseMinutes}m + ${currentConfig.increment}s`;
  }
}

/**
 * Render engine snapshot to UI
 */
function renderSnapshot(snap, force = false) {
  // 1. Time display
  const p1TimeStr = ClockEngine.formatTime(snap.p1.remainingMs, true);
  const p2TimeStr = ClockEngine.formatTime(snap.p2.remainingMs, true);

  if (timeDigits1.textContent !== p1TimeStr || force) timeDigits1.textContent = p1TimeStr;
  if (timeDigits2.textContent !== p2TimeStr || force) timeDigits2.textContent = p2TimeStr;

  // 2. Moves counter
  movesLabel1.textContent = `${snap.p1.moves} move${snap.p1.moves === 1 ? '' : 's'}`;
  movesLabel2.textContent = `${snap.p2.moves} move${snap.p2.moves === 1 ? '' : 's'}`;

  // 3. Delays
  if (snap.p1.delayRemainingMs > 0 && snap.activePlayer === 1) {
    delayBadge1.textContent = `Delay ${Math.ceil(snap.p1.delayRemainingMs / 1000)}s`;
    delayBadge1.hidden = false;
  } else {
    delayBadge1.hidden = true;
  }

  if (snap.p2.delayRemainingMs > 0 && snap.activePlayer === 2) {
    delayBadge2.textContent = `Delay ${Math.ceil(snap.p2.delayRemainingMs / 1000)}s`;
    delayBadge2.hidden = false;
  } else {
    delayBadge2.hidden = true;
  }

  // 4. Zone active & low time classes
  zone1.classList.toggle('is-active', snap.activePlayer === 1);
  zone2.classList.toggle('is-active', snap.activePlayer === 2);

  zone1.classList.toggle('is-low-time', snap.p1.isLowTime);
  zone2.classList.toggle('is-low-time', snap.p2.isLowTime);

  zone1.classList.toggle('is-flagged', snap.flaggedPlayer === 1);
  zone2.classList.toggle('is-flagged', snap.flaggedPlayer === 2);

  // 5. Prompts
  if (snap.state === CLOCK_STATES.READY) {
    promptLabel1.textContent = "Tap to start Black's clock";
    promptLabel2.textContent = "Tap to start White's clock";
    promptLabel1.hidden = false;
    promptLabel2.hidden = false;
  } else if (snap.state === CLOCK_STATES.PAUSED) {
    promptLabel1.textContent = snap.activePlayer === 1 ? 'Paused — Tap to resume' : 'Paused';
    promptLabel2.textContent = snap.activePlayer === 2 ? 'Paused — Tap to resume' : 'Paused';
    promptLabel1.hidden = false;
    promptLabel2.hidden = false;
  } else {
    promptLabel1.hidden = true;
    promptLabel2.hidden = true;
  }

  // 6. Play / Pause Button state
  const isRunning = snap.state === CLOCK_STATES.RUNNING;
  iconPlay.hidden = isRunning;
  iconPause.hidden = !isRunning;
  btnPlayPause.setAttribute('aria-label', isRunning ? 'Pause Clock' : 'Start Clock');

  // 7. Low-time audio tick trigger (<10s)
  if (isRunning) {
    const activeP = snap.activePlayer;
    if (activeP && snap[`p${activeP}`].isCriticalTime && !lowTimeAlertTriggered[activeP]) {
      playLowTimeTick();
      lowTimeAlertTriggered[activeP] = true;
    }
  }

  // 8. Flag fall handling
  if (snap.state === CLOCK_STATES.FLAGGED && (!previousSnapshot || previousSnapshot.state !== CLOCK_STATES.FLAGGED)) {
    handleFlagFall(snap);
  }

  previousSnapshot = snap;
}

/**
 * Handle Flag Fall
 */
function handleFlagFall(snap) {
  releaseWakeLock();
  playFlagFallAlarm();

  const flaggedName = snap.flaggedPlayer === 1 ? 'White' : 'Black';
  const winnerName = snap.winner === 1 ? 'White' : 'Black';
  flagMessage.textContent = `${flaggedName}'s flag fell! ${winnerName} wins on time.`;
  flagOverlay.hidden = false;
}

/**
 * High-frequency tick loop using requestAnimationFrame + delta sync
 */
function startTickLoop() {
  function loop() {
    if (engine) {
      const snap = engine.tick();
      renderSnapshot(snap);
    }
    tickTimerId = requestAnimationFrame(loop);
  }
  tickTimerId = requestAnimationFrame(loop);
}

/**
 * Handle Clock Zone Tap
 */
function handleZoneTap(player) {
  if (!engine) return;

  const snap = engine.getSnapshot();
  if (snap.state === CLOCK_STATES.FLAGGED) return;

  const res = engine.tap(player);
  if (res.success) {
    playMoveSound();
    requestWakeLock();
    renderSnapshot(engine.getSnapshot(), true);
  }
}

/**
 * Toggle Play / Pause
 */
function togglePlayPause() {
  if (!engine) return;
  const snap = engine.getSnapshot();

  if (snap.state === CLOCK_STATES.READY) {
    // Start with White (Player 1)
    engine.tap(2); // Tapping player 2 starts player 1
    requestWakeLock();
  } else if (snap.state === CLOCK_STATES.RUNNING) {
    engine.pause();
    releaseWakeLock();
  } else if (snap.state === CLOCK_STATES.PAUSED) {
    engine.resume();
    requestWakeLock();
  }
  renderSnapshot(engine.getSnapshot(), true);
}

/**
 * Request Reset
 */
function requestReset() {
  if (!engine) return;
  const snap = engine.getSnapshot();

  // If clock hasn't started, reset directly without modal
  if (snap.state === CLOCK_STATES.READY) {
    initEngine();
    return;
  }

  // If game is in progress or flagged, prompt confirm modal
  resetModalBackdrop.hidden = false;
}

function confirmReset() {
  resetModalBackdrop.hidden = true;
  flagOverlay.hidden = true;
  releaseWakeLock();
  initEngine();
}

/**
 * Screen Wake Lock API Management
 */
async function requestWakeLock() {
  if ('wakeLock' in navigator) {
    try {
      if (!wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => {
          wakeLock = null;
        });
      }
    } catch {}
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }
}

// Re-acquire wake lock if tab becomes visible while clock is running
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && engine) {
    const snap = engine.getSnapshot();
    if (snap.state === CLOCK_STATES.RUNNING) {
      requestWakeLock();
    }
  }
});

/**
 * Native Fullscreen API
 */
function toggleFullscreen() {
  if (!document.fullscreenElement && !document.webkitFullscreenElement) {
    const docEl = document.documentElement;
    const reqFn = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.msRequestFullscreen;
    if (reqFn) {
      reqFn.call(docEl).catch(() => {});
    }
    shell.classList.add('is-fullscreen-app');
  } else {
    const exitFn = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
    if (exitFn) {
      exitFn.call(document).catch(() => {});
    }
    shell.classList.remove('is-fullscreen-app');
  }
  updateFullscreenIcon();
}

function updateFullscreenIcon() {
  const isFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
  iconEnterFullscreen.hidden = isFs;
  iconExitFullscreen.hidden = !isFs;
}

document.addEventListener('fullscreenchange', () => {
  const isFs = Boolean(document.fullscreenElement);
  shell.classList.toggle('is-fullscreen-app', isFs);
  updateFullscreenIcon();
});

/**
 * Sound Toggle & Icon
 */
function handleSoundToggle() {
  const muted = toggleAudioMuted();
  updateSoundIcon();
  if (!muted) {
    playMoveSound();
  }
}

function updateSoundIcon() {
  const muted = isAudioMuted();
  iconSoundOn.hidden = muted;
  iconSoundOff.hidden = !muted;
  btnSound.setAttribute('aria-label', muted ? 'Unmute Sound' : 'Mute Sound');
}

/**
 * Populate Popular Presets Grid in Modal
 */
function populatePresets() {
  if (!presetsGrid) return;
  presetsGrid.innerHTML = '';

  PRESET_TIME_CONTROLS.forEach((preset) => {
    const chip = document.createElement('button');
    chip.className = 'preset-chip';
    chip.type = 'button';
    chip.textContent = preset.label;
    chip.dataset.presetId = preset.id;

    if (currentConfig && currentConfig.presetId === preset.id) {
      chip.classList.add('is-selected');
    }

    chip.addEventListener('click', () => {
      selectPreset(preset);
    });

    presetsGrid.appendChild(chip);
  });
}

function selectPreset(preset) {
  document.querySelectorAll('.preset-chip').forEach((c) => c.classList.remove('is-selected'));
  const selectedChip = document.querySelector(`.preset-chip[data-preset-id="${preset.id}"]`);
  if (selectedChip) selectedChip.classList.add('is-selected');

  customMinutes.value = preset.baseMinutes;
  customSeconds.value = preset.baseSeconds;
  customIncrement.value = preset.increment;
  customMode.value = preset.mode;

  currentConfig = {
    presetId: preset.id,
    label: preset.label,
    baseMinutes: preset.baseMinutes,
    baseSeconds: preset.baseSeconds,
    increment: preset.increment,
    mode: preset.mode
  };
}

/**
 * Apply Settings & Reset Clock
 */
function applySettings() {
  const mins = parseInt(customMinutes.value, 10) || 0;
  const secs = parseInt(customSeconds.value, 10) || 0;
  const inc = parseInt(customIncrement.value, 10) || 0;
  const mode = customMode.value || TIMING_MODES.FISCHER;

  // Find if matching preset or custom
  const matchingPreset = PRESET_TIME_CONTROLS.find(
    (p) => p.baseMinutes === mins && p.baseSeconds === secs && p.increment === inc && p.mode === mode
  );

  currentConfig = {
    presetId: matchingPreset ? matchingPreset.id : 'custom',
    label: matchingPreset ? matchingPreset.label : `${mins}m ${secs > 0 ? secs + 's' : ''} + ${inc}s`,
    baseMinutes: mins,
    baseSeconds: secs,
    increment: inc,
    mode
  };

  try {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(currentConfig));
  } catch {}

  settingsModalBackdrop.hidden = true;
  flagOverlay.hidden = true;
  initEngine();
}

/**
 * Theme selection update
 */
function updateThemeSelection(themeName) {
  document.querySelectorAll('.theme-pill').forEach((pill) => {
    pill.classList.toggle('is-selected', pill.dataset.themeVal === themeName);
  });
}

/**
 * Bind DOM & Keyboard Events
 */
function bindEvents() {
  // Clock Zones Tap / Pointer
  zone1.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    handleZoneTap(1);
  });

  zone2.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    handleZoneTap(2);
  });

  // HUD Buttons
  btnPlayPause.addEventListener('click', togglePlayPause);
  btnReset.addEventListener('click', requestReset);
  btnSound.addEventListener('click', handleSoundToggle);
  btnFullscreen.addEventListener('click', toggleFullscreen);

  // Settings Buttons
  const openSettings = () => {
    settingsModalBackdrop.hidden = false;
    populatePresets();
  };
  btnSettings.addEventListener('click', openSettings);
  if (headerSettingsBtn) headerSettingsBtn.addEventListener('click', openSettings);
  btnCloseSettings.addEventListener('click', () => {
    settingsModalBackdrop.hidden = true;
  });
  btnApplySettings.addEventListener('click', applySettings);

  // Shortcuts Modal
  if (headerShortcutsBtn) {
    headerShortcutsBtn.addEventListener('click', () => {
      shortcutsModalBackdrop.hidden = false;
    });
  }
  btnCloseShortcuts.addEventListener('click', () => {
    shortcutsModalBackdrop.hidden = true;
  });

  // Reset Modal
  btnConfirmReset.addEventListener('click', confirmReset);
  btnCancelReset.addEventListener('click', () => {
    resetModalBackdrop.hidden = true;
  });

  // Flag Overlay Buttons
  btnFlagRestart.addEventListener('click', () => {
    flagOverlay.hidden = true;
    initEngine();
  });
  btnFlagClose.addEventListener('click', () => {
    flagOverlay.hidden = true;
  });

  // Theme Pills
  document.querySelectorAll('.theme-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      const themeVal = pill.dataset.themeVal;
      document.documentElement.setAttribute('data-theme', themeVal);
      try {
        localStorage.setItem(STORAGE_KEY_THEME, themeVal);
      } catch {}
      updateThemeSelection(themeVal);
    });
  });

  // Sound Option Buttons
  const activeSound = getSoundType();
  document.querySelectorAll('.sound-btn').forEach((btn) => {
    btn.classList.toggle('is-selected', btn.dataset.soundVal === activeSound);
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sound-btn').forEach((b) => b.classList.remove('is-selected'));
      btn.classList.add('is-selected');
      const soundVal = btn.dataset.soundVal;
      setSoundType(soundVal);
      playMoveSound(soundVal);
    });
  });

  // Invert Opponent Toggle
  if (toggleRotateOpponent) {
    toggleRotateOpponent.addEventListener('change', (e) => {
      const unmirrored = !e.target.checked;
      shell.classList.toggle('is-unmirrored', unmirrored);
      try {
        localStorage.setItem(STORAGE_KEY_UNMIRRORED, String(unmirrored));
      } catch {}
    });
  }

  // Haptics Toggle
  if (toggleHaptics) {
    toggleHaptics.checked = isHapticsEnabled();
    toggleHaptics.addEventListener('change', (e) => {
      setHapticsEnabled(e.target.checked);
    });
  }

  // Close modals on backdrop click
  [settingsModalBackdrop, resetModalBackdrop, shortcutsModalBackdrop].forEach((backdrop) => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        backdrop.hidden = true;
      }
    });
  });

  // Keyboard Shortcuts (Desktop / Arbiter / Practice)
  document.addEventListener('keydown', (e) => {
    // Ignore keystrokes inside input fields
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) {
      if (e.key === 'Escape') {
        settingsModalBackdrop.hidden = true;
      }
      return;
    }

    if (e.key === 'Escape') {
      settingsModalBackdrop.hidden = true;
      resetModalBackdrop.hidden = true;
      shortcutsModalBackdrop.hidden = true;
      flagOverlay.hidden = true;
      return;
    }

    if (e.code === 'Space') {
      e.preventDefault();
      if (!engine) return;
      const snap = engine.getSnapshot();
      if (snap.state === CLOCK_STATES.READY) {
        handleZoneTap(1);
      } else if (snap.state === CLOCK_STATES.RUNNING) {
        handleZoneTap(snap.activePlayer);
      } else if (snap.state === CLOCK_STATES.PAUSED) {
        togglePlayPause();
      }
    } else if (e.key.toLowerCase() === 'p') {
      e.preventDefault();
      togglePlayPause();
    } else if (e.key.toLowerCase() === 'r') {
      e.preventDefault();
      requestReset();
    } else if (e.key.toLowerCase() === 'f') {
      e.preventDefault();
      toggleFullscreen();
    } else if (e.key.toLowerCase() === 's') {
      e.preventDefault();
      openSettings();
    } else if (e.key.toLowerCase() === 'm') {
      e.preventDefault();
      handleSoundToggle();
    } else if (e.key === '1' || e.key === 'ArrowLeft') {
      e.preventDefault();
      handleZoneTap(1);
    } else if (e.key === '2' || e.key === 'ArrowRight') {
      e.preventDefault();
      handleZoneTap(2);
    }
  });
}

// Bootstrap
init();
