export const PLAY_CHALLENGE_VERSION = '1';

export const PLAY_CHALLENGE_TIME_CONTROLS = Object.freeze([
  'none',
  '1+0',
  '3+2',
  '5+0',
  '10+0',
  '15+10',
  '30+0',
  '45+45',
]);

export const PLAY_CHALLENGE_SIDES = Object.freeze(['white', 'black', 'random']);
export const PLAY_CHALLENGE_SPEEDS = Object.freeze(['instant', 'fast', 'normal', 'slow']);

const TIME_CONTROL_SET = new Set(PLAY_CHALLENGE_TIME_CONTROLS);
const SIDE_SET = new Set(PLAY_CHALLENGE_SIDES);
const SPEED_SET = new Set(PLAY_CHALLENGE_SPEEDS);
const COMPACT_PARAM = 'pc';

const SIDE_CODES = Object.freeze({
  white: 'w',
  black: 'b',
  random: 'r',
});
const TIME_CONTROL_CODES = Object.freeze({
  none: 'n',
  '1+0': 'a',
  '3+2': 'b',
  '5+0': 'c',
  '10+0': 'd',
  '15+10': 'e',
  '30+0': 'f',
  '45+45': 'g',
});
const SPEED_CODES = Object.freeze({
  instant: 'i',
  fast: 'f',
  normal: 'n',
  slow: 's',
});

const SIDE_VALUES = Object.freeze(Object.fromEntries(Object.entries(SIDE_CODES).map(([value, code]) => [code, value])));
const TIME_CONTROL_VALUES = Object.freeze(Object.fromEntries(Object.entries(TIME_CONTROL_CODES).map(([value, code]) => [code, value])));
const SPEED_VALUES = Object.freeze(Object.fromEntries(Object.entries(SPEED_CODES).map(([value, code]) => [code, value])));

function normalizeSkill(value) {
  const skill = Number(String(value ?? '').trim());
  if (!Number.isInteger(skill) || skill < 800 || skill > 3190) {
    throw new Error('Engine strength must be between 800 and 3190 Elo.');
  }
  return skill;
}

function normalizeFen(value) {
  const fen = String(value || '').trim().replace(/\s+/g, ' ');
  if (!fen || fen.length > 200) {
    throw new Error('The prepared starting position is missing or too long.');
  }
  return fen;
}

function normalizeChoice(value, allowed, errorMessage) {
  const normalized = String(value || '').trim();
  if (!allowed.has(normalized)) {
    throw new Error(errorMessage);
  }
  return normalized;
}

export function normalizePlayChallenge(config = {}) {
  return {
    fen: normalizeFen(config.fen),
    skill: normalizeSkill(config.skill),
    side: normalizeChoice(config.side, SIDE_SET, 'The prepared color is invalid.'),
    timeControl: normalizeChoice(
      config.timeControl,
      TIME_CONTROL_SET,
      'The prepared time control is invalid.',
    ),
    thinkingSpeed: normalizeChoice(
      config.thinkingSpeed,
      SPEED_SET,
      'The prepared thinking speed is invalid.',
    ),
  };
}

function encodeCompactFen(fen) {
  return fen.replaceAll('/', '.').replaceAll(' ', '_');
}

function decodeCompactFen(value) {
  return String(value || '').replaceAll('_', ' ').replaceAll('.', '/');
}

function encodeCompactChallenge(challenge) {
  return [
    PLAY_CHALLENGE_VERSION,
    encodeCompactFen(challenge.fen),
    String(challenge.skill),
    SIDE_CODES[challenge.side],
    TIME_CONTROL_CODES[challenge.timeControl],
    SPEED_CODES[challenge.thinkingSpeed],
  ].join('~');
}

function decodeCompactChallenge(payload) {
  const parts = String(payload || '').split('~');
  if (parts.length !== 6 || parts[0] !== PLAY_CHALLENGE_VERSION) {
    throw new Error('This prepared game link uses an unsupported format.');
  }
  return normalizePlayChallenge({
    fen: decodeCompactFen(parts[1]),
    skill: parts[2],
    side: SIDE_VALUES[parts[3]],
    timeControl: TIME_CONTROL_VALUES[parts[4]],
    thinkingSpeed: SPEED_VALUES[parts[5]],
  });
}

export function buildPlayChallengeLink(config, locationObject = globalThis.location) {
  const challenge = normalizePlayChallenge(config);
  const url = new URL(locationObject?.href || String(locationObject || ''));
  url.search = '';
  url.hash = '';
  return `${url.toString()}?${COMPACT_PARAM}=${encodeCompactChallenge(challenge)}`;
}

export function readPlayChallenge(locationObject = globalThis.location) {
  const search = locationObject?.search
    ?? new URL(locationObject?.href || String(locationObject || '')).search;
  const params = new URLSearchParams(search);
  const compactPayload = params.get(COMPACT_PARAM);
  if (compactPayload) {
    return decodeCompactChallenge(compactPayload);
  }

  // Backward compatibility for links created by the first implementation.
  if (params.get('playChallenge') !== PLAY_CHALLENGE_VERSION) {
    return null;
  }
  return normalizePlayChallenge({
    fen: params.get('playFen'),
    skill: params.get('playSkill'),
    side: params.get('playSide'),
    timeControl: params.get('playTime'),
    thinkingSpeed: params.get('playSpeed'),
  });
}
