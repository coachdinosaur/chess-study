create extension if not exists pgcrypto;

create table if not exists public.live_board_rooms (
  id uuid primary key default gen_random_uuid(),
  room_code text not null unique check (room_code ~ '^[A-Z0-9]{6,12}$'),
  teacher_token_hash text not null,
  student_token_hash text not null,
  fen text not null,
  pgn text not null default '',
  orientation text not null default 'white' check (orientation in ('white', 'black')),
  last_move jsonb,
  student_moves_allowed boolean not null default true,
  revision bigint not null default 0 check (revision >= 0),
  active_lesson_id text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '12 hours')
);

alter table public.live_board_rooms enable row level security;
revoke all on table public.live_board_rooms from anon, authenticated;

create or replace function public.create_live_board_room(
  p_room_code text,
  p_teacher_token text,
  p_student_token text,
  p_fen text,
  p_pgn text default '',
  p_orientation text default 'white'
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
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
    room_code, teacher_token_hash, student_token_hash, fen, pgn, orientation
  ) values (
    p_room_code,
    encode(digest(p_teacher_token, 'sha256'), 'hex'),
    encode(digest(p_student_token, 'sha256'), 'hex'),
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
    'expires_at', v_room.expires_at
  );
exception
  when unique_violation then
    raise exception 'Room code already exists';
end;
$$;

create or replace function public.get_live_board_room(
  p_room_code text,
  p_access_token text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
stable
as $$
declare
  v_room public.live_board_rooms;
  v_hash text;
begin
  v_hash := encode(digest(coalesce(p_access_token, ''), 'sha256'), 'hex');

  select * into v_room
  from public.live_board_rooms
  where room_code = p_room_code
    and expires_at > now()
    and (teacher_token_hash = v_hash or student_token_hash = v_hash);

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
    'expires_at', v_room.expires_at
  );
end;
$$;

create or replace function public.update_live_board_teacher(
  p_room_code text,
  p_teacher_token text,
  p_expected_revision bigint,
  p_fen text,
  p_pgn text,
  p_orientation text,
  p_last_move jsonb,
  p_student_moves_allowed boolean,
  p_active_lesson_id text default ''
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_room public.live_board_rooms;
  v_hash text;
begin
  v_hash := encode(digest(coalesce(p_teacher_token, ''), 'sha256'), 'hex');
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
    'expires_at', v_room.expires_at
  );
end;
$$;

create or replace function public.update_live_board_student(
  p_room_code text,
  p_student_token text,
  p_expected_revision bigint,
  p_fen text,
  p_pgn text,
  p_last_move jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_room public.live_board_rooms;
  v_hash text;
begin
  v_hash := encode(digest(coalesce(p_student_token, ''), 'sha256'), 'hex');

  update public.live_board_rooms
  set fen = p_fen,
      pgn = coalesce(p_pgn, ''),
      last_move = p_last_move,
      revision = revision + 1,
      updated_at = now(),
      expires_at = greatest(expires_at, now() + interval '12 hours')
  where room_code = p_room_code
    and student_token_hash = v_hash
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
    'expires_at', v_room.expires_at
  );
end;
$$;

revoke all on function public.create_live_board_room(text, text, text, text, text, text) from public;
revoke all on function public.get_live_board_room(text, text) from public;
revoke all on function public.update_live_board_teacher(text, text, bigint, text, text, text, jsonb, boolean, text) from public;
revoke all on function public.update_live_board_student(text, text, bigint, text, text, jsonb) from public;

grant execute on function public.create_live_board_room(text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.get_live_board_room(text, text) to anon, authenticated;
grant execute on function public.update_live_board_teacher(text, text, bigint, text, text, text, jsonb, boolean, text) to anon, authenticated;
grant execute on function public.update_live_board_student(text, text, bigint, text, text, jsonb) to anon, authenticated;
