import { getSupabase, readableError, requireProfile } from './supabase-client.mjs';
import { escapeHtml, setBusy, setStatus } from './ui.mjs';
import {
  assignmentLink,
  formatLevel,
  randomAccessToken,
  sha256Hex,
} from './puzzle-assignment-core.mjs';

const TOKEN_STORE_KEY = 'chess-study-puzzle-assignment-teacher-links-v1';

const state = {
  profile: null,
  students: [],
  assignments: [],
  rows: [],
  filter: 'all',
  rendering: false,
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

function storeToken(rowId, token) {
  const store = readTokenStore();
  store[rowId] = token;
  writeTokenStore(store);
}

function removeTokens(rowIds) {
  const store = readTokenStore();
  for (const rowId of rowIds) delete store[rowId];
  writeTokenStore(store);
}

function tokenFor(rowId) {
  return readTokenStore()[rowId] || '';
}

function setLocalStatus(message = '', tone = '') {
  setStatus(document.querySelector('#puzzleAssignmentStatus'), message, tone);
}

function formatDate(value, fallback = 'No due date') {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function localDateTimeValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}

function statusLabel(status) {
  return String(status || 'not_started').replaceAll('_', ' ');
}

function assignmentRows(assignmentId) {
  return state.rows.filter((row) => row.assignment_id === assignmentId);
}

function studentName(studentId) {
  return state.students.find((student) => student.id === studentId)?.display_name || 'Student';
}

function hasStarted(rows) {
  return rows.some((row) => row.status !== 'not_started' || row.started_at);
}

function dueState(assignment) {
  if (!assignment.due_at) return { label: 'No due date', tone: '' };
  const due = new Date(assignment.due_at);
  if (Number.isNaN(due.getTime())) return { label: 'No due date', tone: '' };
  const overdue = assignment.status === 'published' && due.getTime() < Date.now();
  return { label: `${overdue ? 'Overdue' : 'Due'} ${formatDate(assignment.due_at)}`, tone: overdue ? 'overdue' : '' };
}

async function loadData() {
  const supabase = getSupabase();
  const [{ data: assignments, error: assignmentError }, { data: students, error: studentError }] = await Promise.all([
    supabase
      .from('puzzle_assignments')
      .select('id, title, instructions, level, min_rating, max_rating, theme_filters, puzzle_count, allow_hints, max_hint_level, allow_retry, passing_score, due_at, status, published_at, created_at, updated_at')
      .eq('teacher_id', state.profile.id)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('managed_students')
      .select('id, display_name, archived_at')
      .eq('teacher_id', state.profile.id)
      .order('display_name', { ascending: true }),
  ]);
  if (assignmentError) throw assignmentError;
  if (studentError) throw studentError;

  state.assignments = assignments || [];
  state.students = students || [];
  const ids = state.assignments.map((assignment) => assignment.id);
  if (!ids.length) {
    state.rows = [];
    renderDashboard();
    return;
  }

  const { data: rows, error: rowError } = await supabase
    .from('puzzle_assignment_students')
    .select('id, assignment_id, student_id, status, current_index, score, started_at, completed_at, last_opened_at, created_at')
    .in('assignment_id', ids)
    .order('created_at', { ascending: true });
  if (rowError) throw rowError;
  state.rows = rows || [];
  renderDashboard();
}

function summaryMarkup() {
  const active = state.assignments.filter((assignment) => assignment.status === 'published').length;
  const archived = state.assignments.filter((assignment) => assignment.status === 'archived').length;
  const completed = state.rows.filter((row) => row.status === 'completed').length;
  const inProgress = state.rows.filter((row) => row.status === 'started').length;
  return `
    <div class="assignment-management-summary" aria-label="Assignment summary">
      <div><strong>${active}</strong><span>Active assignments</span></div>
      <div><strong>${inProgress}</strong><span>Students in progress</span></div>
      <div><strong>${completed}</strong><span>Completed submissions</span></div>
      <div><strong>${archived}</strong><span>Archived assignments</span></div>
    </div>
  `;
}

function filterMarkup() {
  return `
    <div class="assignment-management-toolbar">
      <div class="assignment-management-filters" aria-label="Filter assignments">
        ${[
          ['all', 'All'],
          ['published', 'Active'],
          ['archived', 'Archived'],
        ].map(([value, label]) => `<button type="button" data-lifecycle-action="filter" data-filter="${value}" aria-pressed="${state.filter === value}">${label}</button>`).join('')}
      </div>
      <button class="button-secondary" type="button" data-lifecycle-action="refresh">Refresh progress</button>
    </div>
  `;
}

function studentRowMarkup(row, assignment) {
  const token = tokenFor(row.id);
  const progress = Math.min(assignment.puzzle_count, Number(row.current_index || 0));
  const detail = `${statusLabel(row.status)} · ${progress}/${assignment.puzzle_count} puzzles · score ${Number(row.score || 0)}%`;
  return `
    <div class="assignment-admin-student-row">
      <div class="assignment-admin-student-copy">
        <strong>${escapeHtml(studentName(row.student_id))}</strong>
        <small>${escapeHtml(detail)}</small>
      </div>
      <div class="assignment-admin-student-actions">
        ${token ? `<button class="button-secondary" type="button" data-lifecycle-action="copy-link" data-row-id="${escapeHtml(row.id)}">Copy link</button>` : ''}
        <button class="button-secondary" type="button" data-lifecycle-action="reissue-link" data-row-id="${escapeHtml(row.id)}">${token ? 'Replace link' : 'Create link'}</button>
      </div>
    </div>
  `;
}

function assignmentCardMarkup(assignment) {
  const rows = assignmentRows(assignment.id);
  const started = rows.filter((row) => row.status === 'started').length;
  const completed = rows.filter((row) => row.status === 'completed').length;
  const notStarted = rows.filter((row) => row.status === 'not_started').length;
  const average = rows.length
    ? Math.round(rows.reduce((sum, row) => sum + Number(row.score || 0), 0) / rows.length)
    : 0;
  const completion = rows.length ? Math.round((completed / rows.length) * 100) : 0;
  const due = dueState(assignment);
  const locked = hasStarted(rows);
  const themes = Array.isArray(assignment.theme_filters) && assignment.theme_filters.length
    ? assignment.theme_filters.join(', ')
    : 'Mixed training';

  return `
    <article class="assignment-admin-card ${assignment.status === 'archived' ? 'is-archived' : ''}" data-assignment-id="${escapeHtml(assignment.id)}">
      <div class="assignment-admin-card-head">
        <div>
          <div class="assignment-admin-title-row">
            <h4>${escapeHtml(assignment.title)}</h4>
            <span class="assignment-status-badge ${escapeHtml(assignment.status)}">${escapeHtml(assignment.status)}</span>
          </div>
          <p class="assignment-admin-meta">${escapeHtml(formatLevel(assignment.level))} · rating ${assignment.min_rating}–${assignment.max_rating} · ${assignment.puzzle_count} puzzles · ${escapeHtml(themes)} · ${escapeHtml(due.label)}</p>
        </div>
        <div class="assignment-admin-actions">
          <button class="button-secondary" type="button" data-lifecycle-action="edit" data-assignment-id="${escapeHtml(assignment.id)}">Edit details</button>
          <button class="button-secondary" type="button" data-lifecycle-action="duplicate" data-assignment-id="${escapeHtml(assignment.id)}">Duplicate</button>
          ${assignment.status === 'published'
            ? `<button class="button-secondary" type="button" data-lifecycle-action="archive" data-assignment-id="${escapeHtml(assignment.id)}">Archive</button>`
            : `<button class="button-secondary" type="button" data-lifecycle-action="restore" data-assignment-id="${escapeHtml(assignment.id)}">Restore</button>`}
          <button class="button-danger" type="button" data-lifecycle-action="delete" data-assignment-id="${escapeHtml(assignment.id)}">Delete</button>
        </div>
      </div>
      <div class="assignment-admin-overview">
        <div><strong>${rows.length}</strong><span>Assigned students</span></div>
        <div><strong>${started}</strong><span>In progress</span></div>
        <div><strong>${completed}</strong><span>Completed</span></div>
        <div><strong>${average}%</strong><span>Average score</span></div>
      </div>
      <div class="assignment-progress-shell">
        <div class="assignment-progress-label"><span>${completed} of ${rows.length} completed</span><span>${completion}%</span></div>
        <div class="assignment-progress-track" style="--assignment-progress:${completion}%"><span></span></div>
      </div>
      ${locked ? '<div class="assignment-lifecycle-warning" style="margin:0 15px 12px">Students have started. Editing is limited to title, instructions, due date, scoring, and hint policies. The frozen puzzle set remains unchanged.</div>' : ''}
      <div class="assignment-admin-students">
        ${rows.length ? rows.map((row) => studentRowMarkup(row, assignment)).join('') : '<div class="empty">No students assigned.</div>'}
      </div>
    </article>
  `;
}

function renderDashboard() {
  const list = document.querySelector('#puzzleAssignmentHistoryList');
  if (!list) return;
  state.rendering = true;
  const filtered = state.filter === 'all'
    ? state.assignments
    : state.assignments.filter((assignment) => assignment.status === state.filter);
  list.innerHTML = `
    <div class="assignment-admin-list" data-lifecycle-rendered="true">
      ${summaryMarkup()}
      ${filterMarkup()}
      ${filtered.length ? filtered.map(assignmentCardMarkup).join('') : '<div class="empty">No assignments match this view.</div>'}
    </div>
  `;
  state.rendering = false;
}

function ensureDialog() {
  let dialog = document.querySelector('#assignmentLifecycleDialog');
  if (dialog) return dialog;
  dialog = document.createElement('dialog');
  dialog.id = 'assignmentLifecycleDialog';
  dialog.className = 'assignment-lifecycle-dialog';
  dialog.innerHTML = `
    <form id="assignmentLifecycleForm" class="assignment-lifecycle-form">
      <input id="assignmentLifecycleId" type="hidden">
      <header>
        <h3>Edit assignment details</h3>
        <p>The exact puzzle positions stay frozen. Duplicate the assignment to create a revised puzzle set.</p>
      </header>
      <div id="assignmentLifecycleNotice" class="assignment-lifecycle-warning" hidden></div>
      <div class="form-row">
        <label for="assignmentLifecycleTitle">Title</label>
        <input id="assignmentLifecycleTitle" maxlength="160" required>
      </div>
      <div class="form-row">
        <label for="assignmentLifecycleInstructions">Teacher instructions</label>
        <textarea id="assignmentLifecycleInstructions" maxlength="4000"></textarea>
      </div>
      <div class="assignment-lifecycle-grid">
        <div class="form-row">
          <label for="assignmentLifecycleDue">Due date</label>
          <input id="assignmentLifecycleDue" type="datetime-local">
        </div>
        <div class="form-row">
          <label for="assignmentLifecyclePassing">Passing score</label>
          <input id="assignmentLifecyclePassing" type="number" min="0" max="100">
        </div>
        <label class="checkbox-row"><input id="assignmentLifecycleHints" type="checkbox"> Allow hints</label>
        <div class="form-row compact">
          <span>Maximum hint level</span>
          <select id="assignmentLifecycleMaxHint"><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option></select>
        </div>
        <label class="checkbox-row"><input id="assignmentLifecycleRetry" type="checkbox"> Allow retry after mistakes</label>
      </div>
      <div class="assignment-lifecycle-actions">
        <button class="button-secondary" type="button" data-lifecycle-dialog-action="cancel">Cancel</button>
        <button id="assignmentLifecycleSave" class="button" type="submit">Save changes</button>
      </div>
    </form>
  `;
  document.body.appendChild(dialog);
  dialog.querySelector('[data-lifecycle-dialog-action="cancel"]').addEventListener('click', () => dialog.close());
  dialog.querySelector('#assignmentLifecycleForm').addEventListener('submit', saveEdit);
  return dialog;
}

function openEdit(assignmentId) {
  const assignment = state.assignments.find((item) => item.id === assignmentId);
  if (!assignment) return;
  const dialog = ensureDialog();
  const rows = assignmentRows(assignment.id);
  dialog.querySelector('#assignmentLifecycleId').value = assignment.id;
  dialog.querySelector('#assignmentLifecycleTitle').value = assignment.title || '';
  dialog.querySelector('#assignmentLifecycleInstructions').value = assignment.instructions || '';
  dialog.querySelector('#assignmentLifecycleDue').value = localDateTimeValue(assignment.due_at);
  dialog.querySelector('#assignmentLifecyclePassing').value = String(assignment.passing_score ?? 70);
  dialog.querySelector('#assignmentLifecycleHints').checked = Boolean(assignment.allow_hints);
  dialog.querySelector('#assignmentLifecycleMaxHint').value = String(assignment.max_hint_level ?? 2);
  dialog.querySelector('#assignmentLifecycleRetry').checked = Boolean(assignment.allow_retry);
  const notice = dialog.querySelector('#assignmentLifecycleNotice');
  notice.hidden = !hasStarted(rows);
  notice.textContent = hasStarted(rows)
    ? 'One or more students have started. The puzzle set, level, rating range, and assigned students cannot be changed here.'
    : 'No student has started. These edits will be visible the next time students open their links.';
  dialog.showModal();
}

async function saveEdit(event) {
  event.preventDefault();
  const dialog = document.querySelector('#assignmentLifecycleDialog');
  const button = dialog.querySelector('#assignmentLifecycleSave');
  setBusy(button, true, 'Saving…');
  try {
    const id = dialog.querySelector('#assignmentLifecycleId').value;
    const title = dialog.querySelector('#assignmentLifecycleTitle').value.trim();
    if (!title) throw new Error('Enter an assignment title.');
    const dueValue = dialog.querySelector('#assignmentLifecycleDue').value;
    const updates = {
      title,
      instructions: dialog.querySelector('#assignmentLifecycleInstructions').value.trim(),
      due_at: dueValue ? new Date(dueValue).toISOString() : null,
      passing_score: Number(dialog.querySelector('#assignmentLifecyclePassing').value || 0),
      allow_hints: dialog.querySelector('#assignmentLifecycleHints').checked,
      max_hint_level: Number(dialog.querySelector('#assignmentLifecycleMaxHint').value),
      allow_retry: dialog.querySelector('#assignmentLifecycleRetry').checked,
    };
    const { error } = await getSupabase().from('puzzle_assignments').update(updates).eq('id', id);
    if (error) throw error;
    dialog.close();
    await loadData();
    setLocalStatus('Assignment details updated.', 'success');
  } catch (error) {
    setLocalStatus(readableError(error), 'error');
  } finally {
    setBusy(button, false);
  }
}

async function copyStudentLink(rowId) {
  const token = tokenFor(rowId);
  if (!token) throw new Error('This browser does not have that token. Create a replacement link.');
  await navigator.clipboard.writeText(assignmentLink(token));
  setLocalStatus('Student assignment link copied.', 'success');
}

async function reissueStudentLink(rowId) {
  const token = randomAccessToken();
  const hash = await sha256Hex(token);
  const { error } = await getSupabase().from('puzzle_assignment_students').update({ access_token_hash: hash }).eq('id', rowId);
  if (error) throw error;
  storeToken(rowId, token);
  await navigator.clipboard.writeText(assignmentLink(token));
  renderDashboard();
  setLocalStatus('Replacement link created and copied. The previous link no longer works.', 'success');
}

async function setAssignmentStatus(assignmentId, status) {
  const verb = status === 'archived' ? 'archive' : 'restore';
  if (!window.confirm(`${verb[0].toUpperCase()}${verb.slice(1)} this assignment?`)) return;
  const { error } = await getSupabase().from('puzzle_assignments').update({ status }).eq('id', assignmentId);
  if (error) throw error;
  await loadData();
  setLocalStatus(`Assignment ${status === 'archived' ? 'archived' : 'restored'}.`, 'success');
}

async function deleteAssignment(assignmentId) {
  const assignment = state.assignments.find((item) => item.id === assignmentId);
  if (!assignment) return;
  const rows = assignmentRows(assignmentId);
  const warning = rows.some((row) => row.status !== 'not_started')
    ? 'This permanently deletes student progress and results. Type DELETE to continue.'
    : 'This permanently deletes the assignment and invalidates its links. Type DELETE to continue.';
  const confirmation = window.prompt(`${warning}\n\nAssignment: ${assignment.title}`, '');
  if (confirmation !== 'DELETE') return;
  const { error } = await getSupabase().from('puzzle_assignments').delete().eq('id', assignmentId);
  if (error) throw error;
  removeTokens(rows.map((row) => row.id));
  await loadData();
  setLocalStatus('Assignment permanently deleted.', 'success');
}

async function duplicateAssignment(assignmentId) {
  const assignment = state.assignments.find((item) => item.id === assignmentId);
  if (!assignment) return;
  const originalRows = assignmentRows(assignmentId).filter((row) => {
    const student = state.students.find((item) => item.id === row.student_id);
    return student && !student.archived_at;
  });
  if (!originalRows.length) throw new Error('No active assigned students are available for the duplicate.');
  const title = String(window.prompt('Title for the duplicated assignment', `${assignment.title} copy`) || '').trim();
  if (!title) return;
  if (!window.confirm(`Publish the duplicate to ${originalRows.length} active student${originalRows.length === 1 ? '' : 's'} with new private links?`)) return;

  const supabase = getSupabase();
  const { data: puzzleRows, error: puzzleError } = await supabase
    .from('puzzle_assignment_puzzles')
    .select('puzzle_id, position_number, puzzle_snapshot')
    .eq('assignment_id', assignmentId)
    .order('position_number', { ascending: true });
  if (puzzleError) throw puzzleError;

  const tokens = new Map();
  const students = [];
  for (const row of originalRows) {
    const token = randomAccessToken();
    tokens.set(row.student_id, token);
    students.push({ student_id: row.student_id, token_hash: await sha256Hex(token) });
  }

  const payload = {
    title,
    instructions: assignment.instructions || '',
    level: assignment.level,
    min_rating: assignment.min_rating,
    max_rating: assignment.max_rating,
    themes: assignment.theme_filters || [],
    allow_hints: assignment.allow_hints,
    max_hint_level: assignment.max_hint_level,
    allow_retry: assignment.allow_retry,
    passing_score: assignment.passing_score,
    due_at: assignment.due_at || '',
    puzzles: (puzzleRows || []).map((row) => ({ id: row.puzzle_id, snapshot: row.puzzle_snapshot })),
    students,
  };

  const { data, error } = await supabase.rpc('create_puzzle_assignment', { p_payload: payload });
  if (error) throw error;
  const { data: newRows, error: rowError } = await supabase
    .from('puzzle_assignment_students')
    .select('id, student_id')
    .eq('assignment_id', data.assignment_id);
  if (rowError) throw rowError;
  for (const row of newRows || []) {
    const token = tokens.get(row.student_id);
    if (token) storeToken(row.id, token);
  }
  await loadData();
  setLocalStatus(`Duplicated “${assignment.title}” as “${title}”.`, 'success');
}

function handleClick(event) {
  const button = event.target.closest('[data-lifecycle-action]');
  if (!button) return;
  const action = button.dataset.lifecycleAction;
  const assignmentId = button.dataset.assignmentId;
  const rowId = button.dataset.rowId;
  let task = null;
  if (action === 'filter') {
    state.filter = button.dataset.filter || 'all';
    renderDashboard();
    return;
  }
  if (action === 'refresh') task = loadData();
  if (action === 'edit') return openEdit(assignmentId);
  if (action === 'duplicate') task = duplicateAssignment(assignmentId);
  if (action === 'archive') task = setAssignmentStatus(assignmentId, 'archived');
  if (action === 'restore') task = setAssignmentStatus(assignmentId, 'published');
  if (action === 'delete') task = deleteAssignment(assignmentId);
  if (action === 'copy-link') task = copyStudentLink(rowId);
  if (action === 'reissue-link') task = reissueStudentLink(rowId);
  task?.catch((error) => setLocalStatus(readableError(error), 'error'));
}

function waitForHistoryList() {
  return new Promise((resolve) => {
    const existing = document.querySelector('#puzzleAssignmentHistoryList');
    if (existing) return resolve(existing);
    const observer = new MutationObserver(() => {
      const element = document.querySelector('#puzzleAssignmentHistoryList');
      if (!element) return;
      observer.disconnect();
      resolve(element);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

async function initialize() {
  try {
    state.profile = await requireProfile('teacher');
    if (!state.profile) return;
    const list = await waitForHistoryList();
    list.addEventListener('click', handleClick);
    const observer = new MutationObserver(() => {
      if (state.rendering) return;
      if (list.querySelector(':scope > .assignment-admin-list[data-lifecycle-rendered="true"]')) return;
      renderDashboard();
    });
    observer.observe(list, { childList: true });
    await loadData();
  } catch (error) {
    setLocalStatus(readableError(error), 'error');
  }
}

initialize();
