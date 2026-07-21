import { getSupabase, readableError, requireProfile, signOut } from './supabase-client.mjs';
import { escapeHtml, formatDate, setBusy, setStatus } from './ui.mjs';

const elements = {
  profileName: document.querySelector('#profileName'),
  signOut: document.querySelector('#signOutButton'),
  status: document.querySelector('#studentStatus'),
  membershipList: document.querySelector('#membershipList'),
  assignmentList: document.querySelector('#assignmentList'),
};

const app = {
  profile: null,
  memberships: [],
  assignments: [],
  progress: [],
  feedback: [],
};

function progressFor(assignmentId) {
  return app.progress.find((row) => row.assignment_id === assignmentId) || null;
}

function feedbackFor(assignmentId) {
  return app.feedback.find((row) => row.assignment_id === assignmentId) || null;
}

function renderMemberships() {
  if (!app.memberships.length) {
    elements.membershipList.innerHTML = `
      <div class="empty">
        This browser has not joined a class.
        <div class="inline-actions"><a class="button" href="./join.html">Join with class code</a></div>
      </div>`;
    return;
  }

  elements.membershipList.innerHTML = app.memberships.map((membership) => `
    <article class="list-card">
      <div class="list-card-head">
        <div>
          <h3>${escapeHtml(membership.class?.name || 'Chess class')}</h3>
          <p>${membership.status === 'pending' ? 'Waiting for teacher approval.' : membership.status === 'active' ? 'Enrollment active.' : 'Enrollment removed.'}</p>
        </div>
        <span class="chip">${escapeHtml(membership.status)}</span>
      </div>
    </article>
  `).join('');
}

function renderAssignments() {
  const activeMemberships = app.memberships.filter((item) => item.status === 'active');
  if (!activeMemberships.length) {
    elements.assignmentList.innerHTML = '<div class="empty">Assignments appear after the teacher approves the class membership.</div>';
    return;
  }

  if (!app.assignments.length) {
    elements.assignmentList.innerHTML = '<div class="empty">No assignments have been published yet.</div>';
    return;
  }

  const classNames = new Map(activeMemberships.map((item) => [item.class_id, item.class?.name || 'Chess class']));

  elements.assignmentList.innerHTML = app.assignments.map((assignment) => {
    const progress = progressFor(assignment.id);
    const status = progress?.status || 'not_started';
    const feedback = feedbackFor(assignment.id);

    return `
      <article class="list-card">
        <div class="list-card-head">
          <div>
            <h3>${escapeHtml(assignment.title)}</h3>
            <p>${escapeHtml(assignment.resource_title)}</p>
          </div>
          <span class="chip">${escapeHtml(status.replaceAll('_', ' '))}</span>
        </div>
        <div class="meta">
          <span class="chip">${escapeHtml(classNames.get(assignment.class_id) || 'Chess class')}</span>
          <span class="chip">Due ${escapeHtml(formatDate(assignment.due_at))}</span>
        </div>
        ${assignment.instructions ? `<p>${escapeHtml(assignment.instructions)}</p>` : ''}
        ${feedback ? `<div class="status" data-tone="success"><strong>Teacher feedback:</strong> ${escapeHtml(feedback.feedback)}</div>` : ''}
        <div class="inline-actions">
          ${assignment.resource_url ? `<button class="button-secondary" type="button" data-action="open-assignment" data-assignment-id="${escapeHtml(assignment.id)}" data-url="${escapeHtml(assignment.resource_url)}">Open lesson</button>` : ''}
          <button class="button" type="button" data-action="complete-assignment" data-assignment-id="${escapeHtml(assignment.id)}" ${status === 'completed' ? 'disabled' : ''}>${status === 'completed' ? 'Completed' : 'Mark complete'}</button>
        </div>
      </article>
    `;
  }).join('');
}

async function loadDashboard() {
  const supabase = getSupabase();
  const { data: memberships, error: membershipError } = await supabase
    .from('class_members')
    .select('class_id, status, joined_at, approved_at, class:classes!class_members_class_id_fkey(id, name)')
    .eq('student_id', app.profile.id)
    .order('joined_at', { ascending: false });
  if (membershipError) throw membershipError;

  app.memberships = memberships || [];
  const activeClassIds = app.memberships
    .filter((item) => item.status === 'active')
    .map((item) => item.class_id);

  if (!activeClassIds.length) {
    app.assignments = [];
    app.progress = [];
    app.feedback = [];
    renderMemberships();
    renderAssignments();
    return;
  }

  const { data: assignments, error: assignmentError } = await supabase
    .from('assignments')
    .select('id, class_id, title, instructions, resource_type, resource_title, resource_url, due_at, published_at')
    .in('class_id', activeClassIds)
    .order('published_at', { ascending: false });
  if (assignmentError) throw assignmentError;

  app.assignments = assignments || [];
  const assignmentIds = app.assignments.map((item) => item.id);

  if (assignmentIds.length) {
    const [progressResult, feedbackResult] = await Promise.all([
      supabase
        .from('assignment_progress')
        .select('assignment_id, student_id, status, last_opened_at, completed_at, updated_at')
        .eq('student_id', app.profile.id)
        .in('assignment_id', assignmentIds),
      supabase
        .from('teacher_feedback')
        .select('assignment_id, feedback, updated_at')
        .eq('student_id', app.profile.id)
        .in('assignment_id', assignmentIds),
    ]);
    if (progressResult.error) throw progressResult.error;
    if (feedbackResult.error) throw feedbackResult.error;
    app.progress = progressResult.data || [];
    app.feedback = feedbackResult.data || [];
  } else {
    app.progress = [];
    app.feedback = [];
  }

  renderMemberships();
  renderAssignments();
}

async function saveProgress(assignmentId, status) {
  const existing = progressFor(assignmentId);
  if (existing?.status === 'completed' && status === 'started') return existing;

  const now = new Date().toISOString();
  const row = {
    assignment_id: assignmentId,
    student_id: app.profile.id,
    status,
    last_opened_at: status === 'started' ? now : existing?.last_opened_at || now,
    completed_at: status === 'completed' ? now : null,
  };

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('assignment_progress')
    .upsert(row, { onConflict: 'assignment_id,student_id' })
    .select('assignment_id, student_id, status, last_opened_at, completed_at, updated_at')
    .single();
  if (error) throw error;

  app.progress = app.progress.filter((item) => item.assignment_id !== assignmentId);
  app.progress.push(data);
  return data;
}

async function initialize() {
  try {
    app.profile = await requireProfile('student');
    if (!app.profile) return;
    elements.profileName.textContent = app.profile.display_name;
    await loadDashboard();
  } catch (error) {
    setStatus(elements.status, readableError(error), 'error');
  }
}

elements.assignmentList?.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;

  const assignmentId = button.dataset.assignmentId;
  const action = button.dataset.action;
  setBusy(button, true, action === 'open-assignment' ? 'Opening…' : 'Saving…');
  setStatus(elements.status, '');

  try {
    if (action === 'open-assignment') {
      await saveProgress(assignmentId, 'started');
      window.location.href = button.dataset.url;
      return;
    }

    if (action === 'complete-assignment') {
      await saveProgress(assignmentId, 'completed');
      renderAssignments();
      setStatus(elements.status, 'Assignment marked complete.', 'success');
    }
  } catch (error) {
    setStatus(elements.status, readableError(error), 'error');
    setBusy(button, false);
  }
});

elements.signOut?.addEventListener('click', () => {
  const confirmed = window.confirm('This V1 student account belongs to this browser. Signing out may make it impossible to recover without a linked email. Continue?');
  if (!confirmed) return;
  signOut().catch((error) => setStatus(elements.status, readableError(error), 'error'));
});

initialize();
