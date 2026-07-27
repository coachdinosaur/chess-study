import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPlayChallengeLink,
  normalizePlayChallenge,
  readPlayChallenge,
} from './play-challenge-link.mjs';

const config = {
  fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
  skill: 1450,
  side: 'black',
  timeControl: '15+10',
  thinkingSpeed: 'slow',
};

test('builds and reads a compact reusable play challenge link', () => {
  const link = buildPlayChallengeLink(config, { href: 'https://cddigital.top/?old=1#section' });
  const url = new URL(link);

  assert.equal(url.origin + url.pathname, 'https://cddigital.top/');
  assert.equal(url.hash, '');
  assert.ok(url.searchParams.has('pc'));
  assert.equal(url.searchParams.has('playFen'), false);
  assert.ok(link.length < 140, `Expected a compact link, received ${link.length} characters.`);
  assert.deepEqual(readPlayChallenge(url), config);
});

test('continues to read first-generation prepared links', () => {
  const legacy = new URL('https://cddigital.top/');
  legacy.searchParams.set('playChallenge', '1');
  legacy.searchParams.set('playFen', config.fen);
  legacy.searchParams.set('playSkill', String(config.skill));
  legacy.searchParams.set('playSide', config.side);
  legacy.searchParams.set('playTime', config.timeControl);
  legacy.searchParams.set('playSpeed', config.thinkingSpeed);

  assert.deepEqual(readPlayChallenge(legacy), config);
});

test('returns null for a normal app URL', () => {
  assert.equal(readPlayChallenge({ search: '?tab=play' }), null);
});

test('rejects invalid prepared settings', () => {
  assert.throws(
    () => normalizePlayChallenge({ ...config, skill: 799 }),
    /between 800 and 3190 Elo/,
  );
  assert.throws(
    () => normalizePlayChallenge({ ...config, timeControl: '2+1' }),
    /time control is invalid/,
  );
  assert.throws(
    () => readPlayChallenge({ search: '?pc=1~broken' }),
    /unsupported format/,
  );
});
