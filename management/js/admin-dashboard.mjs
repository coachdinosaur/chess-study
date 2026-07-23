import { getSupabase, readableError, requireProfile, signOut } from './supabase-client.mjs';
import { escapeHtml, setBusy, setStatus } from './ui.mjs';

const elements = {
  profileName: document.querySelector('#profileName'),
  status: document.querySelector('#adminStatus'),
  search: document.querySelector('#teacherSearch'),
  teacherList: document.querySelector('#teacherAccountList'),
  auditList: document.querySelector('#auditList'),
  refresh: document.querySelector('#refreshAdminButton'),
  signOut: document.querySelector('#signOutButton'),
};

let teachers = [];
let auditRows = [];

function formatDate(value) {
  if (!value) return 'Not reviewed';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function renderTeachers() {
  const query = elements.search.value.trim().toLowerCase();
  const visible = teachers.filter((teacher) => `${teacher.display_name} ${teacher.email}`.toLowerCase().includes(query));
  if (!visible.length) {
    elements.teacherList.innerHTML = '<div class="empty">No teacher accounts match this search.</div>';
    return;
  }

  elements.teacherList.innerHTML = visible.map((teacher) => {
    const isProtectedAdmin = teacher.is_admin;
    const status = teacher.account_status || 'pending';
    return `
      <article class="list-card teacher-admin-card" data-teacher-id="${escapeHtml(teacher.teacher_id)}">
        <div class="list-card-head">
          <div>
            <h3>${escapeHtml(teacher.display_name)}</h3>
            <p>${escapeHtml(teacher.email || 'No email')}</p>
          </div>
          <div class="heading-with-chip">
            ${isProtectedAdmin ? '<span class="chip">Administrator</span>' : ''}
            <span class="chip account-status-${escapeHtml(status)}">${escapeHtml(status)}</span>
          </div>
        </div>
        <div class="meta">
          <span class="chip">${teacher.active_students} active students</span>
          <span class="chip">${teacher.archived_students} archived</span>
          <span class="chip">${teacher.coaching_session_count} sessions</span>
          <span class="chip">Created ${escapeHtml(formatDate(teacher.created_at))}</span>
        </div>
        ${teacher.suspension_reason ? `<div class="status" data-tone="warning">${escapeHtml(teacher.suspension_reason)}</div>` : ''}
        <div class="form-row admin-reason-row">
          <label>Review or suspension note</label>
          <input data-field="reason" maxlength="1000" value="${escapeHtml(teacher.suspension_reason || '')}" placeholder="Required when suspending">
        </div>
        <div class="inline-actions">
          <button class="button" type="button" data-action="approve" ${isProtectedAdmin ? 'disabled' : ''}>Approve</button>
          <button class="button-secondary" type="button" data-action="pending" ${isProtectedAdmin ? 'disabled' : ''}>Return to pending</button>
          <button class="button-danger" type="button" data-action="suspend" ${isProtectedAdmin ? 'disabled' : ''}>Suspend</button>
        </div>
      </article>`;
  }).join('');
}

function renderAudit() {
  if (!auditRows.length) {
    elements.auditList.innerHTML = '<div class="empty">No management events have been recorded yet.</div>';
    return;
  }

  elements.auditList.innerHTML = auditRows.map((row) => `
    <article class="list-card audit-card">
      <div class="list-card-head">
        <div>
          <h3>${escapeHtml(row.event_type)}</h3>
          <p>${escapeHtml(formatDate(row.created_at))}</p>
        </div>
        <span class="chip">${escapeHtml(row.target_type)}</span>
      </div>
      <p>Actor: ${escapeHtml(row.actor_display_name || 'System or deleted account')}</p>
      <p>Teacher: ${escapeHtml(row.teacher_display_name || 'Deleted or unavailable')}</p>
      ${row.metadata && Object.keys(row.metadata).length
        ? `<pre class="audit-metadata">${escapeHtml(JSON.stringify(row.metadata, null, 2))}</pre>`
        : ''}
    </article>`).join('');
}

async function loadAdminData() {
  setBusy(elements.refresh, true, 'Refreshing…');
  setStatus(elements.status, '');
  try {
    const supabase = getSupabase();
    const [teachersResult, auditResult] = await Promise.all([
      supabase.rpc('admin_list_teachers'),
      supabase.rpc('admin_list_audit_log', { p_limit: 100 }),
    ]);
    if (teachersResult.error) throw teachersResult.error;
    if (auditResult.error) throw auditResult.error;
    teachers = teachersResult.data || [];
    auditRows = auditResult.data || [];
    renderTeachers();
    renderAudit();
  } catch (error) {
    setStatus(elements.status, readableError(error), 'error');
  } finally {
    setBusy(elements.refresh, false);
  }
}

async function updateTeacherStatus(card, status) {
  const reason = card.querySelector('[data-field="reason"]')?.value.trim() || '';
  if (status === 'suspended' && !reason) {
    setStatus(elements.status, 'Enter a suspension reason before suspending the account.', 'error');
    return;
  }

  const actionName = status === 'approved' ? 'approve' : status === 'pending' ? 'pending' : 'suspend';
  const button = card.querySelector(`[data-action="${actionName}"]`);
  setBusy(button, true, 'Saving…');
  setStatus(elements.status, '');
  try {
    const supabase = getSupabase();
    const { error } = await supabase.rpc('admin_set_teacher_status', {
      p_teacher_id: card.dataset.teacherId,
      p_status: status,
      p_reason: reason,
    });
    if (error) throw error;
    await loadAdminData();
    setStatus(elements.status, `Teacher account set to ${status}.`, 'success');
  } catch (error) {
    setStatus(elements.status, readableError(error), 'error');
    setBusy(button, false);
  }
}

async function initialize() {
  try {
    const profile = await requireProfile('teacher', { requireAdmin: true });
    if (!profile) return;
    elements.profileName.textContent = profile.display_name;
    await loadAdminData();
  } catch (error) {
    setStatus(elements.status, readableError(error), 'error');
  }
}

elements.search?.addEventListener('input', renderTeachers);
elements.refresh?.addEventListener('click', loadAdminData);
elements.signOut?.addEventListener('click', () => signOut().catch((error) => setStatus(elements.status, readableError(error), 'error')));
elements.teacherList?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  const card = event.target.closest('[data-teacher-id]');
  if (!button || !card) return;
  if (button.dataset.action === 'approve') updateTeacherStatus(card, 'approved');
  if (button.dataset.action === 'pending') updateTeacherStatus(card, 'pending');
  if (button.dataset.action === 'suspend') updateTeacherStatus(card, 'suspended');
});

initialize();
