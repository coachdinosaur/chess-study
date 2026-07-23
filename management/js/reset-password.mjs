import { getSupabase, readableError } from './supabase-client.mjs';
import { setBusy, setStatus } from './ui.mjs';

const form = document.querySelector('#resetPasswordForm');
const statusBox = document.querySelector('#resetPasswordStatus');
const submitButton = form?.querySelector('button[type="submit"]');
const supabase = getSupabase();
let recoveryReady = false;

function setReady() {
  recoveryReady = true;
  for (const control of form?.elements || []) control.disabled = false;
  setStatus(statusBox, 'Recovery link accepted. Choose a new password.', 'success');
}

for (const control of form?.elements || []) control.disabled = true;

const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY' || session?.user) setReady();
});

const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
if (sessionError) {
  setStatus(statusBox, readableError(sessionError), 'error');
} else if (sessionData.session?.user) {
  setReady();
} else {
  window.setTimeout(() => {
    if (!recoveryReady) {
      setStatus(statusBox, 'This recovery link is invalid or expired. Request another password-reset email.', 'error');
    }
  }, 1800);
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!recoveryReady) return;

  const values = new FormData(form);
  const password = String(values.get('password') || '');
  const confirmPassword = String(values.get('confirmPassword') || '');
  if (password.length < 8) {
    setStatus(statusBox, 'Use a password with at least eight characters.', 'error');
    return;
  }
  if (password !== confirmPassword) {
    setStatus(statusBox, 'The passwords do not match.', 'error');
    return;
  }

  setBusy(submitButton, true, 'Updating…');
  setStatus(statusBox, '');
  try {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    await supabase.auth.signOut();
    window.location.replace('./login.html?reset=1');
  } catch (error) {
    setStatus(statusBox, readableError(error), 'error');
    setBusy(submitButton, false);
  }
});

window.addEventListener('pagehide', () => authListener.subscription.unsubscribe(), { once: true });
