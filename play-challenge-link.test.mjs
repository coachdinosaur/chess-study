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

test('builds and reads a reusable play challenge link', () => {
  const link = buildPlayChallengeLink(config, { href: 'https://cddigital.top/?old=1#section' });
  const url = new URL(link);

  assert.equal(url.origin + url.pathname, 'https://cddigital.top/');
  assert.equal(url.hash, '');
  assert.deepEqual(readPlayChallenge(url), config);
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
});
