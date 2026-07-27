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

export function buildPlayChallengeLink(config, locationObject = globalThis.location) {
  const challenge = normalizePlayChallenge(config);
  const url = new URL(locationObject?.href || String(locationObject || ''));
  url.search = '';
  url.hash = '';
  url.searchParams.set('playChallenge', PLAY_CHALLENGE_VERSION);
  url.searchParams.set('playFen', challenge.fen);
  url.searchParams.set('playSkill', String(challenge.skill));
  url.searchParams.set('playSide', challenge.side);
  url.searchParams.set('playTime', challenge.timeControl);
  url.searchParams.set('playSpeed', challenge.thinkingSpeed);
  return url.toString();
}

export function readPlayChallenge(locationObject = globalThis.location) {
  const search = locationObject?.search
    ?? new URL(locationObject?.href || String(locationObject || '')).search;
  const params = new URLSearchParams(search);
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
