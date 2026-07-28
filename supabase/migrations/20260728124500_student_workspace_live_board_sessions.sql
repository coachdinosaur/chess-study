-- Permanent student workspace entry point with temporary per-lesson Live Board rooms.
begin;

alter table public.student_workspaces
  add column if not exists active_live_board_room_code text,
  add column if not exists live_board_started_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'student_workspaces_active_live_board_room_fkey'
      and conrelid = 'public.student_workspaces'::regclass
  ) then
    alter table public.student_workspaces
      add constraint student_workspaces_active_live_board_room_fkey
      foreign key (active_live_board_room_code)
      references public.live_board_rooms(room_code)
      on delete set null;
  end if;
end;
$$;

create index if not exists student_workspaces_active_live_board_room_idx
  on public.student_workspaces (active_live_board_room_code)
  where active_live_board_room_code is not null;

create or replace function public.start_student_workspace_live_board(
  p_workspace_id uuid,
  p_room_code text,
  p_teacher_token text,
  p_student_token text,
  p_fen text default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  p_orientation text default 'white'
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_workspace public.student_workspaces%rowtype;
  v_room public.live_board_rooms%rowtype;
  v_student_hash text;
begin
  if auth.uid() is null or not private.is_teacher() then
    raise exception 'Teacher access is required.';
  end if;

  select *
  into v_workspace
  from public.student_workspaces
  where id = p_workspace_id
    and teacher_id = auth.uid();
  if not found then raise exception 'Student workspace was not found.'; end if;

  if not exists (
    select 1
    from public.managed_students student
    where student.id = v_workspace.student_id
      and student.teacher_id = auth.uid()
      and student.archived_at is null
  ) then
    raise exception 'This student workspace is no longer active.';
  end if;

  if p_room_code !~ '^[A-Z0-9]{6,12}$' then raise exception 'Invalid room code.'; end if;
  if char_length(coalesce(p_teacher_token, '')) < 32
     or char_length(coalesce(p_student_token, '')) < 32 then
    raise exception 'Room tokens are too short.';
  end if;
  if p_orientation not in ('white', 'black') then raise exception 'Invalid orientation.'; end if;

  v_student_hash := encode(extensions.digest(convert_to(p_student_token, 'UTF8'), 'sha256'), 'hex');
  if v_student_hash <> v_workspace.access_token_hash then
    raise exception 'The current private workspace link is required to start a Live Board session.';
  end if;

  delete from public.live_board_rooms where expires_at <= now();
  if v_workspace.active_live_board_room_code is not null then
    delete from public.live_board_rooms
    where room_code = v_workspace.active_live_board_room_code;
  end if;

  insert into public.live_board_rooms (
    room_code,
    teacher_token_hash,
    student_token_hash,
    student_short_token_hash,
    fen,
    pgn,
    orientation
  ) values (
    p_room_code,
    encode(extensions.digest(convert_to(p_teacher_token, 'UTF8'), 'sha256'), 'hex'),
    v_student_hash,
    encode(extensions.digest(convert_to(left(p_student_token, 16), 'UTF8'), 'sha256'), 'hex'),
    p_fen,
    '',
    p_orientation
  ) returning * into v_room;

  update public.student_workspaces
  set active_live_board_room_code = v_room.room_code,
      live_board_started_at = now()
  where id = v_workspace.id;

  return jsonb_build_object(
    'active', true,
    'room_code', v_room.room_code,
    'expires_at', v_room.expires_at,
    'started_at', now()
  );
exception
  when unique_violation then raise exception 'Room code already exists. Try again.';
end;
$$;

create or replace function public.get_teacher_student_workspace_live_board(
  p_workspace_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_room public.live_board_rooms%rowtype;
  v_workspace public.student_workspaces%rowtype;
begin
  if auth.uid() is null or not private.is_teacher() then
    raise exception 'Teacher access is required.';
  end if;

  select *
  into v_workspace
  from public.student_workspaces
  where id = p_workspace_id
    and teacher_id = auth.uid();
  if not found then raise exception 'Student workspace was not found.'; end if;

  if v_workspace.active_live_board_room_code is null then
    return jsonb_build_object('active', false);
  end if;

  select *
  into v_room
  from public.live_board_rooms
  where room_code = v_workspace.active_live_board_room_code
    and expires_at > now();
  if not found then return jsonb_build_object('active', false); end if;

  return jsonb_build_object(
    'active', true,
    'room_code', v_room.room_code,
    'expires_at', v_room.expires_at,
    'started_at', v_workspace.live_board_started_at
  );
end;
$$;

create or replace function public.end_student_workspace_live_board(
  p_workspace_id uuid
) returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_room_code text;
begin
  if auth.uid() is null or not private.is_teacher() then
    raise exception 'Teacher access is required.';
  end if;

  select active_live_board_room_code
  into v_room_code
  from public.student_workspaces
  where id = p_workspace_id
    and teacher_id = auth.uid();
  if not found then raise exception 'Student workspace was not found.'; end if;

  update public.student_workspaces
  set active_live_board_room_code = null,
      live_board_started_at = null
  where id = p_workspace_id
    and teacher_id = auth.uid();

  if v_room_code is not null then
    delete from public.live_board_rooms where room_code = v_room_code;
  end if;
  return true;
end;
$$;

create or replace function public.get_student_workspace_live_board_by_token(
  p_token text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_hash text;
  v_workspace public.student_workspaces%rowtype;
  v_room public.live_board_rooms%rowtype;
begin
  if p_token is null or char_length(p_token) < 32 or char_length(p_token) > 512 then
    return jsonb_build_object('active', false);
  end if;

  v_hash := encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex');
  select workspace.*
  into v_workspace
  from public.student_workspaces workspace
  join public.managed_students student
    on student.id = workspace.student_id
   and student.teacher_id = workspace.teacher_id
   and student.archived_at is null
  where workspace.access_token_hash = v_hash
    and workspace.is_published;

  if not found or v_workspace.active_live_board_room_code is null then
    return jsonb_build_object('active', false);
  end if;

  select *
  into v_room
  from public.live_board_rooms
  where room_code = v_workspace.active_live_board_room_code
    and student_token_hash = v_hash
    and expires_at > now();
  if not found then return jsonb_build_object('active', false); end if;

  return jsonb_build_object(
    'active', true,
    'room_code', v_room.room_code,
    'expires_at', v_room.expires_at
  );
end;
$$;

revoke all on function public.start_student_workspace_live_board(uuid,text,text,text,text,text) from public, anon;
revoke all on function public.get_teacher_student_workspace_live_board(uuid) from public, anon;
revoke all on function public.end_student_workspace_live_board(uuid) from public, anon;
revoke all on function public.get_student_workspace_live_board_by_token(text) from public;

grant execute on function public.start_student_workspace_live_board(uuid,text,text,text,text,text) to authenticated;
grant execute on function public.get_teacher_student_workspace_live_board(uuid) to authenticated;
grant execute on function public.end_student_workspace_live_board(uuid) to authenticated;
grant execute on function public.get_student_workspace_live_board_by_token(text) to anon, authenticated;

commit;
