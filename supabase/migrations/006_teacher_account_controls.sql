begin;

create type public.teacher_account_status as enum (
  'pending',
  'approved',
  'suspended'
);

create table public.teacher_account_controls (
  teacher_id uuid primary key references public.profiles(id) on delete cascade,
  status public.teacher_account_status not null default 'pending',
  suspension_reason text not null default '' check (char_length(suspension_reason) <= 1000),
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_admins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid
);

create table public.management_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  teacher_id uuid,
  event_type text not null check (char_length(event_type) between 1 and 120),
  target_type text not null check (char_length(target_type) between 1 and 80),
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index teacher_account_controls_status_idx
  on public.teacher_account_controls(status, created_at);
create index management_audit_log_created_at_idx
  on public.management_audit_log(created_at desc);
create index management_audit_log_teacher_id_idx
  on public.management_audit_log(teacher_id, created_at desc);

create trigger teacher_account_controls_touch_updated_at
before update on public.teacher_account_controls
for each row execute function public.touch_updated_at();

insert into public.teacher_account_controls (
  teacher_id,
  status,
  reviewed_at,
  reviewed_by
)
select p.id, 'approved'::public.teacher_account_status, now(), p.id
from public.profiles p
where p.role = 'teacher'
on conflict (teacher_id) do nothing;

insert into public.platform_admins (user_id, created_by)
select p.id, p.id
from public.profiles p
where p.role = 'teacher'
order by p.created_at asc
limit 1
on conflict (user_id) do nothing;

create or replace function public.initialize_teacher_account_control()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role = 'teacher' then
    insert into public.teacher_account_controls (teacher_id, status)
    values (new.id, 'pending')
    on conflict (teacher_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger initialize_teacher_account_control_after_profile
  after insert on public.profiles
  for each row execute function public.initialize_teacher_account_control();

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.platform_admins admin
    where admin.user_id = auth.uid()
  );
$$;

create or replace function private.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles profile
    join public.teacher_account_controls control
      on control.teacher_id = profile.id
    where profile.id = auth.uid()
      and profile.role = 'teacher'
      and control.status = 'approved'
  );
$$;

create or replace function private.is_teacher_of_class(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select private.is_teacher()
    and exists (
      select 1
      from public.classes class
      where class.id = p_class_id
        and class.teacher_id = auth.uid()
    );
$$;

grant execute on function private.is_platform_admin() to authenticated;
grant execute on function private.is_teacher() to authenticated;
grant execute on function private.is_teacher_of_class(uuid) to authenticated;

alter table public.teacher_account_controls enable row level security;
alter table public.platform_admins enable row level security;
alter table public.management_audit_log enable row level security;

create policy teacher_account_controls_select_own_or_admin
on public.teacher_account_controls for select
to authenticated
using (teacher_id = auth.uid() or private.is_platform_admin());

create policy platform_admins_select_own_or_admin
on public.platform_admins for select
to authenticated
using (user_id = auth.uid() or private.is_platform_admin());

create policy management_audit_log_admin_select
on public.management_audit_log for select
to authenticated
using (private.is_platform_admin());

grant select on public.teacher_account_controls to authenticated;
grant select on public.platform_admins to authenticated;
grant select on public.management_audit_log to authenticated;

create or replace function public.admin_list_teachers()
returns table (
  teacher_id uuid,
  display_name text,
  email text,
  account_status text,
  suspension_reason text,
  created_at timestamptz,
  reviewed_at timestamptz,
  is_admin boolean,
  active_students bigint,
  archived_students bigint,
  coaching_session_count bigint
)
language plpgsql
security definer
set search_path = public, auth, private, pg_temp
as $$
begin
  if auth.uid() is null or not private.is_platform_admin() then
    raise exception 'Platform administrator access is required.';
  end if;

  return query
  select
    profile.id,
    profile.display_name,
    user_record.email::text,
    coalesce(control.status, 'pending'::public.teacher_account_status)::text,
    coalesce(control.suspension_reason, ''),
    profile.created_at,
    control.reviewed_at,
    exists (
      select 1 from public.platform_admins admin where admin.user_id = profile.id
    ),
    (
      select count(*)
      from public.managed_students student
      where student.teacher_id = profile.id and student.archived_at is null
    ),
    (
      select count(*)
      from public.managed_students student
      where student.teacher_id = profile.id and student.archived_at is not null
    ),
    (
      select count(*)
      from public.coaching_sessions session_row
      where session_row.teacher_id = profile.id
    )
  from public.profiles profile
  join auth.users user_record on user_record.id = profile.id
  left join public.teacher_account_controls control on control.teacher_id = profile.id
  where profile.role = 'teacher'
  order by profile.created_at asc;
end;
$$;

create or replace function public.admin_set_teacher_status(
  p_teacher_id uuid,
  p_status text,
  p_reason text default ''
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  normalized_status public.teacher_account_status;
  normalized_reason text;
begin
  if auth.uid() is null or not private.is_platform_admin() then
    raise exception 'Platform administrator access is required.';
  end if;

  if p_status not in ('pending', 'approved', 'suspended') then
    raise exception 'Unknown teacher account status.';
  end if;
  normalized_status := p_status::public.teacher_account_status;
  normalized_reason := left(trim(coalesce(p_reason, '')), 1000);

  if not exists (
    select 1 from public.profiles profile
    where profile.id = p_teacher_id and profile.role = 'teacher'
  ) then
    raise exception 'Teacher account was not found.';
  end if;

  if normalized_status <> 'approved'
     and exists (select 1 from public.platform_admins admin where admin.user_id = p_teacher_id) then
    raise exception 'A platform administrator cannot be suspended or returned to pending status.';
  end if;

  insert into public.teacher_account_controls (
    teacher_id,
    status,
    suspension_reason,
    reviewed_at,
    reviewed_by
  )
  values (
    p_teacher_id,
    normalized_status,
    case when normalized_status = 'suspended' then normalized_reason else '' end,
    now(),
    auth.uid()
  )
  on conflict (teacher_id) do update set
    status = excluded.status,
    suspension_reason = excluded.suspension_reason,
    reviewed_at = excluded.reviewed_at,
    reviewed_by = excluded.reviewed_by;

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
    'teacher.account_status_changed',
    'teacher_account',
    p_teacher_id::text,
    jsonb_build_object('status', normalized_status::text, 'reason', normalized_reason)
  );
end;
$$;

create or replace function public.admin_list_audit_log(p_limit integer default 100)
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
set search_path = public, private, pg_temp
as $$
begin
  if auth.uid() is null or not private.is_platform_admin() then
    raise exception 'Platform administrator access is required.';
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
  order by audit.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;

create or replace function public.record_my_data_export()
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  if auth.uid() is null or not private.is_teacher() then
    raise exception 'An approved teacher account is required.';
  end if;

  insert into public.management_audit_log (
    actor_id,
    teacher_id,
    event_type,
    target_type,
    target_id
  )
  values (
    auth.uid(),
    auth.uid(),
    'teacher.data_exported',
    'teacher_account',
    auth.uid()::text
  );
end;
$$;

create or replace function public.delete_my_teacher_account(p_confirmation text)
returns void
language plpgsql
security definer
set search_path = public, auth, private, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication is required.';
  end if;
  if p_confirmation <> 'DELETE' then
    raise exception 'Type DELETE to confirm account deletion.';
  end if;
  if exists (
    select 1 from public.platform_admins admin where admin.user_id = current_user_id
  ) then
    raise exception 'A platform administrator account cannot be self-deleted. Transfer the administrator role first.';
  end if;

  insert into public.management_audit_log (
    actor_id,
    teacher_id,
    event_type,
    target_type,
    target_id
  )
  values (
    current_user_id,
    current_user_id,
    'teacher.account_deleted',
    'teacher_account',
    current_user_id::text
  );

  delete from auth.users where id = current_user_id;
  if not found then
    raise exception 'Teacher account was not found.';
  end if;
end;
$$;

revoke all on function public.admin_list_teachers() from public;
revoke all on function public.admin_set_teacher_status(uuid, text, text) from public;
revoke all on function public.admin_list_audit_log(integer) from public;
revoke all on function public.record_my_data_export() from public;
revoke all on function public.delete_my_teacher_account(text) from public;

grant execute on function public.admin_list_teachers() to authenticated;
grant execute on function public.admin_set_teacher_status(uuid, text, text) to authenticated;
grant execute on function public.admin_list_audit_log(integer) to authenticated;
grant execute on function public.record_my_data_export() to authenticated;
grant execute on function public.delete_my_teacher_account(text) to authenticated;

commit;
