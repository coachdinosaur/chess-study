import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

import {
  VISIT_OPT_OUT_KEY as TRACKER_OPT_OUT_KEY,
  buildVisitRequest,
  externalReferrerHost,
  isCountedHost,
  isLikelyBot,
  normalizeVisitPath,
  planVisit,
} from '../site-visits.mjs';
import {
  VISIT_OPT_OUT_KEY as ADMIN_OPT_OUT_KEY,
  chartSummaryLabel,
  isVisitCountingDisabled,
  niceAxisMax,
  renderDailyTable,
  renderReferrers,
  renderTopPages,
  renderTrafficChart,
  renderTrafficTiles,
  setVisitCountingDisabled,
} from '../management/js/site-traffic.mjs';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [migration, adminHtml, dashboard] = await Promise.all([
  read('supabase/migrations/20261018120000_site_visit_counter.sql'),
  read('management/admin.html'),
  read('management/js/admin-dashboard.mjs'),
]);

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

test('tracker sends only a normalized path, never query strings or fragment tokens', () => {
  assert.equal(normalizeVisitPath('/'), '/');
  assert.equal(normalizeVisitPath('/index.html'), '/');
  assert.equal(normalizeVisitPath('/lessons/index.html'), '/lessons/');
  assert.equal(normalizeVisitPath('//lessons//pawn-01.html'), '/lessons/pawn-01.html');
  assert.equal(normalizeVisitPath(`/${'a'.repeat(300)}`).length, 200);

  const request = buildVisitRequest({
    path: normalizeVisitPath('/management/student-workspace.html'),
    referrerHost: 'google.com',
    isVisit: true,
    isNewVisitor: false,
  });
  assert.match(request.url, /\/rest\/v1\/rpc\/record_site_visit$/);
  assert.equal(request.init.method, 'POST');
  assert.equal(request.init.credentials, 'omit');
  assert.equal(request.init.keepalive, true);
  assert.deepEqual(JSON.parse(request.init.body), {
    p_path: '/management/student-workspace.html',
    p_referrer_host: 'google.com',
    p_is_visit: true,
    p_is_new_visitor: false,
  });
  assert.doesNotMatch(request.init.body, /token|#|\?/);
});

test('referrers are reduced to an external host name', () => {
  assert.equal(externalReferrerHost('https://www.google.com/search?q=chess', 'cddigital.top'), 'google.com');
  assert.equal(externalReferrerHost('https://cddigital.top/lessons/', 'cddigital.top'), '');
  assert.equal(externalReferrerHost('https://www.cddigital.top/', 'cddigital.top'), '');
  assert.equal(externalReferrerHost('android-app://com.google.android.gm/', 'cddigital.top'), '');
  assert.equal(externalReferrerHost('', 'cddigital.top'), '');

  const pageView = JSON.parse(buildVisitRequest({ path: '/', referrerHost: 'reddit.com', isVisit: false, isNewVisitor: false }).init.body);
  assert.equal(pageView.p_referrer_host, '', 'referrers are only sent when a visit starts');
});

test('only the production site counts, and bots are skipped', () => {
  assert.equal(isCountedHost('cddigital.top'), true);
  assert.equal(isCountedHost('www.cddigital.top'), true);
  for (const host of ['localhost', '127.0.0.1', 'coachdinosaur.github.io', '']) {
    assert.equal(isCountedHost(host), false, host);
  }
  assert.equal(isLikelyBot('Mozilla/5.0 (compatible; Googlebot/2.1)'), true);
  assert.equal(isLikelyBot('Mozilla/5.0 HeadlessChrome/120.0'), true);
  assert.equal(isLikelyBot('Mozilla/5.0 (Windows NT 10.0) Chrome/120.0', true), true, 'webdriver');
  assert.equal(isLikelyBot('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/604.1'), false);
});

test('visits start after 30 idle minutes and new visitors are counted once', () => {
  const now = Date.UTC(2026, 9, 18, 12);
  const base = { now, storageAvailable: true, externalReferrer: '' };
  assert.deepEqual(planVisit({ ...base, lastSeen: null, seenBefore: false }), { isVisit: true, isNewVisitor: true });
  assert.deepEqual(planVisit({ ...base, lastSeen: String(now - 5 * 60 * 1000), seenBefore: true }), { isVisit: false, isNewVisitor: false });
  assert.deepEqual(planVisit({ ...base, lastSeen: String(now - 31 * 60 * 1000), seenBefore: true }), { isVisit: true, isNewVisitor: false });

  const noStorage = { now, storageAvailable: false, lastSeen: null, seenBefore: false };
  assert.deepEqual(planVisit({ ...noStorage, externalReferrer: null }), { isVisit: true, isNewVisitor: false });
  assert.deepEqual(planVisit({ ...noStorage, externalReferrer: 'bing.com' }), { isVisit: true, isNewVisitor: false });
  assert.deepEqual(planVisit({ ...noStorage, externalReferrer: '' }), { isVisit: false, isNewVisitor: false });
});

test('the admin opt-out uses the same key as the tracker and tolerates blocked storage', () => {
  assert.equal(ADMIN_OPT_OUT_KEY, TRACKER_OPT_OUT_KEY);
  const storage = memoryStorage();
  assert.equal(isVisitCountingDisabled(storage), false);
  assert.equal(setVisitCountingDisabled(storage, true), true);
  assert.equal(storage.getItem(TRACKER_OPT_OUT_KEY), '1');
  assert.equal(isVisitCountingDisabled(storage), true);
  assert.equal(setVisitCountingDisabled(storage, false), true);
  assert.equal(isVisitCountingDisabled(storage), false);

  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(isVisitCountingDisabled(blocked), false);
  assert.equal(setVisitCountingDisabled(blocked, true), false);
  assert.equal(setVisitCountingDisabled(null, true), false);
});

test('admin traffic rendering escapes stored text and keeps whole-number axes', () => {
  assert.deepEqual([0, 1, 3, 5, 9, 11, 50, 350].map(niceAxisMax), [2, 2, 4, 6, 10, 20, 60, 400]);

  const pages = renderTopPages([{ path: '/lessons/"><img src=x onerror=alert(1)>', page_views: 3, visits: 1 }]);
  assert.doesNotMatch(pages, /<img/);
  assert.match(pages, /3 views/);
  assert.match(renderTopPages([]), /No page views/);

  const referrers = renderReferrers([{ referrer_host: 'google.com', visits: 1 }], 4);
  assert.match(referrers, /google\.com[\s\S]+1 visit<[\s\S]+Direct, bookmarks, or apps[\s\S]+4 visits/);

  const daily = [
    { day: '2026-10-16', visits: 0, page_views: 0, new_visitors: 0 },
    { day: '2026-10-17', visits: 3, page_views: 8, new_visitors: 2 },
    { day: '2026-10-18', visits: 1, page_views: 1, new_visitors: 0 },
  ];
  const chart = renderTrafficChart(daily);
  assert.equal((chart.match(/class="traffic-column"/g) || []).length, 3);
  assert.match(chart, /height:0\.00%/);
  assert.match(chart, /height:75\.00%/, '3 of an axis max of 4');
  assert.match(chartSummaryLabel(daily), /4 visits in total, busiest on .+ with 3 visits/);
  assert.match(renderDailyTable(daily), /<th scope="col">New visitors<\/th>/);
  assert.equal((renderDailyTable(daily).match(/<tr>/g) || []).length, 4);

  const tiles = renderTrafficTiles({ totals: { today: { visits: 1, page_views: 2, new_visitors: 1 } } });
  assert.match(tiles, /Today[\s\S]+>1<[\s\S]+>visit<[\s\S]+2 page views · 1 new visitor/);
  assert.match(tiles, /All time[\s\S]+>0<[\s\S]+>visits</);
});

test('admin page shows the visit panel and loads it independently of teacher data', () => {
  for (const id of ['trafficTiles', 'trafficChart', 'trafficTopPages', 'trafficReferrers', 'trafficDailyTable', 'trafficOptOut', 'refreshTrafficButton']) {
    assert.match(adminHtml, new RegExp(`id="${id}"`), id);
  }
  assert.match(adminHtml, /site-traffic\.css\?v=20261018-visits1/);
  assert.match(adminHtml, /admin-dashboard\.mjs\?v=20261018-visits1/);
  assert.doesNotMatch(adminHtml, /site-visits\.mjs/, 'administration pages are not counted');
  assert.match(dashboard, /\.rpc\('admin_site_traffic_summary', \{\s+p_time_zone: browserTimeZone\(\),\s+p_days: TRAFFIC_DAYS,/);
  assert.match(dashboard, /Promise\.all\(\[loadAdminData\(\), loadSiteTraffic\(\)\]\)/);
  assert.doesNotMatch(dashboard, /from '\.\.\/\.\.\/site-visits\.mjs'/);
});

test('visit counter migration stores no identifiers and restricts reads to administrators', () => {
  assert.match(migration, /^begin;[\s\S]+commit;\s*$/);
  assert.match(migration, /alter table public\.site_traffic_hourly enable row level security/);
  assert.match(migration, /revoke all on table public\.site_traffic_hourly from public, anon, authenticated/);
  const table = migration.match(/create table if not exists public\.site_traffic_hourly \(([\s\S]+?)\n\);/)?.[1] || '';
  const columns = [...table.matchAll(/^\s+([a-z_]+) (?:timestamptz|text|integer)/gm)].map((match) => match[1]);
  assert.deepEqual(columns, ['bucket_start', 'path', 'referrer_host', 'page_views', 'visits', 'new_visitors']);

  const record = migration.match(/create or replace function public\.record_site_visit[\s\S]+?\$\$;/)?.[0] || '';
  assert.match(record, /security definer/);
  assert.match(record, /set search_path = pg_catalog, public, pg_temp/);
  assert.match(record, /v_path !~ '\^\/\[A-Za-z0-9\._~\/%-\]\{0,199\}\$'/);
  assert.match(record, /on conflict \(bucket_start, path, referrer_host\) do update/);
  assert.match(migration, /grant execute on function public\.record_site_visit\(text, text, boolean, boolean\)\s+to anon, authenticated/);

  const summary = migration.match(/create or replace function public\.admin_site_traffic_summary[\s\S]+?\$\$;/)?.[0] || '';
  assert.match(summary, /security definer/);
  assert.match(summary, /auth\.uid\(\) is null or not private\.is_platform_admin\(\)/);
  assert.match(summary, /pg_timezone_names/);
  assert.match(migration, /revoke all on function public\.admin_site_traffic_summary\(text, integer\)\s+from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.admin_site_traffic_summary\(text, integer\)\s+to authenticated;/);
});

test('public pages load the tracker once and private teacher pages do not', async () => {
  const lessons = (await readdir(new URL('../lessons/', import.meta.url))).filter((name) => name.endsWith('.html'));
  const publicPages = [
    'index.html',
    'live-board.html',
    'about/index.html',
    'clock/index.html',
    'articles/index.html',
    'management/student-workspace.html',
    'management/assignment.html',
    ...lessons.map((name) => `lessons/${name}`),
  ];
  for (const page of publicPages) {
    const html = await read(page);
    const depth = page.split('/').length - 1;
    const expected = `${depth ? '../'.repeat(depth) : './'}site-visits.mjs?v=20261018-visits1`;
    const tags = html.match(/<script type="module" src="[^"]*site-visits\.mjs[^"]*"><\/script>/g) || [];
    assert.equal(tags.length, 1, `${page} loads the tracker once`);
    assert.ok(tags[0].includes(expected), `${page} uses ${expected}`);
    assert.ok(html.indexOf(tags[0]) < html.search(/<\/head>/i), `${page} loads it in the head`);
  }

  for (const page of ['management/admin.html', 'management/teacher.html', 'management/login.html', 'management/account.html', 'endgame-trainer/index.html']) {
    assert.doesNotMatch(await read(page), /site-visits\.mjs/, `${page} is not counted`);
  }
});
