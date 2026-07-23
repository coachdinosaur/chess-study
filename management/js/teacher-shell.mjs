import { currentProfile } from './supabase-client.mjs';

try {
  const profile = await currentProfile();
  const adminLink = document.querySelector('#platformAdminLink');
  if (adminLink && profile?.is_admin) adminLink.hidden = false;
} catch {
  // The main dashboard owns the visible authentication error state.
}
