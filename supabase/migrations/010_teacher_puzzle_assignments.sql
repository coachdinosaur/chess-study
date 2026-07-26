begin;

alter table public.managed_students
  add column if not exists puzzle_level text not null default 'advanced_beginner',
  add column if not exists target_rating integer not null default 1100;

alter table public.managed_students
  drop constraint if exists managed_students_puzzle_level_check,
  add constraint managed_students_puzzle_level_check
    check (puzzle_level in ('new_learner','beginner','advanced_beginner','intermediate','upper_intermediate','advanced','custom')),
  drop constraint if exists managed_students_target_rating_check,
  add constraint managed_students_target_rating_check
    check (target_rating between 400 and 3000);

create table if not exists public.puzzle_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  instructions text not null default '' check (char_length(instructions) <= 4000),
  level text not null check (level in ('new_learner','beginner','advanced_beginner','intermediate','upper_intermediate','advanced','custom')),
  min_rating integer not null check (min_rating between 400 and 3000),
  max_rating integer not null check (max_rating between 400 and 3000 and max_rating >= min_rating),
  theme_filters text[] not null default '{}',
  puzzle_count integer not null check (puzzle_count between 1 and 30),
  allow_hints boolean not null default true,
  max_hint_level integer not null default 2 check (max_hint_level between 0 and 4),
  allow_retry boolean not null default true,
  passing_score integer not null default 70 check (passing_score between 0 and 100),
  due_at timestamptz,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.puzzle_assignment_puzzles (
  assignment_id uuid not null references public.puzzle_assignments(id) on delete cascade,
  puzzle_id text not null check (char_length(puzzle_id) between 1 and 80),
  position_number integer not null check (position_number between 1 and 30),
  puzzle_snapshot jsonb not null,
  primary key (assignment_id, position_number),
  unique (assignment_id, puzzle_id)
);

create table if not exists public.puzzle_assignment_students (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.puzzle_assignments(id) on delete cascade,
  student_id uuid not null references public.managed_students(id) on delete cascade,
  access_token_hash text not null unique check (access_token_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'not_started' check (status in ('not_started','started','completed')),
  current_index integer not null default 0 check (current_index between 0 and 30),
  score integer not null default 0 check (score between 0 and 100),
  started_at timestamptz,
  completed_at timestamptz,
  last_opened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);

create table if not exists public.puzzle_assignment_attempts (
  id uuid primary key default gen_random_uuid(),
  student_assignment_id uuid not null references public.puzzle_assignment_students(id) on delete cascade,
  puzzle_id text not null check (char_length(puzzle_id) between 1 and 80),
  position_number integer not null check (position_number between 1 and 30),
  finished boolean not null default false,
  solved boolean not null default false,
  first_attempt boolean not null default false,
  mistakes integer not null default 0 check (mistakes between 0 and 100),
  hints_used integer not null default 0 check (hints_used between 0 and 4),
  elapsed_seconds integer not null default 0 check (elapsed_seconds between 0 and 86400),
  last_move_san text not null default '' check (char_length(last_move_san) <= 40),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_assignment_id, puzzle_id)
);

create index if not exists puzzle_assignments_teacher_created_idx
  on public.puzzle_assignments (teacher_id, created_at desc);
create index if not exists puzzle_assignment_students_assignment_idx
  on public.puzzle_assignment_students (assignment_id, status);
create index if not exists puzzle_assignment_students_student_idx
  on public.puzzle_assignment_students (student_id, created_at desc);
create index if not exists puzzle_assignment_attempts_student_assignment_idx
  on public.puzzle_assignment_attempts (student_assignment_id, position_number);

alter table public.puzzle_assignments enable row level security;
alter table public.puzzle_assignment_puzzles enable row level security;
alter table public.puzzle_assignment_students enable row level security;
alter table public.puzzle_assignment_attempts enable row level security;

drop policy if exists puzzle_assignments_teacher_select on public.puzzle_assignments;
create policy puzzle_assignments_teacher_select on public.puzzle_assignments
  for select to authenticated
  using (teacher_id = (select auth.uid()) and private.is_teacher());

drop policy if exists puzzle_assignments_teacher_insert on public.puzzle_assignments;
create policy puzzle_assignments_teacher_insert on public.puzzle_assignments
  for insert to authenticated
  with check (teacher_id = (select auth.uid()) and private.is_teacher());

drop policy if exists puzzle_assignments_teacher_update on public.puzzle_assignments;
create policy puzzle_assignments_teacher_update on public.puzzle_assignments
  for update to authenticated
  using (teacher_id = (select auth.uid()) and private.is_teacher())
  with check (teacher_id = (select auth.uid()) and private.is_teacher());

drop policy if exists puzzle_assignments_teacher_delete on public.puzzle_assignments;
create policy puzzle_assignments_teacher_delete on public.puzzle_assignments
  for delete to authenticated
  using (teacher_id = (select auth.uid()) and private.is_teacher());

drop policy if exists puzzle_assignment_puzzles_teacher_all on public.puzzle_assignment_puzzles;
create policy puzzle_assignment_puzzles_teacher_all on public.puzzle_assignment_puzzles
  for all to authenticated
  using (exists (
    select 1 from public.puzzle_assignments a
    where a.id = assignment_id and a.teacher_id = (select auth.uid()) and private.is_teacher()
  ))
  with check (exists (
    select 1 from public.puzzle_assignments a
    where a.id = assignment_id and a.teacher_id = (select auth.uid()) and private.is_teacher()
  ));

drop policy if exists puzzle_assignment_students_teacher_all on public.puzzle_assignment_students;
create policy puzzle_assignment_students_teacher_all on public.puzzle_assignment_students
  for all to authenticated
  using (exists (
    select 1 from public.puzzle_assignments a
    where a.id = assignment_id and a.teacher_id = (select auth.uid()) and private.is_teacher()
  ))
  with check (
    exists (
      select 1 from public.puzzle_assignments a
      where a.id = assignment_id and a.teacher_id = (select auth.uid()) and private.is_teacher()
    )
    and exists (
      select 1 from public.managed_students s
      where s.id = student_id and s.teacher_id = (select auth.uid())
    )
  );

drop policy if exists puzzle_assignment_attempts_teacher_select on public.puzzle_assignment_attempts;
create policy puzzle_assignment_attempts_teacher_select on public.puzzle_assignment_attempts
  for select to authenticated
  using (exists (
    select 1
    from public.puzzle_assignment_students pas
    join public.puzzle_assignments a on a.id = pas.assignment_id
    where pas.id = student_assignment_id
      and a.teacher_id = (select auth.uid())
      and private.is_teacher()
  ));

revoke all on public.puzzle_assignments from anon;
revoke all on public.puzzle_assignment_puzzles from anon;
revoke all on public.puzzle_assignment_students from anon;
revoke all on public.puzzle_assignment_attempts from anon;
grant select, insert, update, delete on public.puzzle_assignments to authenticated;
grant select, insert, update, delete on public.puzzle_assignment_puzzles to authenticated;
grant select, insert, update, delete on public.puzzle_assignment_students to authenticated;
grant select on public.puzzle_assignment_attempts to authenticated;

drop trigger if exists puzzle_assignments_touch_updated_at on public.puzzle_assignments;
create trigger puzzle_assignments_touch_updated_at
before update on public.puzzle_assignments
for each row execute function public.touch_updated_at();

drop trigger if exists puzzle_assignment_students_touch_updated_at on public.puzzle_assignment_students;
create trigger puzzle_assignment_students_touch_updated_at
before update on public.puzzle_assignment_students
for each row execute function public.touch_updated_at();

drop trigger if exists puzzle_assignment_attempts_touch_updated_at on public.puzzle_assignment_attempts;
create trigger puzzle_assignment_attempts_touch_updated_at
before update on public.puzzle_assignment_attempts
for each row execute function public.touch_updated_at();

create or replace function public.create_puzzle_assignment(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
declare
  v_teacher_id uuid := auth.uid();
  v_assignment_id uuid;
  v_title text := btrim(coalesce(p_payload->>'title', ''));
  v_instructions text := btrim(coalesce(p_payload->>'instructions', ''));
  v_level text := coalesce(p_payload->>'level', 'advanced_beginner');
  v_min_rating integer := coalesce((p_payload->>'min_rating')::integer, 850);
  v_max_rating integer := coalesce((p_payload->>'max_rating')::integer, 1300);
  v_puzzle_count integer := jsonb_array_length(coalesce(p_payload->'puzzles', '[]'::jsonb));
  v_students_count integer := jsonb_array_length(coalesce(p_payload->'students', '[]'::jsonb));
  v_row jsonb;
  v_position integer := 0;
  v_student_id uuid;
  v_token_hash text;
begin
  if v_teacher_id is null or not private.is_teacher() then
    raise exception 'Teacher authentication is required.';
  end if;
  if char_length(v_title) < 1 or char_length(v_title) > 160 then
    raise exception 'Assignment title must be 1 to 160 characters.';
  end if;
  if char_length(v_instructions) > 4000 then
    raise exception 'Instructions are too long.';
  end if;
  if v_level not in ('new_learner','beginner','advanced_beginner','intermediate','upper_intermediate','advanced','custom') then
    raise exception 'Invalid assignment level.';
  end if;
  if v_min_rating < 400 or v_max_rating > 3000 or v_min_rating > v_max_rating then
    raise exception 'Invalid puzzle rating range.';
  end if;
  if v_puzzle_count < 1 or v_puzzle_count > 30 then
    raise exception 'Assignments must contain 1 to 30 puzzles.';
  end if;
  if v_students_count < 1 or v_students_count > 100 then
    raise exception 'Select 1 to 100 students.';
  end if;

  insert into public.puzzle_assignments (
    teacher_id, title, instructions, level, min_rating, max_rating, theme_filters,
    puzzle_count, allow_hints, max_hint_level, allow_retry, passing_score,
    due_at, status, published_at
  ) values (
    v_teacher_id,
    v_title,
    v_instructions,
    v_level,
    v_min_rating,
    v_max_rating,
    coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'themes', '[]'::jsonb))), array[]::text[]),
    v_puzzle_count,
    coalesce((p_payload->>'allow_hints')::boolean, true),
    greatest(0, least(4, coalesce((p_payload->>'max_hint_level')::integer, 2))),
    coalesce((p_payload->>'allow_retry')::boolean, true),
    greatest(0, least(100, coalesce((p_payload->>'passing_score')::integer, 70))),
    nullif(p_payload->>'due_at', '')::timestamptz,
    'published',
    now()
  ) returning id into v_assignment_id;

  for v_row in select value from jsonb_array_elements(p_payload->'puzzles')
  loop
    v_position := v_position + 1;
    if btrim(coalesce(v_row->>'id', '')) = '' or jsonb_typeof(v_row->'snapshot') is distinct from 'object' then
      raise exception 'Every puzzle needs an ID and snapshot.';
    end if;
    insert into public.puzzle_assignment_puzzles (
      assignment_id, puzzle_id, position_number, puzzle_snapshot
    ) values (
      v_assignment_id, v_row->>'id', v_position, v_row->'snapshot'
    );
  end loop;

  for v_row in select value from jsonb_array_elements(p_payload->'students')
  loop
    v_student_id := (v_row->>'student_id')::uuid;
    v_token_hash := lower(coalesce(v_row->>'token_hash', ''));
    if v_token_hash !~ '^[0-9a-f]{64}$' then
      raise exception 'Invalid student access token hash.';
    end if;
    if not exists (
      select 1 from public.managed_students s
      where s.id = v_student_id and s.teacher_id = v_teacher_id and s.archived_at is null
    ) then
      raise exception 'One selected student is not active or does not belong to this teacher.';
    end if;
    insert into public.puzzle_assignment_students (
      assignment_id, student_id, access_token_hash
    ) values (
      v_assignment_id, v_student_id, v_token_hash
    );
  end loop;

  return jsonb_build_object(
    'assignment_id', v_assignment_id,
    'student_count', v_students_count
  );
end;
$$;

revoke all on function public.create_puzzle_assignment(jsonb) from public;
grant execute on function public.create_puzzle_assignment(jsonb) to authenticated;

create or replace function public.get_puzzle_assignment_by_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_hash text;
  v_student_assignment public.puzzle_assignment_students%rowtype;
  v_assignment public.puzzle_assignments%rowtype;
  v_student public.managed_students%rowtype;
  v_puzzles jsonb;
  v_attempts jsonb;
begin
  if p_token is null or char_length(p_token) < 32 or char_length(p_token) > 512 then
    raise exception 'Invalid assignment link.';
  end if;
  v_hash := encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex');

  select * into v_student_assignment
  from public.puzzle_assignment_students
  where access_token_hash = v_hash;
  if not found then raise exception 'Assignment link was not found or has been replaced.'; end if;

  select * into v_assignment
  from public.puzzle_assignments
  where id = v_student_assignment.assignment_id and status = 'published';
  if not found then raise exception 'This assignment is not currently available.'; end if;

  select * into v_student from public.managed_students where id = v_student_assignment.student_id;
  if not found or v_student.archived_at is not null then
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
      'id', p.puzzle_id,
      'position_number', p.position_number,
      'snapshot', p.puzzle_snapshot
    ) order by p.position_number
  ), '[]'::jsonb) into v_puzzles
  from public.puzzle_assignment_puzzles p
  where p.assignment_id = v_assignment.id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'puzzle_id', a.puzzle_id,
      'position_number', a.position_number,
      'finished', a.finished,
      'solved', a.solved,
      'first_attempt', a.first_attempt,
      'mistakes', a.mistakes,
      'hints_used', a.hints_used,
      'elapsed_seconds', a.elapsed_seconds,
      'last_move_san', a.last_move_san,
      'completed_at', a.completed_at
    ) order by a.position_number
  ), '[]'::jsonb) into v_attempts
  from public.puzzle_assignment_attempts a
  where a.student_assignment_id = v_student_assignment.id;

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
    'student', jsonb_build_object('id', v_student.id, 'display_name', v_student.display_name),
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

revoke all on function public.get_puzzle_assignment_by_token(text) from public;
grant execute on function public.get_puzzle_assignment_by_token(text) to anon, authenticated;

create or replace function public.save_puzzle_assignment_attempt(
  p_token text,
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
  v_student_assignment_id uuid;
  v_assignment_id uuid;
  v_total integer;
  v_finished integer;
  v_first_attempt integer;
  v_score integer;
  v_status text;
begin
  if p_token is null or char_length(p_token) < 32 or char_length(p_token) > 512 then
    raise exception 'Invalid assignment link.';
  end if;
  v_hash := encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex');

  select pas.id, pas.assignment_id
  into v_student_assignment_id, v_assignment_id
  from public.puzzle_assignment_students pas
  join public.puzzle_assignments pa on pa.id = pas.assignment_id and pa.status = 'published'
  join public.managed_students ms on ms.id = pas.student_id and ms.archived_at is null
  where pas.access_token_hash = v_hash;
  if not found then raise exception 'Assignment link was not found or is inactive.'; end if;

  if not exists (
    select 1 from public.puzzle_assignment_puzzles p
    where p.assignment_id = v_assignment_id
      and p.puzzle_id = p_puzzle_id
      and p.position_number = p_position_number
  ) then
    raise exception 'That puzzle does not belong to this assignment.';
  end if;

  insert into public.puzzle_assignment_attempts (
    student_assignment_id, puzzle_id, position_number, finished, solved, first_attempt,
    mistakes, hints_used, elapsed_seconds, last_move_san, completed_at
  ) values (
    v_student_assignment_id,
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
    last_move_san = case when excluded.last_move_san <> '' then excluded.last_move_san else public.puzzle_assignment_attempts.last_move_san end,
    completed_at = case
      when public.puzzle_assignment_attempts.solved or excluded.solved
        then coalesce(public.puzzle_assignment_attempts.completed_at, now())
      else null
    end;

  select count(*), count(*) filter (where a.finished), count(*) filter (where a.solved and a.first_attempt)
  into v_total, v_finished, v_first_attempt
  from public.puzzle_assignment_puzzles p
  left join public.puzzle_assignment_attempts a
    on a.student_assignment_id = v_student_assignment_id and a.puzzle_id = p.puzzle_id
  where p.assignment_id = v_assignment_id;

  v_score := case when v_total > 0 then round(100.0 * v_first_attempt / v_total)::integer else 0 end;
  v_status := case when v_finished >= v_total and v_total > 0 then 'completed' else 'started' end;

  update public.puzzle_assignment_students
  set status = v_status,
      current_index = greatest(current_index, least(v_total, p_position_number - 1 + case when p_finished then 1 else 0 end)),
      score = v_score,
      started_at = coalesce(started_at, now()),
      completed_at = case when v_status = 'completed' then coalesce(completed_at, now()) else null end,
      last_opened_at = now()
  where id = v_student_assignment_id;

  return jsonb_build_object(
    'status', v_status,
    'score', v_score,
    'finished', v_finished,
    'total', v_total
  );
end;
$$;

revoke all on function public.save_puzzle_assignment_attempt(text,text,integer,boolean,boolean,boolean,integer,integer,integer,text) from public;
grant execute on function public.save_puzzle_assignment_attempt(text,text,integer,boolean,boolean,boolean,integer,integer,integer,text) to anon, authenticated;

commit;
