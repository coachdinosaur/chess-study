import { Chess } from '../../vendor/chess.js';
import { getSupabase, readableError } from './supabase-client.mjs';
import { workspaceAssignmentLink } from './student-workspace-core.mjs';

const PIECE_ASSETS = Object.freeze({
  w: Object.freeze({ k: '../assets/pieces/mpchess/wK.svg', q: '../assets/pieces/mpchess/wQ.svg', r: '../assets/pieces/mpchess/wR.svg', b: '../assets/pieces/mpchess/wB.svg', n: '../assets/pieces/mpchess/wN.svg', p: '../assets/pieces/mpchess/wP.svg' }),
  b: Object.freeze({ k: '../assets/pieces/mpchess/bK.svg', q: '../assets/pieces/mpchess/bQ.svg', r: '../assets/pieces/mpchess/bR.svg', b: '../assets/pieces/mpchess/bB.svg', n: '../assets/pieces/mpchess/bN.svg', p: '../assets/pieces/mpchess/bP.svg' }),
});

const elements = {
  loading: document.querySelector('#studentWorkspaceLoading'),
  error: document.querySelector('#studentWorkspaceError'),
  shell: document.querySelector('#studentWorkspaceShell'),
  student: document.querySelector('#studentWorkspaceStudent'),
  coach: document.querySelector('#studentWorkspaceCoach'),
  updated: document.querySelector('#studentWorkspaceUpdated'),
  instructionsCard: document.querySelector('#studentWorkspaceInstructionsCard'),
  instructions: document.querySelector('#studentWorkspaceInstructions'),
  homeworkCard: document.querySelector('#studentWorkspaceHomeworkCard'),
  homework: document.querySelector('#studentWorkspaceHomework'),
  due: document.querySelector('#studentWorkspaceDue'),
  assignmentsCard: document.querySelector('#studentWorkspaceAssignmentsCard'),
  assignments: document.querySelector('#studentWorkspaceAssignments'),
  lessonCard: document.querySelector('#studentWorkspaceLessonCard'),
  lessonTitle: document.querySelector('#studentWorkspaceLessonTitle'),
  lessonLink: document.querySelector('#studentWorkspaceLessonLink'),
  positionCard: document.querySelector('#studentWorkspacePositionCard'),
  positionTitle: document.querySelector('#studentWorkspacePositionTitle'),
  positionBoard: document.querySelector('#studentWorkspaceBoard'),
  positionLink: document.querySelector('#studentWorkspacePositionLink'),
  liveBoardCard: document.querySelector('#studentWorkspaceLiveBoardCard'),
  liveBoardLink: document.querySelector('#studentWorkspaceLiveBoardLink'),
};

function parseToken() {
  return new URLSearchParams(location.hash.replace(/^#/, '')).get('token') || '';
}

function formatDate(value, { includeTime = true } = {}) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, includeTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { dateStyle: 'medium' }).format(date);
}

function setError(error) {
  elements.loading.hidden = true;
  elements.shell.hidden = true;
  elements.error.hidden = false;
  elements.error.innerHTML = '';
  const heading = document.createElement('h1');
  heading.textContent = 'Workspace unavailable';
  const message = document.createElement('p');
  message.textContent = readableError(error);
  elements.error.append(heading, message);
}

function pieceAlt(piece) {
  const names = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };
  return `${piece.color === 'w' ? 'White' : 'Black'} ${names[piece.type]}`;
}

function renderPosition(fen) {
  const game = new Chess(fen);
  const squares = [];
  for (const rank of ['8', '7', '6', '5', '4', '3', '2', '1']) {
    for (const file of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      squares.push(`${file}${rank}`);
    }
  }
  elements.positionBoard.innerHTML = '';
  for (const square of squares) {
    const piece = game.get(square);
    const file = square.charCodeAt(0) - 97;
    const rank = Number(square[1]) - 1;
    const cell = document.createElement('div');
    cell.className = `student-workspace-square ${(file + rank) % 2 === 1 ? 'light' : 'dark'}`;
    if (piece) {
      const image = document.createElement('img');
      image.className = 'student-workspace-piece';
      image.src = PIECE_ASSETS[piece.color][piece.type];
      image.alt = pieceAlt(piece);
      image.draggable = false;
      cell.append(image);
    }
    elements.positionBoard.append(cell);
  }
}

function assignmentProgress(assignment) {
  const completed = Math.min(
    Number(assignment.current_index) || 0,
    Number(assignment.puzzle_count) || 0,
  );
  const total = Number(assignment.puzzle_count) || 0;
  const score = Number(assignment.score) || 0;
  const status = String(assignment.status || 'not_started').replaceAll('_', ' ');
  return `${status} · ${completed}/${total} complete · score ${score}%`;
}

function renderAssignments(assignments, token) {
  elements.assignments.innerHTML = '';
  elements.assignmentsCard.hidden = !assignments.length;
  for (const assignment of assignments) {
    const item = document.createElement('article');
    item.className = 'student-workspace-task';

    const copy = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = assignment.title;
    const progress = document.createElement('p');
    progress.textContent = assignmentProgress(assignment);
    copy.append(title, progress);

    if (assignment.due_at) {
      const due = document.createElement('p');
      due.textContent = `Due ${formatDate(assignment.due_at)}`;
      copy.append(due);
    }

    const link = document.createElement('a');
    link.className = assignment.status === 'completed' ? 'button-secondary' : 'button';
    link.href = workspaceAssignmentLink(token, assignment.student_assignment_id);
    link.textContent = assignment.status === 'completed' ? 'Review' : 'Continue';
    item.append(copy, link);
    elements.assignments.append(item);
  }
}

function render(payload, token) {
  const workspace = payload.workspace || {};
  const student = payload.student || {};
  const assignments = Array.isArray(payload.assignments) ? payload.assignments : [];

  document.title = `${student.display_name || 'Student'} Workspace | CD Digital Chess`;
  elements.student.textContent = student.display_name || 'Student workspace';
  elements.coach.textContent = `Prepared by ${payload.coach?.display_name || 'your coach'}`;
  elements.updated.textContent = workspace.updated_at
    ? `Updated ${formatDate(workspace.updated_at)}`
    : '';

  elements.instructionsCard.hidden = !workspace.teacher_instructions;
  elements.instructions.textContent = workspace.teacher_instructions || '';

  elements.homeworkCard.hidden = !workspace.homework;
  elements.homework.textContent = workspace.homework || '';
  elements.due.hidden = !workspace.due_at;
  elements.due.textContent = workspace.due_at ? `Due ${formatDate(workspace.due_at)}` : '';

  elements.lessonCard.hidden = !workspace.lesson_url;
  elements.lessonTitle.textContent = workspace.lesson_title || 'Assigned lesson';
  elements.lessonLink.href = workspace.lesson_url || '#';

  elements.positionCard.hidden = !workspace.position_fen;
  if (workspace.position_fen) {
    elements.positionTitle.textContent = workspace.position_title || 'Position to study';
    renderPosition(workspace.position_fen);
    const studyUrl = new URL('../index.html', location.href);
    studyUrl.searchParams.set('embed', '1');
    studyUrl.searchParams.set('fen', workspace.position_fen);
    elements.positionLink.href = studyUrl.href;
  }

  elements.liveBoardCard.hidden = !workspace.live_board_url;
  elements.liveBoardLink.href = workspace.live_board_url || '#';

  renderAssignments(assignments, token);
  elements.loading.hidden = true;
  elements.error.hidden = true;
  elements.shell.hidden = false;
}

async function initialize() {
  try {
    const token = parseToken();
    if (!token) throw new Error('The private student workspace link is missing its access token.');
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('get_student_workspace_by_token', {
      p_token: token,
    });
    if (error) throw error;
    render(data, token);
  } catch (error) {
    setError(error);
  }
}

initialize();
