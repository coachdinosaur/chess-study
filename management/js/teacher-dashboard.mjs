import { getSupabase, readableError, requireProfile, signOut } from './supabase-client.mjs';
import { loadLessonCatalog } from './lesson-catalog.mjs';
import { escapeHtml, formatDate, setBusy, setStatus } from './ui.mjs';
import {
  clearCoachSession,
  createCoachSession,
  elapsedCoachSessionMinutes,
  formatCoachSessionElapsed,
  loadCoachSession,
  recommendCoachLesson,
  saveCoachSession,
} from './coach-session-command.mjs?v=20260727-coach-session1';

const STATUS_LABELS = Object.freeze({
  not_started: 'Not yet taught',
  taught: 'Taught',
  practicing: 'Needs practice',
  completed: 'Completed',
});

const elements = {
  profileName: document.querySelector('#profileName'),
  signOut: document.querySelector('#signOutButton'),
  status: document.querySelector('#dashboardStatus'),
  createStudentForm: document.querySelector('#createStudentForm'),
  studentSearch: document.querySelector('#studentSearch'),
  studentViewFilter: document.querySelector('#studentViewFilter'),
  studentList: document.querySelector('#studentList'),
  selectedPanel: document.querySelector('#selectedStudentPanel'),
  selectedName: document.querySelector('#selectedStudentName'),
  selectedState: document.querySelector('#selectedStudentState'),
  notes: document.querySelector('#studentDetailNotes'),
  saveNotes: document.querySelector('#saveStudentNotesButton'),
  archiveStudent: document.querySelector('#archiveStudentButton'),
  exportStudent: document.querySelector('#exportStudentButton'),
  coachSessionSummary: document.querySelector('#coachSessionSummary'),
  coachSessionState: document.querySelector('#coachSessionState'),
  coachLastSessionValue: document.querySelector('#coachLastSessionValue'),
  coachLastSessionDetail: document.querySelector('#coachLastSessionDetail'),
  coachNextStepValue: document.querySelector('#coachNextStepValue'),
  coachNextStepDetail: document.querySelector('#coachNextStepDetail'),
  coachRecommendedLessonValue: document.querySelector('#coachRecommendedLessonValue'),
  coachRecommendedLessonDetail: document.querySelector('#coachRecommendedLessonDetail'),
  coachAssignmentValue: document.querySelector('#coachAssignmentValue'),
  coachAssignmentDetail: document.querySelector('#coachAssignmentDetail'),
  coachSessionTimer: document.querySelector('#coachSessionTimer'),
  coachSessionElapsed: document.querySelector('#coachSessionElapsed'),
  startCoachSession: document.querySelector('#startCoachSessionButton'),
  endCoachSession: document.querySelector('#endCoachSessionButton'),
  openRecommendedLesson: document.querySelector('#openRecommendedLessonLink'),
  sessionPanel: document.querySelector('#sessionPanel'),
  sessionForm: document.querySelector('#sessionForm'),
  sessionId: document.querySelector('#sessionId'),
  sessionDate: document.querySelector('#sessionDate'),
  sessionDuration: document.querySelector('#sessionDuration'),
  sessionLessonKey: document.querySelector('#sessionLessonKey'),
  sessionNotes: document.querySelector('#sessionNotes'),
  sessionHomework: document.querySelector('#sessionHomework'),
  sessionNextStep: document.querySelector('#sessionNextStep'),
  saveSession: document.querySelector('#saveSessionButton'),
  cancelSessionEdit: document.querySelector('#cancelSessionEditButton'),
  sessionList: document.querySelector('#sessionList'),
  lessonSearch: document.querySelector('#lessonSearch'),
  levelFilter: document.querySelector('#levelFilter'),
  statusFilter: document.querySelector('#statusFilter'),
  curriculumSummary: document.querySelector('#curriculumSummary'),
  lessonSearchResult: document.querySelector('#lessonSearchResult'),
  lessonSearchEmpty: document.querySelector('#lessonSearchEmpty'),
  curriculumList: document.querySelector('#curriculumList'),
};

const app = {
  profile: null,
  students: [],
  selectedStudentId: null,
  catalog: [],
  progress: [],
  sessions: [],
  coachSession: null,
  coachSessionTimer: null,
  assignmentSummary: null,
  assignmentSummaryLoaded: false,
};

function selectedStudent() {
  return app.students.find((student) => student.id === app.selectedStudentId) || null;
}

function progressFor(lessonKey) {
  return app.progress.find((row) => row.lesson_key === lessonKey) || null;
}

function sessionFor(sessionId) {
  return app.sessions.find((session) => session.id === sessionId) || null;
}

function normalizeSearch(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function localToday() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function formatSessionDate(value) {
  if (!value) return 'Undated session';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function updateCoachSessionTimer() {
  if (!elements.coachSessionElapsed || !app.coachSession) return;
  elements.coachSessionElapsed.textContent = formatCoachSessionElapsed(app.coachSession);
}

function stopCoachSessionTimer() {
  if (app.coachSessionTimer) window.clearInterval(app.coachSessionTimer);
  app.coachSessionTimer = null;
}

function ensureCoachSessionTimer() {
  stopCoachSessionTimer();
  if (!app.coachSession) return;
  updateCoachSessionTimer();
  app.coachSessionTimer = window.setInterval(updateCoachSessionTimer, 1000);
}

function activeCoachRecommendation() {
  return recommendCoachLesson({
    catalog: app.catalog,
    progress: app.progress,
    sessions: app.sessions,
    preferredLessonKey: app.coachSession?.studentId === app.selectedStudentId
      ? app.coachSession.lessonKey
      : '',
  });
}

function syncActiveCoachSessionLesson() {
  if (app.coachSession?.studentId !== app.selectedStudentId) return;
  app.coachSession.lessonKey = elements.sessionLessonKey.value;
  saveCoachSession(window.sessionStorage, app.coachSession);
  renderCoachSessionCommand();
}

function renderCoachSessionCommand() {
  const student = selectedStudent();
  if (!student || !elements.coachSessionState) return;

  const latest = app.sessions[0] || null;
  const recommendation = activeCoachRecommendation();
  const activeStudent = app.coachSession
    ? app.students.find((item) => item.id === app.coachSession.studentId) || null
    : null;
  const activeForSelected = app.coachSession?.studentId === student.id;
  const archived = Boolean(student.archived_at);

  elements.coachLastSessionValue.textContent = latest
    ? formatSessionDate(latest.session_date)
    : 'No session recorded';
  elements.coachLastSessionDetail.textContent = latest
    ? `${latest.lesson_title || 'General coaching session'}${latest.duration_minutes ? ` · ${latest.duration_minutes} minutes` : ''}`
    : 'Start the first session when the student is ready.';

  elements.coachNextStepValue.textContent = latest?.next_step ? 'Carry forward' : 'Not set yet';
  elements.coachNextStepDetail.textContent = latest?.next_step
    || 'Add a next step when logging the session.';

  elements.coachRecommendedLessonValue.textContent = recommendation?.lesson.title
    || 'No available lesson';
  elements.coachRecommendedLessonDetail.textContent = recommendation
    ? `${recommendation.reason} · ${recommendation.lesson.level}${recommendation.lesson.module ? ` · ${recommendation.lesson.module}` : ''}`
    : 'Update the curriculum when another lesson becomes available.';
  elements.openRecommendedLesson.hidden = !recommendation;
  if (recommendation) elements.openRecommendedLesson.href = recommendation.lesson.url;

  const assignment = app.assignmentSummary?.studentId === student.id
    ? app.assignmentSummary.assignment
    : null;
  if (!app.assignmentSummaryLoaded) {
    elements.coachAssignmentValue.textContent = 'Loading assignments…';
    elements.coachAssignmentDetail.textContent = 'Recent assignment progress will appear here.';
  } else if (assignment) {
    elements.coachAssignmentValue.textContent = assignment.title;
    elements.coachAssignmentDetail.textContent =
      `${String(assignment.status || 'not started').replaceAll('_', ' ')} · `
      + `${assignment.currentIndex}/${assignment.puzzleCount} completed · score ${assignment.score}%`;
  } else {
    elements.coachAssignmentValue.textContent = 'No published assignment';
    elements.coachAssignmentDetail.textContent = 'Create a focused puzzle assignment when follow-up work is needed.';
  }

  if (activeForSelected) {
    elements.coachSessionState.textContent = 'Session running';
    elements.coachSessionSummary.textContent =
      `Coaching ${student.display_name}. Open the lesson or Live Board, then end here to log the session.`;
  } else if (activeStudent) {
    elements.coachSessionState.textContent = 'Another session running';
    elements.coachSessionSummary.textContent =
      `A session is running for ${activeStudent.display_name}. Select that student to continue it, or start a new session here.`;
  } else {
    elements.coachSessionState.textContent = archived ? 'Archived' : 'Ready';
    elements.coachSessionSummary.textContent = archived
      ? 'Restore this student before recording another coaching session.'
      : 'Review the latest context, then start a focused coaching session.';
  }

  elements.startCoachSession.hidden = activeForSelected;
  elements.startCoachSession.disabled = archived;
  elements.endCoachSession.hidden = !activeForSelected;
  elements.coachSessionTimer.hidden = !activeForSelected;
  if (activeForSelected) updateCoachSessionTimer();
}

function clearActiveCoachSession() {
  app.coachSession = null;
  clearCoachSession(window.sessionStorage);
  stopCoachSessionTimer();
}

function startCoachSession() {
  const student = selectedStudent();
  if (!student || student.archived_at) return;

  const activeStudent = app.coachSession
    ? app.students.find((item) => item.id === app.coachSession.studentId) || null
    : null;
  if (activeStudent && activeStudent.id !== student.id) {
    const replace = window.confirm(
      `A coaching session is already running for ${activeStudent.display_name}. End it and start a new session for ${student.display_name}?`
    );
    if (!replace) return;
  }

  const recommendation = activeCoachRecommendation();
  app.coachSession = createCoachSession({
    studentId: student.id,
    lessonKey: recommendation?.lesson.key || '',
  });
  saveCoachSession(window.sessionStorage, app.coachSession);
  resetSessionForm();
  if (app.coachSession.lessonKey) elements.sessionLessonKey.value = app.coachSession.lessonKey;
  ensureCoachSessionTimer();
  renderCoachSessionCommand();
  setStatus(elements.status, `Coaching session started for ${student.display_name}.`, 'success');
}

function endCoachSession() {
  const student = selectedStudent();
  if (!student || app.coachSession?.studentId !== student.id) return;

  const duration = elapsedCoachSessionMinutes(app.coachSession);
  const lessonKey = app.coachSession.lessonKey;
  clearActiveCoachSession();

  if (!elements.sessionDuration.value.trim()) elements.sessionDuration.value = String(duration);
  if (!elements.sessionLessonKey.value && lessonKey) elements.sessionLessonKey.value = lessonKey;
  renderCoachSessionCommand();
  setStatus(elements.status, 'Session timer stopped. Complete the notes, homework, and next step, then save the session.', 'neutral');
  elements.sessionPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  elements.sessionNotes.focus({ preventScroll: true });
}

function visibleStudents() {
  const view = elements.studentViewFilter?.value || 'active';
  const terms = normalizeSearch(elements.studentSearch?.value).split(/\s+/).filter(Boolean);
  return app.students.filter((student) => {
    const isArchived = Boolean(student.archived_at);
    if (view === 'active' && isArchived) return false;
    if (view === 'archived' && !isArchived) return false;
    const haystack = normalizeSearch(`${student.display_name} ${student.notes || ''}`);
    return terms.every((term) => haystack.includes(term));
  });
}

function renderStudents() {
  const students = visibleStudents();
  if (!students.length) {
    const view = elements.studentViewFilter?.value || 'active';
    const message = view === 'archived'
      ? 'No archived students match this search.'
      : view === 'all'
        ? 'No students match this search.'
        : 'No active students match this search. Add a student above or view archived records.';
    elements.studentList.innerHTML = `<div class="empty">${escapeHtml(message)}</div>`;
    return;
  }

  elements.studentList.innerHTML = students.map((student) => `
    <button class="list-card" type="button" data-action="select-student" data-student-id="${escapeHtml(student.id)}" data-active="${student.id === app.selectedStudentId}">
      <div class="list-card-head">
        <strong>${escapeHtml(student.display_name)}</strong>
        <span class="chip">${student.archived_at ? 'Archived' : 'Active'}</span>
      </div>
      <p>Added ${escapeHtml(formatDate(student.created_at, 'recently'))}</p>
    </button>
  `).join('');
}

function populateLevelFilter() {
  const levels = [...new Set(app.catalog.map((lesson) => lesson.level))];
  elements.levelFilter.innerHTML = '<option value="all">All levels</option>'
    + levels.map((level) => `<option value="${escapeHtml(level)}">${escapeHtml(level)}</option>`).join('');
}

function populateSessionLessons() {
  const currentValue = elements.sessionLessonKey.value;
  const groups = new Map();
  for (const lesson of app.catalog.filter((item) => item.available)) {
    if (!groups.has(lesson.level)) groups.set(lesson.level, []);
    groups.get(lesson.level).push(lesson);
  }

  elements.sessionLessonKey.innerHTML = '<option value="">No linked lesson</option>'
    + [...groups.entries()].map(([level, lessons]) => `
      <optgroup label="${escapeHtml(level)}">
        ${lessons.map((lesson) => `<option value="${escapeHtml(lesson.key)}">${escapeHtml(lesson.number)}. ${escapeHtml(lesson.title)}</option>`).join('')}
      </optgroup>
    `).join('');
  elements.sessionLessonKey.value = currentValue;
}

function renderSummary(lessons) {
  const counts = Object.fromEntries(Object.keys(STATUS_LABELS).map((status) => [status, 0]));
  for (const lesson of lessons) {
    if (!lesson.available) continue;
    const status = progressFor(lesson.key)?.status || 'not_started';
    counts[status] += 1;
  }
  elements.curriculumSummary.innerHTML = `
    <span class="chip">${counts.completed} completed</span>
    <span class="chip">${counts.taught} taught</span>
    <span class="chip">${counts.practicing} need practice</span>
    <span class="chip">${counts.not_started} not yet taught</span>
  `;
}

function filteredCurriculum() {
  const level = elements.levelFilter.value;
  const status = elements.statusFilter.value;
  const terms = normalizeSearch(elements.lessonSearch.value).split(/\s+/).filter(Boolean);

  const searched = app.catalog.filter((lesson) => {
    if (level !== 'all' && lesson.level !== level) return false;
    const haystack = normalizeSearch(`${lesson.number} ${lesson.title} ${lesson.level} ${lesson.module || ''}`);
    return terms.every((term) => haystack.includes(term));
  });

  const displayed = searched.filter((lesson) => {
    if (status === 'all') return true;
    if (!lesson.available) return false;
    return (progressFor(lesson.key)?.status || 'not_started') === status;
  });

  return { searched, displayed, terms };
}

function setEditingEnabled(student) {
  const archived = Boolean(student?.archived_at);
  elements.notes.disabled = archived;
  elements.saveNotes.disabled = archived;
  elements.sessionForm.querySelectorAll('input, select, textarea, button[type="submit"]').forEach((control) => {
    control.disabled = archived;
  });
  elements.cancelSessionEdit.disabled = archived;
}

function renderStudentHeader() {
  const student = selectedStudent();
  elements.selectedPanel.hidden = !student;
  if (!student) return;

  const archived = Boolean(student.archived_at);
  elements.selectedName.textContent = student.display_name;
  elements.selectedState.textContent = archived ? 'Archived' : 'Active';
  elements.notes.value = student.notes || '';
  elements.archiveStudent.textContent = archived ? 'Restore student' : 'Archive student';
  elements.archiveStudent.className = archived ? 'button-secondary' : 'button-danger';
  setEditingEnabled(student);
}

function renderCurriculum() {
  const student = selectedStudent();
  renderStudentHeader();
  if (!student) return;

  const { searched, displayed, terms } = filteredCurriculum();
  renderSummary(searched);
  renderCoachSessionCommand();
  elements.lessonSearchResult.textContent = `${displayed.length} of ${searched.length} matching lessons shown`;
  elements.lessonSearchResult.hidden = false;
  elements.lessonSearchEmpty.hidden = displayed.length > 0;

  if (!displayed.length) {
    elements.curriculumList.innerHTML = '';
    return;
  }

  const groups = new Map();
  for (const lesson of displayed) {
    const key = `${lesson.level}||${lesson.module || 'Lessons'}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(lesson);
  }

  const archived = Boolean(student.archived_at);
  elements.curriculumList.innerHTML = [...groups.entries()].map(([groupKey, groupLessons]) => {
    const [level, moduleTitle] = groupKey.split('||');
    const cards = groupLessons.map((lesson) => {
      const progress = progressFor(lesson.key);
      const currentStatus = progress?.status || 'not_started';
      const options = Object.entries(STATUS_LABELS).map(([value, label]) =>
        `<option value="${value}" ${value === currentStatus ? 'selected' : ''}>${label}</option>`
      ).join('');

      return `
        <article class="list-card">
          <div class="list-card-head">
            <div>
              <h3>${escapeHtml(lesson.number)}. ${escapeHtml(lesson.title)}</h3>
              <p>${escapeHtml(level)}${moduleTitle ? ` · ${escapeHtml(moduleTitle)}` : ''}</p>
            </div>
            <span class="chip">${lesson.available ? escapeHtml(STATUS_LABELS[currentStatus]) : 'Not available yet'}</span>
          </div>
          <div class="inline-actions">
            ${lesson.available ? `
              <select data-action="set-status" data-lesson-key="${escapeHtml(lesson.key)}" aria-label="Status for ${escapeHtml(lesson.title)}" ${archived ? 'disabled' : ''}>${options}</select>
              <a class="button-secondary" href="${escapeHtml(lesson.url)}" target="_blank" rel="noopener">Open lesson</a>
              <button class="button-secondary" type="button" data-action="prefill-session" data-lesson-key="${escapeHtml(lesson.key)}" ${archived ? 'disabled' : ''}>Log session</button>
            ` : '<button class="button-secondary" type="button" disabled>Lesson page not created</button>'}
          </div>
        </article>
      `;
    }).join('');

    return `<section class="stack"><div class="section-head"><h3>${escapeHtml(level)} · ${escapeHtml(moduleTitle)}</h3></div>${cards}</section>`;
  }).join('');

  if (terms.length) elements.lessonSearchResult.textContent += ` for “${elements.lessonSearch.value.trim()}”`;
}

function resetSessionForm() {
  elements.sessionForm.reset();
  elements.sessionId.value = '';
  elements.sessionDate.value = localToday();
  elements.saveSession.textContent = 'Add session';
  elements.cancelSessionEdit.hidden = true;
}

function renderSessions() {
  const student = selectedStudent();
  if (!student) return;
  const archived = Boolean(student.archived_at);
  renderCoachSessionCommand();

  if (!app.sessions.length) {
    elements.sessionList.innerHTML = '<div class="empty">No coaching sessions recorded yet.</div>';
    return;
  }

  elements.sessionList.innerHTML = app.sessions.map((session) => {
    const lessonTitle = session.lesson_title || 'General coaching session';
    const duration = Number.isFinite(session.duration_minutes) && session.duration_minutes > 0
      ? `${session.duration_minutes} minutes`
      : '';
    return `
      <article class="list-card session-card">
        <div class="list-card-head">
          <div>
            <h3>${escapeHtml(formatSessionDate(session.session_date))}</h3>
            <p>${session.lesson_url
              ? `<a href="${escapeHtml(session.lesson_url)}" target="_blank" rel="noopener">${escapeHtml(lessonTitle)}</a>`
              : escapeHtml(lessonTitle)}${duration ? ` · ${escapeHtml(duration)}` : ''}</p>
          </div>
          <span class="chip">Session</span>
        </div>
        ${session.notes ? `<div class="session-detail"><strong>Notes</strong><p>${escapeHtml(session.notes)}</p></div>` : ''}
        ${session.homework ? `<div class="session-detail"><strong>Homework</strong><p>${escapeHtml(session.homework)}</p></div>` : ''}
        ${session.next_step ? `<div class="session-detail"><strong>Next step</strong><p>${escapeHtml(session.next_step)}</p></div>` : ''}
        ${archived ? '' : `
          <div class="inline-actions">
            <button class="button-secondary" type="button" data-action="edit-session" data-session-id="${escapeHtml(session.id)}">Edit</button>
            <button class="button-danger" type="button" data-action="delete-session" data-session-id="${escapeHtml(session.id)}">Delete</button>
          </div>
        `}
      </article>
    `;
  }).join('');
}

async function loadStudents({ preserveSelection = true } = {}) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('managed_students')
    .select('id, teacher_id, display_name, notes, archived_at, created_at')
    .eq('teacher_id', app.profile.id)
    .order('created_at', { ascending: true });
  if (error) throw error;

  app.students = data || [];
  if (!preserveSelection || !app.students.some((student) => student.id === app.selectedStudentId)) {
    const activeSessionStudent = app.students.find((student) =>
      student.id === app.coachSession?.studentId && !student.archived_at
    );
    app.selectedStudentId = activeSessionStudent?.id
      || app.students.find((student) => !student.archived_at)?.id
      || app.students[0]?.id
      || null;
  }
  renderStudents();
  await loadStudentData();
}

async function loadStudentData() {
  const student = selectedStudent();
  if (!student) {
    app.progress = [];
    app.sessions = [];
    elements.selectedPanel.hidden = true;
    return;
  }

  const supabase = getSupabase();
  const [progressResult, sessionsResult] = await Promise.all([
    supabase
      .from('managed_student_lesson_progress')
      .select('student_id, lesson_key, lesson_title, lesson_level, lesson_module, lesson_url, status, teacher_notes, taught_at, completed_at, updated_at')
      .eq('student_id', student.id),
    supabase
      .from('coaching_sessions')
      .select('id, teacher_id, student_id, session_date, duration_minutes, lesson_key, lesson_title, lesson_url, notes, homework, next_step, created_at, updated_at')
      .eq('student_id', student.id)
      .order('session_date', { ascending: false })
      .order('created_at', { ascending: false }),
  ]);
  if (progressResult.error) throw progressResult.error;
  if (sessionsResult.error) throw sessionsResult.error;

  app.progress = progressResult.data || [];
  app.sessions = sessionsResult.data || [];
  document.dispatchEvent(new CustomEvent('coach-session:request-assignment-summary', {
    detail: { studentId: student.id },
  }));
  resetSessionForm();
  if (app.coachSession?.studentId === student.id && app.coachSession.lessonKey) {
    elements.sessionLessonKey.value = app.coachSession.lessonKey;
  }
  renderCurriculum();
  renderSessions();
}

async function createStudent(event) {
  event.preventDefault();
  const button = elements.createStudentForm.querySelector('button[type="submit"]');
  setBusy(button, true, 'Adding…');
  setStatus(elements.status, '');

  try {
    const values = new FormData(elements.createStudentForm);
    const displayName = String(values.get('displayName') || '').trim();
    const notes = String(values.get('notes') || '').trim();
    if (!displayName) throw new Error('Enter the student name.');

    const supabase = getSupabase();
    const { data, error } = await supabase.from('managed_students').insert({
      teacher_id: app.profile.id,
      display_name: displayName,
      notes,
    }).select('id').single();
    if (error) throw error;

    app.selectedStudentId = data.id;
    app.assignmentSummary = null;
    app.assignmentSummaryLoaded = false;
    elements.studentViewFilter.value = 'active';
    elements.studentSearch.value = '';
    elements.createStudentForm.reset();
    await loadStudents();
    setStatus(elements.status, `Added ${displayName}.`, 'success');
  } catch (error) {
    setStatus(elements.status, readableError(error), 'error');
  } finally {
    setBusy(button, false);
  }
}

async function saveStudentNotes() {
  const student = selectedStudent();
  if (!student || student.archived_at) return;
  setBusy(elements.saveNotes, true, 'Saving…');
  try {
    const notes = elements.notes.value.trim();
    const supabase = getSupabase();
    const { error } = await supabase.from('managed_students').update({ notes }).eq('id', student.id);
    if (error) throw error;
    student.notes = notes;
    renderStudents();
    setStatus(elements.status, 'Student notes saved.', 'success');
  } catch (error) {
    setStatus(elements.status, readableError(error), 'error');
  } finally {
    setBusy(elements.saveNotes, false);
  }
}

async function toggleArchiveStudent() {
  const student = selectedStudent();
  if (!student) return;
  const restoring = Boolean(student.archived_at);
  const hasActiveSession = app.coachSession?.studentId === student.id;
  const question = restoring
    ? `Restore ${student.display_name} to the active student list?`
    : `Archive ${student.display_name}? Their lesson and session history will be preserved.${hasActiveSession ? ' The running session timer will stop.' : ''}`;
  if (!window.confirm(question)) return;

  setBusy(elements.archiveStudent, true, restoring ? 'Restoring…' : 'Archiving…');
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('managed_students')
      .update({ archived_at: restoring ? null : new Date().toISOString() })
      .eq('id', student.id);
    if (error) throw error;
    if (!restoring && hasActiveSession) clearActiveCoachSession();
    elements.studentViewFilter.value = restoring ? 'active' : 'archived';
    await loadStudents();
    setStatus(elements.status, restoring ? 'Student restored.' : 'Student archived.', 'success');
  } catch (error) {
    setStatus(elements.status, readableError(error), 'error');
  } finally {
    setBusy(elements.archiveStudent, false);
  }
}

async function setLessonStatus(select) {
  const student = selectedStudent();
  const lesson = app.catalog.find((item) => item.key === select.dataset.lessonKey);
  if (!student || student.archived_at || !lesson || !lesson.available) return;

  select.disabled = true;
  setStatus(elements.status, '');
  try {
    const status = select.value;
    const now = new Date().toISOString();
    const existing = progressFor(lesson.key);
    const row = {
      student_id: student.id,
      lesson_key: lesson.key,
      lesson_title: lesson.title,
      lesson_level: lesson.level,
      lesson_module: lesson.module || '',
      lesson_url: lesson.url,
      status,
      teacher_notes: existing?.teacher_notes || '',
      taught_at: ['taught', 'practicing', 'completed'].includes(status) ? existing?.taught_at || now : null,
      completed_at: status === 'completed' ? now : null,
    };

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('managed_student_lesson_progress')
      .upsert(row, { onConflict: 'student_id,lesson_key' })
      .select()
      .single();
    if (error) throw error;

    app.progress = app.progress.filter((item) => item.lesson_key !== lesson.key);
    app.progress.push(data);
    renderCurriculum();
    setStatus(elements.status, `${lesson.title}: ${STATUS_LABELS[status]}.`, 'success');
  } catch (error) {
    setStatus(elements.status, readableError(error), 'error');
    select.disabled = false;
  }
}

async function saveSession(event) {
  event.preventDefault();
  const student = selectedStudent();
  if (!student || student.archived_at) return;

  setBusy(elements.saveSession, true, elements.sessionId.value ? 'Saving…' : 'Adding…');
  setStatus(elements.status, '');
  try {
    const sessionId = elements.sessionId.value;
    const lesson = app.catalog.find((item) => item.key === elements.sessionLessonKey.value) || null;
    let durationValue = elements.sessionDuration.value.trim();
    if (!sessionId && !durationValue && app.coachSession?.studentId === student.id) {
      durationValue = String(elapsedCoachSessionMinutes(app.coachSession));
      elements.sessionDuration.value = durationValue;
    }
    const duration = durationValue === '' ? null : Number(durationValue);
    if (duration !== null && (!Number.isInteger(duration) || duration < 0 || duration > 600)) {
      throw new Error('Duration must be a whole number from 0 to 600 minutes.');
    }

    const notes = elements.sessionNotes.value.trim();
    const homework = elements.sessionHomework.value.trim();
    const nextStep = elements.sessionNextStep.value.trim();
    if (!lesson && !notes && !homework && !nextStep) {
      throw new Error('Link a lesson or add at least one session note, homework item, or next step.');
    }

    const row = {
      teacher_id: app.profile.id,
      student_id: student.id,
      session_date: elements.sessionDate.value || localToday(),
      duration_minutes: duration,
      lesson_key: lesson?.key || null,
      lesson_title: lesson?.title || '',
      lesson_url: lesson?.url || null,
      notes,
      homework,
      next_step: nextStep,
    };

    const supabase = getSupabase();
    const request = sessionId
      ? supabase.from('coaching_sessions').update(row).eq('id', sessionId).eq('student_id', student.id)
      : supabase.from('coaching_sessions').insert(row);
    const { data, error } = await request.select().single();
    if (error) throw error;

    app.sessions = app.sessions.filter((item) => item.id !== data.id);
    app.sessions.push(data);
    app.sessions.sort((a, b) => `${b.session_date}${b.created_at}`.localeCompare(`${a.session_date}${a.created_at}`));
    if (!sessionId && app.coachSession?.studentId === student.id) clearActiveCoachSession();
    resetSessionForm();
    renderSessions();
    setStatus(elements.status, sessionId ? 'Coaching session updated.' : 'Coaching session added.', 'success');
  } catch (error) {
    setStatus(elements.status, readableError(error), 'error');
  } finally {
    setBusy(elements.saveSession, false);
  }
}

function editSession(sessionId) {
  if (app.coachSession?.studentId === app.selectedStudentId) {
    setStatus(elements.status, 'End and log the running session before editing an earlier record.', 'warning');
    return;
  }
  const session = sessionFor(sessionId);
  if (!session) return;
  elements.sessionId.value = session.id;
  elements.sessionDate.value = session.session_date || localToday();
  elements.sessionDuration.value = session.duration_minutes ?? '';
  elements.sessionLessonKey.value = session.lesson_key || '';
  elements.sessionNotes.value = session.notes || '';
  elements.sessionHomework.value = session.homework || '';
  elements.sessionNextStep.value = session.next_step || '';
  elements.saveSession.textContent = 'Save session';
  elements.cancelSessionEdit.hidden = false;
  elements.sessionPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  elements.sessionNotes.focus({ preventScroll: true });
}

async function deleteSession(sessionId) {
  const session = sessionFor(sessionId);
  const student = selectedStudent();
  if (!session || !student || student.archived_at) return;
  if (app.coachSession?.studentId === student.id) {
    setStatus(elements.status, 'End and log the running session before deleting an earlier record.', 'warning');
    return;
  }
  if (!window.confirm(`Delete the coaching session from ${formatSessionDate(session.session_date)}?`)) return;

  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('coaching_sessions')
      .delete()
      .eq('id', session.id)
      .eq('student_id', student.id);
    if (error) throw error;
    app.sessions = app.sessions.filter((item) => item.id !== session.id);
    if (elements.sessionId.value === session.id) resetSessionForm();
    renderSessions();
    setStatus(elements.status, 'Coaching session deleted.', 'success');
  } catch (error) {
    setStatus(elements.status, readableError(error), 'error');
  }
}

function prefillSession(lessonKey) {
  const lesson = app.catalog.find((item) => item.key === lessonKey);
  if (!lesson) return;
  resetSessionForm();
  elements.sessionLessonKey.value = lesson.key;
  syncActiveCoachSessionLesson();
  elements.sessionPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  elements.sessionNotes.focus({ preventScroll: true });
}

function csvCell(value) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

function exportStudentCsv() {
  const student = selectedStudent();
  if (!student) return;

  const headers = [
    'record_type', 'student_name', 'student_state', 'date', 'duration_minutes',
    'lesson_key', 'lesson_title', 'lesson_level', 'lesson_module', 'status',
    'notes', 'homework', 'next_step', 'taught_at', 'completed_at', 'updated_at',
  ];
  const rows = [[
    'student', student.display_name, student.archived_at ? 'archived' : 'active', '', '',
    '', '', '', '', '', student.notes || '', '', '', '', '', student.created_at,
  ]];

  for (const progress of app.progress) {
    rows.push([
      'lesson_progress', student.display_name, student.archived_at ? 'archived' : 'active', '', '',
      progress.lesson_key, progress.lesson_title, progress.lesson_level, progress.lesson_module,
      STATUS_LABELS[progress.status] || progress.status, progress.teacher_notes || '', '', '',
      progress.taught_at || '', progress.completed_at || '', progress.updated_at || '',
    ]);
  }

  for (const session of app.sessions) {
    rows.push([
      'coaching_session', student.display_name, student.archived_at ? 'archived' : 'active',
      session.session_date, session.duration_minutes ?? '', session.lesson_key || '',
      session.lesson_title || '', '', '', '', session.notes || '', session.homework || '',
      session.next_step || '', '', '', session.updated_at || '',
    ]);
  }

  const csv = '\uFEFF' + [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const filename = normalizeSearch(student.display_name).replaceAll(' ', '-') || 'student';
  link.href = url;
  link.download = `${filename}-coaching-record.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setStatus(elements.status, 'Student coaching record exported.', 'success');
}

async function selectStudent(studentId) {
  app.selectedStudentId = studentId;
  app.assignmentSummary = null;
  app.assignmentSummaryLoaded = false;
  renderStudents();
  try {
    await loadStudentData();
  } catch (error) {
    setStatus(elements.status, readableError(error), 'error');
  }
}

async function handleStudentViewChange() {
  const students = visibleStudents();
  if (!students.some((student) => student.id === app.selectedStudentId)) {
    app.selectedStudentId = students[0]?.id || null;
    app.assignmentSummary = null;
    app.assignmentSummaryLoaded = false;
    await loadStudentData();
  }
  renderStudents();
}

async function initialize() {
  try {
    app.profile = await requireProfile('teacher');
    if (!app.profile) return;
    elements.profileName.textContent = app.profile.display_name;
    app.catalog = await loadLessonCatalog();
    app.coachSession = loadCoachSession(window.sessionStorage);
    populateLevelFilter();
    populateSessionLessons();
    resetSessionForm();
    await loadStudents({ preserveSelection: false });
    if (app.coachSession && !app.students.some((student) =>
      student.id === app.coachSession.studentId && !student.archived_at
    )) {
      clearActiveCoachSession();
      renderCoachSessionCommand();
    } else {
      ensureCoachSessionTimer();
    }
  } catch (error) {
    setStatus(elements.status, readableError(error), 'error');
  }
}

elements.signOut?.addEventListener('click', () => signOut().catch((error) => setStatus(elements.status, readableError(error), 'error')));
elements.createStudentForm?.addEventListener('submit', createStudent);
elements.studentSearch?.addEventListener('input', renderStudents);
elements.studentViewFilter?.addEventListener('change', () => handleStudentViewChange().catch((error) => setStatus(elements.status, readableError(error), 'error')));
elements.saveNotes?.addEventListener('click', saveStudentNotes);
elements.archiveStudent?.addEventListener('click', toggleArchiveStudent);
elements.exportStudent?.addEventListener('click', exportStudentCsv);
elements.startCoachSession?.addEventListener('click', startCoachSession);
elements.endCoachSession?.addEventListener('click', endCoachSession);
elements.sessionForm?.addEventListener('submit', saveSession);
elements.sessionLessonKey?.addEventListener('change', syncActiveCoachSessionLesson);
elements.cancelSessionEdit?.addEventListener('click', resetSessionForm);
elements.lessonSearch?.addEventListener('input', renderCurriculum);
elements.levelFilter?.addEventListener('change', renderCurriculum);
elements.statusFilter?.addEventListener('change', renderCurriculum);

elements.studentList?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action="select-student"]');
  if (button) selectStudent(button.dataset.studentId);
});

elements.curriculumList?.addEventListener('change', (event) => {
  const select = event.target.closest('[data-action="set-status"]');
  if (select) setLessonStatus(select);
});

elements.curriculumList?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action="prefill-session"]');
  if (button) prefillSession(button.dataset.lessonKey);
});

elements.sessionList?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  if (button.dataset.action === 'edit-session') editSession(button.dataset.sessionId);
  if (button.dataset.action === 'delete-session') deleteSession(button.dataset.sessionId);
});

document.addEventListener('coach-session:assignment-summary', (event) => {
  const detail = event.detail;
  if (!detail || typeof detail.studentId !== 'string') return;
  if (detail.studentId !== app.selectedStudentId) return;
  app.assignmentSummary = detail;
  app.assignmentSummaryLoaded = true;
  renderCoachSessionCommand();
});

initialize();
