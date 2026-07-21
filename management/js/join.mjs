import { MANAGEMENT_CONFIGURED } from './config.mjs';
import {
  currentProfile,
  currentSession,
  getSupabase,
  readableError,
} from './supabase-client.mjs';
import { setBusy, setStatus } from './ui.mjs';

const form = document.querySelector('#joinForm');
const statusBox = document.querySelector('#joinStatus');
const configuredNotice = document.querySelector('#configuredNotice');

if (!MANAGEMENT_CONFIGURED) {
  setStatus(
    configuredNotice,
    'Setup is incomplete. Configure Supabase before students can join classes.',
    'warning',
  );
  for (const control of form?.elements || []) control.disabled = true;
}

async function ensureStudentSession() {
  const existingSession = await currentSession();
  if (existingSession?.user) {
    const profile = await currentProfile();
    if (profile?.role !== 'student') {
      throw new Error('A teacher account cannot join a class as a student. Sign out first or use a separate browser profile.');
    }
    return existingSession;
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.session;
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = form.querySelector('button[type="submit"]');
  setBusy(button, true, 'Joining…');
  setStatus(statusBox, '');

  try {
    const values = new FormData(form);
    const code = String(values.get('classCode') || '').trim().toUpperCase();
    const displayName = String(values.get('displayName') || '').trim();

    if (!/^[A-Z0-9]{8}$/.test(code)) {
      throw new Error('Enter the eight-character class code provided by the teacher.');
    }
    if (displayName.length < 2) {
      throw new Error('Enter the student name or approved nickname.');
    }

    await ensureStudentSession();
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('join_class_by_code', {
      p_code: code,
      p_display_name: displayName,
    });
    if (error) throw error;

    const membership = Array.isArray(data) ? data[0] : data;
    const message = membership?.status === 'active'
      ? `Joined ${membership.class_name}.`
      : `Request sent to ${membership?.class_name || 'the class'}. The teacher must approve it.`;

    setStatus(statusBox, message, 'success');
    window.setTimeout(() => window.location.replace('./student.html'), 700);
  } catch (error) {
    setStatus(statusBox, readableError(error), 'error');
    setBusy(button, false);
  }
});
