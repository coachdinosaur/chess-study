begin;

create or replace function public.audit_management_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  owner_teacher_id uuid;
  audit_target_id text;
  audit_metadata jsonb;
  student_id_value uuid;
begin
  if tg_table_name = 'managed_students' then
    owner_teacher_id := case when tg_op = 'DELETE' then old.teacher_id else new.teacher_id end;
    audit_target_id := (case when tg_op = 'DELETE' then old.id else new.id end)::text;
    audit_metadata := jsonb_build_object(
      'operation', lower(tg_op),
      'student_name', case when tg_op = 'DELETE' then old.display_name else new.display_name end,
      'archived', (case when tg_op = 'DELETE' then old.archived_at else new.archived_at end) is not null
    );
  elsif tg_table_name = 'managed_student_lesson_progress' then
    student_id_value := case when tg_op = 'DELETE' then old.student_id else new.student_id end;
    select student.teacher_id into owner_teacher_id
    from public.managed_students student
    where student.id = student_id_value;
    audit_target_id := student_id_value::text || ':' || (case when tg_op = 'DELETE' then old.lesson_key else new.lesson_key end);
    audit_metadata := jsonb_build_object(
      'operation', lower(tg_op),
      'lesson_key', case when tg_op = 'DELETE' then old.lesson_key else new.lesson_key end,
      'status', (case when tg_op = 'DELETE' then old.status else new.status end)::text
    );
  elsif tg_table_name = 'coaching_sessions' then
    owner_teacher_id := case when tg_op = 'DELETE' then old.teacher_id else new.teacher_id end;
    audit_target_id := (case when tg_op = 'DELETE' then old.id else new.id end)::text;
    audit_metadata := jsonb_build_object(
      'operation', lower(tg_op),
      'session_date', case when tg_op = 'DELETE' then old.session_date else new.session_date end,
      'lesson_key', case when tg_op = 'DELETE' then old.lesson_key else new.lesson_key end
    );
  else
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  insert into public.management_audit_log (
    actor_id,
    teacher_id,
    event_type,
    target_type,
    target_id,
    metadata
  )
  values (
    auth.uid(),
    owner_teacher_id,
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    audit_target_id,
    audit_metadata
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger audit_managed_students_change
after insert or update or delete on public.managed_students
for each row execute function public.audit_management_change();

create trigger audit_managed_student_lesson_progress_change
after insert or update or delete on public.managed_student_lesson_progress
for each row execute function public.audit_management_change();

create trigger audit_coaching_sessions_change
after insert or update or delete on public.coaching_sessions
for each row execute function public.audit_management_change();

commit;
