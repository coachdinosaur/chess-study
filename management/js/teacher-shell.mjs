import { currentProfile } from './supabase-client.mjs';

const assignmentPolish = document.createElement('link');
assignmentPolish.rel = 'stylesheet';
assignmentPolish.href = './puzzle-assignment-polish.css?v=20260726-assignment-management2';
document.head.appendChild(assignmentPolish);

function relabelAssignmentManagement() {
  const section = document.querySelector('.puzzle-assignment-history');
  if (!section) return false;
  const heading = section.querySelector('.section-head h3');
  const copy = section.querySelector('.section-head .panel-copy');
  if (heading) heading.textContent = 'Assignment management';
  if (copy) copy.textContent = 'Review active and archived assignments, student progress, private links, safe edits, duplication, restoration, and permanent deletion.';
  return true;
}

try {
  const profile = await currentProfile();
  const adminLink = document.querySelector('#platformAdminLink');
  if (adminLink && profile?.is_admin) adminLink.hidden = false;
  if (profile?.role === 'teacher' && profile?.account_status === 'approved') {
    await import('./puzzle-assignment-lifecycle.mjs?v=20260726-assignment-management2');
    if (!relabelAssignmentManagement()) {
      const observer = new MutationObserver(() => {
        if (!relabelAssignmentManagement()) return;
        observer.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }
} catch {
  // The main dashboard owns the visible authentication error state.
}
