import { getSupabase, readableError, requireProfile, signOut } from './supabase-client.mjs';
import { escapeHtml, setBusy, setStatus } from './ui.mjs';
import {
  AUDIT_PAGE_SIZE,
  buildAuditPageParams,
  mergeAuditPage,
} from './admin-audit-pagination.mjs';

const elements = {
  profileName: document.querySelector('#profileName'),
  status: document.querySelector('#adminStatus'),
  search: document.querySelector('#teacherSearch'),
  teacherList: document.querySelector('#teacherAccountList'),
  auditList: document.querySelector('#auditList'),
  auditPaginationStatus: document.querySelector('#auditPaginationStatus'),
  loadMoreAudit: document.querySelector('#loadMoreAuditButton'),
  refresh: document.querySelector('#refreshAdminButton'),
  signOut: document.querySelector('#signOutButton'),
  deleteDialog: document.querySelector('#teacherDeleteDialog'),
  deleteForm: document.querySelector('#teacherDeleteForm'),
  deleteName: document.querySelector('#teacherDeleteName'),
  deleteEmail: document.querySelector('#teacherDeleteEmail'),
  deleteConfirmation: document.querySelector('#teacherDeleteConfirmation'),
  deleteError: document.querySelector('#teacherDeleteError'),
  cancelDelete: document.querySelector('#cancelTeacherDeleteButton'),
  confirmDelete: document.querySelector('#confirmTeacherDeleteButton'),
};

let teachers = [];
let auditRows = [];
let auditCursor = null;
let auditHasMore = false;
let auditLoading = false;
let selectedTeacher = null;
let deletionPending = false;

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
    const adminAction = isProtectedAdmin
      ? '<button class="button-secondary" type="button" data-action="remove-admin">Remove administrator</button>'
      : `<button class="button-secondary" type="button" data-action="grant-admin" ${status !== 'approved' ? 'disabled' : ''}>Grant administrator</button>`;
    const deleteAction = isProtectedAdmin
      ? '<button class="button-danger" type="button" disabled title="Remove administrator access before deleting this account.">Delete account</button>'
      : '<button class="button-danger" type="button" data-action="delete-teacher">Delete account</button>';
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
          ${adminAction}
          ${deleteAction}
        </div>
      </article>`;
  }).join('');
}

function renderAuditPagination() {
  if (!auditRows.length) {
    elements.auditPaginationStatus.textContent = '';
  } else if (auditHasMore) {
    elements.auditPaginationStatus.textContent = `Showing ${auditRows.length} events, newest first.`;
  } else {
    elements.auditPaginationStatus.textContent = `Showing all ${auditRows.length} recorded event${auditRows.length === 1 ? '' : 's'}, newest first.`;
  }

  elements.loadMoreAudit.hidden = !auditHasMore;
  elements.loadMoreAudit.disabled = auditLoading;
}

function renderAudit() {
  if (!auditRows.length) {
    elements.auditList.innerHTML = '<div class="empty">No management events have been recorded yet.</div>';
    renderAuditPagination();
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
  renderAuditPagination();
}

async function loadAdminData() {
  setBusy(elements.refresh, true, 'Refreshing…');
  setStatus(elements.status, '');
  try {
    const supabase = getSupabase();
    const [teachersResult, auditResult] = await Promise.all([
      supabase.rpc('admin_list_teachers'),
      supabase.rpc('admin_list_audit_log', buildAuditPageParams()),
    ]);
    if (teachersResult.error) throw teachersResult.error;
    if (auditResult.error) throw auditResult.error;
    teachers = teachersResult.data || [];
    const auditPage = mergeAuditPage([], auditResult.data, AUDIT_PAGE_SIZE);
    auditRows = auditPage.rows;
    auditCursor = auditPage.cursor;
    auditHasMore = auditPage.hasMore;
    renderTeachers();
    renderAudit();
  } catch (error) {
    setStatus(elements.status, readableError(error), 'error');
  } finally {
    setBusy(elements.refresh, false);
  }
}

async function loadMoreAuditEvents() {
  if (auditLoading || !auditHasMore || !auditCursor) return;

  auditLoading = true;
  setBusy(elements.loadMoreAudit, true, 'Loading…');
  setStatus(elements.status, '');
  renderAuditPagination();

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc(
      'admin_list_audit_log',
      buildAuditPageParams(auditCursor),
    );
    if (error) throw error;

    const auditPage = mergeAuditPage(auditRows, data, AUDIT_PAGE_SIZE);
    auditRows = auditPage.rows;
    auditCursor = auditPage.cursor;
    auditHasMore = auditPage.hasMore;
    renderAudit();
  } catch (error) {
    setStatus(elements.status, readableError(error), 'error');
  } finally {
    auditLoading = false;
    setBusy(elements.loadMoreAudit, false);
    renderAuditPagination();
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

async function updatePlatformAdmin(card, isAdmin) {
  const action = isAdmin ? 'grant-admin' : 'remove-admin';
  const button = card.querySelector(`[data-action="${action}"]`);
  const verb = isAdmin ? 'grant administrator access to' : 'remove administrator access from';
  const teacher = teachers.find((item) => item.teacher_id === card.dataset.teacherId);
  if (!window.confirm(`${verb} ${teacher?.display_name || 'this teacher'}?`)) return;

  setBusy(button, true, 'Saving…');
  setStatus(elements.status, '');
  try {
    const supabase = getSupabase();
    const { error } = await supabase.rpc('admin_set_platform_admin', {
      p_teacher_id: card.dataset.teacherId,
      p_is_admin: isAdmin,
    });
    if (error) throw error;
    await loadAdminData();
    setStatus(elements.status, isAdmin ? 'Platform administrator access granted.' : 'Platform administrator access removed.', 'success');
  } catch (error) {
    setStatus(elements.status, readableError(error), 'error');
    setBusy(button, false);
  }
}

function setDeletionError(message = '') {
  elements.deleteError.textContent = message;
  elements.deleteError.hidden = !message;
}

function syncDeleteConfirmation() {
  elements.confirmDelete.disabled = deletionPending || elements.deleteConfirmation.value !== 'DELETE';
}

function openTeacherDeletion(card) {
  const teacher = teachers.find((item) => item.teacher_id === card.dataset.teacherId);
  if (!teacher || teacher.is_admin || deletionPending) return;

  selectedTeacher = teacher;
  elements.deleteName.textContent = teacher.display_name || 'Unnamed teacher';
  elements.deleteEmail.textContent = teacher.email || 'No email';
  elements.deleteConfirmation.value = '';
  setDeletionError('');
  setStatus(elements.status, '');
  syncDeleteConfirmation();

  if (typeof elements.deleteDialog.showModal === 'function') {
    elements.deleteDialog.showModal();
  } else {
    elements.deleteDialog.setAttribute('open', '');
  }
  elements.deleteConfirmation.focus();
}

function cancelTeacherDeletion() {
  if (deletionPending) return;
  if (elements.deleteDialog.open && typeof elements.deleteDialog.close === 'function') {
    elements.deleteDialog.close('cancel');
  } else {
    elements.deleteDialog.removeAttribute('open');
  }
  selectedTeacher = null;
  elements.deleteConfirmation.value = '';
  setDeletionError('');
  syncDeleteConfirmation();
}

async function deleteTeacherAccount(event) {
  event.preventDefault();
  if (!selectedTeacher || deletionPending) return;
  if (elements.deleteConfirmation.value !== 'DELETE') {
    setDeletionError('Type DELETE exactly to confirm account deletion.');
    syncDeleteConfirmation();
    return;
  }

  const teacher = selectedTeacher;
  deletionPending = true;
  elements.cancelDelete.disabled = true;
  setBusy(elements.confirmDelete, true, 'Deleting...');
  setDeletionError('');

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('admin_delete_teacher_account', {
      p_teacher_id: teacher.teacher_id,
      p_confirmation: elements.deleteConfirmation.value,
    });
    if (error) throw error;

    deletionPending = false;
    elements.cancelDelete.disabled = false;
    if (elements.deleteDialog.open && typeof elements.deleteDialog.close === 'function') {
      elements.deleteDialog.close('deleted');
    } else {
      elements.deleteDialog.removeAttribute('open');
    }
    selectedTeacher = null;
    elements.deleteConfirmation.value = '';
    setBusy(elements.confirmDelete, false);
    syncDeleteConfirmation();

    await loadAdminData();
    const retainedStudents = Number(data?.active_students || 0) + Number(data?.archived_students || 0);
    const recipient = data?.transferred_to_name || 'your administrator account';
    setStatus(
      elements.status,
      `${teacher.display_name || 'Teacher'} was deleted. ${retainedStudents} student record${retainedStudents === 1 ? '' : 's'} and associated teaching data were retained and transferred to ${recipient}.`,
      'success',
    );
  } catch (error) {
    deletionPending = false;
    elements.cancelDelete.disabled = false;
    setBusy(elements.confirmDelete, false);
    setDeletionError(readableError(error));
    syncDeleteConfirmation();
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
elements.loadMoreAudit?.addEventListener('click', loadMoreAuditEvents);
elements.signOut?.addEventListener('click', () => signOut().catch((error) => setStatus(elements.status, readableError(error), 'error')));
elements.teacherList?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  const card = event.target.closest('[data-teacher-id]');
  if (!button || !card) return;
  if (button.dataset.action === 'approve') updateTeacherStatus(card, 'approved');
  if (button.dataset.action === 'pending') updateTeacherStatus(card, 'pending');
  if (button.dataset.action === 'suspend') updateTeacherStatus(card, 'suspended');
  if (button.dataset.action === 'grant-admin') updatePlatformAdmin(card, true);
  if (button.dataset.action === 'remove-admin') updatePlatformAdmin(card, false);
  if (button.dataset.action === 'delete-teacher') openTeacherDeletion(card);
});
elements.deleteConfirmation?.addEventListener('input', () => {
  setDeletionError('');
  syncDeleteConfirmation();
});
elements.cancelDelete?.addEventListener('click', cancelTeacherDeletion);
elements.deleteForm?.addEventListener('submit', deleteTeacherAccount);
elements.deleteDialog?.addEventListener('cancel', (event) => {
  if (deletionPending) {
    event.preventDefault();
    return;
  }
  selectedTeacher = null;
  elements.deleteConfirmation.value = '';
  setDeletionError('');
  syncDeleteConfirmation();
});

initialize();
