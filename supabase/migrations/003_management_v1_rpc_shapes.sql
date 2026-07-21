begin;

drop function if exists public.create_class_with_code(text);

create function public.create_class_with_code(p_name text)
returns jsonb
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

  return to_jsonb(created_class);
end;
$$;

revoke all on function public.create_class_with_code(text) from public;
grant execute on function public.create_class_with_code(text) to authenticated;

commit;
