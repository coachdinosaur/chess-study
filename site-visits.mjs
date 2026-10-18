/**
 * Anonymous site visit counter.
 *
 * Sends one request per page load to the Supabase `record_site_visit` RPC,
 * which increments hourly counters. Nothing identifying is sent or stored:
 * no cookies, IP addresses, user agents, query strings, or URL fragments
 * (student workspace tokens live in the fragment and never leave the page). Two local-only
 * values distinguish a new visit (30 minutes of inactivity) and a first-time
 * browser. Administrators can exclude their own browser from the counts.
 */
import {
  MANAGEMENT_CONFIGURED,
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from './management/js/config.mjs';

export const VISIT_OPT_OUT_KEY = 'cd-site-visits-opt-out-v1';
const LAST_SEEN_KEY = 'cd-site-visits-last-seen-v1';
const VISITOR_SEEN_KEY = 'cd-site-visits-seen-v1';
const VISIT_IDLE_MS = 30 * 60 * 1000;
const COUNTED_HOSTS = new Set(['cddigital.top', 'www.cddigital.top']);
const BOT_PATTERN = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|embedly|monitor/i;

export function normalizeVisitPath(pathname) {
  let path = String(pathname || '/').replace(/\/{2,}/g, '/');
  if (!path.startsWith('/')) path = `/${path}`;
  path = path.replace(/\/index\.html$/i, '/');
  return path.slice(0, 200);
}

export function externalReferrerHost(referrer, currentHost) {
  try {
    const url = new URL(referrer);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const current = String(currentHost || '').toLowerCase().replace(/^www\./, '');
    return host && host !== current ? host.slice(0, 100) : '';
  } catch {
    return '';
  }
}

export function isCountedHost(hostname) {
  return COUNTED_HOSTS.has(String(hostname || '').toLowerCase());
}

export function isLikelyBot(userAgent, webdriver = false) {
  return Boolean(webdriver) || BOT_PATTERN.test(String(userAgent || ''));
}

/** Decides whether this page view starts a visit and whether the browser is new. */
export function planVisit({ now, lastSeen, seenBefore, storageAvailable, externalReferrer }) {
  if (!storageAvailable) {
    // Without storage, treat arrivals from another site (or typed URLs) as visits.
    return { isVisit: Boolean(externalReferrer) || externalReferrer === null, isNewVisitor: false };
  }
  const last = Number(lastSeen);
  const isVisit = !Number.isFinite(last) || last <= 0 || now - last > VISIT_IDLE_MS;
  return { isVisit, isNewVisitor: isVisit && !seenBefore };
}

export function buildVisitRequest({ path, referrerHost, isVisit, isNewVisitor }) {
  return {
    url: `${SUPABASE_URL}/rest/v1/rpc/record_site_visit`,
    init: {
      method: 'POST',
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_path: path,
        p_referrer_host: isVisit ? referrerHost : '',
        p_is_visit: isVisit,
        p_is_new_visitor: isNewVisitor,
      }),
      credentials: 'omit',
      keepalive: true,
    },
  };
}

function isFramed() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function recordCurrentVisit() {
  if (!MANAGEMENT_CONFIGURED || !isCountedHost(window.location.hostname)) return;
  if (isFramed() || isLikelyBot(navigator.userAgent, navigator.webdriver)) return;

  let storage = null;
  try {
    storage = window.localStorage;
    if (storage.getItem(VISIT_OPT_OUT_KEY) === '1') return;
  } catch {
    storage = null;
  }

  const now = Date.now();
  const referrerHost = externalReferrerHost(document.referrer, window.location.hostname);
  let lastSeen = null;
  let seenBefore = false;
  if (storage) {
    try {
      lastSeen = storage.getItem(LAST_SEEN_KEY);
      seenBefore = storage.getItem(VISITOR_SEEN_KEY) === '1';
      storage.setItem(LAST_SEEN_KEY, String(now));
      storage.setItem(VISITOR_SEEN_KEY, '1');
    } catch {
      storage = null;
    }
  }

  const plan = planVisit({
    now,
    lastSeen,
    seenBefore,
    storageAvailable: Boolean(storage),
    externalReferrer: document.referrer ? referrerHost : null,
  });
  const request = buildVisitRequest({
    path: normalizeVisitPath(window.location.pathname),
    referrerHost,
    ...plan,
  });
  fetch(request.url, request.init).catch(() => {});
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.prerendering) {
    document.addEventListener('prerenderingchange', recordCurrentVisit, { once: true });
  } else {
    recordCurrentVisit();
  }
}
