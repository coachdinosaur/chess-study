import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TRAINING_OBJECTIVE_DRAW,
  TRAINING_OBJECTIVE_WIN,
  classifyStudentMove,
  deriveTrainingObjective,
  engineScoreForSolver,
  isTrainingSolved,
  prepareLichessTrainingPuzzle,
  tablebaseOutcomeForSolver,
} from '../lichess-position-training-core.mjs';

test('repair move makes White the solver when Black moved first', () => {
  const puzzle = prepareLichessTrainingPuzzle({
    id: 'white-solver',
    sourceFen: '7k/8/6K1/8/8/8/3Q4/8 b - - 0 1',
    repairMove: 'h8g8',
  });
  assert.equal(puzzle.losingMoverColor, 'b');
  assert.equal(puzzle.solverColor, 'w');
  assert.match(puzzle.startFen, / w /);
});

test('repair move makes Black the solver when White moved first', () => {
  const puzzle = prepareLichessTrainingPuzzle({
    id: 'black-solver',
    sourceFen: '8/8/8/8/8/6k1/3q4/7K w - - 0 1',
    repairMove: 'h1g1',
  });
  assert.equal(puzzle.losingMoverColor, 'w');
  assert.equal(puzzle.solverColor, 'b');
  assert.match(puzzle.startFen, / b /);
});

test('engine scores are converted to the solver perspective', () => {
  assert.deepEqual(engineScoreForSolver({ type: 'cp', value: 300 }, 'w', 'w'), { type: 'cp', value: 300 });
  assert.deepEqual(engineScoreForSolver({ type: 'cp', value: 300 }, 'w', 'b'), { type: 'cp', value: -300 });
  assert.deepEqual(engineScoreForSolver({ type: 'mate', value: -2 }, 'b', 'w'), { type: 'mate', value: 2 });
});

test('tablebase outcome is also solver-relative', () => {
  assert.equal(tablebaseOutcomeForSolver('win', 'w', 'w'), 'win');
  assert.equal(tablebaseOutcomeForSolver('win', 'w', 'b'), 'loss');
  assert.equal(tablebaseOutcomeForSolver('loss', 'b', 'w'), 'win');
  assert.equal(tablebaseOutcomeForSolver('draw', 'b', 'w'), 'draw');
  assert.equal(tablebaseOutcomeForSolver('cursed-win', 'w', 'w'), 'draw');
  assert.equal(tablebaseOutcomeForSolver('blessed-loss', 'b', 'w'), 'draw');
});

test('positions where the solver is losing are rejected as training starts', () => {
  assert.equal(deriveTrainingObjective({ outcome: 'loss', solverScore: { type: 'cp', value: -800 } }), null);
  assert.equal(deriveTrainingObjective({ outcome: 'win', solverScore: { type: 'cp', value: 500 } }), TRAINING_OBJECTIVE_WIN);
  assert.equal(deriveTrainingObjective({ outcome: 'draw', solverScore: { type: 'cp', value: 0 } }), TRAINING_OBJECTIVE_DRAW);
});

test('a different winning move is accepted without matching a stored line', () => {
  const result = classifyStudentMove({
    objective: TRAINING_OBJECTIVE_WIN,
    baseline: { solverScore: { type: 'cp', value: 650 } },
    afterMove: { solverScore: { type: 'cp', value: 410 }, outcome: 'win' },
  });
  assert.equal(result.accepted, true);
});

test('throwing away a win is rejected', () => {
  const result = classifyStudentMove({
    objective: TRAINING_OBJECTIVE_WIN,
    baseline: { solverScore: { type: 'cp', value: 650 } },
    afterMove: { solverScore: { type: 'cp', value: 0 }, outcome: 'draw' },
  });
  assert.equal(result.accepted, false);
});

test('mate-tagged training does not finish before checkmate', () => {
  const game = {
    isCheckmate: () => false,
    isDraw: () => false,
    turn: () => 'b',
  };
  const solved = isTrainingSolved({
    game,
    objective: TRAINING_OBJECTIVE_WIN,
    solverColor: 'w',
    solverMoves: 4,
    startMaterial: 9,
    evaluation: { outcome: 'win', solverScore: { type: 'cp', value: 10000 } },
    themes: ['mate'],
  });
  assert.equal(solved, false);
});
