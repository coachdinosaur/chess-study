alter function public.create_live_board_room(text, text, text, text, text, text)
  set search_path = public, extensions, pg_temp;

alter function public.get_live_board_room(text, text)
  set search_path = public, extensions, pg_temp;

alter function public.update_live_board_teacher(text, text, bigint, text, text, text, jsonb, boolean, text)
  set search_path = public, extensions, pg_temp;

alter function public.update_live_board_student(text, text, bigint, text, text, jsonb)
  set search_path = public, extensions, pg_temp;
