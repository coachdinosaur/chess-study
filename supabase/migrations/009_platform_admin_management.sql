begin;

create or replace function public.admin_set_platform_admin(
  p_teacher_id uuid,
  p_is_admin boolean
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  admin_count bigint;
begin
  if auth.uid() is null or not private.is_platform_admin() then
    raise exception 'Platform administrator access is required.';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    join public.teacher_account_controls control on control.teacher_id = profile.id
    where profile.id = p_teacher_id
      and profile.role = 'teacher'
      and control.status = 'approved'
  ) then
    raise exception 'Only an approved teacher can be a platform administrator.';
  end if;

  if p_is_admin then
    insert into public.platform_admins (user_id, created_by)
    values (p_teacher_id, auth.uid())
    on conflict (user_id) do nothing;
  else
    select count(*) into admin_count from public.platform_admins;
    if admin_count <= 1 then
      raise exception 'The final platform administrator cannot be removed.';
    end if;
    delete from public.platform_admins where user_id = p_teacher_id;
    if not found then
      raise exception 'That teacher is not a platform administrator.';
    end if;
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
    p_teacher_id,
    case when p_is_admin then 'teacher.admin_granted' else 'teacher.admin_removed' end,
    'platform_admin',
    p_teacher_id::text,
    jsonb_build_object('is_admin', p_is_admin)
  );
end;
$$;

revoke all on function public.admin_set_platform_admin(uuid, boolean) from public;
grant execute on function public.admin_set_platform_admin(uuid, boolean) to authenticated;

commit;
