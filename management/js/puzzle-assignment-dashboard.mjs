import { Chess } from '../../vendor/chess.js';
import { getSupabase, readableError, requireProfile } from './supabase-client.mjs';
import { escapeHtml, setBusy, setStatus } from './ui.mjs';
import {
  ASSIGNMENT_THEMES,
  LEVEL_PRESETS,
  assignmentLink,
  formatLevel,
  loadAllPositionTrainingPuzzles,
  presetFor,
  randomAccessToken,
  selectAssignmentPuzzles,
  sha256Hex,
} from './puzzle-assignment-core.mjs';

const TOKEN_STORE_KEY = 'chess-study-puzzle-assignment-teacher-links-v1';
const PIECE_ASSETS = Object.freeze({
  w: Object.freeze({ k: '../assets/pieces/mpchess/wK.svg', q: '../assets/pieces/mpchess/wQ.svg', r: '../assets/pieces/mpchess/wR.svg', b: '../assets/pieces/mpchess/wB.svg', n: '../assets/pieces/mpchess/wN.svg', p: '../assets/pieces/mpchess/wP.svg' }),
  b: Object.freeze({ k: '../assets/pieces/mpchess/bK.svg', q: '../assets/pieces/mpchess/bQ.svg', r: '../assets/pieces/mpchess/bR.svg', b: '../assets/pieces/mpchess/bB.svg', n: '../assets/pieces/mpchess/bN.svg', p: '../assets/pieces/mpchess/bP.svg' }),
});

const state = {
  profile: null,
  students: [],
  records: [],
  preview: [],
  assignments: [],
  studentAssignments: [],
  currentStudentId: null,
  loaded: false,
};

function readTokenStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(TOKEN_STORE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeTokenStore(store) {
  localStorage.setItem(TOKEN_STORE_KEY, JSON.stringify(store));
}

function storeToken(studentAssignmentId, token) {
  const store = readTokenStore();
  store[studentAssignmentId] = token;
  writeTokenStore(store);
}

function tokenFor(studentAssignmentId) {
  return readTokenStore()[studentAssignmentId] || '';
}

function selectedStudentFromMainDashboard() {
  return document.querySelector('#studentList [data-action="select-student"][data-active="true"]')?.dataset.studentId
    || document.querySelector('#studentList [data-action="select-student"][aria-current="true"]')?.dataset.studentId
    || state.currentStudentId
    || state.students.find((student) => !student.archived_at)?.id
    || null;
}

function currentStudent() {
  const id = selectedStudentFromMainDashboard();
  return state.students.find((student) => student.id === id) || null;
}

function dispatchCoachAssignmentSummary() {
  const studentId = selectedStudentFromMainDashboard();
  if (!studentId) return;

  const assignment = state.assignments.find((item) =>
    state.studentAssignments.some((row) =>
      row.assignment_id === item.id && row.student_id === studentId
    )
  ) || null;
  const row = assignment
    ? state.studentAssignments.find((item) =>
      item.assignment_id === assignment.id && item.student_id === studentId
    )
    : null;

  document.dispatchEvent(new CustomEvent('coach-session:assignment-summary', {
    detail: {
      studentId,
      assignment: assignment && row ? {
        id: assignment.id,
        title: assignment.title,
        status: row.status,
        currentIndex: Number(row.current_index) || 0,
        puzzleCount: Number(assignment.puzzle_count) || 0,
        score: Number(row.score) || 0,
        dueAt: assignment.due_at || '',
      } : null,
    },
  }));
}

function setLocalStatus(message = '', tone = '') {
  const element = document.querySelector('#puzzleAssignmentStatus');
  if (!element) return;
  setStatus(element, message, tone);
}

function levelOptions(selected = 'advanced_beginner') {
  return Object.entries(LEVEL_PRESETS).map(([value, preset]) =>
    `<option value="${value}" ${value === selected ? 'selected' : ''}>${escapeHtml(preset.label)}</option>`
  ).join('');
}

function themeOptions() {
  return ASSIGNMENT_THEMES.map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join('');
}

function injectInterface() {
  const panel = document.querySelector('#selectedStudentPanel');
  if (!panel || document.querySelector('#puzzleAssignmentPanel')) return;

  const wrapper = document.createElement('article');
  wrapper.id = 'puzzleAssignmentPanel';
  wrapper.className = 'panel puzzle-assignment-panel';
  wrapper.innerHTML = `
    <div class="section-head puzzle-assignment-heading">
      <div>
        <h2>Lichess puzzle assignments</h2>
        <p class="panel-copy">Generate a fixed level-based puzzle set, inspect every position, replace unsuitable puzzles, and publish private links to existing students.</p>
      </div>
      <button id="refreshPuzzleAssignmentsButton" class="button-secondary" type="button">Refresh results</button>
    </div>

    <div id="puzzleAssignmentStatus" class="status" aria-live="polite" hidden></div>

    <form id="puzzleAssignmentForm" class="form-grid puzzle-assignment-form">
      <div class="puzzle-assignment-form-grid">
        <div class="form-row">
          <label for="puzzleAssignmentTitle">Assignment title</label>
          <input id="puzzleAssignmentTitle" maxlength="160" required placeholder="Advanced Beginner Defence 1">
        </div>
        <div class="form-row">
          <label for="puzzleAssignmentLevel">Student level</label>
          <select id="puzzleAssignmentLevel">${levelOptions()}</select>
        </div>
        <div class="form-row">
          <label for="puzzleAssignmentMinRating">Minimum puzzle rating</label>
          <input id="puzzleAssignmentMinRating" type="number" min="400" max="3000" value="850" required>
        </div>
        <div class="form-row">
          <label for="puzzleAssignmentMaxRating">Maximum puzzle rating</label>
          <input id="puzzleAssignmentMaxRating" type="number" min="400" max="3000" value="1300" required>
        </div>
        <div class="form-row">
          <label for="puzzleAssignmentCount">Number of puzzles</label>
          <input id="puzzleAssignmentCount" type="number" min="1" max="30" value="10" required>
        </div>
        <div class="form-row">
          <label for="puzzleAssignmentTheme">Training focus</label>
          <select id="puzzleAssignmentTheme">${themeOptions()}</select>
        </div>
        <div class="form-row">
          <label for="puzzleAssignmentPassingScore">Passing score</label>
          <input id="puzzleAssignmentPassingScore" type="number" min="0" max="100" value="70">
        </div>
        <div class="form-row">
          <label for="puzzleAssignmentDueAt">Due date (optional)</label>
          <input id="puzzleAssignmentDueAt" type="datetime-local">
        </div>
      </div>

      <fieldset class="puzzle-assignment-students">
        <legend>Assign to existing students</legend>
        <div id="puzzleAssignmentStudentList" class="puzzle-assignment-student-list"></div>
      </fieldset>

      <div class="puzzle-assignment-policy-grid">
        <label class="checkbox-row"><input id="puzzleAssignmentAllowHints" type="checkbox" checked> Allow hints</label>
        <label class="form-row compact"><span>Maximum hint level</span><select id="puzzleAssignmentMaxHint"><option value="1">1: concept</option><option value="2" selected>2: source piece</option><option value="3">3: destination</option><option value="4">4: full move</option></select></label>
        <label class="checkbox-row"><input id="puzzleAssignmentAllowRetry" type="checkbox" checked> Allow retry after mistakes</label>
        <label class="checkbox-row"><input id="puzzleAssignmentSaveLevel" type="checkbox" checked> Save this as the selected student's default level</label>
      </div>

      <div class="form-row">
        <label for="puzzleAssignmentInstructions">Teacher instructions</label>
        <textarea id="puzzleAssignmentInstructions" maxlength="4000" placeholder="Solve without moving until you identify the opponent's threat."></textarea>
      </div>

      <div class="inline-actions">
        <button id="generatePuzzleAssignmentButton" class="button-secondary" type="button">Generate and preview</button>
        <button id="publishPuzzleAssignmentButton" class="button" type="submit" disabled>Publish assignment</button>
      </div>
    </form>

    <section id="puzzleAssignmentPreviewSection" class="puzzle-assignment-preview" hidden>
      <div class="section-head">
        <div><h3>Pre-review exact positions</h3><p class="panel-copy">These puzzle IDs are frozen into the published assignment. Replace anything you do not want the student to receive.</p></div>
        <span id="puzzleAssignmentPreviewCount" class="chip"></span>
      </div>
      <div id="puzzleAssignmentPreviewList" class="list"></div>
    </section>

    <section class="puzzle-assignment-history">
      <div class="section-head"><div><h3>Published assignments</h3><p class="panel-copy">Student progress is stored in Supabase. Raw access links stay in this teacher browser and can be reissued when needed.</p></div></div>
      <div id="puzzleAssignmentHistoryList" class="list"><div class="empty">Loading assignments…</div></div>
    </section>

    <dialog id="puzzleAssignmentPreviewDialog" class="puzzle-preview-dialog">
      <form method="dialog" class="puzzle-preview-dialog-shell">
        <button class="puzzle-preview-close" value="close" aria-label="Close preview">×</button>
        <div id="puzzlePreviewBoard" class="puzzle-preview-board" aria-label="Puzzle board preview"></div>
        <div id="puzzlePreviewDetails" class="puzzle-preview-details"></div>
      </form>
    </dialog>
  `;

  const firstDetail = panel.querySelector('.panel');
  firstDetail?.insertAdjacentElement('afterend', wrapper);
  bindEvents();
}

function renderStudentChoices() {
  const list = document.querySelector('#puzzleAssignmentStudentList');
  if (!list) return;
  const activeStudents = state.students.filter((student) => !student.archived_at);
  if (!activeStudents.length) {
    list.innerHTML = '<div class="empty">Add an active student before creating an assignment.</div>';
    return;
  }
  const selectedId = selectedStudentFromMainDashboard();
  list.innerHTML = activeStudents.map((student) => `
    <label class="puzzle-assignment-student-option">
      <input type="checkbox" name="assignmentStudent" value="${escapeHtml(student.id)}" ${student.id === selectedId ? 'checked' : ''}>
      <span><strong>${escapeHtml(student.display_name)}</strong><small>${escapeHtml(formatLevel(student.puzzle_level))} · target ${Number(student.target_rating) || 1100}</small></span>
    </label>
  `).join('');
}

function applyPreset(level) {
  const preset = presetFor(level);
  document.querySelector('#puzzleAssignmentMinRating').value = preset.minRating;
  document.querySelector('#puzzleAssignmentMaxRating').value = preset.maxRating;
  document.querySelector('#puzzleAssignmentCount').value = preset.puzzleCount;
}

function formSettings() {
  const theme = document.querySelector('#puzzleAssignmentTheme').value;
  return {
    level: document.querySelector('#puzzleAssignmentLevel').value,
    minRating: Number(document.querySelector('#puzzleAssignmentMinRating').value),
    maxRating: Number(document.querySelector('#puzzleAssignmentMaxRating').value),
    puzzleCount: Number(document.querySelector('#puzzleAssignmentCount').value),
    themes: theme === 'any' ? [] : [theme],
  };
}

function renderPreview() {
  const section = document.querySelector('#puzzleAssignmentPreviewSection');
  const list = document.querySelector('#puzzleAssignmentPreviewList');
  const count = document.querySelector('#puzzleAssignmentPreviewCount');
  const publish = document.querySelector('#publishPuzzleAssignmentButton');
  section.hidden = !state.preview.length;
  publish.disabled = !state.preview.length;
  count.textContent = `${state.preview.length} frozen puzzles`;
  list.innerHTML = state.preview.map((puzzle, index) => `
    <article class="list-card puzzle-preview-card">
      <div class="list-card-head">
        <div>
          <h4>${index + 1}. Puzzle ${escapeHtml(puzzle.id)}</h4>
          <p>Rating ${puzzle.rating ?? '—'} · ${escapeHtml((puzzle.themes || []).join(', ') || 'Mixed')}</p>
        </div>
        <span class="chip">${puzzle.solverColor === 'b' ? 'Black' : 'White'} to move</span>
      </div>
      <div class="inline-actions">
        <button class="button-secondary" type="button" data-assignment-action="preview" data-index="${index}">Preview board</button>
        <button class="button-secondary" type="button" data-assignment-action="replace" data-index="${index}">Replace puzzle</button>
        ${puzzle.gameUrl ? `<a class="button-secondary" href="${escapeHtml(puzzle.gameUrl)}" target="_blank" rel="noopener">Lichess game</a>` : ''}
      </div>
    </article>
  `).join('');
}

function renderFenBoard(fen, orientation = 'w') {
  const game = new Chess(fen);
  const board = game.board();
  const rows = orientation === 'b' ? [...board].reverse() : board;
  const normalizedRows = rows.map((row) => orientation === 'b' ? [...row].reverse() : row);
  return normalizedRows.flatMap((row, rankIndex) => row.map((piece, fileIndex) => {
    const light = (rankIndex + fileIndex) % 2 === 0;
    return `<div class="puzzle-preview-square ${light ? 'light' : 'dark'}">${piece ? `<img src="${PIECE_ASSETS[piece.color][piece.type]}" alt="">` : ''}</div>`;
  })).join('');
}

function openPreview(index) {
  const puzzle = state.preview[index];
  if (!puzzle) return;
  const dialog = document.querySelector('#puzzleAssignmentPreviewDialog');
  document.querySelector('#puzzlePreviewBoard').innerHTML = renderFenBoard(puzzle.startFen, puzzle.solverColor);
  document.querySelector('#puzzlePreviewDetails').innerHTML = `
    <h3>Puzzle ${escapeHtml(puzzle.id)}</h3>
    <p><strong>${puzzle.solverColor === 'b' ? 'Black' : 'White'} to move</strong></p>
    <p>Rating: ${puzzle.rating ?? '—'}</p>
    <p>Themes: ${escapeHtml((puzzle.themes || []).join(', ') || 'Mixed')}</p>
    <p class="muted">The losing side's database move has already been applied. The student begins from this position.</p>
  `;
  dialog.showModal();
}

function replacePreview(index) {
  try {
    const excludeIds = state.preview.map((puzzle) => puzzle.id);
    const replacement = selectAssignmentPuzzles(state.records, { ...formSettings(), puzzleCount: 1 }, { excludeIds })[0];
    state.preview[index] = replacement;
    renderPreview();
    setLocalStatus(`Replaced puzzle ${index + 1}.`, 'success');
  } catch (error) {
    setLocalStatus(readableError(error), 'error');
  }
}

async function generatePreview() {
  const button = document.querySelector('#generatePuzzleAssignmentButton');
  setBusy(button, true, 'Generating…');
  setLocalStatus('');
  try {
    if (!state.loaded) {
      const loaded = await loadAllPositionTrainingPuzzles();
      state.records = loaded.records;
      state.loaded = true;
    }
    state.preview = selectAssignmentPuzzles(state.records, formSettings());
    renderPreview();
    setLocalStatus(`Generated ${state.preview.length} exact positions for teacher review.`, 'success');
    document.querySelector('#puzzleAssignmentPreviewSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    state.preview = [];
    renderPreview();
    setLocalStatus(readableError(error), 'error');
  } finally {
    setBusy(button, false);
  }
}

async function publishAssignment(event) {
  event.preventDefault();
  const button = document.querySelector('#publishPuzzleAssignmentButton');
  setBusy(button, true, 'Publishing…');
  setLocalStatus('');
  try {
    if (!state.preview.length) throw new Error('Generate and review the puzzle set first.');
    const studentIds = [...document.querySelectorAll('input[name="assignmentStudent"]:checked')].map((input) => input.value);
    if (!studentIds.length) throw new Error('Select at least one active student.');
    const title = document.querySelector('#puzzleAssignmentTitle').value.trim();
    if (!title) throw new Error('Enter an assignment title.');

    const tokens = new Map();
    const students = [];
    for (const studentId of studentIds) {
      const token = randomAccessToken();
      tokens.set(studentId, token);
      students.push({ student_id: studentId, token_hash: await sha256Hex(token) });
    }

    const settings = formSettings();
    const dueValue = document.querySelector('#puzzleAssignmentDueAt').value;
    const payload = {
      title,
      instructions: document.querySelector('#puzzleAssignmentInstructions').value.trim(),
      level: settings.level,
      min_rating: settings.minRating,
      max_rating: settings.maxRating,
      themes: settings.themes,
      allow_hints: document.querySelector('#puzzleAssignmentAllowHints').checked,
      max_hint_level: Number(document.querySelector('#puzzleAssignmentMaxHint').value),
      allow_retry: document.querySelector('#puzzleAssignmentAllowRetry').checked,
      passing_score: Number(document.querySelector('#puzzleAssignmentPassingScore').value),
      due_at: dueValue ? new Date(dueValue).toISOString() : '',
      puzzles: state.preview.map((snapshot) => ({ id: snapshot.id, snapshot })),
      students,
    };

    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('create_puzzle_assignment', { p_payload: payload });
    if (error) throw error;
    const assignmentId = data.assignment_id;

    const { data: assignedRows, error: assignedError } = await supabase
      .from('puzzle_assignment_students')
      .select('id, student_id')
      .eq('assignment_id', assignmentId);
    if (assignedError) throw assignedError;
    for (const row of assignedRows || []) {
      const token = tokens.get(row.student_id);
      if (token) storeToken(row.id, token);
    }

    if (document.querySelector('#puzzleAssignmentSaveLevel').checked) {
      const selected = currentStudent();
      if (selected && studentIds.includes(selected.id)) {
        const midpoint = Math.round((settings.minRating + settings.maxRating) / 2);
        const { error: updateError } = await supabase
          .from('managed_students')
          .update({ puzzle_level: settings.level, target_rating: midpoint })
          .eq('id', selected.id);
        if (updateError) throw updateError;
        selected.puzzle_level = settings.level;
        selected.target_rating = midpoint;
        renderStudentChoices();
      }
    }

    state.preview = [];
    renderPreview();
    document.querySelector('#puzzleAssignmentForm').reset();
    document.querySelector('#puzzleAssignmentLevel').value = 'advanced_beginner';
    applyPreset('advanced_beginner');
    document.querySelector('#puzzleAssignmentAllowHints').checked = true;
    document.querySelector('#puzzleAssignmentAllowRetry').checked = true;
    document.querySelector('#puzzleAssignmentSaveLevel').checked = true;
    document.querySelector('#puzzleAssignmentMaxHint').value = '2';
    document.querySelector('#puzzleAssignmentPassingScore').value = '70';
    renderStudentChoices();
    await loadAssignmentHistory();
    setLocalStatus(`Published “${title}” to ${studentIds.length} student${studentIds.length === 1 ? '' : 's'}.`, 'success');
  } catch (error) {
    setLocalStatus(readableError(error), 'error');
  } finally {
    setBusy(button, false);
  }
}

async function loadStudents() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('managed_students')
    .select('id, display_name, puzzle_level, target_rating, archived_at')
    .eq('teacher_id', state.profile.id)
    .order('created_at', { ascending: true });
  if (error) throw error;
  state.students = data || [];
  state.currentStudentId = selectedStudentFromMainDashboard();
  renderStudentChoices();
  const selected = currentStudent();
  if (selected) {
    document.querySelector('#puzzleAssignmentLevel').value = selected.puzzle_level || 'advanced_beginner';
    const preset = presetFor(selected.puzzle_level);
    document.querySelector('#puzzleAssignmentMinRating').value = Math.max(400, (selected.target_rating || preset.minRating) - 250);
    document.querySelector('#puzzleAssignmentMaxRating').value = Math.min(3000, (selected.target_rating || preset.maxRating) + 250);
    document.querySelector('#puzzleAssignmentCount').value = preset.puzzleCount;
  }
}

async function loadAssignmentHistory() {
  const supabase = getSupabase();
  const { data: assignments, error } = await supabase
    .from('puzzle_assignments')
    .select('id, title, level, min_rating, max_rating, puzzle_count, passing_score, due_at, status, published_at, created_at')
    .eq('teacher_id', state.profile.id)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  state.assignments = assignments || [];
  const ids = state.assignments.map((assignment) => assignment.id);
  if (!ids.length) {
    state.studentAssignments = [];
    renderHistory();
    return;
  }
  const { data: rows, error: rowError } = await supabase
    .from('puzzle_assignment_students')
    .select('id, assignment_id, student_id, status, current_index, score, started_at, completed_at, last_opened_at')
    .in('assignment_id', ids)
    .order('created_at', { ascending: true });
  if (rowError) throw rowError;
  state.studentAssignments = rows || [];
  renderHistory();
}

function formatDate(value) {
  if (!value) return 'No due date';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'No due date' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function renderHistory() {
  const list = document.querySelector('#puzzleAssignmentHistoryList');
  if (!list) return;
  if (!state.assignments.length) {
    list.innerHTML = '<div class="empty">No puzzle assignments have been published yet.</div>';
    dispatchCoachAssignmentSummary();
    return;
  }
  const students = new Map(state.students.map((student) => [student.id, student]));
  list.innerHTML = state.assignments.map((assignment) => {
    const rows = state.studentAssignments.filter((row) => row.assignment_id === assignment.id);
    const studentRows = rows.map((row) => {
      const student = students.get(row.student_id);
      const token = tokenFor(row.id);
      return `
        <div class="puzzle-assignment-result-row">
          <span><strong>${escapeHtml(student?.display_name || 'Student')}</strong><small>${escapeHtml(row.status.replaceAll('_', ' '))} · ${row.current_index}/${assignment.puzzle_count} · score ${row.score}%</small></span>
          <div class="inline-actions">
            ${token ? `<button class="button-secondary" type="button" data-assignment-action="copy-link" data-row-id="${escapeHtml(row.id)}">Copy link</button>` : ''}
            <button class="button-secondary" type="button" data-assignment-action="reissue-link" data-row-id="${escapeHtml(row.id)}">${token ? 'Reissue link' : 'Create link on this device'}</button>
          </div>
        </div>
      `;
    }).join('');
    return `
      <article class="list-card puzzle-assignment-history-card">
        <div class="list-card-head">
          <div><h4>${escapeHtml(assignment.title)}</h4><p>${escapeHtml(formatLevel(assignment.level))} · ${assignment.min_rating}–${assignment.max_rating} · ${assignment.puzzle_count} puzzles · due ${escapeHtml(formatDate(assignment.due_at))}</p></div>
          <span class="chip">${escapeHtml(assignment.status)}</span>
        </div>
        <div class="puzzle-assignment-result-list">${studentRows || '<div class="empty">No students assigned.</div>'}</div>
        ${assignment.status === 'published' ? `<div class="inline-actions"><button class="button-danger" type="button" data-assignment-action="archive-assignment" data-assignment-id="${escapeHtml(assignment.id)}">Archive assignment</button></div>` : ''}
      </article>
    `;
  }).join('');
  dispatchCoachAssignmentSummary();
}

async function copyStudentLink(rowId) {
  const token = tokenFor(rowId);
  if (!token) throw new Error('This browser does not have the original token. Reissue the link.');
  await navigator.clipboard.writeText(assignmentLink(token));
  setLocalStatus('Student assignment link copied.', 'success');
}

async function reissueStudentLink(rowId) {
  const token = randomAccessToken();
  const hash = await sha256Hex(token);
  const supabase = getSupabase();
  const { error } = await supabase.from('puzzle_assignment_students').update({ access_token_hash: hash }).eq('id', rowId);
  if (error) throw error;
  storeToken(rowId, token);
  await navigator.clipboard.writeText(assignmentLink(token));
  renderHistory();
  setLocalStatus('A replacement student link was created and copied. The previous link no longer works.', 'success');
}

async function archiveAssignment(assignmentId) {
  if (!window.confirm('Archive this assignment? Existing student links will stop opening it.')) return;
  const supabase = getSupabase();
  const { error } = await supabase.from('puzzle_assignments').update({ status: 'archived' }).eq('id', assignmentId);
  if (error) throw error;
  await loadAssignmentHistory();
  setLocalStatus('Assignment archived.', 'success');
}

function bindEvents() {
  document.querySelector('#puzzleAssignmentLevel')?.addEventListener('change', (event) => applyPreset(event.target.value));
  document.querySelector('#generatePuzzleAssignmentButton')?.addEventListener('click', generatePreview);
  document.querySelector('#puzzleAssignmentForm')?.addEventListener('submit', publishAssignment);
  document.querySelector('#refreshPuzzleAssignmentsButton')?.addEventListener('click', () => loadAssignmentHistory().catch((error) => setLocalStatus(readableError(error), 'error')));

  document.querySelector('#puzzleAssignmentPreviewList')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-assignment-action]');
    if (!button) return;
    const index = Number(button.dataset.index);
    if (button.dataset.assignmentAction === 'preview') openPreview(index);
    if (button.dataset.assignmentAction === 'replace') replacePreview(index);
  });

  document.querySelector('#puzzleAssignmentHistoryList')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-assignment-action]');
    if (!button) return;
    const action = button.dataset.assignmentAction;
    const task = action === 'copy-link'
      ? copyStudentLink(button.dataset.rowId)
      : action === 'reissue-link'
        ? reissueStudentLink(button.dataset.rowId)
        : action === 'archive-assignment'
          ? archiveAssignment(button.dataset.assignmentId)
          : null;
    task?.catch((error) => setLocalStatus(readableError(error), 'error'));
  });

  document.querySelector('#studentList')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action="select-student"]');
    if (!button) return;
    state.currentStudentId = button.dataset.studentId;
    queueMicrotask(() => {
      renderStudentChoices();
      const selected = currentStudent();
      if (selected) {
        document.querySelector('#puzzleAssignmentLevel').value = selected.puzzle_level || 'advanced_beginner';
        applyPreset(selected.puzzle_level || 'advanced_beginner');
      }
      dispatchCoachAssignmentSummary();
    });
  });
}

async function initialize() {
  try {
    state.profile = await requireProfile('teacher');
    if (!state.profile) return;
    injectInterface();
    await Promise.all([loadStudents(), loadAssignmentHistory()]);
    dispatchCoachAssignmentSummary();
  } catch (error) {
    setLocalStatus(readableError(error), 'error');
  }
}

document.addEventListener('coach-session:request-assignment-summary', (event) => {
  const studentId = event.detail?.studentId;
  if (typeof studentId !== 'string' || !studentId) return;
  state.currentStudentId = studentId;
  dispatchCoachAssignmentSummary();
});

initialize();
