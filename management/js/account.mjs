import { getSupabase, readableError, requireProfile, signOut } from './supabase-client.mjs';
import { setBusy, setStatus } from './ui.mjs';

const elements = {
  profileName: document.querySelector('#profileName'),
  email: document.querySelector('#accountEmail'),
  statusLabel: document.querySelector('#accountStatusLabel'),
  adminLabel: document.querySelector('#accountAdminLabel'),
  status: document.querySelector('#accountStatus'),
  passwordForm: document.querySelector('#changePasswordForm'),
  exportButton: document.querySelector('#exportAccountButton'),
  deleteForm: document.querySelector('#deleteAccountForm'),
  deleteButton: document.querySelector('#deleteAccountButton'),
  adminDeleteNotice: document.querySelector('#adminDeleteNotice'),
  signOut: document.querySelector('#signOutButton'),
};

let profile = null;
let authenticatedEmail = '';

function downloadJson(filename, value) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function changePassword(event) {
  event.preventDefault();
  const button = elements.passwordForm.querySelector('button[type="submit"]');
  const values = new FormData(elements.passwordForm);
  const currentPassword = String(values.get('currentPassword') || '');
  const newPassword = String(values.get('newPassword') || '');
  const confirmPassword = String(values.get('confirmPassword') || '');

  if (newPassword.length < 8) {
    setStatus(elements.status, 'Use a new password with at least eight characters.', 'error');
    return;
  }
  if (newPassword !== confirmPassword) {
    setStatus(elements.status, 'The new passwords do not match.', 'error');
    return;
  }

  setBusy(button, true, 'Updating…');
  setStatus(elements.status, '');
  try {
    const supabase = getSupabase();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: authenticatedEmail,
      password: currentPassword,
    });
    if (authError) throw new Error('The current password is incorrect.');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    elements.passwordForm.reset();
    setStatus(elements.status, 'Password updated.', 'success');
  } catch (error) {
    setStatus(elements.status, readableError(error), 'error');
  } finally {
    setBusy(button, false);
  }
}

async function exportAccount() {
  setBusy(elements.exportButton, true, 'Exporting…');
  setStatus(elements.status, '');
  try {
    const supabase = getSupabase();
    const { data: students, error: studentsError } = await supabase
      .from('managed_students')
      .select('id, display_name, notes, archived_at, created_at')
      .eq('teacher_id', profile.id)
      .order('created_at');
    if (studentsError) throw studentsError;

    const studentIds = (students || []).map((student) => student.id);
    let progress = [];
    let sessions = [];
    if (studentIds.length) {
      const [progressResult, sessionResult] = await Promise.all([
        supabase
          .from('managed_student_lesson_progress')
          .select('*')
          .in('student_id', studentIds),
        supabase
          .from('coaching_sessions')
          .select('*')
          .eq('teacher_id', profile.id)
          .order('session_date', { ascending: false }),
      ]);
      if (progressResult.error) throw progressResult.error;
      if (sessionResult.error) throw sessionResult.error;
      progress = progressResult.data || [];
      sessions = sessionResult.data || [];
    }

    const { error: auditError } = await supabase.rpc('record_my_data_export');
    if (auditError) throw auditError;

    downloadJson('cd-digital-teacher-account-export.json', {
      exported_at: new Date().toISOString(),
      teacher: {
        id: profile.id,
        display_name: profile.display_name,
        email: authenticatedEmail,
        account_status: profile.account_status,
        created_at: profile.created_at,
      },
      students: students || [],
      lesson_progress: progress,
      coaching_sessions: sessions,
    });
    setStatus(elements.status, 'Complete management data exported.', 'success');
  } catch (error) {
    setStatus(elements.status, readableError(error), 'error');
  } finally {
    setBusy(elements.exportButton, false);
  }
}

async function deleteAccount(event) {
  event.preventDefault();
  if (profile.is_admin) return;

  const values = new FormData(elements.deleteForm);
  const password = String(values.get('currentPassword') || '');
  const confirmation = String(values.get('confirmation') || '');
  if (confirmation !== 'DELETE') {
    setStatus(elements.status, 'Type DELETE exactly to confirm permanent account deletion.', 'error');
    return;
  }

  setBusy(elements.deleteButton, true, 'Deleting…');
  setStatus(elements.status, '');
  try {
    const supabase = getSupabase();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: authenticatedEmail,
      password,
    });
    if (authError) throw new Error('The current password is incorrect.');

    const { error } = await supabase.rpc('delete_my_teacher_account', {
      p_confirmation: confirmation,
    });
    if (error) throw error;

    try { localStorage.removeItem('chess-study-management-auth-v1'); } catch {}
    window.location.replace('./login.html?deleted=1');
  } catch (error) {
    setStatus(elements.status, readableError(error), 'error');
    setBusy(elements.deleteButton, false);
  }
}

async function initialize() {
  try {
    profile = await requireProfile('teacher', { allowUnapproved: true });
    if (!profile) return;
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    authenticatedEmail = data.user?.email || profile.email || '';

    elements.profileName.textContent = profile.display_name;
    elements.email.textContent = authenticatedEmail;
    elements.statusLabel.textContent = profile.account_status;
    elements.adminLabel.textContent = profile.is_admin ? 'Platform administrator' : 'Teacher account';
    elements.adminDeleteNotice.hidden = !profile.is_admin;
    elements.deleteForm.hidden = profile.is_admin;
    if (profile.account_status !== 'approved') {
      elements.exportButton.disabled = true;
      elements.exportButton.title = 'Ask the platform administrator for a data export while this account is not approved.';
    }
  } catch (error) {
    setStatus(elements.status, readableError(error), 'error');
  }
}

elements.passwordForm?.addEventListener('submit', changePassword);
elements.exportButton?.addEventListener('click', exportAccount);
elements.deleteForm?.addEventListener('submit', deleteAccount);
elements.signOut?.addEventListener('click', () => signOut().catch((error) => setStatus(elements.status, readableError(error), 'error')));
initialize();
