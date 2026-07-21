export const SUPABASE_URL = 'https://oxcottitwvayrrcuypmb.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_-0VdtXfcJH__vKlXrX5QIg_8QKXmf6z';

export const MANAGEMENT_CONFIGURED =
  /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(SUPABASE_URL)
  && !SUPABASE_URL.includes('YOUR_PROJECT_REF')
  && SUPABASE_PUBLISHABLE_KEY.length > 20
  && !SUPABASE_PUBLISHABLE_KEY.includes('YOUR_SUPABASE');

export const MANAGEMENT_PATHS = Object.freeze({
  home: './index.html',
  login: './login.html',
  join: './join.html',
  teacher: './teacher.html',
  student: './student.html',
  publicSite: '../index.html',
  lessonIndex: '../lessons/index.html',
});
