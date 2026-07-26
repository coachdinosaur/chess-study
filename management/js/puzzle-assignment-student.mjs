import { Chess } from '../../vendor/chess.js';
import {
  classifyStudentMove,
  deriveTrainingObjective,
  prepareLichessTrainingPuzzle,
  uciToMove,
} from '../../lichess-position-training-core.mjs';
import { PositionTrainingEvaluator } from '../../lichess-position-training-engine.mjs';
import { getSupabase, readableError } from './supabase-client.mjs';

const PIECE_ASSETS = Object.freeze({
  w: Object.freeze({ k: '../assets/pieces/mpchess/wK.svg', q: '../assets/pieces/mpchess/wQ.svg', r: '../assets/pieces/mpchess/wR.svg', b: '../assets/pieces/mpchess/wB.svg', n: '../assets/pieces/mpchess/wN.svg', p: '../assets/pieces/mpchess/wP.svg' }),
  b: Object.freeze({ k: '../assets/pieces/mpchess/bK.svg', q: '../assets/pieces/mpchess/bQ.svg', r: '../assets/pieces/mpchess/bR.svg', b: '../assets/pieces/mpchess/bB.svg', n: '../assets/pieces/mpchess/bN.svg', p: '../assets/pieces/mpchess/bP.svg' }),
});

const THEME_LABELS = Object.freeze({
  mate: 'Checkmating attack',
  mateIn1: 'Mate in one',
  mateIn2: 'Mate in two',
  fork: 'Fork',
  pin: 'Pin',
  skewer: 'Skewer',
  sacrifice: 'Sacrifice',
  defensiveMove: 'Defensive move',
  endgame: 'Endgame',
  rookEndgame: 'Rook endgame',
  pawnEndgame: 'Pawn endgame',
  promotion: 'Promotion',
  discoveredAttack: 'Discovered attack',
  advancedPawn: 'Advanced pawn',
  kingsideAttack: 'King attack',
});

const elements = {
  loading: document.querySelector('#assignmentLoading'),
  error: document.querySelector('#assignmentError'),
  shell: document.querySelector('#assignmentShell'),
  title: document.querySelector('#assignmentTitle'),
  student: document.querySelector('#assignmentStudent'),
  instructions: document.querySelector('#assignmentInstructions'),
  due: document.querySelector('#assignmentDue'),
  progress: document.querySelector('#assignmentProgress'),
  score: document.querySelector('#assignmentScore'),
  board: document.querySelector('#assignmentBoard'),
  boardWrap: document.querySelector('#assignmentBoardWrap'),
  positionMeta: document.querySelector('#assignmentPositionMeta'),
  themes: document.querySelector('#assignmentThemes'),
  feedback: document.querySelector('#assignmentFeedback'),
  hint: document.querySelector('#assignmentHintButton'),
  reset: document.querySelector('#assignmentResetButton'),
  next: document.querySelector('#assignmentNextButton'),
  results: document.querySelector('#assignmentResults'),
};

const app = {
  token: '',
  payload: null,
  puzzles: [],
  attempts: new Map(),
  index: 0,
  puzzle: null,
  prepared: null,
  game: null,
  evaluator: new PositionTrainingEvaluator(),
  baseline: null,
  objective: null,
  selectedSquare: '',
  busy: false,
  mistakes: 0,
  hintsUsed: 0,
  startedAt: 0,
  finishedCurrent: false,
  lastSave: null,
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function parseToken() {
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  return params.get('token') || '';
}

function formatDate(value) {
  if (!value) return 'No due date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No due date';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'long', timeStyle: 'short' }).format(date);
}

function setFeedback(message = '', tone = 'info') {
  elements.feedback.hidden = !message;
  elements.feedback.className = `assignment-feedback ${tone}`;
  elements.feedback.textContent = message;
}

function setError(error) {
  elements.loading.hidden = true;
  elements.shell.hidden = true;
  elements.error.hidden = false;
  elements.error.textContent = readableError(error);
}

function pieceAlt(piece) {
  const names = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };
  return `${piece.color === 'w' ? 'White' : 'Black'} ${names[piece.type]}`;
}

function displaySquares() {
  const files = app.prepared.solverColor === 'b'
    ? ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a']
    : ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = app.prepared.solverColor === 'b'
    ? ['1', '2', '3', '4', '5', '6', '7', '8']
    : ['8', '7', '6', '5', '4', '3', '2', '1'];
  return ranks.flatMap((rank) => files.map((file) => `${file}${rank}`));
}

function renderBoard() {
  const legal = new Set();
  if (app.selectedSquare && !app.busy && !app.finishedCurrent) {
    for (const move of app.game.moves({ square: app.selectedSquare, verbose: true })) {
      legal.add(move.to);
    }
  }

  elements.board.innerHTML = displaySquares().map((square, index) => {
    const piece = app.game.get(square);
    const file = square.charCodeAt(0) - 97;
    const rank = Number(square[1]) - 1;
    const light = (file + rank) % 2 === 1;
    const classes = [
      'assignment-square',
      light ? 'light' : 'dark',
      square === app.selectedSquare ? 'selected' : '',
      legal.has(square) ? 'legal-target' : '',
    ].filter(Boolean).join(' ');
    const fileLabel = index >= 56 ? square[0] : '';
    const rankLabel = index % 8 === 0 ? square[1] : '';
    return `
      <button class="${classes}" type="button" data-square="${square}" aria-label="${piece ? pieceAlt(piece) : square}">
        ${piece ? `<img class="assignment-piece" src="${PIECE_ASSETS[piece.color][piece.type]}" alt="${pieceAlt(piece)}" draggable="false">` : ''}
        ${rankLabel ? `<span class="assignment-coordinate rank">${rankLabel}</span>` : ''}
        ${fileLabel ? `<span class="assignment-coordinate file">${fileLabel}</span>` : ''}
      </button>
    `;
  }).join('');
  elements.board.classList.toggle('is-busy', app.busy);
}

function currentAttempt() {
  return app.attempts.get(app.puzzle.id) || null;
}

function renderMeta() {
  const total = app.puzzles.length;
  const attempt = currentAttempt();
  elements.progress.textContent = `Puzzle ${app.index + 1} of ${total}`;
  elements.score.textContent = `Score ${app.payload.progress?.score || 0}%`;
  elements.positionMeta.innerHTML = `
    <div><span>Rating</span><strong>${app.prepared.rating ?? '—'}</strong></div>
    <div><span>Side</span><strong>${app.prepared.solverColor === 'b' ? 'Black' : 'White'} to move</strong></div>
    <div><span>Mistakes</span><strong>${app.mistakes}</strong></div>
    <div><span>Hints</span><strong>${app.hintsUsed}</strong></div>
  `;
  elements.themes.innerHTML = (app.prepared.themes || []).map((theme) =>
    `<span class="assignment-theme">${escapeHtml(THEME_LABELS[theme] || theme)}</span>`
  ).join('') || '<span class="assignment-theme">Mixed position</span>';
  elements.hint.hidden = !app.payload.assignment.allow_hints;
  elements.hint.disabled = app.busy
    || app.finishedCurrent
    || app.hintsUsed >= app.payload.assignment.max_hint_level;
  elements.reset.disabled = app.busy || app.finishedCurrent;
  elements.next.hidden = !app.finishedCurrent;
  if (attempt?.finished) elements.next.hidden = false;
}

function elapsedSeconds() {
  return Math.max(0, Math.round((Date.now() - app.startedAt) / 1000));
}

async function saveAttempt({ finished, solved, firstAttempt = false, san = '' }) {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('save_puzzle_assignment_attempt', {
    p_token: app.token,
    p_puzzle_id: app.puzzle.id,
    p_position_number: app.index + 1,
    p_finished: finished,
    p_solved: solved,
    p_first_attempt: firstAttempt,
    p_mistakes: app.mistakes,
    p_hints_used: app.hintsUsed,
    p_elapsed_seconds: elapsedSeconds(),
    p_last_move_san: san,
  });
  if (error) throw error;
  app.lastSave = data;
  app.payload.progress = { ...app.payload.progress, status: data.status, score: data.score };
  app.attempts.set(app.puzzle.id, {
    puzzle_id: app.puzzle.id,
    position_number: app.index + 1,
    finished,
    solved,
    first_attempt: firstAttempt,
    mistakes: app.mistakes,
    hints_used: app.hintsUsed,
    elapsed_seconds: elapsedSeconds(),
    last_move_san: san,
  });
  return data;
}

async function loadPuzzle(index) {
  app.index = index;
  app.puzzle = app.puzzles[index]?.snapshot;
  if (!app.puzzle) {
    showResults();
    return;
  }

  app.prepared = prepareLichessTrainingPuzzle(app.puzzle);
  app.game = new Chess(app.prepared.startFen);
  app.selectedSquare = '';
  app.busy = true;
  app.finishedCurrent = Boolean(currentAttempt()?.finished);
  app.mistakes = Number(currentAttempt()?.mistakes || 0);
  app.hintsUsed = Number(currentAttempt()?.hints_used || 0);
  app.startedAt = Date.now() - Number(currentAttempt()?.elapsed_seconds || 0) * 1000;
  setFeedback('Evaluating the position…', 'info');
  renderBoard();
  renderMeta();

  try {
    app.baseline = await app.evaluator.evaluate(app.game.fen(), app.prepared.solverColor, { movetime: 700 });
    app.objective = deriveTrainingObjective(app.baseline);
    if (!app.objective) throw new Error('This position no longer has a valid training objective.');
    if (app.finishedCurrent) {
      setFeedback(currentAttempt()?.solved ? 'Completed. Review the position or continue.' : 'Attempt completed. Continue to the next puzzle.', currentAttempt()?.solved ? 'success' : 'warning');
    } else {
      setFeedback(app.objective === 'draw' ? 'Find a move that keeps the position safe.' : 'Find a move that preserves the advantage.', 'info');
    }
  } catch (error) {
    setFeedback(readableError(error), 'danger');
  } finally {
    app.busy = false;
    renderBoard();
    renderMeta();
  }
}

function choosePromotion(from, to) {
  const promotions = app.game.moves({ square: from, verbose: true })
    .filter((move) => move.to === to && move.promotion)
    .map((move) => move.promotion);
  if (!promotions.length) return undefined;
  const choice = String(window.prompt('Promote to q, r, b, or n', 'q') || 'q').trim().toLowerCase();
  return promotions.includes(choice) ? choice : promotions[0];
}

async function tryMove(from, to) {
  if (app.busy || app.finishedCurrent) return;
  const promotion = choosePromotion(from, to);
  let move = null;
  try {
    move = app.game.move({ from, to, promotion });
  } catch {
    move = null;
  }
  if (!move) {
    app.selectedSquare = '';
    renderBoard();
    return;
  }

  app.busy = true;
  app.selectedSquare = '';
  renderBoard();
  setFeedback('Checking the move…', 'info');

  try {
    const afterMove = await app.evaluator.evaluate(app.game.fen(), app.prepared.solverColor, { movetime: 700 });
    const result = classifyStudentMove({
      objective: app.objective,
      baseline: app.baseline,
      afterMove,
    });

    if (!result.accepted) {
      app.mistakes += 1;
      if (app.payload.assignment.allow_retry) {
        app.game.undo();
        await saveAttempt({ finished: false, solved: false, san: move.san });
        setFeedback(`${result.reason} Try again.`, 'danger');
      } else {
        app.finishedCurrent = true;
        await saveAttempt({ finished: true, solved: false, san: move.san });
        setFeedback(`${result.reason} This attempt is recorded.`, 'danger');
      }
    } else {
      app.finishedCurrent = true;
      const firstAttempt = app.mistakes === 0 && app.hintsUsed === 0;
      await saveAttempt({ finished: true, solved: true, firstAttempt, san: move.san });
      setFeedback(`${result.reason}${firstAttempt ? ' First-attempt solve.' : ''}`, 'success');
    }
  } catch (error) {
    app.game.undo();
    setFeedback(readableError(error), 'danger');
  } finally {
    app.busy = false;
    renderBoard();
    renderMeta();
  }
}

function handleSquareClick(square) {
  if (app.busy || app.finishedCurrent) return;
  const piece = app.game.get(square);
  if (!app.selectedSquare) {
    if (piece?.color === app.prepared.solverColor) {
      app.selectedSquare = square;
      renderBoard();
    }
    return;
  }
  if (square === app.selectedSquare) {
    app.selectedSquare = '';
    renderBoard();
    return;
  }
  if (piece?.color === app.prepared.solverColor) {
    app.selectedSquare = square;
    renderBoard();
    return;
  }
  tryMove(app.selectedSquare, square);
}

async function showHint() {
  if (app.busy || app.finishedCurrent || !app.payload.assignment.allow_hints) return;
  const nextLevel = Math.min(app.payload.assignment.max_hint_level, app.hintsUsed + 1);
  app.hintsUsed = nextLevel;
  const bestMove = uciToMove(app.baseline?.bestMove);
  let message = '';
  if (nextLevel === 1) {
    const themes = (app.prepared.themes || []).map((theme) => THEME_LABELS[theme] || theme).join(', ');
    message = `${app.objective === 'draw' ? 'Protect the position' : 'Preserve the advantage'}. Themes: ${themes || 'mixed position'}.`;
  } else if (nextLevel === 2) {
    message = bestMove ? `Consider the piece on ${bestMove.from}.` : 'Focus on forcing moves and loose pieces.';
  } else if (nextLevel === 3) {
    message = bestMove ? `The critical destination is ${bestMove.to}.` : 'Look for checks, captures, and direct threats.';
  } else {
    message = bestMove ? `Engine-leading move: ${bestMove.from}–${bestMove.to}${bestMove.promotion ? `=${bestMove.promotion.toUpperCase()}` : ''}.` : 'The engine could not provide a move hint.';
  }
  try {
    await saveAttempt({ finished: false, solved: false });
  } catch (error) {
    setFeedback(readableError(error), 'danger');
    return;
  }
  setFeedback(message, 'warning');
  renderMeta();
}

function resetPosition() {
  if (app.busy || app.finishedCurrent) return;
  app.game = new Chess(app.prepared.startFen);
  app.selectedSquare = '';
  renderBoard();
  setFeedback('Position reset. Your recorded mistakes and hints remain.', 'info');
}

function nextPuzzle() {
  const next = app.index + 1;
  if (next >= app.puzzles.length) {
    showResults();
    return;
  }
  loadPuzzle(next).catch(setError);
}

function showResults() {
  const attempts = [...app.attempts.values()];
  const finished = attempts.filter((attempt) => attempt.finished).length;
  const solved = attempts.filter((attempt) => attempt.solved).length;
  const firstAttempts = attempts.filter((attempt) => attempt.solved && attempt.first_attempt).length;
  const hints = attempts.reduce((sum, attempt) => sum + Number(attempt.hints_used || 0), 0);
  const mistakes = attempts.reduce((sum, attempt) => sum + Number(attempt.mistakes || 0), 0);
  const score = app.lastSave?.score ?? app.payload.progress?.score ?? Math.round((firstAttempts / Math.max(1, app.puzzles.length)) * 100);
  elements.boardWrap.hidden = true;
  document.querySelector('#assignmentSidePanel').hidden = true;
  elements.results.hidden = false;
  elements.results.innerHTML = `
    <h2>Assignment complete</h2>
    <p class="assignment-result-lead">${escapeHtml(app.payload.student.display_name)} completed ${finished} of ${app.puzzles.length} puzzles.</p>
    <div class="assignment-result-grid">
      <div><strong>${score}%</strong><span>Score</span></div>
      <div><strong>${solved}</strong><span>Solved</span></div>
      <div><strong>${firstAttempts}</strong><span>First attempt</span></div>
      <div><strong>${mistakes}</strong><span>Mistakes</span></div>
      <div><strong>${hints}</strong><span>Hints</span></div>
    </div>
    <p>${score >= app.payload.assignment.passing_score ? 'Passing target reached.' : `Passing target: ${app.payload.assignment.passing_score}%.`}</p>
    <a class="button-secondary" href="../index.html">Return to CD Digital Chess</a>
  `;
}

async function initialize() {
  try {
    app.token = parseToken();
    if (!app.token) throw new Error('The assignment link is missing its access token.');
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('get_puzzle_assignment_by_token', { p_token: app.token });
    if (error) throw error;
    app.payload = data;
    app.puzzles = Array.isArray(data.puzzles) ? data.puzzles : [];
    app.attempts = new Map((data.attempts || []).map((attempt) => [attempt.puzzle_id, attempt]));
    if (!app.puzzles.length) throw new Error('This assignment contains no puzzle positions.');

    elements.title.textContent = data.assignment.title;
    elements.student.textContent = data.student.display_name;
    elements.instructions.textContent = data.assignment.instructions || 'Solve each position carefully. The app accepts any move that preserves the objective.';
    elements.due.textContent = formatDate(data.assignment.due_at);
    elements.loading.hidden = true;
    elements.shell.hidden = false;

    const unfinishedIndex = app.puzzles.findIndex((item) => !app.attempts.get(item.snapshot.id)?.finished);
    if (unfinishedIndex < 0) {
      showResults();
      return;
    }
    await loadPuzzle(unfinishedIndex);
  } catch (error) {
    setError(error);
  }
}

elements.board?.addEventListener('click', (event) => {
  const square = event.target.closest('[data-square]')?.dataset.square;
  if (square) handleSquareClick(square);
});
elements.hint?.addEventListener('click', () => showHint().catch(setError));
elements.reset?.addEventListener('click', resetPosition);
elements.next?.addEventListener('click', nextPuzzle);
window.addEventListener('pagehide', () => app.evaluator.dispose());

initialize();
