import {
  MANAGEMENT_CONFIGURED,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from './config.mjs';

let client = null;

export function configurationMessage() {
  return 'Management is not configured yet. Add the Supabase project URL and publishable key in management/js/config.mjs, then apply management migrations 001 through 008.';
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

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, display_name, created_at')
    .eq('id', session.user.id)
    .single();
  if (profileError) throw profileError;

  if (profile.role !== 'teacher') {
    return {
      ...profile,
      email: session.user.email || '',
      account_status: null,
      suspension_reason: '',
      is_admin: false,
    };
  }

  const [controlResult, adminResult] = await Promise.all([
    supabase
      .from('teacher_account_controls')
      .select('status, suspension_reason, reviewed_at, updated_at')
      .eq('teacher_id', profile.id)
      .maybeSingle(),
    supabase
      .from('platform_admins')
      .select('user_id')
      .eq('user_id', profile.id)
      .maybeSingle(),
  ]);
  if (controlResult.error) throw controlResult.error;
  if (adminResult.error) throw adminResult.error;

  return {
    ...profile,
    email: session.user.email || '',
    account_status: controlResult.data?.status || 'pending',
    suspension_reason: controlResult.data?.suspension_reason || '',
    reviewed_at: controlResult.data?.reviewed_at || null,
    is_admin: Boolean(adminResult.data),
  };
}

export function teacherDestination(profile) {
  if (!profile || profile.role !== 'teacher') return './login.html';
  return profile.account_status === 'approved' ? './teacher.html' : './pending.html';
}

export async function requireProfile(
  expectedRole,
  { allowUnapproved = false, requireAdmin = false } = {},
) {
  const profile = await currentProfile();
  if (!profile) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(`./login.html?next=${next}`);
    return null;
  }

  if (expectedRole && profile.role !== expectedRole) {
    const supabase = getSupabase();
    await supabase.auth.signOut();
    window.location.replace('./login.html');
    return null;
  }

  if (
    profile.role === 'teacher'
    && !allowUnapproved
    && profile.account_status !== 'approved'
  ) {
    window.location.replace('./pending.html');
    return null;
  }

  if (requireAdmin && !profile.is_admin) {
    window.location.replace(profile.account_status === 'approved' ? './teacher.html' : './pending.html');
    return null;
  }

  return profile;
}

export function readableError(error) {
  const message = String(error?.message || error || 'Unexpected error.');
  return message
    .replace(/^Failed to fetch$/i, 'Unable to reach the management server.')
    .replace(/JSON object requested, multiple \(or no\) rows returned/i, 'The requested account record was not found.')
    .replace(/Invalid login credentials/i, 'The email or password is incorrect.')
    .replace(/Email rate limit exceeded/i, 'Too many email requests were made. Wait a while and try again.');
}

export async function signOut() {
  const supabase = getSupabase();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  window.location.replace('./login.html');
}
