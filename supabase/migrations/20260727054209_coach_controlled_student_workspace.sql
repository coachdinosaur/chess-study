-- Coach-controlled, account-free workspace for teacher-managed students.
begin;

create table public.student_workspaces (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null unique references public.managed_students(id) on delete cascade,
  access_token_hash text not null unique check (access_token_hash ~ '^[0-9a-f]{64}$'),
  is_published boolean not null default true,
  teacher_instructions text not null default '' check (char_length(teacher_instructions) <= 4000),
  homework text not null default '' check (char_length(homework) <= 4000),
  due_at timestamptz,
  lesson_key text check (lesson_key is null or char_length(lesson_key) <= 300),
  lesson_title text not null default '' check (char_length(lesson_title) <= 240),
  lesson_url text check (lesson_url is null or char_length(lesson_url) <= 2048),
  position_title text not null default '' check (char_length(position_title) <= 160),
  position_fen text check (position_fen is null or char_length(position_fen) <= 200),
  live_board_url text check (live_board_url is null or char_length(live_board_url) <= 2048),
  token_rotated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index student_workspaces_teacher_id_idx
  on public.student_workspaces (teacher_id);

alter table public.student_workspaces enable row level security;

create policy student_workspaces_teacher_select
on public.student_workspaces for select
to authenticated
using (
  teacher_id = (select auth.uid())
  and (select private.is_teacher())
);

create policy student_workspaces_teacher_insert
on public.student_workspaces for insert
to authenticated
with check (
  teacher_id = (select auth.uid())
  and (select private.is_teacher())
  and exists (
    select 1
    from public.managed_students student
    where student.id = student_workspaces.student_id
      and student.teacher_id = (select auth.uid())
      and student.archived_at is null
  )
);

create policy student_workspaces_teacher_update
on public.student_workspaces for update
to authenticated
using (
  teacher_id = (select auth.uid())
  and (select private.is_teacher())
)
with check (
  teacher_id = (select auth.uid())
  and (select private.is_teacher())
  and exists (
    select 1
    from public.managed_students student
    where student.id = student_workspaces.student_id
      and student.teacher_id = (select auth.uid())
      and student.archived_at is null
  )
);

create policy student_workspaces_teacher_delete
on public.student_workspaces for delete
to authenticated
using (
  teacher_id = (select auth.uid())
  and (select private.is_teacher())
);

revoke all on public.student_workspaces from anon;
grant select, insert, update, delete on public.student_workspaces to authenticated;

create trigger student_workspaces_touch_updated_at
before update on public.student_workspaces
for each row execute function public.touch_updated_at();

create or replace function public.audit_student_workspace_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_row public.student_workspaces%rowtype;
begin
  if tg_op = 'DELETE' then
    v_row := old;
  else
    v_row := new;
  end if;

  insert into public.management_audit_log (
    actor_id,
    teacher_id,
    event_type,
    target_type,
    target_id,
    metadata
  ) values (
    auth.uid(),
    v_row.teacher_id,
    'student_workspaces.' || lower(tg_op),
    'student_workspaces',
    v_row.id::text,
    jsonb_build_object(
      'operation', lower(tg_op),
      'student_id', v_row.student_id,
      'published', v_row.is_published,
      'has_lesson', v_row.lesson_key is not null,
      'has_position', v_row.position_fen is not null,
      'has_live_board', v_row.live_board_url is not null
    )
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.audit_student_workspace_change() from public, anon, authenticated;

create trigger audit_student_workspaces_change
after insert or update or delete on public.student_workspaces
for each row execute function public.audit_student_workspace_change();

create or replace function public.get_student_workspace_by_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_hash text;
  v_workspace public.student_workspaces%rowtype;
  v_student public.managed_students%rowtype;
  v_coach_name text;
  v_assignments jsonb;
begin
  if p_token is null or char_length(p_token) < 32 or char_length(p_token) > 512 then
    raise exception 'Invalid student workspace link.';
  end if;

  v_hash := encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex');

  select *
  into v_workspace
  from public.student_workspaces
  where access_token_hash = v_hash
    and is_published;
  if not found then
    raise exception 'Student workspace link was not found, is paused, or has been replaced.';
  end if;

  select *
  into v_student
  from public.managed_students
  where id = v_workspace.student_id
    and teacher_id = v_workspace.teacher_id
    and archived_at is null;
  if not found then
    raise exception 'This student workspace is no longer active.';
  end if;

  select display_name
  into v_coach_name
  from public.profiles
  where id = v_workspace.teacher_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'student_assignment_id', pas.id,
      'title', pa.title,
      'instructions', pa.instructions,
      'due_at', pa.due_at,
      'puzzle_count', pa.puzzle_count,
      'passing_score', pa.passing_score,
      'status', pas.status,
      'current_index', pas.current_index,
      'score', pas.score,
      'started_at', pas.started_at,
      'completed_at', pas.completed_at
    )
    order by pa.due_at nulls last, pa.created_at desc
  ), '[]'::jsonb)
  into v_assignments
  from public.puzzle_assignment_students pas
  join public.puzzle_assignments pa
    on pa.id = pas.assignment_id
   and pa.teacher_id = v_workspace.teacher_id
   and pa.status = 'published'
  where pas.student_id = v_student.id;

  return jsonb_build_object(
    'workspace', jsonb_build_object(
      'id', v_workspace.id,
      'teacher_instructions', v_workspace.teacher_instructions,
      'homework', v_workspace.homework,
      'due_at', v_workspace.due_at,
      'lesson_key', v_workspace.lesson_key,
      'lesson_title', v_workspace.lesson_title,
      'lesson_url', v_workspace.lesson_url,
      'position_title', v_workspace.position_title,
      'position_fen', v_workspace.position_fen,
      'live_board_url', v_workspace.live_board_url,
      'updated_at', v_workspace.updated_at
    ),
    'student', jsonb_build_object(
      'id', v_student.id,
      'display_name', v_student.display_name
    ),
    'coach', jsonb_build_object(
      'display_name', coalesce(v_coach_name, 'Your coach')
    ),
    'assignments', v_assignments
  );
end;
$$;

revoke all on function public.get_student_workspace_by_token(text) from public;
grant execute on function public.get_student_workspace_by_token(text) to anon, authenticated;

create or replace function public.get_workspace_puzzle_assignment(
  p_token text,
  p_student_assignment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_hash text;
  v_workspace public.student_workspaces%rowtype;
  v_student_assignment public.puzzle_assignment_students%rowtype;
  v_assignment public.puzzle_assignments%rowtype;
  v_student public.managed_students%rowtype;
  v_puzzles jsonb;
  v_attempts jsonb;
begin
  if p_token is null or char_length(p_token) < 32 or char_length(p_token) > 512 then
    raise exception 'Invalid student workspace link.';
  end if;
  if p_student_assignment_id is null then
    raise exception 'A puzzle assignment is required.';
  end if;

  v_hash := encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex');

  select *
  into v_workspace
  from public.student_workspaces
  where access_token_hash = v_hash
    and is_published;
  if not found then
    raise exception 'Student workspace link was not found, is paused, or has been replaced.';
  end if;

  select *
  into v_student_assignment
  from public.puzzle_assignment_students
  where id = p_student_assignment_id
    and student_id = v_workspace.student_id;
  if not found then
    raise exception 'That puzzle assignment does not belong to this student workspace.';
  end if;

  select *
  into v_assignment
  from public.puzzle_assignments
  where id = v_student_assignment.assignment_id
    and teacher_id = v_workspace.teacher_id
    and status = 'published';
  if not found then
    raise exception 'This assignment is not currently available.';
  end if;

  select *
  into v_student
  from public.managed_students
  where id = v_student_assignment.student_id
    and teacher_id = v_workspace.teacher_id
    and archived_at is null;
  if not found then
    raise exception 'This student assignment is no longer active.';
  end if;

  update public.puzzle_assignment_students
  set status = case when status = 'not_started' then 'started' else status end,
      started_at = coalesce(started_at, now()),
      last_opened_at = now()
  where id = v_student_assignment.id
  returning * into v_student_assignment;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', puzzle.puzzle_id,
      'position_number', puzzle.position_number,
      'snapshot', puzzle.puzzle_snapshot
    )
    order by puzzle.position_number
  ), '[]'::jsonb)
  into v_puzzles
  from public.puzzle_assignment_puzzles puzzle
  where puzzle.assignment_id = v_assignment.id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'puzzle_id', attempt.puzzle_id,
      'position_number', attempt.position_number,
      'finished', attempt.finished,
      'solved', attempt.solved,
      'first_attempt', attempt.first_attempt,
      'mistakes', attempt.mistakes,
      'hints_used', attempt.hints_used,
      'elapsed_seconds', attempt.elapsed_seconds,
      'last_move_san', attempt.last_move_san,
      'completed_at', attempt.completed_at
    )
    order by attempt.position_number
  ), '[]'::jsonb)
  into v_attempts
  from public.puzzle_assignment_attempts attempt
  where attempt.student_assignment_id = v_student_assignment.id;

  return jsonb_build_object(
    'assignment', jsonb_build_object(
      'id', v_assignment.id,
      'title', v_assignment.title,
      'instructions', v_assignment.instructions,
      'level', v_assignment.level,
      'min_rating', v_assignment.min_rating,
      'max_rating', v_assignment.max_rating,
      'theme_filters', v_assignment.theme_filters,
      'puzzle_count', v_assignment.puzzle_count,
      'allow_hints', v_assignment.allow_hints,
      'max_hint_level', v_assignment.max_hint_level,
      'allow_retry', v_assignment.allow_retry,
      'passing_score', v_assignment.passing_score,
      'due_at', v_assignment.due_at
    ),
    'student', jsonb_build_object(
      'id', v_student.id,
      'display_name', v_student.display_name
    ),
    'progress', jsonb_build_object(
      'status', v_student_assignment.status,
      'current_index', v_student_assignment.current_index,
      'score', v_student_assignment.score,
      'started_at', v_student_assignment.started_at,
      'completed_at', v_student_assignment.completed_at,
      'last_opened_at', v_student_assignment.last_opened_at
    ),
    'puzzles', v_puzzles,
    'attempts', v_attempts
  );
end;
$$;

revoke all on function public.get_workspace_puzzle_assignment(text,uuid) from public;
grant execute on function public.get_workspace_puzzle_assignment(text,uuid) to anon, authenticated;

create or replace function public.save_workspace_puzzle_assignment_attempt(
  p_token text,
  p_student_assignment_id uuid,
  p_puzzle_id text,
  p_position_number integer,
  p_finished boolean,
  p_solved boolean,
  p_first_attempt boolean,
  p_mistakes integer,
  p_hints_used integer,
  p_elapsed_seconds integer,
  p_last_move_san text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_hash text;
  v_workspace public.student_workspaces%rowtype;
  v_assignment_id uuid;
  v_total integer;
  v_finished integer;
  v_first_attempt integer;
  v_score integer;
  v_status text;
begin
  if p_token is null or char_length(p_token) < 32 or char_length(p_token) > 512 then
    raise exception 'Invalid student workspace link.';
  end if;
  if p_student_assignment_id is null then
    raise exception 'A puzzle assignment is required.';
  end if;

  v_hash := encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex');

  select *
  into v_workspace
  from public.student_workspaces
  where access_token_hash = v_hash
    and is_published;
  if not found then
    raise exception 'Student workspace link was not found, is paused, or has been replaced.';
  end if;

  select pas.assignment_id
  into v_assignment_id
  from public.puzzle_assignment_students pas
  join public.puzzle_assignments assignment
    on assignment.id = pas.assignment_id
   and assignment.teacher_id = v_workspace.teacher_id
   and assignment.status = 'published'
  join public.managed_students student
    on student.id = pas.student_id
   and student.teacher_id = v_workspace.teacher_id
   and student.archived_at is null
  where pas.id = p_student_assignment_id
    and pas.student_id = v_workspace.student_id;
  if not found then
    raise exception 'That puzzle assignment does not belong to this student workspace.';
  end if;

  if not exists (
    select 1
    from public.puzzle_assignment_puzzles puzzle
    where puzzle.assignment_id = v_assignment_id
      and puzzle.puzzle_id = p_puzzle_id
      and puzzle.position_number = p_position_number
  ) then
    raise exception 'That puzzle does not belong to this assignment.';
  end if;

  insert into public.puzzle_assignment_attempts (
    student_assignment_id,
    puzzle_id,
    position_number,
    finished,
    solved,
    first_attempt,
    mistakes,
    hints_used,
    elapsed_seconds,
    last_move_san,
    completed_at
  ) values (
    p_student_assignment_id,
    p_puzzle_id,
    p_position_number,
    coalesce(p_finished, false),
    coalesce(p_solved, false),
    coalesce(p_first_attempt, false) and coalesce(p_solved, false),
    greatest(0, least(100, coalesce(p_mistakes, 0))),
    greatest(0, least(4, coalesce(p_hints_used, 0))),
    greatest(0, least(86400, coalesce(p_elapsed_seconds, 0))),
    left(coalesce(p_last_move_san, ''), 40),
    case when coalesce(p_solved, false) then now() else null end
  )
  on conflict (student_assignment_id, puzzle_id) do update set
    finished = public.puzzle_assignment_attempts.finished or excluded.finished,
    solved = public.puzzle_assignment_attempts.solved or excluded.solved,
    first_attempt = public.puzzle_assignment_attempts.first_attempt or (
      excluded.first_attempt
      and greatest(public.puzzle_assignment_attempts.mistakes, excluded.mistakes) = 0
      and greatest(public.puzzle_assignment_attempts.hints_used, excluded.hints_used) = 0
    ),
    mistakes = greatest(public.puzzle_assignment_attempts.mistakes, excluded.mistakes),
    hints_used = greatest(public.puzzle_assignment_attempts.hints_used, excluded.hints_used),
    elapsed_seconds = greatest(public.puzzle_assignment_attempts.elapsed_seconds, excluded.elapsed_seconds),
    last_move_san = case
      when excluded.last_move_san <> '' then excluded.last_move_san
      else public.puzzle_assignment_attempts.last_move_san
    end,
    completed_at = case
      when public.puzzle_assignment_attempts.solved or excluded.solved
        then coalesce(public.puzzle_assignment_attempts.completed_at, now())
      else null
    end;

  select
    count(*),
    count(*) filter (where attempt.finished),
    count(*) filter (where attempt.solved and attempt.first_attempt)
  into v_total, v_finished, v_first_attempt
  from public.puzzle_assignment_puzzles puzzle
  left join public.puzzle_assignment_attempts attempt
    on attempt.student_assignment_id = p_student_assignment_id
   and attempt.puzzle_id = puzzle.puzzle_id
  where puzzle.assignment_id = v_assignment_id;

  v_score := case
    when v_total > 0 then round(100.0 * v_first_attempt / v_total)::integer
    else 0
  end;
  v_status := case
    when v_finished >= v_total and v_total > 0 then 'completed'
    else 'started'
  end;

  update public.puzzle_assignment_students
  set status = v_status,
      current_index = greatest(
        current_index,
        least(v_total, p_position_number - 1 + case when p_finished then 1 else 0 end)
      ),
      score = v_score,
      started_at = coalesce(started_at, now()),
      completed_at = case
        when v_status = 'completed' then coalesce(completed_at, now())
        else null
      end,
      last_opened_at = now()
  where id = p_student_assignment_id
    and student_id = v_workspace.student_id;

  return jsonb_build_object(
    'status', v_status,
    'score', v_score,
    'finished', v_finished,
    'total', v_total
  );
end;
$$;

revoke all on function public.save_workspace_puzzle_assignment_attempt(
  text,uuid,text,integer,boolean,boolean,boolean,integer,integer,integer,text
) from public;
grant execute on function public.save_workspace_puzzle_assignment_attempt(
  text,uuid,text,integer,boolean,boolean,boolean,integer,integer,integer,text
) to anon, authenticated;

commit;
