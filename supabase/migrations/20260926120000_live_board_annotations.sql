-- Add shared board annotations to Live Board rooms.
--
-- live-board.js lets the teacher draw marks on the 2D board (painted squares,
-- circles, stars, arrows). Marks ride inside the room state JSON, so the room
-- row needs an annotations column and every state-returning RPC must carry it.
--
-- update_live_board_teacher gains a defaulted p_annotations parameter; older
-- 9-parameter clients still resolve through PostgREST named arguments. The
-- client also retries without the parameter when it talks to a database that
-- has not applied this migration yet (PGRST202 signature miss).
--
-- Idempotent: drops every existing overload of the affected functions first,
-- so it is safe to apply whether or not hand-applied versions exist.

begin;

alter table public.live_board_rooms
  add column if not exists annotations jsonb not null default '{}'::jsonb;

-- Drop every existing overload. PostgREST resolves RPCs by name and cannot
-- pick between overloads, so the old 9-parameter update_live_board_teacher
-- must be removed before the 10-parameter version is created.
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure::text as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'create_live_board_room',
        'create_live_board_room_v2',
        'get_live_board_room',
        'update_live_board_teacher',
        'update_live_board_student'
      )
  loop
    execute format('drop function %s', fn.signature);
  end loop;
end;
$$;

-- Room functions --------------------------------------------------------------

create function public.create_live_board_room(
  p_room_code text,
  p_teacher_token text,
  p_student_token text,
  p_fen text,
  p_pgn text default '',
  p_orientation text default 'white'
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_room public.live_board_rooms;
begin
  if p_room_code !~ '^[A-Z0-9]{6,12}$' then
    raise exception 'Invalid room code';
  end if;
  if length(p_teacher_token) < 32 or length(p_student_token) < 32 then
    raise exception 'Room tokens are too short';
  end if;
  if p_orientation not in ('white', 'black') then
    raise exception 'Invalid orientation';
  end if;

  delete from public.live_board_rooms where expires_at <= now();

  insert into public.live_board_rooms (
    room_code, teacher_token_hash, student_token_hash,
    student_short_token_hash, fen, pgn, orientation
  ) values (
    p_room_code,
    encode(extensions.digest(convert_to(p_teacher_token, 'UTF8'), 'sha256'), 'hex'),
    encode(extensions.digest(convert_to(p_student_token, 'UTF8'), 'sha256'), 'hex'),
    encode(extensions.digest(convert_to(left(p_student_token, 16), 'UTF8'), 'sha256'), 'hex'),
    p_fen,
    coalesce(p_pgn, ''),
    p_orientation
  )
  returning * into v_room;

  return jsonb_build_object(
    'room_code', v_room.room_code,
    'fen', v_room.fen,
    'pgn', v_room.pgn,
    'orientation', v_room.orientation,
    'last_move', v_room.last_move,
    'student_moves_allowed', v_room.student_moves_allowed,
    'revision', v_room.revision,
    'active_lesson_id', v_room.active_lesson_id,
    'annotations', v_room.annotations,
    'expires_at', v_room.expires_at
  );
exception
  when unique_violation then
    raise exception 'Room code already exists';
end;
$$;

create function public.create_live_board_room_v2(
  p_room_code text,
  p_teacher_token text,
  p_student_token text,
  p_student_short_token text,
  p_fen text,
  p_pgn text default '',
  p_orientation text default 'white'
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_room public.live_board_rooms;
begin
  if p_room_code !~ '^[A-Z0-9]{6,12}$' then
    raise exception 'Invalid room code';
  end if;
  if length(p_teacher_token) < 32 or length(p_student_token) < 32 then
    raise exception 'Room tokens are too short';
  end if;
  if char_length(coalesce(p_student_short_token, '')) not between 8 and 64 then
    raise exception 'Invalid short student token';
  end if;
  if p_orientation not in ('white', 'black') then
    raise exception 'Invalid orientation';
  end if;

  delete from public.live_board_rooms where expires_at <= now();

  insert into public.live_board_rooms (
    room_code, teacher_token_hash, student_token_hash,
    student_short_token_hash, fen, pgn, orientation
  ) values (
    p_room_code,
    encode(extensions.digest(convert_to(p_teacher_token, 'UTF8'), 'sha256'), 'hex'),
    encode(extensions.digest(convert_to(p_student_token, 'UTF8'), 'sha256'), 'hex'),
    encode(extensions.digest(convert_to(p_student_short_token, 'UTF8'), 'sha256'), 'hex'),
    p_fen,
    coalesce(p_pgn, ''),
    p_orientation
  )
  returning * into v_room;

  return jsonb_build_object(
    'room_code', v_room.room_code,
    'fen', v_room.fen,
    'pgn', v_room.pgn,
    'orientation', v_room.orientation,
    'last_move', v_room.last_move,
    'student_moves_allowed', v_room.student_moves_allowed,
    'revision', v_room.revision,
    'active_lesson_id', v_room.active_lesson_id,
    'annotations', v_room.annotations,
    'expires_at', v_room.expires_at
  );
exception
  when unique_violation then
    raise exception 'Room code already exists';
end;
$$;

create function public.get_live_board_room(
  p_room_code text,
  p_access_token text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
stable
as $$
declare
  v_room public.live_board_rooms;
  v_hash text;
begin
  v_hash := encode(extensions.digest(convert_to(coalesce(p_access_token, ''), 'UTF8'), 'sha256'), 'hex');

  select * into v_room
  from public.live_board_rooms
  where room_code = p_room_code
    and expires_at > now()
    and (teacher_token_hash = v_hash
         or student_token_hash = v_hash
         or student_short_token_hash = v_hash);

  if not found then
    raise exception 'Room not found or access token is invalid';
  end if;

  return jsonb_build_object(
    'room_code', v_room.room_code,
    'fen', v_room.fen,
    'pgn', v_room.pgn,
    'orientation', v_room.orientation,
    'last_move', v_room.last_move,
    'student_moves_allowed', v_room.student_moves_allowed,
    'revision', v_room.revision,
    'active_lesson_id', v_room.active_lesson_id,
    'annotations', v_room.annotations,
    'expires_at', v_room.expires_at
  );
end;
$$;

create function public.update_live_board_teacher(
  p_room_code text,
  p_teacher_token text,
  p_expected_revision bigint,
  p_fen text,
  p_pgn text,
  p_orientation text,
  p_last_move jsonb,
  p_student_moves_allowed boolean,
  p_active_lesson_id text default '',
  p_annotations jsonb default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_room public.live_board_rooms;
  v_hash text;
begin
  v_hash := encode(extensions.digest(convert_to(coalesce(p_teacher_token, ''), 'UTF8'), 'sha256'), 'hex');
  if p_orientation not in ('white', 'black') then
    raise exception 'Invalid orientation';
  end if;

  update public.live_board_rooms
  set fen = p_fen,
      pgn = coalesce(p_pgn, ''),
      orientation = p_orientation,
      last_move = p_last_move,
      student_moves_allowed = p_student_moves_allowed,
      active_lesson_id = coalesce(p_active_lesson_id, ''),
      annotations = coalesce(p_annotations, annotations),
      revision = revision + 1,
      updated_at = now(),
      expires_at = greatest(expires_at, now() + interval '12 hours')
  where room_code = p_room_code
    and teacher_token_hash = v_hash
    and expires_at > now()
    and revision = p_expected_revision
  returning * into v_room;

  if not found then
    raise exception 'Teacher update rejected because access or revision is invalid';
  end if;

  return jsonb_build_object(
    'room_code', v_room.room_code,
    'fen', v_room.fen,
    'pgn', v_room.pgn,
    'orientation', v_room.orientation,
    'last_move', v_room.last_move,
    'student_moves_allowed', v_room.student_moves_allowed,
    'revision', v_room.revision,
    'active_lesson_id', v_room.active_lesson_id,
    'annotations', v_room.annotations,
    'expires_at', v_room.expires_at
  );
end;
$$;

create function public.update_live_board_student(
  p_room_code text,
  p_student_token text,
  p_expected_revision bigint,
  p_fen text,
  p_pgn text,
  p_last_move jsonb
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_room public.live_board_rooms;
  v_hash text;
begin
  v_hash := encode(extensions.digest(convert_to(coalesce(p_student_token, ''), 'UTF8'), 'sha256'), 'hex');

  update public.live_board_rooms
  set fen = p_fen,
      pgn = coalesce(p_pgn, ''),
      last_move = p_last_move,
      revision = revision + 1,
      updated_at = now(),
      expires_at = greatest(expires_at, now() + interval '12 hours')
  where room_code = p_room_code
    and (student_token_hash = v_hash or student_short_token_hash = v_hash)
    and expires_at > now()
    and student_moves_allowed
    and revision = p_expected_revision
  returning * into v_room;

  if not found then
    raise exception 'Student move rejected because the room is locked, stale, or access is invalid';
  end if;

  return jsonb_build_object(
    'room_code', v_room.room_code,
    'fen', v_room.fen,
    'pgn', v_room.pgn,
    'orientation', v_room.orientation,
    'last_move', v_room.last_move,
    'student_moves_allowed', v_room.student_moves_allowed,
    'revision', v_room.revision,
    'active_lesson_id', v_room.active_lesson_id,
    'annotations', v_room.annotations,
    'expires_at', v_room.expires_at
  );
end;
$$;

-- Grants ----------------------------------------------------------------------

revoke all on function public.create_live_board_room(text, text, text, text, text, text) from public;
revoke all on function public.create_live_board_room_v2(text, text, text, text, text, text, text) from public;
revoke all on function public.get_live_board_room(text, text) from public;
revoke all on function public.update_live_board_teacher(text, text, bigint, text, text, text, jsonb, boolean, text, jsonb) from public;
revoke all on function public.update_live_board_student(text, text, bigint, text, text, jsonb) from public;

grant execute on function public.create_live_board_room(text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.create_live_board_room_v2(text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.get_live_board_room(text, text) to anon, authenticated;
grant execute on function public.update_live_board_teacher(text, text, bigint, text, text, text, jsonb, boolean, text, jsonb) to anon, authenticated;
grant execute on function public.update_live_board_student(text, text, bigint, text, text, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';

commit;
