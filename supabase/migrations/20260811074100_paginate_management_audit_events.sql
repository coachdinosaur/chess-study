begin;

drop function if exists public.admin_list_audit_log(integer);

create function public.admin_list_audit_log(
  p_limit integer default 25,
  p_before_created_at timestamptz default null,
  p_before_id bigint default null
)
returns table (
  audit_id bigint,
  created_at timestamptz,
  event_type text,
  target_type text,
  target_id text,
  actor_display_name text,
  teacher_display_name text,
  metadata jsonb
)
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 25), 500));
begin
  if auth.uid() is null or not private.is_platform_admin() then
    raise exception 'Platform administrator access is required.';
  end if;

  if (p_before_created_at is null) <> (p_before_id is null) then
    raise exception 'The audit pagination cursor is incomplete.';
  end if;

  return query
  select
    audit.id,
    audit.created_at,
    audit.event_type,
    audit.target_type,
    audit.target_id,
    actor.display_name,
    teacher.display_name,
    audit.metadata
  from public.management_audit_log audit
  left join public.profiles actor on actor.id = audit.actor_id
  left join public.profiles teacher on teacher.id = audit.teacher_id
  where p_before_created_at is null
     or (audit.created_at, audit.id) < (p_before_created_at, p_before_id)
  order by audit.created_at desc, audit.id desc
  limit v_limit;
end;
$$;

comment on function public.admin_list_audit_log(integer, timestamptz, bigint) is
  'Lists management audit events newest first using a stable created-at/id cursor.';

revoke all on function public.admin_list_audit_log(integer, timestamptz, bigint)
  from public, anon, authenticated;
grant execute on function public.admin_list_audit_log(integer, timestamptz, bigint)
  to authenticated;

drop index if exists public.management_audit_log_created_at_idx;
create index management_audit_log_created_at_idx
  on public.management_audit_log(created_at desc, id desc);

commit;
