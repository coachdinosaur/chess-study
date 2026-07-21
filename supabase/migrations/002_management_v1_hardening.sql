begin;

drop policy if exists teacher_feedback_insert_teacher on public.teacher_feedback;
drop policy if exists teacher_feedback_update_teacher on public.teacher_feedback;

create policy teacher_feedback_insert_teacher
on public.teacher_feedback
for insert
to authenticated
with check (
  teacher_id = auth.uid()
  and exists (
    select 1
    from public.assignments a
    join public.class_members cm
      on cm.class_id = a.class_id
     and cm.student_id = teacher_feedback.student_id
     and cm.status = 'active'
    where a.id = teacher_feedback.assignment_id
      and private.is_teacher_of_class(a.class_id)
  )
);

create policy teacher_feedback_update_teacher
on public.teacher_feedback
for update
to authenticated
using (
  teacher_id = auth.uid()
  and exists (
    select 1
    from public.assignments a
    join public.class_members cm
      on cm.class_id = a.class_id
     and cm.student_id = teacher_feedback.student_id
     and cm.status = 'active'
    where a.id = teacher_feedback.assignment_id
      and private.is_teacher_of_class(a.class_id)
  )
)
with check (
  teacher_id = auth.uid()
  and exists (
    select 1
    from public.assignments a
    join public.class_members cm
      on cm.class_id = a.class_id
     and cm.student_id = teacher_feedback.student_id
     and cm.status = 'active'
    where a.id = teacher_feedback.assignment_id
      and private.is_teacher_of_class(a.class_id)
  )
);

commit;
