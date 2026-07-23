begin;

-- Require an approved teacher account on the current teacher-owned tables.
drop policy if exists managed_students_teacher_select on public.managed_students;
create policy managed_students_teacher_select
on public.managed_students for select
to authenticated
using (teacher_id = auth.uid() and private.is_teacher());

drop policy if exists managed_students_teacher_insert on public.managed_students;
create policy managed_students_teacher_insert
on public.managed_students for insert
to authenticated
with check (teacher_id = auth.uid() and private.is_teacher());

drop policy if exists managed_students_teacher_update on public.managed_students;
create policy managed_students_teacher_update
on public.managed_students for update
to authenticated
using (teacher_id = auth.uid() and private.is_teacher())
with check (teacher_id = auth.uid() and private.is_teacher());

drop policy if exists managed_students_teacher_delete on public.managed_students;
create policy managed_students_teacher_delete
on public.managed_students for delete
to authenticated
using (teacher_id = auth.uid() and private.is_teacher());

drop policy if exists managed_student_progress_teacher_select on public.managed_student_lesson_progress;
create policy managed_student_progress_teacher_select
on public.managed_student_lesson_progress for select
to authenticated
using (
  private.is_teacher()
  and exists (
    select 1 from public.managed_students student
    where student.id = managed_student_lesson_progress.student_id
      and student.teacher_id = auth.uid()
  )
);

drop policy if exists managed_student_progress_teacher_insert on public.managed_student_lesson_progress;
create policy managed_student_progress_teacher_insert
on public.managed_student_lesson_progress for insert
to authenticated
with check (
  private.is_teacher()
  and exists (
    select 1 from public.managed_students student
    where student.id = managed_student_lesson_progress.student_id
      and student.teacher_id = auth.uid()
  )
);

drop policy if exists managed_student_progress_teacher_update on public.managed_student_lesson_progress;
create policy managed_student_progress_teacher_update
on public.managed_student_lesson_progress for update
to authenticated
using (
  private.is_teacher()
  and exists (
    select 1 from public.managed_students student
    where student.id = managed_student_lesson_progress.student_id
      and student.teacher_id = auth.uid()
  )
)
with check (
  private.is_teacher()
  and exists (
    select 1 from public.managed_students student
    where student.id = managed_student_lesson_progress.student_id
      and student.teacher_id = auth.uid()
  )
);

drop policy if exists managed_student_progress_teacher_delete on public.managed_student_lesson_progress;
create policy managed_student_progress_teacher_delete
on public.managed_student_lesson_progress for delete
to authenticated
using (
  private.is_teacher()
  and exists (
    select 1 from public.managed_students student
    where student.id = managed_student_lesson_progress.student_id
      and student.teacher_id = auth.uid()
  )
);

drop policy if exists coaching_sessions_teacher_select on public.coaching_sessions;
create policy coaching_sessions_teacher_select
on public.coaching_sessions for select
to authenticated
using (
  private.is_teacher()
  and teacher_id = auth.uid()
  and exists (
    select 1 from public.managed_students student
    where student.id = coaching_sessions.student_id
      and student.teacher_id = auth.uid()
  )
);

drop policy if exists coaching_sessions_teacher_insert on public.coaching_sessions;
create policy coaching_sessions_teacher_insert
on public.coaching_sessions for insert
to authenticated
with check (
  private.is_teacher()
  and teacher_id = auth.uid()
  and exists (
    select 1 from public.managed_students student
    where student.id = coaching_sessions.student_id
      and student.teacher_id = auth.uid()
  )
);

drop policy if exists coaching_sessions_teacher_update on public.coaching_sessions;
create policy coaching_sessions_teacher_update
on public.coaching_sessions for update
to authenticated
using (
  private.is_teacher()
  and teacher_id = auth.uid()
  and exists (
    select 1 from public.managed_students student
    where student.id = coaching_sessions.student_id
      and student.teacher_id = auth.uid()
  )
)
with check (
  private.is_teacher()
  and teacher_id = auth.uid()
  and exists (
    select 1 from public.managed_students student
    where student.id = coaching_sessions.student_id
      and student.teacher_id = auth.uid()
  )
);

drop policy if exists coaching_sessions_teacher_delete on public.coaching_sessions;
create policy coaching_sessions_teacher_delete
on public.coaching_sessions for delete
to authenticated
using (
  private.is_teacher()
  and teacher_id = auth.uid()
  and exists (
    select 1 from public.managed_students student
    where student.id = coaching_sessions.student_id
      and student.teacher_id = auth.uid()
  )
);

-- Retired V1 tables remain migration-safe, but suspended teachers lose write access there too.
drop policy if exists classes_select_allowed on public.classes;
create policy classes_select_allowed
on public.classes for select
to authenticated
using (
  (teacher_id = auth.uid() and private.is_teacher())
  or private.is_active_member(id)
);

drop policy if exists classes_update_teacher on public.classes;
create policy classes_update_teacher
on public.classes for update
to authenticated
using (teacher_id = auth.uid() and private.is_teacher())
with check (teacher_id = auth.uid() and private.is_teacher());

drop policy if exists classes_delete_teacher on public.classes;
create policy classes_delete_teacher
on public.classes for delete
to authenticated
using (teacher_id = auth.uid() and private.is_teacher());

drop policy if exists teacher_feedback_select_allowed on public.teacher_feedback;
create policy teacher_feedback_select_allowed
on public.teacher_feedback for select
to authenticated
using (
  student_id = auth.uid()
  or (teacher_id = auth.uid() and private.is_teacher())
);

drop policy if exists teacher_feedback_update_teacher on public.teacher_feedback;
create policy teacher_feedback_update_teacher
on public.teacher_feedback for update
to authenticated
using (teacher_id = auth.uid() and private.is_teacher())
with check (teacher_id = auth.uid() and private.is_teacher());

drop policy if exists teacher_feedback_delete_teacher on public.teacher_feedback;
create policy teacher_feedback_delete_teacher
on public.teacher_feedback for delete
to authenticated
using (teacher_id = auth.uid() and private.is_teacher());

commit;
