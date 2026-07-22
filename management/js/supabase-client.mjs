import {
  MANAGEMENT_CONFIGURED,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from './config.mjs';

let client = null;

export function configurationMessage() {
  return 'Management is not configured yet. Add the Supabase project URL and publishable key in management/js/config.mjs, then apply supabase/migrations/001_management_v1.sql.';
}

export function getSupabase() {
  if (!MANAGEMENT_CONFIGURED) {
    throw new Error(configurationMessage());
  }

  if (!window.supabase?.createClient) {
    throw new Error('The Supabase browser library did not load. Check the network connection and Content Security Policy.');
  }

  if (!client) {
    client = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          storageKey: 'chess-study-management-auth-v1',
        },
      },
    );
  }

  return client;
}

export async function currentSession() {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function currentProfile() {
  const supabase = getSupabase();
  const session = await currentSession();
  if (!session?.user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, display_name, created_at')
    .eq('id', session.user.id)
    .single();

  if (error) throw error;
  return data;
}

export async function requireProfile(expectedRole) {
  const profile = await currentProfile();
  if (!profile) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(`./login.html?next=${next}`);
    return null;
  }

  if (expectedRole && profile.role !== expectedRole) {
    window.location.replace(profile.role === 'teacher' ? './teacher.html' : './student.html');
    return null;
  }

  return profile;
}

export async function requireStudentProfile() {
  const profile = await currentProfile();
  if (!profile) {
    window.location.replace('./join.html');
    return null;
  }

  if (profile.role !== 'student') {
    window.location.replace('./teacher.html');
    return null;
  }

  return profile;
}

export function readableError(error) {
  const message = String(error?.message || error || 'Unexpected error.');
  return message
    .replace(/^Failed to fetch$/i, 'Unable to reach the management server.')
    .replace(/JSON object requested, multiple \(or no\) rows returned/i, 'The requested account record was not found.');
}

export async function signOut(destination = './login.html') {
  const supabase = getSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  window.location.replace(destination);
}
