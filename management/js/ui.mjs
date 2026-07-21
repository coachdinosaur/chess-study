export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function setStatus(element, message = '', tone = 'neutral') {
  if (!element) return;
  element.textContent = message;
  element.dataset.tone = tone;
  element.hidden = !message;
}

export function setBusy(button, busy, busyLabel = 'Working…') {
  if (!button) return;
  if (busy) {
    button.dataset.originalLabel = button.textContent;
    button.textContent = busyLabel;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalLabel || button.textContent;
    button.disabled = false;
    delete button.dataset.originalLabel;
  }
}

export function formatDate(value, fallback = 'No due date') {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function normalizeSiteUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const url = new URL(raw, window.location.origin);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Lesson links must use HTTP or HTTPS.');
  }
  return url.href;
}

export function queryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}
