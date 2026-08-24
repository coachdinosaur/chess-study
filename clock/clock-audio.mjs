/**
 * ClockAudio — Zero-latency Web Audio API Procedural Sound & Haptics Engine
 * Provides synthesized sounds for mechanical switch clicks, digital beeps, wood taps,
 * low-time warnings, and flag-fall buzzers without external audio file dependencies.
 */

const STORAGE_KEY_SOUND = 'chess-clock-sound-type-v1';
const STORAGE_KEY_MUTED = 'chess-clock-muted-v1';
const STORAGE_KEY_HAPTIC = 'chess-clock-haptic-v1';

export const SOUND_TYPES = {
  MECHANICAL: 'mechanical',
  BEEP: 'beep',
  WOOD: 'wood',
  SILENT: 'silent'
};

let audioCtx = null;
let currentSoundType = SOUND_TYPES.MECHANICAL;
let isMuted = false;
let isHapticEnabled = true;

// Initialize preferences from localStorage
try {
  const savedSound = localStorage.getItem(STORAGE_KEY_SOUND);
  if (savedSound && Object.values(SOUND_TYPES).includes(savedSound)) {
    currentSoundType = savedSound;
  }
  const savedMuted = localStorage.getItem(STORAGE_KEY_MUTED);
  if (savedMuted !== null) {
    isMuted = savedMuted === 'true';
  }
  const savedHaptic = localStorage.getItem(STORAGE_KEY_HAPTIC);
  if (savedHaptic !== null) {
    isHapticEnabled = savedHaptic !== 'false';
  }
} catch {}

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function getSoundType() {
  return currentSoundType;
}

export function setSoundType(type) {
  if (Object.values(SOUND_TYPES).includes(type)) {
    currentSoundType = type;
    try {
      localStorage.setItem(STORAGE_KEY_SOUND, type);
    } catch {}
  }
}

export function isAudioMuted() {
  return isMuted;
}

export function setAudioMuted(muted) {
  isMuted = Boolean(muted);
  try {
    localStorage.setItem(STORAGE_KEY_MUTED, String(isMuted));
  } catch {}
}

export function toggleAudioMuted() {
  setAudioMuted(!isMuted);
  return isMuted;
}

export function isHapticsEnabled() {
  return isHapticEnabled;
}

export function setHapticsEnabled(enabled) {
  isHapticEnabled = Boolean(enabled);
  try {
    localStorage.setItem(STORAGE_KEY_HAPTIC, String(isHapticEnabled));
  } catch {}
}

/**
 * Trigger subtle device vibration if supported
 */
export function triggerHaptic(durationMs = 25) {
  if (!isHapticEnabled) return;
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(durationMs);
    } catch {}
  }
}

/**
 * Play move sound based on selected sound type
 */
export function playMoveSound(overrideType = null) {
  triggerHaptic(20);
  if (isMuted) return;

  const type = overrideType || currentSoundType;
  if (type === SOUND_TYPES.SILENT) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  if (type === SOUND_TYPES.MECHANICAL) {
    playMechanicalClick(ctx);
  } else if (type === SOUND_TYPES.BEEP) {
    playDigitalBeep(ctx);
  } else if (type === SOUND_TYPES.WOOD) {
    playWoodTap(ctx);
  }
}

/**
 * Mechanical switch click (tactile micro-snap)
 */
function playMechanicalClick(ctx) {
  const now = ctx.currentTime;
  
  // High click component
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(1400, now);
  osc.frequency.exponentialRampToValueAtTime(180, now + 0.022);
  gain.gain.setValueAtTime(0.4, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.03);

  // Subtle lower body thud
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(320, now + 0.004);
  osc2.frequency.exponentialRampToValueAtTime(80, now + 0.035);
  gain2.gain.setValueAtTime(0.25, now + 0.004);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.038);
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(now + 0.004);
  osc2.stop(now + 0.04);
}

/**
 * Digital electronic beep (DGT 2010 style)
 */
function playDigitalBeep(ctx) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1800, now);
  gain.gain.setValueAtTime(0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.045);
}

/**
 * Wood piece tap
 */
function playWoodTap(ctx) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(220, now);
  osc.frequency.exponentialRampToValueAtTime(60, now + 0.05);
  gain.gain.setValueAtTime(0.45, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.06);
}

/**
 * Low-time warning tick (<10s)
 */
export function playLowTimeTick() {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, now);
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.035);
}

/**
 * Flag fall buzzer / alarm
 */
export function playFlagFallAlarm() {
  triggerHaptic([100, 50, 100, 50, 200]);
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  
  // Tone 1: High alarm
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'square';
  osc1.frequency.setValueAtTime(660, now);
  gain1.gain.setValueAtTime(0.2, now);
  gain1.gain.setValueAtTime(0.2, now + 0.15);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.22);

  // Tone 2: Low alarm
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sawtooth';
  osc2.frequency.setValueAtTime(440, now + 0.22);
  gain2.gain.setValueAtTime(0.25, now + 0.22);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(now + 0.22);
  osc2.stop(now + 0.7);
}
