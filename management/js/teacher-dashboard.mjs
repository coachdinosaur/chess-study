import { getSupabase, readableError, requireProfile, signOut } from './supabase-client.mjs';
import { loadLessonCatalog } from './lesson-catalog.mjs';
import { escapeHtml, formatDate, setBusy, setStatus } from './ui.mjs';

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
  studentList: document.querySelector('#studentList'),
  selectedPanel: document.querySelector('#selectedStudentPanel'),
  selectedName: document.querySelector('#selectedStudentName'),
  notes: document.querySelector('#studentDetailNotes'),
  saveNotes: document.querySelector('#saveStudentNotesButton'),
  archiveStudent: document.querySelector('#archiveStudentButton'),
  levelFilter: document.querySelector('#levelFilter'),
  curriculumSummary: document.querySelector('#curriculumSummary'),
  curriculumList: document.querySelector('#curriculumList'),
};

const app = {
  profile: null,
  students: [],
  selectedStudentId: null,
  catalog: [],
  progress: [],
};

function selectedStudent() {
  return app.students.find((student) => student.id === app.selectedStudentId) || null;
}

function progressFor(lessonKey) {
  return app.progress.find((row) => row.lesson_key === lessonKey) || null;
}

function renderStudents() {
  if (!app.students.length) {
    elements.studentList.innerHTML = '<div class="empty">No students yet. Add one student or several students above.</div>';
    return;
  }

  elements.studentList.innerHTML = app.students.map((student) => `
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

function renderSummary(visibleLessons) {
  const counts = Object.fromEntries(Object.keys(STATUS_LABELS).map((status) => [status, 0]));
  for (const lesson of visibleLessons) {
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

function renderCurriculum() {
  const student = selectedStudent();
  elements.selectedPanel.hidden = !student;
  if (!student) return;

  elements.selectedName.textContent = student.display_name;
  elements.notes.value = student.notes || '';

  const filter = elements.levelFilter.value;
  const lessons = app.catalog.filter((lesson) => filter === 'all' || lesson.level === filter);
  renderSummary(lessons);

  if (!lessons.length) {
    elements.curriculumList.innerHTML = '<div class="empty">No curriculum entries found for this level.</div>';
    return;
  }

  const groups = new Map();
  for (const lesson of lessons) {
    const key = `${lesson.level}||${lesson.module || 'Lessons'}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(lesson);
  }

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
              <select data-action="set-status" data-lesson-key="${escapeHtml(lesson.key)}" aria-label="Status for ${escapeHtml(lesson.title)}">${options}</select>
              <a class="button-secondary" href="${escapeHtml(lesson.url)}" target="_blank" rel="noopener">Open lesson</a>
            ` : '<button class="button-secondary" type="button" disabled>Lesson page not created</button>'}
          </div>
        </article>
      `;
    }).join('');

    return `<section class="stack"><div class="section-head"><h3>${escapeHtml(level)} · ${escapeHtml(moduleTitle)}</h3></div>${cards}</section>`;
  }).join('');
}

async function loadStudents({ preserveSelection = true } = {}) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('managed_students')
    .select('id, teacher_id, display_name, notes, archived_at, created_at')
    .eq('teacher_id', app.profile.id)
    .is('archived_at', null)
    .order('created_at', { ascending: true });
  if (error) throw error;

  app.students = data || [];
  if (!preserveSelection || !app.students.some((student) => student.id === app.selectedStudentId)) {
    app.selectedStudentId = app.students[0]?.id || null;
  }
  renderStudents();
  await loadProgress();
}

async function loadProgress() {
  const student = selectedStudent();
  if (!student) {
    app.progress = [];
    renderCurriculum();
    return;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('managed_student_lesson_progress')
    .select('student_id, lesson_key, lesson_title, lesson_level, lesson_module, lesson_url, status, teacher_notes, taught_at, completed_at, updated_at')
    .eq('student_id', student.id);
  if (error) throw error;
  app.progress = data || [];
  renderCurriculum();
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
  if (!student) return;
  setBusy(elements.saveNotes, true, 'Saving…');
  try {
    const notes = elements.notes.value.trim();
    const supabase = getSupabase();
    const { error } = await supabase.from('managed_students').update({ notes }).eq('id', student.id);
    if (error) throw error;
    student.notes = notes;
    setStatus(elements.status, 'Student notes saved.', 'success');
  } catch (error) {
    setStatus(elements.status, readableError(error), 'error');
  } finally {
    setBusy(elements.saveNotes, false);
  }
}

async function archiveStudent() {
  const student = selectedStudent();
  if (!student || !window.confirm(`Archive ${student.display_name}? Their lesson history will be preserved.`)) return;
  setBusy(elements.archiveStudent, true, 'Archiving…');
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('managed_students').update({ archived_at: new Date().toISOString() }).eq('id', student.id);
    if (error) throw error;
    app.selectedStudentId = null;
    await loadStudents({ preserveSelection: false });
    setStatus(elements.status, 'Student archived.', 'success');
  } catch (error) {
    setStatus(elements.status, readableError(error), 'error');
  } finally {
    setBusy(elements.archiveStudent, false);
  }
}

async function setLessonStatus(select) {
  const student = selectedStudent();
  const lesson = app.catalog.find((item) => item.key === select.dataset.lessonKey);
  if (!student || !lesson || !lesson.available) return;

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

async function initialize() {
  try {
    app.profile = await requireProfile('teacher');
    if (!app.profile) return;
    elements.profileName.textContent = app.profile.display_name;
    app.catalog = await loadLessonCatalog();
    populateLevelFilter();
    await loadStudents({ preserveSelection: false });
  } catch (error) {
    setStatus(elements.status, readableError(error), 'error');
  }
}

elements.signOut?.addEventListener('click', () => signOut().catch((error) => setStatus(elements.status, readableError(error), 'error')));
elements.createStudentForm?.addEventListener('submit', createStudent);
elements.saveNotes?.addEventListener('click', saveStudentNotes);
elements.archiveStudent?.addEventListener('click', archiveStudent);
elements.levelFilter?.addEventListener('change', renderCurriculum);

elements.studentList?.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action="select-student"]');
  if (!button) return;
  app.selectedStudentId = button.dataset.studentId;
  renderStudents();
  try {
    await loadProgress();
  } catch (error) {
    setStatus(elements.status, readableError(error), 'error');
  }
});

elements.curriculumList?.addEventListener('change', (event) => {
  const select = event.target.closest('[data-action="set-status"]');
  if (select) setLessonStatus(select);
});

initialize();
