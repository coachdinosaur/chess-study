begin;

alter function public.touch_updated_at()
  set search_path = public, pg_temp;

revoke execute on function public.handle_new_auth_user()
  from public, anon, authenticated;

revoke execute on function public.rls_auto_enable()
  from public, anon, authenticated;

commit;
