import test from 'node:test';
import assert from 'node:assert/strict';
import { PositionTrainingEvaluator } from '../lichess-position-training-engine.mjs';

const CHECKMATE_FEN = '3Q2k1/5ppp/8/8/7P/8/P3pqPK/8 b - - 0 1';
const STALEMATE_FEN = '7k/5K2/6Q1/8/8/8/8/8 b - - 0 1';

test('delivered checkmate is a terminal win without starting Stockfish', async () => {
  const evaluator = new PositionTrainingEvaluator();
  let engineCalled = false;
  evaluator.stockfish.analyse = async () => {
    engineCalled = true;
    throw new Error('Stockfish must not run for terminal checkmate.');
  };

  const result = await evaluator.evaluate(CHECKMATE_FEN, 'w');
  assert.equal(engineCalled, false);
  assert.equal(result.source, 'terminal');
  assert.equal(result.outcome, 'win');
  assert.deepEqual(result.solverScore, { type: 'mate', value: 1 });
  assert.equal(result.bestMove, '');
  evaluator.dispose();
});

test('the checkmated side receives a terminal loss', async () => {
  const evaluator = new PositionTrainingEvaluator();
  const result = await evaluator.evaluate(CHECKMATE_FEN, 'b');
  assert.equal(result.source, 'terminal');
  assert.equal(result.outcome, 'loss');
  assert.deepEqual(result.solverScore, { type: 'mate', value: -1 });
  evaluator.dispose();
});

test('terminal draw is returned without starting Stockfish', async () => {
  const evaluator = new PositionTrainingEvaluator();
  let engineCalled = false;
  evaluator.stockfish.analyse = async () => {
    engineCalled = true;
    throw new Error('Stockfish must not run for terminal draw.');
  };

  const result = await evaluator.evaluate(STALEMATE_FEN, 'w');
  assert.equal(engineCalled, false);
  assert.equal(result.source, 'terminal');
  assert.equal(result.outcome, 'draw');
  assert.deepEqual(result.solverScore, { type: 'cp', value: 0 });
  evaluator.dispose();
});
