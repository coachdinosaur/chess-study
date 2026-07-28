import { Chess } from '../../vendor/chess.js';
import { loadLessonCatalog } from './lesson-catalog.mjs';
import { getSupabase, readableError, requireProfile } from './supabase-client.mjs';
import { escapeHtml, setBusy, setStatus } from './ui.mjs';
import {
  liveBoardTeacherLink,
  randomAccessToken,
  sha256Hex,
  studentWorkspaceLink,
} from './student-workspace-core.mjs';

const TOKEN_STORE_KEY = 'chess-study-student-workspace-links-v1';
const LIVE_BOARD_STORE_KEY = 'chess-study-student-live-board-v1';
const DEFAULT_POSITION = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function installLiveBoardControls() {
  const oldInput = document.querySelector('#studentWorkspaceLiveBoardUrl');
  const row = oldInput?.closest('.form-row');
  if (!row) return;

  row.classList.add('student-workspace-live-board-row');
  row.innerHTML = `
    <label>Live Board session</label>
    <p id="studentWorkspaceLiveBoardSummary" class="muted">Save the workspace before starting a Live Board session.</p>
    <div class="inline-actions student-workspace-live-board-actions">
      <button id="startStudentWorkspaceLiveBoardButton" class="button" type="button">Start Live Board session</button>
      <a id="resumeStudentWorkspaceLiveBoardLink" class="button-secondary" href="#" target="_blank" rel="noopener" hidden>Resume teacher board</a>
      <button id="endStudentWorkspaceLiveBoardButton" class="button-danger" type="button" hidden>End Live Board session</button>
    </div>
    <p class="muted">The student keeps the same permanent workspace link. A temporary synchronized room appears there only while a session is active.</p>
  `;
}

installLiveBoardControls();

const elements = {
  form: document.querySelector('#studentWorkspaceForm'),
  status: document.querySelector('#studentWorkspaceStatus'),
  state: document.querySelector('#studentWorkspaceState'),
  description: document.querySelector('#studentWorkspaceDescription'),
  published: document.querySelector('#studentWorkspacePublished'),
  instructions: document.querySelector('#studentWorkspaceInstructions'),
  homework: document.querySelector('#studentWorkspaceHomework'),
  dueAt: document.querySelector('#studentWorkspaceDueAt'),
  lesson: document.querySelector('#studentWorkspaceLesson'),
  positionTitle: document.querySelector('#studentWorkspacePositionTitle'),
  positionFen: document.querySelector('#studentWorkspacePositionFen'),
  save: document.querySelector('#saveStudentWorkspaceButton'),
  copy: document.querySelector('#copyStudentWorkspaceLinkButton'),
  open: document.querySelector('#openStudentWorkspaceLink'),
  reissue: document.querySelector('#reissueStudentWorkspaceLinkButton'),
  liveBoardSummary: document.querySelector('#studentWorkspaceLiveBoardSummary'),
  startLiveBoard: document.querySelector('#startStudentWorkspaceLiveBoardButton'),
  resumeLiveBoard: document.querySelector('#resumeStudentWorkspaceLiveBoardLink'),
  endLiveBoard: document.querySelector('#endStudentWorkspaceLiveBoardButton'),
};

const state = {
  profile: null,
  students: [],
  catalog: [],
  studentId: null,
  workspace: null,
  liveBoard: { active: false },
  loadVersion: 0,
};

function readObjectStore(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

function writeObjectStore(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function readTokenStore() {
  return readObjectStore(TOKEN_STORE_KEY);
}

function storeToken(workspaceId, token) {
  const store = readTokenStore();
  store[workspaceId] = token;
  writeObjectStore(TOKEN_STORE_KEY, store);
}

function tokenForWorkspace() {
  return state.workspace?.id ? readTokenStore()[state.workspace.id] || '' : '';
}

function readLiveBoardStore() {
  return readObjectStore(LIVE_BOARD_STORE_KEY);
}

function storeLiveBoardCredentials(workspaceId, credentials) {
  const store = readLiveBoardStore();
  store[workspaceId] = credentials;
  writeObjectStore(LIVE_BOARD_STORE_KEY, store);
}

function clearLiveBoardCredentials(workspaceId) {
  const store = readLiveBoardStore();
  delete store[workspaceId];
  writeObjectStore(LIVE_BOARD_STORE_KEY, store);
}

function liveBoardCredentialsForWorkspace() {
  return state.workspace?.id ? readLiveBoardStore()[state.workspace.id] || null : null;
}

function makeRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

function selectedStudentId() {
  return document.querySelector('#studentList [data-action="select-student"][data-active="true"]')?.dataset.studentId
    || state.studentId
    || state.students.find((student) => !student.archived_at)?.id
    || null;
}

function selectedStudent() {
  return state.students.find((student) => student.id === state.studentId) || null;
}

function toLocalDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function populateLessonOptions() {
  const current = state.workspace?.lesson_key || '';
  elements.lesson.innerHTML = [
    '<option value="">No assigned lesson</option>',
    ...state.catalog
      .filter((lesson) => lesson.available)
      .map((lesson) => `<option value="${escapeHtml(lesson.key)}">${escapeHtml(lesson.level)} · ${escapeHtml(lesson.title)}</option>`),
  ].join('');
  elements.lesson.value = state.catalog.some((lesson) => lesson.key === current) ? current : '';
}

function renderLiveBoardSession(student, workspace, archived, token) {
  const active = Boolean(state.liveBoard?.active && state.liveBoard.room_code);
  const credentials = liveBoardCredentialsForWorkspace();
  const canResume = Boolean(
    active
    && credentials?.roomCode === state.liveBoard.room_code
    && credentials?.teacherToken
    && token
  );

  elements.startLiveBoard.hidden = active && canResume;
  elements.startLiveBoard.disabled = archived || !workspace || !workspace.is_published || !token;
  elements.startLiveBoard.textContent = active ? 'Start replacement session' : 'Start Live Board session';
  elements.resumeLiveBoard.hidden = !canResume;
  elements.endLiveBoard.hidden = !active;
  elements.endLiveBoard.disabled = archived || !workspace;

  if (canResume) {
    elements.resumeLiveBoard.href = liveBoardTeacherLink(
      state.liveBoard.room_code,
      credentials.teacherToken,
      token,
    );
  } else {
    elements.resumeLiveBoard.href = '#';
  }

  if (!workspace) {
    elements.liveBoardSummary.textContent = 'Save the workspace before starting a Live Board session.';
  } else if (archived) {
    elements.liveBoardSummary.textContent = 'Archived students cannot start or resume Live Board sessions.';
  } else if (!workspace.is_published) {
    elements.liveBoardSummary.textContent = 'Publish the workspace before starting a Live Board session.';
  } else if (active) {
    const expires = formatDateTime(state.liveBoard.expires_at);
    elements.liveBoardSummary.textContent = `Room ${state.liveBoard.room_code} is active${expires ? ` until ${expires}` : ''}. ${student.display_name} joins from the same permanent workspace link.`;
  } else if (workspace.active_live_board_room_code) {
    elements.liveBoardSummary.textContent = 'The previous Live Board session expired. Start a new session shortly before class.';
  } else {
    elements.liveBoardSummary.textContent = `${student.display_name} will see Join Live Board only while you have an active temporary session.`;
  }
}

function render() {
  const student = selectedStudent();
  const workspace = state.workspace;
  const token = tokenForWorkspace();
  const archived = Boolean(student?.archived_at);

  elements.form.hidden = !student;
  if (!student) {
    elements.description.textContent = 'Select a student to prepare their coach-controlled workspace.';
    elements.state.textContent = 'No student';
    return;
  }

  elements.description.textContent = workspace
    ? `Choose exactly what ${student.display_name} sees. Changes appear on the same private link.`
    : `Create one permanent private link for ${student.display_name}, then choose exactly what appears there.`;
  elements.state.textContent = archived
    ? 'Archived'
    : workspace?.is_published
      ? 'Published'
      : workspace
        ? 'Paused'
        : 'Not created';

  elements.published.checked = workspace?.is_published ?? true;
  elements.instructions.value = workspace?.teacher_instructions || '';
  elements.homework.value = workspace?.homework || '';
  elements.dueAt.value = toLocalDateTime(workspace?.due_at);
  elements.positionTitle.value = workspace?.position_title || '';
  elements.positionFen.value = workspace?.position_fen || '';
  populateLessonOptions();

  const link = token ? studentWorkspaceLink(token) : '';
  elements.copy.disabled = !link;
  elements.copy.hidden = !workspace;
  elements.open.hidden = !link;
  elements.open.href = link || '#';
  elements.reissue.hidden = !workspace;
  elements.save.disabled = archived;
  elements.reissue.disabled = archived;

  if (workspace && !token) {
    setStatus(
      elements.status,
      'This browser does not have the raw private link. Reissue it to replace the old link.',
      'warning',
    );
  } else {
    setStatus(elements.status, '');
  }

  renderLiveBoardSession(student, workspace, archived, token);
}

async function loadStudents() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('managed_students')
    .select('id, display_name, archived_at')
    .eq('teacher_id', state.profile.id)
    .order('created_at', { ascending: true });
  if (error) throw error;
  state.students = data || [];
}

async function refreshStudent(studentId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('managed_students')
    .select('id, display_name, archived_at')
    .eq('teacher_id', state.profile.id)
    .eq('id', studentId)
    .maybeSingle();
  if (error) throw error;
  state.students = state.students.filter((student) => student.id !== studentId);
  if (data) state.students.push(data);
}

async function fetchLiveBoardSession(workspaceId) {
  if (!workspaceId) return { active: false };
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('get_teacher_student_workspace_live_board', {
    p_workspace_id: workspaceId,
  });
  if (error) throw error;
  return data || { active: false };
}

async function loadWorkspace(studentId = selectedStudentId()) {
  if (!studentId) {
    state.studentId = null;
    state.workspace = null;
    state.liveBoard = { active: false };
    render();
    return;
  }

  const loadVersion = ++state.loadVersion;
  await refreshStudent(studentId);
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('student_workspaces')
    .select('id, teacher_id, student_id, is_published, teacher_instructions, homework, due_at, lesson_key, lesson_title, lesson_url, position_title, position_fen, active_live_board_room_code, live_board_started_at, token_rotated_at, created_at, updated_at')
    .eq('student_id', studentId)
    .maybeSingle();
  if (error) throw error;
  if (loadVersion !== state.loadVersion) return;

  const liveBoard = data ? await fetchLiveBoardSession(data.id) : { active: false };
  if (loadVersion !== state.loadVersion) return;

  state.studentId = studentId;
  state.workspace = data || null;
  state.liveBoard = liveBoard;
  render();
}

function workspaceValues() {
  const lesson = state.catalog.find((item) => item.key === elements.lesson.value) || null;
  const fen = elements.positionFen.value.trim();
  if (fen) {
    try {
      new Chess(fen);
    } catch {
      throw new Error('Enter a valid FEN for the assigned position.');
    }
  }

  return {
    is_published: elements.published.checked,
    teacher_instructions: elements.instructions.value.trim(),
    homework: elements.homework.value.trim(),
    due_at: elements.dueAt.value ? new Date(elements.dueAt.value).toISOString() : null,
    lesson_key: lesson?.key || null,
    lesson_title: lesson?.title || '',
    lesson_url: lesson?.url || null,
    position_title: elements.positionTitle.value.trim(),
    position_fen: fen || null,
    live_board_url: null,
  };
}

async function saveWorkspace(event) {
  event.preventDefault();
  const student = selectedStudent();
  if (!student || student.archived_at) return;

  setBusy(elements.save, true, 'Saving…');
  setStatus(elements.status, '');
  try {
    const supabase = getSupabase();
    const values = workspaceValues();
    let token = tokenForWorkspace();
    let result;

    if (state.workspace) {
      result = await supabase
        .from('student_workspaces')
        .update(values)
        .eq('id', state.workspace.id)
        .eq('student_id', student.id)
        .select()
        .single();
    } else {
      token = randomAccessToken();
      result = await supabase
        .from('student_workspaces')
        .insert({
          ...values,
          teacher_id: state.profile.id,
          student_id: student.id,
          access_token_hash: await sha256Hex(token),
        })
        .select()
        .single();
    }
    if (result.error) throw result.error;

    state.workspace = result.data;
    if (token) storeToken(result.data.id, token);
    state.liveBoard = await fetchLiveBoardSession(result.data.id);
    render();
    setStatus(
      elements.status,
      `Student workspace ${state.workspace.is_published ? 'published' : 'saved and paused'}.`,
      'success',
    );
  } catch (error) {
    setStatus(elements.status, readableError(error), 'error');
  } finally {
    setBusy(elements.save, false);
  }
}

async function copyWorkspaceLink() {
  const token = tokenForWorkspace();
  if (!token) return;
  try {
    await navigator.clipboard.writeText(studentWorkspaceLink(token));
    setStatus(elements.status, 'Private student workspace link copied.', 'success');
  } catch {
    setStatus(elements.status, 'The browser could not copy the link. Open it and copy from the address bar.', 'warning');
  }
}

async function endLiveBoardRoom({ confirm = true } = {}) {
  const student = selectedStudent();
  const workspace = state.workspace;
  if (!student || !workspace) return false;
  if (confirm && !window.confirm(`End ${student.display_name}'s current Live Board session?`)) return false;

  const supabase = getSupabase();
  const { error } = await supabase.rpc('end_student_workspace_live_board', {
    p_workspace_id: workspace.id,
  });
  if (error) throw error;

  clearLiveBoardCredentials(workspace.id);
  state.workspace.active_live_board_room_code = null;
  state.workspace.live_board_started_at = null;
  state.liveBoard = { active: false };
  return true;
}

async function reissueWorkspaceLink() {
  const student = selectedStudent();
  if (!student || !state.workspace || student.archived_at) return;
  if (!window.confirm(`Replace ${student.display_name}'s current workspace link? The old link will stop working immediately.`)) return;

  setBusy(elements.reissue, true, 'Replacing…');
  setStatus(elements.status, '');
  try {
    if (state.workspace.active_live_board_room_code || state.liveBoard?.active) {
      await endLiveBoardRoom({ confirm: false });
    }

    const token = randomAccessToken();
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('student_workspaces')
      .update({
        access_token_hash: await sha256Hex(token),
        token_rotated_at: new Date().toISOString(),
      })
      .eq('id', state.workspace.id)
      .eq('student_id', student.id)
      .select()
      .single();
    if (error) throw error;

    state.workspace = data;
    state.liveBoard = { active: false };
    storeToken(data.id, token);
    render();
    setStatus(elements.status, 'Private link replaced. Copy and send the new link.', 'success');
  } catch (error) {
    setStatus(elements.status, readableError(error), 'error');
  } finally {
    setBusy(elements.reissue, false);
  }
}

async function startLiveBoardSession() {
  const student = selectedStudent();
  const workspace = state.workspace;
  const studentToken = tokenForWorkspace();
  if (!student || !workspace || student.archived_at || !workspace.is_published) return;

  if (!studentToken) {
    setStatus(elements.status, 'Reissue the private workspace link before starting a Live Board session.', 'warning');
    return;
  }
  if (state.liveBoard?.active && !window.confirm(`Replace ${student.display_name}'s active Live Board session?`)) return;

  const popup = window.open('about:blank', '_blank');
  if (popup) popup.opener = null;
  setBusy(elements.startLiveBoard, true, 'Starting…');
  setStatus(elements.status, '');

  try {
    const roomCode = makeRoomCode();
    const teacherToken = randomAccessToken();
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('start_student_workspace_live_board', {
      p_workspace_id: workspace.id,
      p_room_code: roomCode,
      p_teacher_token: teacherToken,
      p_student_token: studentToken,
      p_fen: workspace.position_fen || DEFAULT_POSITION,
      p_orientation: 'white',
    });
    if (error) throw error;

    storeLiveBoardCredentials(workspace.id, {
      roomCode: data.room_code,
      teacherToken,
    });
    state.workspace.active_live_board_room_code = data.room_code;
    state.workspace.live_board_started_at = data.started_at || new Date().toISOString();
    state.liveBoard = data;
    render();

    const url = liveBoardTeacherLink(data.room_code, teacherToken, studentToken);
    if (popup) popup.location.replace(url);
    else window.open(url, '_blank', 'noopener');

    setStatus(
      elements.status,
      `Live Board session started for ${student.display_name}. Their permanent workspace now shows Join Live Board.`,
      'success',
    );
  } catch (error) {
    if (popup) popup.close();
    setStatus(elements.status, readableError(error), 'error');
  } finally {
    setBusy(elements.startLiveBoard, false);
  }
}

async function endLiveBoardSession() {
  setBusy(elements.endLiveBoard, true, 'Ending…');
  setStatus(elements.status, '');
  try {
    const ended = await endLiveBoardRoom();
    if (!ended) return;
    render();
    setStatus(
      elements.status,
      'Live Board session ended. The permanent student workspace remains available.',
      'success',
    );
  } catch (error) {
    setStatus(elements.status, readableError(error), 'error');
  } finally {
    setBusy(elements.endLiveBoard, false);
  }
}

async function initialize() {
  try {
    state.profile = await requireProfile('teacher');
    if (!state.profile) return;
    const [catalog] = await Promise.all([
      loadLessonCatalog(),
      loadStudents(),
    ]);
    state.catalog = catalog;
    await loadWorkspace();
  } catch (error) {
    setStatus(elements.status, readableError(error), 'error');
  }
}

elements.form?.addEventListener('submit', saveWorkspace);
elements.copy?.addEventListener('click', () => copyWorkspaceLink());
elements.reissue?.addEventListener('click', () => reissueWorkspaceLink());
elements.startLiveBoard?.addEventListener('click', () => startLiveBoardSession());
elements.endLiveBoard?.addEventListener('click', () => endLiveBoardSession());

document.querySelector('#studentList')?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action="select-student"]');
  if (!button) return;
  queueMicrotask(() => loadWorkspace(button.dataset.studentId).catch((error) => {
    setStatus(elements.status, readableError(error), 'error');
  }));
});

document.addEventListener('coach-session:request-assignment-summary', (event) => {
  const studentId = event.detail?.studentId;
  if (!studentId) return;
  loadWorkspace(studentId).catch((error) => {
    setStatus(elements.status, readableError(error), 'error');
  });
});

initialize();
