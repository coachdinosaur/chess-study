begin;

create type public.teacher_lesson_status as enum (
  'not_started',
  'taught',
  'practicing',
  'completed'
);

create table public.managed_students (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 80),
  notes text not null default '' check (char_length(notes) <= 4000),
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.managed_student_lesson_progress (
  student_id uuid not null references public.managed_students(id) on delete cascade,
  lesson_key text not null check (char_length(lesson_key) between 1 and 300),
  lesson_title text not null check (char_length(lesson_title) between 1 and 240),
  lesson_level text not null check (char_length(lesson_level) between 1 and 80),
  lesson_module text not null default '' check (char_length(lesson_module) <= 160),
  lesson_url text,
  status public.teacher_lesson_status not null default 'not_started',
  teacher_notes text not null default '' check (char_length(teacher_notes) <= 4000),
  taught_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (student_id, lesson_key)
);

create index managed_students_teacher_id_idx on public.managed_students(teacher_id);
create index managed_student_progress_student_id_idx on public.managed_student_lesson_progress(student_id);
create index managed_student_progress_status_idx on public.managed_student_lesson_progress(status);

create trigger managed_student_lesson_progress_touch_updated_at
before update on public.managed_student_lesson_progress
for each row execute function public.touch_updated_at();

alter table public.managed_students enable row level security;
alter table public.managed_student_lesson_progress enable row level security;

grant select, insert, update, delete on public.managed_students to authenticated;
grant select, insert, update, delete on public.managed_student_lesson_progress to authenticated;

create policy managed_students_teacher_select
on public.managed_students for select
to authenticated
using (teacher_id = auth.uid());

create policy managed_students_teacher_insert
on public.managed_students for insert
to authenticated
with check (teacher_id = auth.uid() and private.is_teacher());

create policy managed_students_teacher_update
on public.managed_students for update
to authenticated
using (teacher_id = auth.uid())
with check (teacher_id = auth.uid() and private.is_teacher());

create policy managed_students_teacher_delete
on public.managed_students for delete
to authenticated
using (teacher_id = auth.uid());

create policy managed_student_progress_teacher_select
on public.managed_student_lesson_progress for select
to authenticated
using (
  exists (
    select 1 from public.managed_students student
    where student.id = managed_student_lesson_progress.student_id
      and student.teacher_id = auth.uid()
  )
);

create policy managed_student_progress_teacher_insert
on public.managed_student_lesson_progress for insert
to authenticated
with check (
  exists (
    select 1 from public.managed_students student
    where student.id = managed_student_lesson_progress.student_id
      and student.teacher_id = auth.uid()
  )
);

create policy managed_student_progress_teacher_update
on public.managed_student_lesson_progress for update
to authenticated
using (
  exists (
    select 1 from public.managed_students student
    where student.id = managed_student_lesson_progress.student_id
      and student.teacher_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.managed_students student
    where student.id = managed_student_lesson_progress.student_id
      and student.teacher_id = auth.uid()
  )
);

create policy managed_student_progress_teacher_delete
on public.managed_student_lesson_progress for delete
to authenticated
using (
  exists (
    select 1 from public.managed_students student
    where student.id = managed_student_lesson_progress.student_id
      and student.teacher_id = auth.uid()
  )
);

commit;
