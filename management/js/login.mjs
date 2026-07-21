import { MANAGEMENT_CONFIGURED } from './config.mjs';
import {
  currentProfile,
  getSupabase,
  readableError,
} from './supabase-client.mjs';
import { setBusy, setStatus } from './ui.mjs';

const signInForm = document.querySelector('#signInForm');
const signUpForm = document.querySelector('#signUpForm');
const statusBox = document.querySelector('#authStatus');
const configuredNotice = document.querySelector('#configuredNotice');

function destinationFor(profile) {
  return profile?.role === 'teacher' ? './teacher.html' : './student.html';
}

async function redirectExistingSession() {
  if (!MANAGEMENT_CONFIGURED) return;
  try {
    const profile = await currentProfile();
    if (profile) window.location.replace(destinationFor(profile));
  } catch (error) {
    setStatus(statusBox, readableError(error), 'error');
  }
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
    window.location.replace(destinationFor(profile));
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
        'Account created. Check the teacher email for the confirmation link, then sign in.',
        'success',
      );
      signUpForm.reset();
      setBusy(button, false);
      return;
    }

    window.location.replace('./teacher.html');
  } catch (error) {
    setStatus(statusBox, readableError(error), 'error');
    setBusy(button, false);
  }
});
