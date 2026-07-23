begin;

create table public.coaching_sessions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.managed_students(id) on delete cascade,
  session_date date not null default current_date,
  duration_minutes integer check (duration_minutes is null or duration_minutes between 0 and 600),
  lesson_key text check (lesson_key is null or char_length(lesson_key) <= 300),
  lesson_title text not null default '' check (char_length(lesson_title) <= 240),
  lesson_url text,
  notes text not null default '' check (char_length(notes) <= 8000),
  homework text not null default '' check (char_length(homework) <= 4000),
  next_step text not null default '' check (char_length(next_step) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index coaching_sessions_teacher_id_idx on public.coaching_sessions(teacher_id);
create index coaching_sessions_student_date_idx on public.coaching_sessions(student_id, session_date desc);

create trigger coaching_sessions_touch_updated_at
before update on public.coaching_sessions
for each row execute function public.touch_updated_at();

alter table public.coaching_sessions enable row level security;
grant select, insert, update, delete on public.coaching_sessions to authenticated;

create policy coaching_sessions_teacher_select
on public.coaching_sessions for select
to authenticated
using (
  teacher_id = auth.uid()
  and exists (
    select 1 from public.managed_students student
    where student.id = coaching_sessions.student_id
      and student.teacher_id = auth.uid()
  )
);

create policy coaching_sessions_teacher_insert
on public.coaching_sessions for insert
to authenticated
with check (
  teacher_id = auth.uid()
  and private.is_teacher()
  and exists (
    select 1 from public.managed_students student
    where student.id = coaching_sessions.student_id
      and student.teacher_id = auth.uid()
  )
);

create policy coaching_sessions_teacher_update
on public.coaching_sessions for update
to authenticated
using (
  teacher_id = auth.uid()
  and exists (
    select 1 from public.managed_students student
    where student.id = coaching_sessions.student_id
      and student.teacher_id = auth.uid()
  )
)
with check (
  teacher_id = auth.uid()
  and private.is_teacher()
  and exists (
    select 1 from public.managed_students student
    where student.id = coaching_sessions.student_id
      and student.teacher_id = auth.uid()
  )
);

create policy coaching_sessions_teacher_delete
on public.coaching_sessions for delete
to authenticated
using (
  teacher_id = auth.uid()
  and exists (
    select 1 from public.managed_students student
    where student.id = coaching_sessions.student_id
      and student.teacher_id = auth.uid()
  )
);

commit;
