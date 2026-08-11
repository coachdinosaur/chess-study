import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, dashboard, migration] = await Promise.all([
  readFile(new URL('../management/admin.html', import.meta.url), 'utf8'),
  readFile(new URL('../management/js/admin-dashboard.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/migrations/20260811062832_admin_teacher_deletion.sql', import.meta.url), 'utf8'),
]);

test('administrator deletion UI requires deliberate confirmation and identifies the target', () => {
  assert.match(html, /<dialog id="teacherDeleteDialog"/);
  assert.match(html, /id="teacherDeleteName"/);
  assert.match(html, /id="teacherDeleteEmail"/);
  assert.match(html, /Type <strong>DELETE<\/strong> to confirm/);
  assert.match(html, /id="confirmTeacherDeleteButton"[^>]+disabled/);
  assert.match(html, /Student records and associated teaching data are retained and transferred/);

  assert.match(dashboard, /elements\.deleteConfirmation\.value !== 'DELETE'/);
  assert.match(dashboard, /\.rpc\('admin_delete_teacher_account'/);
  assert.match(dashboard, /p_teacher_id: teacher\.teacher_id/);
  assert.match(dashboard, /teacher\.is_admin/);
  assert.match(dashboard, /isProtectedAdmin[\s\S]+Remove administrator access before deleting this account/);

  const cancelFunction = dashboard.match(/function cancelTeacherDeletion\(\) \{[\s\S]+?\n\}/)?.[0] || '';
  assert.ok(cancelFunction, 'cancel handler exists');
  assert.doesNotMatch(cancelFunction, /\.rpc\(/, 'cancel does not call the deletion RPC');
});

test('admin deletion RPC authorizes, preserves owned data, audits, and deletes Auth last', () => {
  assert.match(migration, /create or replace function public\.admin_delete_teacher_account/);
  assert.match(migration, /security definer/);
  assert.match(migration, /not private\.is_platform_admin\(\)/);
  assert.match(migration, /p_teacher_id = v_actor_id/);
  assert.match(migration, /from public\.platform_admins admin[\s\S]+admin\.user_id = p_teacher_id/);
  assert.match(migration, /p_confirmation is distinct from 'DELETE'/);
  assert.match(migration, /for update of profile, user_record/);

  const authDeletion = migration.indexOf('delete from auth.users');
  assert.ok(authDeletion > 0, 'Auth user deletion exists');
  for (const retainedUpdate of [
    'update public.classes',
    'update public.assignments',
    'update public.teacher_feedback',
    'update public.managed_students',
    'update public.coaching_sessions',
    'update public.puzzle_assignments',
    'update public.student_workspaces',
  ]) {
    const updatePosition = migration.indexOf(retainedUpdate);
    assert.ok(updatePosition > 0 && updatePosition < authDeletion, `${retainedUpdate} runs before Auth deletion`);
  }

  assert.doesNotMatch(migration, /delete from public\.managed_students/);
  assert.ok(migration.indexOf('delete from public.live_board_rooms') < authDeletion, 'active bearer-token rooms end first');
  assert.match(migration, /active_live_board_room_code = null,[\s\S]+live_board_started_at = null/);
  assert.ok(migration.indexOf("'teacher.account_deleted_by_admin'") < authDeletion, 'audit entry is written first');
  assert.match(migration, /revoke all on function public\.admin_delete_teacher_account\(uuid, text\) from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.admin_delete_teacher_account\(uuid, text\) to authenticated/);
  assert.match(migration, /^begin;[\s\S]+commit;\s*$/);
});
