import assert from 'node:assert/strict';
import test from 'node:test';
import { PositionTrainingLearning } from '../lichess-position-training-learning.mjs';

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

const puzzle = Object.freeze({
  id: 'learning-test-1',
  sourceFen: '4k3/8/8/8/8/8/4r3/4K3 b - - 0 1',
  startFen: '4k3/8/8/8/8/8/8/4K3 w - - 0 2',
  repairMove: 'e2e1',
  solverColor: 'w',
  losingMoverColor: 'b',
  rating: 1400,
  themes: ['defensiveMove', 'endgame', 'short'],
});

test('progressive hints reveal concept, source, target, then move', () => {
  const learning = new PositionTrainingLearning({ storage: new MemoryStorage(), now: () => 1000 });
  learning.beginPuzzle(puzzle);
  const first = learning.nextHint({ puzzle, bestMove: 'e1e2', objectiveText: 'Hold the position' });
  const second = learning.nextHint({ puzzle, bestMove: 'e1e2', objectiveText: 'Hold the position' });
  const third = learning.nextHint({ puzzle, bestMove: 'e1e2', objectiveText: 'Hold the position' });
  const fourth = learning.nextHint({ puzzle, bestMove: 'e1e2', objectiveText: 'Hold the position' });
  assert.equal(first.level, 1);
  assert.equal(first.from, '');
  assert.equal(second.from, 'e1');
  assert.equal(second.to, '');
  assert.equal(third.to, 'e2');
  assert.match(fourth.text, /leading candidate/i);
});

test('mistakes enter review and two clean review solves retire the puzzle', () => {
  let now = 1000;
  const learning = new PositionTrainingLearning({ storage: new MemoryStorage(), now: () => now });
  learning.beginPuzzle(puzzle);
  learning.recordMistake({ puzzle, moveSan: 'Kf1', reason: 'The move loses.' });
  assert.equal(learning.reviewCount(), 1);
  assert.equal(learning.nextReview().id, puzzle.id);

  learning.beginPuzzle(puzzle, { reviewMode: true });
  learning.recordSolved({ puzzle, moveSan: 'Ke2', objectiveText: 'Hold', verdictReason: 'Draw preserved', bestMove: 'e1e2' });
  assert.equal(learning.reviewCount(), 1);

  now += 24 * 60 * 60 * 1000;
  learning.beginPuzzle(puzzle, { reviewMode: true });
  learning.recordSolved({ puzzle, moveSan: 'Ke2', objectiveText: 'Hold', verdictReason: 'Draw preserved', bestMove: 'e1e2' });
  assert.equal(learning.reviewCount(), 0);
});

test('adaptive filters follow the rating and weakest theme', () => {
  const learning = new PositionTrainingLearning({ storage: new MemoryStorage(), now: () => 1000 });
  learning.beginPuzzle(puzzle);
  learning.recordMistake({ puzzle, moveSan: 'Kf1', reason: 'Lost' });
  const filters = learning.effectiveFilters({ difficultyMode: 'adaptive', theme: 'weakest', minRating: 400, maxRating: 3000 });
  assert.equal(filters.theme, 'defensiveMove');
  assert.ok(filters.minRating < filters.maxRating);
  assert.ok(filters.minRating <= learning.adaptiveRating());
  assert.ok(filters.maxRating >= learning.adaptiveRating());
});

test('theme dashboard records attempts, mistakes, hints and solves', () => {
  const learning = new PositionTrainingLearning({ storage: new MemoryStorage(), now: () => 1000 });
  learning.beginPuzzle(puzzle);
  learning.nextHint({ puzzle, bestMove: 'e1e2' });
  learning.recordMistake({ puzzle, moveSan: 'Kf1', reason: 'Lost' });
  learning.recordSolved({ puzzle, moveSan: 'Ke2', objectiveText: 'Hold', verdictReason: 'Draw preserved', bestMove: 'e1e2' });
  const row = learning.dashboard().find((item) => item.theme === 'defensiveMove');
  assert.equal(row.attempts, 1);
  assert.equal(row.solved, 1);
  assert.equal(row.mistakes, 1);
  assert.equal(row.hints, 1);
});
