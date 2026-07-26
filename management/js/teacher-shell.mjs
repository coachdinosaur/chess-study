import { currentProfile } from './supabase-client.mjs';

const assignmentPolish = document.createElement('link');
assignmentPolish.rel = 'stylesheet';
assignmentPolish.href = './puzzle-assignment-polish.css?v=20260726-assignment-management2';
document.head.appendChild(assignmentPolish);

try {
  const profile = await currentProfile();
  const adminLink = document.querySelector('#platformAdminLink');
  if (adminLink && profile?.is_admin) adminLink.hidden = false;
  if (profile?.role === 'teacher' && profile?.account_status === 'approved') {
    await import('./puzzle-assignment-lifecycle.mjs?v=20260726-assignment-management2');
  }
} catch {
  // The main dashboard owns the visible authentication error state.
}
