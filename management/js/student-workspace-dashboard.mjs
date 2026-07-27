import { Chess } from '../../vendor/chess.js';
import { loadLessonCatalog } from './lesson-catalog.mjs';
import { getSupabase, readableError, requireProfile } from './supabase-client.mjs';
import { escapeHtml, setBusy, setStatus } from './ui.mjs';
import {
  randomAccessToken,
  sha256Hex,
  studentWorkspaceLink,
  validateStudentLiveBoardUrl,
} from './student-workspace-core.mjs';

const TOKEN_STORE_KEY = 'chess-study-student-workspace-links-v1';

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
  liveBoardUrl: document.querySelector('#studentWorkspaceLiveBoardUrl'),
  save: document.querySelector('#saveStudentWorkspaceButton'),
  copy: document.querySelector('#copyStudentWorkspaceLinkButton'),
  open: document.querySelector('#openStudentWorkspaceLink'),
  reissue: document.querySelector('#reissueStudentWorkspaceLinkButton'),
};

const state = {
  profile: null,
  students: [],
  catalog: [],
  studentId: null,
  workspace: null,
  loadVersion: 0,
};

function readTokenStore() {
  try {
    const value = JSON.parse(localStorage.getItem(TOKEN_STORE_KEY) || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

function storeToken(workspaceId, token) {
  const store = readTokenStore();
  store[workspaceId] = token;
  localStorage.setItem(TOKEN_STORE_KEY, JSON.stringify(store));
}

function tokenForWorkspace() {
  return state.workspace?.id ? readTokenStore()[state.workspace.id] || '' : '';
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
  elements.liveBoardUrl.value = workspace?.live_board_url || '';
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

async function loadWorkspace(studentId = selectedStudentId()) {
  if (!studentId) {
    state.studentId = null;
    state.workspace = null;
    render();
    return;
  }
  const loadVersion = ++state.loadVersion;
  await refreshStudent(studentId);
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('student_workspaces')
    .select('id, teacher_id, student_id, is_published, teacher_instructions, homework, due_at, lesson_key, lesson_title, lesson_url, position_title, position_fen, live_board_url, token_rotated_at, created_at, updated_at')
    .eq('student_id', studentId)
    .maybeSingle();
  if (error) throw error;
  if (loadVersion !== state.loadVersion) return;
  state.studentId = studentId;
  state.workspace = data || null;
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
    live_board_url: validateStudentLiveBoardUrl(elements.liveBoardUrl.value),
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

async function reissueWorkspaceLink() {
  const student = selectedStudent();
  if (!student || !state.workspace || student.archived_at) return;
  if (!window.confirm(`Replace ${student.display_name}'s current workspace link? The old link will stop working immediately.`)) return;

  setBusy(elements.reissue, true, 'Replacing…');
  setStatus(elements.status, '');
  try {
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
    storeToken(data.id, token);
    render();
    setStatus(elements.status, 'Private link replaced. Copy and send the new link.', 'success');
  } catch (error) {
    setStatus(elements.status, readableError(error), 'error');
  } finally {
    setBusy(elements.reissue, false);
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
