import {
  randomAccessToken,
  sha256Hex,
} from './puzzle-assignment-core.mjs';

export { randomAccessToken, sha256Hex };

export function studentWorkspaceLink(token, locationObject = globalThis.location) {
  const base = new URL('./student-workspace.html', locationObject.href);
  base.hash = `token=${encodeURIComponent(token)}`;
  return base.href;
}

export function workspaceAssignmentLink(
  token,
  studentAssignmentId,
  locationObject = globalThis.location,
) {
  const base = new URL('./assignment.html', locationObject.href);
  base.hash = new URLSearchParams({
    workspace: token,
    assignment: studentAssignmentId,
  }).toString();
  return base.href;
}

export function validateStudentLiveBoardUrl(value, locationObject = globalThis.location) {
  const text = String(value || '').trim();
  if (!text) return '';

  let url;
  try {
    url = new URL(text, locationObject.href);
  } catch {
    throw new Error('Enter a valid Live Board student link.');
  }

  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  const role = url.searchParams.get('role') || hash.get('role') || '';
  const expectedOrigin = new URL(locationObject.href).origin;
  if (
    url.origin !== expectedOrigin
    || !url.pathname.endsWith('/live-board.html')
    || role !== 'student'
  ) {
    throw new Error('Paste the secure student link from Live Board, not the teacher room URL.');
  }
  return url.href;
}
