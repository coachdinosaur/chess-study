begin;

create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create type public.profile_role as enum ('teacher', 'student');
create type public.membership_status as enum ('pending', 'active', 'removed');
create type public.assignment_resource_type as enum ('static_lesson', 'study_snapshot', 'external_link');
create type public.assignment_progress_status as enum ('not_started', 'started', 'completed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.profile_role not null default 'student',
  display_name text not null check (char_length(display_name) between 1 and 80),
  created_at timestamptz not null default now()
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  join_code text not null unique check (join_code ~ '^[A-Z0-9]{8}$'),
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.class_members (
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status public.membership_status not null default 'pending',
  joined_at timestamptz not null default now(),
  approved_at timestamptz,
  primary key (class_id, student_id)
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  instructions text not null default '' check (char_length(instructions) <= 4000),
  resource_type public.assignment_resource_type not null default 'static_lesson',
  resource_title text not null check (char_length(resource_title) between 1 and 200),
  resource_url text,
  lesson_payload jsonb,
  due_at timestamptz,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (
    (resource_type = 'study_snapshot' and lesson_payload is not null)
    or
    (resource_type in ('static_lesson', 'external_link') and resource_url is not null)
  )
);

create table public.assignment_progress (
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status public.assignment_progress_status not null default 'not_started',
  last_opened_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (assignment_id, student_id)
);

create table public.teacher_feedback (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  feedback text not null check (char_length(feedback) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);

create index classes_teacher_id_idx on public.classes(teacher_id);
create index class_members_student_id_idx on public.class_members(student_id);
create index class_members_class_status_idx on public.class_members(class_id, status);
create index assignments_class_id_idx on public.assignments(class_id);
create index assignment_progress_student_id_idx on public.assignment_progress(student_id);
create index teacher_feedback_student_id_idx on public.teacher_feedback(student_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger assignment_progress_touch_updated_at
before update on public.assignment_progress
for each row execute function public.touch_updated_at();

create trigger teacher_feedback_touch_updated_at
before update on public.teacher_feedback
for each row execute function public.touch_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  requested_role public.profile_role;
  requested_name text;
begin
  requested_role := case
    when coalesce(new.is_anonymous, false) then 'student'::public.profile_role
    when lower(coalesce(new.raw_user_meta_data ->> 'role', 'student')) = 'teacher'
      then 'teacher'::public.profile_role
    else 'student'::public.profile_role
  end;

  requested_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');
  if requested_name is null then
    requested_name := case
      when new.email is not null then split_part(new.email, '@', 1)
      else 'Student'
    end;
  end if;

  insert into public.profiles (id, role, display_name)
  values (new.id, requested_role, left(requested_name, 80))
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create or replace function private.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'teacher'
  );
$$;

create or replace function private.is_teacher_of_class(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.classes c
    where c.id = p_class_id
      and c.teacher_id = auth.uid()
  );
$$;

create or replace function private.is_active_member(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.class_members cm
    where cm.class_id = p_class_id
      and cm.student_id = auth.uid()
      and cm.status = 'active'
  );
$$;

create or replace function private.can_view_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    p_profile_id = auth.uid()
    or exists (
      select 1
      from public.class_members cm
      join public.classes c on c.id = cm.class_id
      where cm.student_id = p_profile_id
        and c.teacher_id = auth.uid()
    );
$$;

create or replace function private.can_access_assignment(p_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.assignments a
    where a.id = p_assignment_id
      and (
        private.is_teacher_of_class(a.class_id)
        or private.is_active_member(a.class_id)
      )
  );
$$;

grant execute on function private.is_teacher() to authenticated;
grant execute on function private.is_teacher_of_class(uuid) to authenticated;
grant execute on function private.is_active_member(uuid) to authenticated;
grant execute on function private.can_view_profile(uuid) to authenticated;
grant execute on function private.can_access_assignment(uuid) to authenticated;

create or replace function public.create_class_with_code(p_name text)
returns public.classes
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  created_class public.classes;
  candidate_code text;
  normalized_name text;
begin
  if auth.uid() is null or not private.is_teacher() then
    raise exception 'Only authenticated teachers can create classes.';
  end if;

  normalized_name := nullif(trim(p_name), '');
  if normalized_name is null or char_length(normalized_name) > 120 then
    raise exception 'Class name must contain 1 to 120 characters.';
  end if;

  loop
    candidate_code := upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 8));
    exit when not exists (
      select 1 from public.classes where join_code = candidate_code
    );
  end loop;

  insert into public.classes (teacher_id, name, join_code)
  values (auth.uid(), normalized_name, candidate_code)
  returning * into created_class;

  return created_class;
end;
$$;

create or replace function public.rotate_class_join_code(p_class_id uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  candidate_code text;
begin
  if auth.uid() is null or not private.is_teacher_of_class(p_class_id) then
    raise exception 'Only the class teacher can rotate this code.';
  end if;

  loop
    candidate_code := upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 8));
    exit when not exists (
      select 1 from public.classes where join_code = candidate_code
    );
  end loop;

  update public.classes
  set join_code = candidate_code
  where id = p_class_id;

  return candidate_code;
end;
$$;

create or replace function public.join_class_by_code(p_code text, p_display_name text)
returns table (class_id uuid, class_name text, status public.membership_status)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_class public.classes;
  normalized_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'student'
  ) then
    raise exception 'Only student accounts can join a class.';
  end if;

  normalized_name := nullif(trim(p_display_name), '');
  if normalized_name is null or char_length(normalized_name) > 80 then
    raise exception 'Display name must contain 1 to 80 characters.';
  end if;

  select c.*
  into target_class
  from public.classes c
  where c.join_code = upper(trim(p_code))
    and c.archived_at is null
  limit 1;

  if target_class.id is null then
    raise exception 'Class code was not found.';
  end if;

  update public.profiles
  set display_name = normalized_name
  where id = auth.uid()
    and role = 'student';

  insert into public.class_members (class_id, student_id, status, joined_at, approved_at)
  values (target_class.id, auth.uid(), 'pending', now(), null)
  on conflict (class_id, student_id)
  do update set
    status = case
      when public.class_members.status = 'removed' then 'pending'::public.membership_status
      else public.class_members.status
    end,
    joined_at = case
      when public.class_members.status = 'removed' then now()
      else public.class_members.joined_at
    end,
    approved_at = case
      when public.class_members.status = 'removed' then null
      else public.class_members.approved_at
    end;

  return query
  select target_class.id, target_class.name, cm.status
  from public.class_members cm
  where cm.class_id = target_class.id
    and cm.student_id = auth.uid();
end;
$$;

create or replace function public.approve_class_member(p_class_id uuid, p_student_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not private.is_teacher_of_class(p_class_id) then
    raise exception 'Only the class teacher can approve students.';
  end if;

  update public.class_members
  set status = 'active', approved_at = now()
  where class_id = p_class_id
    and student_id = p_student_id
    and status = 'pending';

  if not found then
    raise exception 'Pending student membership was not found.';
  end if;
end;
$$;

create or replace function public.remove_class_member(p_class_id uuid, p_student_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not private.is_teacher_of_class(p_class_id) then
    raise exception 'Only the class teacher can remove students.';
  end if;

  update public.class_members
  set status = 'removed', approved_at = null
  where class_id = p_class_id
    and student_id = p_student_id;
end;
$$;

revoke all on function public.create_class_with_code(text) from public;
revoke all on function public.rotate_class_join_code(uuid) from public;
revoke all on function public.join_class_by_code(text, text) from public;
revoke all on function public.approve_class_member(uuid, uuid) from public;
revoke all on function public.remove_class_member(uuid, uuid) from public;

grant execute on function public.create_class_with_code(text) to authenticated;
grant execute on function public.rotate_class_join_code(uuid) to authenticated;
grant execute on function public.join_class_by_code(text, text) to authenticated;
grant execute on function public.approve_class_member(uuid, uuid) to authenticated;
grant execute on function public.remove_class_member(uuid, uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_progress enable row level security;
alter table public.teacher_feedback enable row level security;

create policy profiles_select_allowed
on public.profiles
for select
to authenticated
using (private.can_view_profile(id));

create policy classes_select_allowed
on public.classes
for select
to authenticated
using (
  teacher_id = auth.uid()
  or private.is_active_member(id)
);

create policy classes_update_teacher
on public.classes
for update
to authenticated
using (teacher_id = auth.uid())
with check (teacher_id = auth.uid());

create policy classes_delete_teacher
on public.classes
for delete
to authenticated
using (teacher_id = auth.uid());

create policy class_members_select_allowed
on public.class_members
for select
to authenticated
using (
  student_id = auth.uid()
  or private.is_teacher_of_class(class_id)
);

create policy class_members_update_teacher
on public.class_members
for update
to authenticated
using (private.is_teacher_of_class(class_id))
with check (private.is_teacher_of_class(class_id));

create policy assignments_select_allowed
on public.assignments
for select
to authenticated
using (
  private.is_teacher_of_class(class_id)
  or private.is_active_member(class_id)
);

create policy assignments_insert_teacher
on public.assignments
for insert
to authenticated
with check (
  created_by = auth.uid()
  and private.is_teacher_of_class(class_id)
);

create policy assignments_update_teacher
on public.assignments
for update
to authenticated
using (private.is_teacher_of_class(class_id))
with check (
  created_by = auth.uid()
  and private.is_teacher_of_class(class_id)
);

create policy assignments_delete_teacher
on public.assignments
for delete
to authenticated
using (private.is_teacher_of_class(class_id));

create policy assignment_progress_select_allowed
on public.assignment_progress
for select
to authenticated
using (
  student_id = auth.uid()
  or exists (
    select 1
    from public.assignments a
    where a.id = assignment_id
      and private.is_teacher_of_class(a.class_id)
  )
);

create policy assignment_progress_insert_student
on public.assignment_progress
for insert
to authenticated
with check (
  student_id = auth.uid()
  and exists (
    select 1
    from public.assignments a
    where a.id = assignment_id
      and private.is_active_member(a.class_id)
  )
);

create policy assignment_progress_update_student
on public.assignment_progress
for update
to authenticated
using (
  student_id = auth.uid()
  and exists (
    select 1
    from public.assignments a
    where a.id = assignment_id
      and private.is_active_member(a.class_id)
  )
)
with check (
  student_id = auth.uid()
  and exists (
    select 1
    from public.assignments a
    where a.id = assignment_id
      and private.is_active_member(a.class_id)
  )
);

create policy teacher_feedback_select_allowed
on public.teacher_feedback
for select
to authenticated
using (
  student_id = auth.uid()
  or teacher_id = auth.uid()
);

create policy teacher_feedback_insert_teacher
on public.teacher_feedback
for insert
to authenticated
with check (
  teacher_id = auth.uid()
  and exists (
    select 1
    from public.assignments a
    where a.id = assignment_id
      and private.is_teacher_of_class(a.class_id)
  )
);

create policy teacher_feedback_update_teacher
on public.teacher_feedback
for update
to authenticated
using (teacher_id = auth.uid())
with check (teacher_id = auth.uid());

create policy teacher_feedback_delete_teacher
on public.teacher_feedback
for delete
to authenticated
using (teacher_id = auth.uid());

grant select on public.profiles to authenticated;
grant select, update, delete on public.classes to authenticated;
grant select, update on public.class_members to authenticated;
grant select, insert, update, delete on public.assignments to authenticated;
grant select, insert, update on public.assignment_progress to authenticated;
grant select, insert, update, delete on public.teacher_feedback to authenticated;

commit;
