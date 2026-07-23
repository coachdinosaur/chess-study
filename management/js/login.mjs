import { MANAGEMENT_CONFIGURED } from './config.mjs';
import {
  currentProfile,
  getSupabase,
  readableError,
  teacherDestination,
} from './supabase-client.mjs';
import { setBusy, setStatus } from './ui.mjs';

const signInForm = document.querySelector('#signInForm');
const signUpForm = document.querySelector('#signUpForm');
const recoveryForm = document.querySelector('#recoveryForm');
const statusBox = document.querySelector('#authStatus');
const configuredNotice = document.querySelector('#configuredNotice');

async function clearRetiredStudentSession(profile) {
  if (!profile || profile.role === 'teacher') return false;
  const supabase = getSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  setStatus(
    statusBox,
    'The retired student-management session was signed out. Sign in with a teacher account.',
    'warning',
  );
  return true;
}

async function redirectExistingSession() {
  if (!MANAGEMENT_CONFIGURED) return;
  try {
    const profile = await currentProfile();
    if (!profile) return;
    if (await clearRetiredStudentSession(profile)) return;
    window.location.replace(teacherDestination(profile));
  } catch (error) {
    setStatus(statusBox, readableError(error), 'error');
  }
}

const query = new URLSearchParams(window.location.search);
if (query.get('deleted') === '1') {
  setStatus(statusBox, 'The teacher account and its management data were deleted.', 'success');
} else if (query.get('reset') === '1') {
  setStatus(statusBox, 'Password updated. Sign in with the new password.', 'success');
}

if (!MANAGEMENT_CONFIGURED) {
  setStatus(
    configuredNotice,
    'Setup is incomplete. Add the Supabase URL and publishable key in management/js/config.mjs before using accounts.',
    'warning',
  );
  for (const control of document.querySelectorAll('input, button[type="submit"]')) {
    control.disabled = true;
  }
} else {
  redirectExistingSession();
}

signInForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = signInForm.querySelector('button[type="submit"]');
  setBusy(button, true, 'Signing in…');
  setStatus(statusBox, '');

  try {
    const form = new FormData(signInForm);
    const supabase = getSupabase();
    const { error } = await supabase.auth.signInWithPassword({
      email: String(form.get('email') || '').trim(),
      password: String(form.get('password') || ''),
    });
    if (error) throw error;

    const profile = await currentProfile();
    if (profile?.role !== 'teacher') {
      await supabase.auth.signOut();
      throw new Error('This management portal accepts teacher accounts only.');
    }
    window.location.replace(teacherDestination(profile));
  } catch (error) {
    setStatus(statusBox, readableError(error), 'error');
    setBusy(button, false);
  }
});

signUpForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = signUpForm.querySelector('button[type="submit"]');
  setBusy(button, true, 'Creating account…');
  setStatus(statusBox, '');

  try {
    const form = new FormData(signUpForm);
    const displayName = String(form.get('displayName') || '').trim();
    const email = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '');

    if (displayName.length < 2) throw new Error('Enter the teacher or coaching name.');
    if (password.length < 8) throw new Error('Use a password with at least eight characters.');

    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: new URL('./pending.html', window.location.href).href,
        data: {
          role: 'teacher',
          display_name: displayName,
        },
      },
    });
    if (error) throw error;

    if (!data.session) {
      setStatus(
        statusBox,
        'Account created. Confirm the teacher email, then wait for platform approval before opening private student records.',
        'success',
      );
      signUpForm.reset();
      setBusy(button, false);
      return;
    }

    const profile = await currentProfile();
    window.location.replace(teacherDestination(profile));
  } catch (error) {
    setStatus(statusBox, readableError(error), 'error');
    setBusy(button, false);
  }
});

recoveryForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = recoveryForm.querySelector('button[type="submit"]');
  setBusy(button, true, 'Sending…');
  setStatus(statusBox, '');

  try {
    const form = new FormData(recoveryForm);
    const email = String(form.get('email') || '').trim();
    if (!email) throw new Error('Enter the teacher account email.');

    const supabase = getSupabase();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: new URL('./reset-password.html', window.location.href).href,
    });
    if (error) throw error;

    setStatus(
      statusBox,
      'If that email belongs to a teacher account, a password-reset link has been sent.',
      'success',
    );
    recoveryForm.reset();
  } catch (error) {
    setStatus(statusBox, readableError(error), 'error');
  } finally {
    setBusy(button, false);
  }
});
