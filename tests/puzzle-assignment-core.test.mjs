import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LEVEL_PRESETS,
  normalizeAssignmentSettings,
  presetFor,
  selectAssignmentPuzzles,
  snapshotPuzzle,
} from '../management/js/puzzle-assignment-core.mjs';

function records(count = 40) {
  return Array.from({ length: count }, (_, index) => ({
    id: `p${index}`,
    sourceFen: '8/8/8/8/8/8/8/K6k w - - 0 1',
    startFen: '8/8/8/8/8/8/8/K6k b - - 1 1',
    repairMove: 'a1a2',
    solverColor: 'b',
    rating: 700 + index * 20,
    themes: index % 2 ? ['fork'] : ['pin'],
  }));
}

test('student-level presets expose bounded rating ranges and assignment sizes', () => {
  for (const [key, preset] of Object.entries(LEVEL_PRESETS)) {
    assert.equal(presetFor(key), preset);
    assert.ok(preset.minRating >= 400);
    assert.ok(preset.maxRating <= 3000);
    assert.ok(preset.maxRating >= preset.minRating);
    assert.ok(preset.puzzleCount >= 1 && preset.puzzleCount <= 30);
  }
});

test('assignment settings clamp unsafe numeric values', () => {
  const settings = normalizeAssignmentSettings({
    level: 'custom',
    minRating: 10,
    maxRating: 9999,
    puzzleCount: 200,
    themes: ['fork', 'any', ''],
  });
  assert.deepEqual(settings, {
    level: 'custom',
    minRating: 400,
    maxRating: 3000,
    puzzleCount: 30,
    themes: ['fork'],
  });
});

test('puzzle selection freezes unique snapshots matching rating and theme', () => {
  const selected = selectAssignmentPuzzles(records(), {
    level: 'custom',
    minRating: 700,
    maxRating: 1480,
    puzzleCount: 8,
    themes: ['fork'],
  }, {
    random: () => 0.25,
  });

  assert.equal(selected.length, 8);
  assert.equal(new Set(selected.map((item) => item.id)).size, 8);
  assert.ok(selected.every((item) => item.rating >= 700 && item.rating <= 1480));
  assert.ok(selected.every((item) => item.themes.includes('fork')));
  assert.ok(selected.every((item) => item.startFen && item.repairMove));
});

test('selection rejects a request with too few matching records', () => {
  assert.throws(() => selectAssignmentPuzzles(records(4), {
    level: 'custom',
    minRating: 700,
    maxRating: 900,
    puzzleCount: 10,
    themes: ['fork'],
  }), /Only \d+ puzzles match/);
});

test('snapshot removes unrelated source fields', () => {
  const snapshot = snapshotPuzzle({
    id: 'p1',
    sourceFen: 'source',
    startFen: 'start',
    repairMove: 'a1a2',
    solverColor: 'b',
    rating: 900,
    themes: ['fork'],
    secret: 'not copied',
  });
  assert.equal(snapshot.secret, undefined);
  assert.equal(snapshot.id, 'p1');
  assert.deepEqual(snapshot.themes, ['fork']);
});
