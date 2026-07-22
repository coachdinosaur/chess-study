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
  class_id uuid not null references public.classes(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 80),
  notes text not null default '' check (char_length(notes) <= 4000),
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.managed_student_lesson_progress (
  student_id uuid not null references public.managed_students(id) on delete cascade,
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  status public.teacher_lesson_status not null default 'not_started',
  teacher_notes text not null default '' check (char_length(teacher_notes) <= 4000),
  taught_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (student_id, assignment_id)
);

create index managed_students_teacher_id_idx on public.managed_students(teacher_id);
create index managed_students_class_id_idx on public.managed_students(class_id);
create index managed_student_progress_assignment_idx on public.managed_student_lesson_progress(assignment_id);

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
with check (
  teacher_id = auth.uid()
  and private.is_teacher_of_class(class_id)
);

create policy managed_students_teacher_update
on public.managed_students for update
to authenticated
using (teacher_id = auth.uid())
with check (
  teacher_id = auth.uid()
  and private.is_teacher_of_class(class_id)
);

create policy managed_students_teacher_delete
on public.managed_students for delete
to authenticated
using (teacher_id = auth.uid());

create policy managed_student_progress_teacher_select
on public.managed_student_lesson_progress for select
to authenticated
using (
  exists (
    select 1
    from public.managed_students student
    join public.assignments assignment on assignment.id = managed_student_lesson_progress.assignment_id
    where student.id = managed_student_lesson_progress.student_id
      and student.teacher_id = auth.uid()
      and assignment.class_id = student.class_id
  )
);

create policy managed_student_progress_teacher_insert
on public.managed_student_lesson_progress for insert
to authenticated
with check (
  exists (
    select 1
    from public.managed_students student
    join public.assignments assignment on assignment.id = managed_student_lesson_progress.assignment_id
    where student.id = managed_student_lesson_progress.student_id
      and student.teacher_id = auth.uid()
      and assignment.class_id = student.class_id
  )
);

create policy managed_student_progress_teacher_update
on public.managed_student_lesson_progress for update
to authenticated
using (
  exists (
    select 1
    from public.managed_students student
    join public.assignments assignment on assignment.id = managed_student_lesson_progress.assignment_id
    where student.id = managed_student_lesson_progress.student_id
      and student.teacher_id = auth.uid()
      and assignment.class_id = student.class_id
  )
)
with check (
  exists (
    select 1
    from public.managed_students student
    join public.assignments assignment on assignment.id = managed_student_lesson_progress.assignment_id
    where student.id = managed_student_lesson_progress.student_id
      and student.teacher_id = auth.uid()
      and assignment.class_id = student.class_id
  )
);

create policy managed_student_progress_teacher_delete
on public.managed_student_lesson_progress for delete
to authenticated
using (
  exists (
    select 1
    from public.managed_students student
    where student.id = managed_student_lesson_progress.student_id
      and student.teacher_id = auth.uid()
  )
);

commit;
