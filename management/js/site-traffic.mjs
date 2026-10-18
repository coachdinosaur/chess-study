import { escapeHtml } from './ui.mjs';

// Must match VISIT_OPT_OUT_KEY in ../../site-visits.mjs (checked by tests).
// The tracker itself is not imported here so administration pages are never counted.
export const VISIT_OPT_OUT_KEY = 'cd-site-visits-opt-out-v1';
export const TRAFFIC_DAYS = 30;

const TOTAL_WINDOWS = [
  ['today', 'Today'],
  ['last_7_days', 'Last 7 days'],
  ['last_30_days', 'Last 30 days'],
  ['all_time', 'All time'],
];

const countFormat = new Intl.NumberFormat(undefined);
const compactFormat = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });

export function formatCount(value) {
  const number = Number(value) || 0;
  return number >= 10000 ? compactFormat.format(number) : countFormat.format(number);
}

function plural(value, word) {
  return `${formatCount(value)} ${word}${Number(value) === 1 ? '' : 's'}`;
}

/** Rounds an axis maximum up to an even step of a power of ten so the midline is a whole number. */
export function niceAxisMax(value) {
  const max = Math.max(2, Number(value) || 0);
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const step = [1, 2, 4, 6, 8, 10].find((candidate) => candidate * magnitude >= max);
  return step * magnitude;
}

function parseDay(day) {
  const [year, month, date] = String(day).split('-').map(Number);
  return new Date(year, (month || 1) - 1, date || 1);
}

export function formatDay(day, options = { month: 'short', day: 'numeric' }) {
  return new Intl.DateTimeFormat(undefined, options).format(parseDay(day));
}

export function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function isVisitCountingDisabled(storage) {
  try {
    return storage?.getItem(VISIT_OPT_OUT_KEY) === '1';
  } catch {
    return false;
  }
}

export function setVisitCountingDisabled(storage, disabled) {
  try {
    if (disabled) storage.setItem(VISIT_OPT_OUT_KEY, '1');
    else storage.removeItem(VISIT_OPT_OUT_KEY);
    return true;
  } catch {
    return false;
  }
}

export function renderTrafficTiles(summary) {
  return TOTAL_WINDOWS.map(([key, label]) => {
    const totals = summary?.totals?.[key] || {};
    return `
      <article class="traffic-tile">
        <h3>${label}</h3>
        <p class="traffic-tile-value">${formatCount(totals.visits)}</p>
        <p class="traffic-tile-unit">${Number(totals.visits) === 1 ? 'visit' : 'visits'}</p>
        <p class="traffic-tile-detail">${plural(totals.page_views, 'page view')} · ${plural(totals.new_visitors, 'new visitor')}</p>
      </article>`;
  }).join('');
}

export function renderTrafficChart(daily) {
  const days = Array.isArray(daily) ? daily : [];
  if (!days.length) return '<div class="empty">No daily data yet.</div>';

  const axisMax = niceAxisMax(Math.max(...days.map((day) => Number(day.visits) || 0)));
  const columns = days.map((day, index) => {
    const visits = Number(day.visits) || 0;
    const height = visits ? Math.max(2, (visits / axisMax) * 100) : 0;
    return `<div class="traffic-column" data-index="${index}"><span class="traffic-bar" style="height:${height.toFixed(2)}%"></span></div>`;
  }).join('');
  const middle = days[Math.floor((days.length - 1) / 2)];

  return `
    <div class="traffic-plot">
      <div class="traffic-gridline" style="bottom:100%"><span>${formatCount(axisMax)}</span></div>
      <div class="traffic-gridline" style="bottom:50%"><span>${formatCount(axisMax / 2)}</span></div>
      <div class="traffic-gridline traffic-baseline" style="bottom:0"><span>0</span></div>
      <div class="traffic-columns">${columns}</div>
      <div class="traffic-tooltip" aria-hidden="true" hidden></div>
    </div>
    <div class="traffic-axis-labels" aria-hidden="true">
      <span>${escapeHtml(formatDay(days[0].day))}</span>
      <span>${escapeHtml(formatDay(middle.day))}</span>
      <span>${escapeHtml(formatDay(days.at(-1).day))}</span>
    </div>`;
}

export function describeTrafficDay(day) {
  return `${formatDay(day.day, { weekday: 'short', month: 'short', day: 'numeric' })}: ${plural(day.visits, 'visit')}, ${plural(day.page_views, 'page view')}, ${plural(day.new_visitors, 'new visitor')}`;
}

export function renderTopPages(pages) {
  if (!pages?.length) return '<li class="traffic-list-empty">No page views in this period yet.</li>';
  return pages.map((page) => `
    <li>
      <a href="${escapeHtml(page.path)}" target="_blank" rel="noopener">${escapeHtml(page.path)}</a>
      <span>${plural(page.page_views, 'view')}</span>
    </li>`).join('');
}

export function renderReferrers(referrers, directVisits) {
  const rows = (referrers || []).map((referrer) => `
    <li>
      <span class="traffic-referrer-host">${escapeHtml(referrer.referrer_host)}</span>
      <span>${plural(referrer.visits, 'visit')}</span>
    </li>`);
  if (Number(directVisits) > 0) {
    rows.push(`
    <li>
      <span class="traffic-referrer-host">Direct, bookmarks, or apps</span>
      <span>${plural(directVisits, 'visit')}</span>
    </li>`);
  }
  return rows.length ? rows.join('') : '<li class="traffic-list-empty">No visits in this period yet.</li>';
}

export function renderDailyTable(daily) {
  const rows = [...(daily || [])].reverse().map((day) => `
    <tr>
      <th scope="row">${escapeHtml(formatDay(day.day, { weekday: 'short', month: 'short', day: 'numeric' }))}</th>
      <td>${formatCount(day.visits)}</td>
      <td>${formatCount(day.page_views)}</td>
      <td>${formatCount(day.new_visitors)}</td>
    </tr>`).join('');
  return `
    <thead><tr><th scope="col">Day</th><th scope="col">Visits</th><th scope="col">Page views</th><th scope="col">New visitors</th></tr></thead>
    <tbody>${rows}</tbody>`;
}

export function trackingSinceText(summary, formatDate) {
  const zone = summary?.time_zone || 'UTC';
  if (!summary?.tracking_since) {
    return `No visits recorded yet. Counting starts once the visit counter is deployed. Days use the ${zone} time zone.`;
  }
  return `Counting since ${formatDate(summary.tracking_since)}. Days use the ${zone} time zone.`;
}

export function chartSummaryLabel(daily) {
  const days = daily || [];
  const total = days.reduce((sum, day) => sum + (Number(day.visits) || 0), 0);
  const busiest = days.reduce((best, day) => (Number(day.visits) > Number(best?.visits || 0) ? day : best), null);
  return busiest
    ? `Visits per day for the last ${days.length} days: ${plural(total, 'visit')} in total, busiest on ${formatDay(busiest.day)} with ${plural(busiest.visits, 'visit')}.`
    : `Visits per day for the last ${days.length} days: no visits yet.`;
}
