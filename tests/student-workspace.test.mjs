import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  studentWorkspaceLink,
  validateStudentLiveBoardUrl,
  workspaceAssignmentLink,
} from '../management/js/student-workspace-core.mjs';

const locationObject = {
  href: 'https://chess.example/management/teacher.html',
};

test('builds a permanent student workspace link with the token in the fragment', () => {
  const link = new URL(studentWorkspaceLink('private-token', locationObject));
  assert.equal(link.pathname, '/management/student-workspace.html');
  assert.equal(link.search, '');
  assert.equal(new URLSearchParams(link.hash.slice(1)).get('token'), 'private-token');
});

test('builds a workspace-authorized assignment link without exposing an assignment token', () => {
  const link = new URL(workspaceAssignmentLink('workspace-token', 'row-123', locationObject));
  const hash = new URLSearchParams(link.hash.slice(1));
  assert.equal(link.pathname, '/management/assignment.html');
  assert.equal(hash.get('workspace'), 'workspace-token');
  assert.equal(hash.get('assignment'), 'row-123');
  assert.equal(hash.has('token'), false);
});

test('accepts only a student Live Board link', () => {
  assert.match(
    validateStudentLiveBoardUrl('../live-board.html?role=student&room=ABC', locationObject),
    /live-board\.html\?role=student/,
  );
  assert.match(
    validateStudentLiveBoardUrl('../live-board.html#role=student&room=ABC', locationObject),
    /#role=student/,
  );
  assert.throws(
    () => validateStudentLiveBoardUrl('../live-board.html?role=teacher&room=ABC', locationObject),
    /secure student link/,
  );
  assert.throws(
    () => validateStudentLiveBoardUrl('https://example.org/not-a-board', locationObject),
    /secure student link/,
  );
  assert.throws(
    () => validateStudentLiveBoardUrl('https://evil.example/live-board.html?role=student', locationObject),
    /secure student link/,
  );
});

test('workspace migration enables RLS and restricts token RPC privileges', async () => {
  const sql = await readFile(
    new URL('../supabase/migrations/20260727054209_coach_controlled_student_workspace.sql', import.meta.url),
    'utf8',
  );
  assert.match(sql, /alter table public\.student_workspaces enable row level security;/);
  assert.match(sql, /revoke all on public\.student_workspaces from anon;/);
  assert.match(sql, /security definer\s+set search_path = pg_catalog, public, extensions/);
  assert.match(sql, /revoke all on function public\.audit_student_workspace_change\(\) from public, anon, authenticated;/);
  assert.match(sql, /grant execute on function public\.get_student_workspace_by_token\(text\) to anon, authenticated;/);
  assert.match(sql, /pas\.student_id = v_workspace\.student_id/);
});
