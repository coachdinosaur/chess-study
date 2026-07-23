import { currentProfile, readableError, signOut } from './supabase-client.mjs';
import { setStatus } from './ui.mjs';

const title = document.querySelector('#approvalTitle');
const copy = document.querySelector('#approvalCopy');
const reason = document.querySelector('#suspensionReason');
const statusBox = document.querySelector('#approvalStatus');
const refreshButton = document.querySelector('#refreshApprovalButton');
const signOutButton = document.querySelector('#signOutButton');

async function loadStatus() {
  refreshButton.disabled = true;
  setStatus(statusBox, 'Checking account status…');
  try {
    const profile = await currentProfile();
    if (!profile) {
      window.location.replace('./login.html');
      return;
    }
    if (profile.role !== 'teacher') {
      await signOut();
      return;
    }
    if (profile.account_status === 'approved') {
      window.location.replace('./teacher.html');
      return;
    }

    if (profile.account_status === 'suspended') {
      title.textContent = 'Teacher account suspended';
      copy.textContent = 'Private management access has been paused by the platform administrator.';
      reason.textContent = profile.suspension_reason || 'No suspension reason was recorded.';
      reason.hidden = false;
      setStatus(statusBox, 'Contact the platform administrator before attempting to use student records.', 'warning');
    } else {
      title.textContent = 'Teacher account awaiting approval';
      copy.textContent = 'Your email is confirmed, but an administrator must approve the coaching account before private student records become available.';
      reason.hidden = true;
      setStatus(statusBox, 'Approval is still pending.', 'warning');
    }
  } catch (error) {
    setStatus(statusBox, readableError(error), 'error');
  } finally {
    refreshButton.disabled = false;
  }
}

refreshButton?.addEventListener('click', loadStatus);
signOutButton?.addEventListener('click', () => signOut().catch((error) => setStatus(statusBox, readableError(error), 'error')));
loadStatus();
