begin;

create or replace function public.admin_delete_teacher_account(
  p_teacher_id uuid,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, private, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_name text;
  v_target_name text;
  v_target_email text;
  v_active_students bigint := 0;
  v_archived_students bigint := 0;
  v_classes bigint := 0;
  v_assignments bigint := 0;
  v_feedback bigint := 0;
  v_sessions bigint := 0;
  v_puzzle_assignments bigint := 0;
  v_workspaces bigint := 0;
  v_ended_live_rooms bigint := 0;
begin
  if v_actor_id is null or not private.is_platform_admin() then
    raise exception 'Platform administrator access is required.';
  end if;

  if p_teacher_id is null then
    raise exception 'Choose a teacher account to delete.';
  end if;

  if p_confirmation is distinct from 'DELETE' then
    raise exception 'Type DELETE to confirm account deletion.';
  end if;

  if p_teacher_id = v_actor_id then
    raise exception 'You cannot delete your own administrator account.';
  end if;

  select profile.display_name
  into v_actor_name
  from public.profiles profile
  join public.teacher_account_controls control
    on control.teacher_id = profile.id
  where profile.id = v_actor_id
    and profile.role = 'teacher'
    and control.status = 'approved';

  if not found then
    raise exception 'An approved teacher administrator account is required to receive retained data.';
  end if;

  select profile.display_name, user_record.email
  into v_target_name, v_target_email
  from public.profiles profile
  join auth.users user_record on user_record.id = profile.id
  where profile.id = p_teacher_id
    and profile.role = 'teacher'
  for update of profile, user_record;

  if not found then
    raise exception 'Teacher account was not found.';
  end if;

  if exists (
    select 1
    from public.platform_admins admin
    where admin.user_id = p_teacher_id
  ) then
    raise exception 'Remove administrator access before deleting this teacher account.';
  end if;

  select
    count(*) filter (where student.archived_at is null),
    count(*) filter (where student.archived_at is not null)
  into v_active_students, v_archived_students
  from public.managed_students student
  where student.teacher_id = p_teacher_id;

  select count(*) into v_classes
  from public.classes class_row
  where class_row.teacher_id = p_teacher_id;

  select count(*) into v_assignments
  from public.assignments assignment
  where assignment.created_by = p_teacher_id;

  select count(*) into v_feedback
  from public.teacher_feedback feedback
  where feedback.teacher_id = p_teacher_id;

  select count(*) into v_sessions
  from public.coaching_sessions session_row
  where session_row.teacher_id = p_teacher_id;

  select count(*) into v_puzzle_assignments
  from public.puzzle_assignments assignment
  where assignment.teacher_id = p_teacher_id;

  select count(*) into v_workspaces
  from public.student_workspaces workspace
  where workspace.teacher_id = p_teacher_id;

  with ended_rooms as (
    delete from public.live_board_rooms room
    using public.student_workspaces workspace
    where workspace.teacher_id = p_teacher_id
      and workspace.active_live_board_room_code = room.room_code
    returning room.id
  )
  select count(*) into v_ended_live_rooms from ended_rooms;

  update public.classes
  set teacher_id = v_actor_id
  where teacher_id = p_teacher_id;

  update public.assignments
  set created_by = v_actor_id
  where created_by = p_teacher_id;

  update public.teacher_feedback
  set teacher_id = v_actor_id
  where teacher_id = p_teacher_id;

  update public.managed_students
  set teacher_id = v_actor_id
  where teacher_id = p_teacher_id;

  update public.coaching_sessions
  set teacher_id = v_actor_id
  where teacher_id = p_teacher_id;

  update public.puzzle_assignments
  set teacher_id = v_actor_id
  where teacher_id = p_teacher_id;

  update public.student_workspaces
  set teacher_id = v_actor_id,
      active_live_board_room_code = null,
      live_board_started_at = null
  where teacher_id = p_teacher_id;

  insert into public.management_audit_log (
    actor_id,
    teacher_id,
    event_type,
    target_type,
    target_id,
    metadata
  ) values (
    v_actor_id,
    p_teacher_id,
    'teacher.account_deleted_by_admin',
    'teacher',
    p_teacher_id::text,
    jsonb_build_object(
      'target_display_name', v_target_name,
      'data_transferred_to', v_actor_id,
      'active_students', v_active_students,
      'archived_students', v_archived_students,
      'classes', v_classes,
      'assignments', v_assignments,
      'feedback', v_feedback,
      'coaching_sessions', v_sessions,
      'puzzle_assignments', v_puzzle_assignments,
      'student_workspaces', v_workspaces,
      'ended_live_board_rooms', v_ended_live_rooms
    )
  );

  delete from auth.users
  where id = p_teacher_id;

  if not found then
    raise exception 'Teacher authentication account could not be deleted.';
  end if;

  return jsonb_build_object(
    'teacher_id', p_teacher_id,
    'display_name', v_target_name,
    'email', v_target_email,
    'transferred_to', v_actor_id,
    'transferred_to_name', v_actor_name,
    'active_students', v_active_students,
    'archived_students', v_archived_students,
    'classes', v_classes,
    'assignments', v_assignments,
    'feedback', v_feedback,
    'coaching_sessions', v_sessions,
    'puzzle_assignments', v_puzzle_assignments,
    'student_workspaces', v_workspaces,
    'ended_live_board_rooms', v_ended_live_rooms
  );
end;
$$;

comment on function public.admin_delete_teacher_account(uuid, text) is
  'Permanently deletes a non-admin teacher Auth account after transferring retained teaching data to the acting platform administrator.';

revoke all on function public.admin_delete_teacher_account(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_delete_teacher_account(uuid, text) to authenticated;

commit;
