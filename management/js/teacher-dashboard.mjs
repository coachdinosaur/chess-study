import { getSupabase, readableError, requireProfile, signOut } from './supabase-client.mjs';
import {
  escapeHtml,
  formatDate,
  normalizeSiteUrl,
  setBusy,
  setStatus,
} from './ui.mjs';

const elements = {
  profileName: document.querySelector('#profileName'),
  signOut: document.querySelector('#signOutButton'),
  dashboardStatus: document.querySelector('#dashboardStatus'),
  createClassForm: document.querySelector('#createClassForm'),
  classList: document.querySelector('#classList'),
  selectedClassPanel: document.querySelector('#selectedClassPanel'),
  selectedClassName: document.querySelector('#selectedClassName'),
  selectedClassCode: document.querySelector('#selectedClassCode'),
  copyCode: document.querySelector('#copyCodeButton'),
  rotateCode: document.querySelector('#rotateCodeButton'),
  memberList: document.querySelector('#memberList'),
  assignmentForm: document.querySelector('#assignmentForm'),
  assignmentList: document.querySelector('#assignmentList'),
};

const app = {
  profile: null,
  classes: [],
  selectedClassId: null,
  members: [],
  assignments: [],
  progress: [],
};

function selectedClass() {
  return app.classes.find((item) => item.id === app.selectedClassId) || null;
}

function renderClassList() {
  if (!app.classes.length) {
    elements.classList.innerHTML = '<div class="empty">No classes yet. Create the first class to generate a student join code.</div>';
    return;
  }

  elements.classList.innerHTML = app.classes.map((item) => `
    <button class="list-card" type="button" data-action="select-class" data-class-id="${escapeHtml(item.id)}" data-active="${item.id === app.selectedClassId}">
      <div class="list-card-head">
        <strong>${escapeHtml(item.name)}</strong>
        <span class="code">${escapeHtml(item.join_code)}</span>
      </div>
      <p>${item.archived_at ? 'Archived' : 'Active class'}</p>
    </button>
  `).join('');
}

function renderMembers() {
  if (!app.members.length) {
    elements.memberList.innerHTML = '<div class="empty">No students have requested to join this class.</div>';
    return;
  }

  elements.memberList.innerHTML = app.members.map((member) => {
    const name = member.student?.display_name || 'Student';
    const actions = member.status === 'pending'
      ? `<button class="button" type="button" data-action="approve-member" data-student-id="${escapeHtml(member.student_id)}">Approve</button>
         <button class="button-danger" type="button" data-action="remove-member" data-student-id="${escapeHtml(member.student_id)}">Reject</button>`
      : member.status === 'active'
        ? `<button class="button-danger" type="button" data-action="remove-member" data-student-id="${escapeHtml(member.student_id)}">Remove</button>`
        : '';

    return `
      <article class="list-card">
        <div class="list-card-head">
          <div>
            <h3>${escapeHtml(name)}</h3>
            <p>Requested ${escapeHtml(formatDate(member.joined_at, 'recently'))}</p>
          </div>
          <span class="chip">${escapeHtml(member.status)}</span>
        </div>
        ${actions ? `<div class="inline-actions">${actions}</div>` : ''}
      </article>
    `;
  }).join('');
}

function renderAssignments() {
  if (!app.assignments.length) {
    elements.assignmentList.innerHTML = '<div class="empty">No assignments have been published for this class.</div>';
    return;
  }

  const activeStudents = app.members.filter((member) => member.status === 'active').length;
  const progressByAssignment = new Map();
  for (const row of app.progress) {
    const rows = progressByAssignment.get(row.assignment_id) || [];
    rows.push(row);
    progressByAssignment.set(row.assignment_id, rows);
  }

  elements.assignmentList.innerHTML = app.assignments.map((assignment) => {
    const rows = progressByAssignment.get(assignment.id) || [];
    const started = rows.filter((row) => row.status === 'started').length;
    const completed = rows.filter((row) => row.status === 'completed').length;

    return `
      <article class="list-card">
        <div class="list-card-head">
          <div>
            <h3>${escapeHtml(assignment.title)}</h3>
            <p>${escapeHtml(assignment.resource_title)}</p>
          </div>
          <span class="chip">Due ${escapeHtml(formatDate(assignment.due_at))}</span>
        </div>
        ${assignment.instructions ? `<p>${escapeHtml(assignment.instructions)}</p>` : ''}
        <div class="meta">
          <span class="chip">${completed}/${activeStudents} completed</span>
          <span class="chip">${started} started</span>
          <span class="chip">${escapeHtml(assignment.resource_type.replaceAll('_', ' '))}</span>
        </div>
        <div class="inline-actions">
          ${assignment.resource_url ? `<a class="button-secondary" href="${escapeHtml(assignment.resource_url)}" target="_blank" rel="noopener">Open lesson</a>` : ''}
          <button class="button-danger" type="button" data-action="delete-assignment" data-assignment-id="${escapeHtml(assignment.id)}">Delete</button>
        </div>
      </article>
    `;
  }).join('');
}

function renderSelectedClass() {
  const current = selectedClass();
  elements.selectedClassPanel.hidden = !current;
  if (!current) return;

  elements.selectedClassName.textContent = current.name;
  elements.selectedClassCode.textContent = current.join_code;
  renderMembers();
  renderAssignments();
}

async function loadClasses({ preserveSelection = true } = {}) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('classes')
    .select('id, teacher_id, name, join_code, archived_at, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;

  app.classes = data || [];
  if (!preserveSelection || !app.classes.some((item) => item.id === app.selectedClassId)) {
    app.selectedClassId = app.classes[0]?.id || null;
  }
  renderClassList();

  if (app.selectedClassId) await loadSelectedClassData();
  else renderSelectedClass();
}

async function loadSelectedClassData() {
  const supabase = getSupabase();
  const classId = app.selectedClassId;
  if (!classId) return;

  const [membersResult, assignmentsResult] = await Promise.all([
    supabase
      .from('class_members')
      .select('student_id, status, joined_at, approved_at, student:profiles!class_members_student_id_fkey(display_name)')
      .eq('class_id', classId)
      .order('joined_at', { ascending: true }),
    supabase
      .from('assignments')
      .select('id, class_id, title, instructions, resource_type, resource_title, resource_url, due_at, published_at')
      .eq('class_id', classId)
      .order('published_at', { ascending: false }),
  ]);

  if (membersResult.error) throw membersResult.error;
  if (assignmentsResult.error) throw assignmentsResult.error;

  app.members = membersResult.data || [];
  app.assignments = assignmentsResult.data || [];

  const assignmentIds = app.assignments.map((item) => item.id);
  if (assignmentIds.length) {
    const { data, error } = await supabase
      .from('assignment_progress')
      .select('assignment_id, student_id, status, updated_at')
      .in('assignment_id', assignmentIds);
    if (error) throw error;
    app.progress = data || [];
  } else {
    app.progress = [];
  }

  renderSelectedClass();
}

async function handleCreateClass(event) {
  event.preventDefault();
  const button = elements.createClassForm.querySelector('button[type="submit"]');
  setBusy(button, true, 'Creating…');
  setStatus(elements.dashboardStatus, '');

  try {
    const form = new FormData(elements.createClassForm);
    const name = String(form.get('className') || '').trim();
    if (!name) throw new Error('Enter a class name.');

    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('create_class_with_code', { p_name: name });
    if (error) throw error;

    app.selectedClassId = data?.id || null;
    elements.createClassForm.reset();
    await loadClasses();
    setStatus(elements.dashboardStatus, `Created ${name}.`, 'success');
  } catch (error) {
    setStatus(elements.dashboardStatus, readableError(error), 'error');
  } finally {
    setBusy(button, false);
  }
}

async function handleMemberAction(action, studentId, button) {
  setBusy(button, true, action === 'approve-member' ? 'Approving…' : 'Removing…');
  try {
    const supabase = getSupabase();
    const functionName = action === 'approve-member' ? 'approve_class_member' : 'remove_class_member';
    const { error } = await supabase.rpc(functionName, {
      p_class_id: app.selectedClassId,
      p_student_id: studentId,
    });
    if (error) throw error;
    await loadSelectedClassData();
  } catch (error) {
    setStatus(elements.dashboardStatus, readableError(error), 'error');
    setBusy(button, false);
  }
}

async function handleCreateAssignment(event) {
  event.preventDefault();
  const button = elements.assignmentForm.querySelector('button[type="submit"]');
  setBusy(button, true, 'Publishing…');
  setStatus(elements.dashboardStatus, '');

  try {
    if (!app.selectedClassId) throw new Error('Create or select a class first.');
    const values = new FormData(elements.assignmentForm);
    const title = String(values.get('title') || '').trim();
    const resourceTitle = String(values.get('resourceTitle') || '').trim();
    const resourceUrl = normalizeSiteUrl(values.get('resourceUrl'));
    const instructions = String(values.get('instructions') || '').trim();
    const dueValue = String(values.get('dueAt') || '').trim();

    if (!title || !resourceTitle || !resourceUrl) {
      throw new Error('Assignment title, lesson title, and lesson link are required.');
    }

    const supabase = getSupabase();
    const { error } = await supabase.from('assignments').insert({
      class_id: app.selectedClassId,
      created_by: app.profile.id,
      title,
      instructions,
      resource_type: 'static_lesson',
      resource_title: resourceTitle,
      resource_url: resourceUrl,
      due_at: dueValue ? new Date(dueValue).toISOString() : null,
    });
    if (error) throw error;

    elements.assignmentForm.reset();
    await loadSelectedClassData();
    setStatus(elements.dashboardStatus, `Published ${title}.`, 'success');
  } catch (error) {
    setStatus(elements.dashboardStatus, readableError(error), 'error');
  } finally {
    setBusy(button, false);
  }
}

async function handleDeleteAssignment(assignmentId, button) {
  if (!window.confirm('Delete this assignment and its progress records?')) return;
  setBusy(button, true, 'Deleting…');
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('assignments').delete().eq('id', assignmentId);
    if (error) throw error;
    await loadSelectedClassData();
  } catch (error) {
    setStatus(elements.dashboardStatus, readableError(error), 'error');
    setBusy(button, false);
  }
}

async function initialize() {
  try {
    app.profile = await requireProfile('teacher');
    if (!app.profile) return;
    elements.profileName.textContent = app.profile.display_name;
    await loadClasses({ preserveSelection: false });
  } catch (error) {
    setStatus(elements.dashboardStatus, readableError(error), 'error');
  }
}

elements.signOut?.addEventListener('click', () => signOut().catch((error) => {
  setStatus(elements.dashboardStatus, readableError(error), 'error');
}));

elements.createClassForm?.addEventListener('submit', handleCreateClass);
elements.assignmentForm?.addEventListener('submit', handleCreateAssignment);

elements.classList?.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action="select-class"]');
  if (!button) return;
  app.selectedClassId = button.dataset.classId;
  renderClassList();
  try {
    await loadSelectedClassData();
  } catch (error) {
    setStatus(elements.dashboardStatus, readableError(error), 'error');
  }
});

elements.memberList?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  if (!['approve-member', 'remove-member'].includes(button.dataset.action)) return;
  handleMemberAction(button.dataset.action, button.dataset.studentId, button);
});

elements.assignmentList?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action="delete-assignment"]');
  if (button) handleDeleteAssignment(button.dataset.assignmentId, button);
});

elements.copyCode?.addEventListener('click', async () => {
  const current = selectedClass();
  if (!current) return;
  await navigator.clipboard.writeText(current.join_code);
  setStatus(elements.dashboardStatus, 'Class code copied.', 'success');
});

elements.rotateCode?.addEventListener('click', async () => {
  const current = selectedClass();
  if (!current || !window.confirm('Generate a new class code? The previous code will stop working.')) return;
  setBusy(elements.rotateCode, true, 'Rotating…');
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('rotate_class_join_code', { p_class_id: current.id });
    if (error) throw error;
    current.join_code = data;
    renderClassList();
    renderSelectedClass();
  } catch (error) {
    setStatus(elements.dashboardStatus, readableError(error), 'error');
  } finally {
    setBusy(elements.rotateCode, false);
  }
});

initialize();
