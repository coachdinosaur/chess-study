const RAW_MOVE_ANNOTATIONS = [
  { nag: 1, glyph: '!', label: 'Good move', group: 'Move quality', pgnSuffix: true },
  { nag: 2, glyph: '?', label: 'Mistake', group: 'Move quality', pgnSuffix: true },
  { nag: 3, glyph: '!!', label: 'Brilliant move', group: 'Move quality', pgnSuffix: true },
  { nag: 4, glyph: '??', label: 'Blunder', group: 'Move quality', pgnSuffix: true },
  { nag: 5, glyph: '!?', label: 'Interesting move', group: 'Move quality', pgnSuffix: true },
  { nag: 6, glyph: '?!', label: 'Dubious move', group: 'Move quality', pgnSuffix: true },
  { nag: 7, glyph: '□', label: 'Forced / only move', group: 'Move quality' },
  { nag: 10, glyph: '=', label: 'Equal position', group: 'Position evaluation' },
  { nag: 13, glyph: '∞', label: 'Unclear position', group: 'Position evaluation' },
  { nag: 14, glyph: '⩲', label: 'White slightly better', group: 'Position evaluation' },
  { nag: 15, glyph: '⩱', label: 'Black slightly better', group: 'Position evaluation' },
  { nag: 16, glyph: '±', label: 'White better', group: 'Position evaluation' },
  { nag: 17, glyph: '∓', label: 'Black better', group: 'Position evaluation' },
  { nag: 18, glyph: '+−', label: 'White winning', group: 'Position evaluation' },
  { nag: 19, glyph: '−+', label: 'Black winning', group: 'Position evaluation' },
];

export const MOVE_ANNOTATIONS = Object.freeze(
  RAW_MOVE_ANNOTATIONS.map((entry) => Object.freeze({ ...entry })),
);

const BY_NAG = new Map(MOVE_ANNOTATIONS.map((entry) => [entry.nag, entry]));
const BY_GLYPH = new Map(MOVE_ANNOTATIONS.map((entry) => [entry.glyph, entry]));

export function moveNagFromValue(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const raw = String(value).trim();
  if (!raw) {
    return null;
  }
  const glyphEntry = BY_GLYPH.get(raw);
  if (glyphEntry) {
    return glyphEntry.nag;
  }
  if (!/^\$?\d+$/.test(raw)) {
    return null;
  }
  const numeric = Number.parseInt(raw.replace(/^\$/, ''), 10);
  return Number.isInteger(numeric) && numeric > 0 && numeric <= 255 ? numeric : null;
}

export function moveNagDetails(value) {
  const nag = moveNagFromValue(value);
  return nag ? (BY_NAG.get(nag) || null) : null;
}

export function moveNagGlyph(value) {
  return moveNagDetails(value)?.glyph || '';
}

export function moveNagLabel(value) {
  const nag = moveNagFromValue(value);
  return nag ? (moveNagDetails(nag)?.label || `NAG $${nag}`) : '';
}

export function moveNagPgnToken(value) {
  const nag = moveNagFromValue(value);
  if (!nag) {
    return '';
  }
  const annotation = moveNagDetails(nag);
  return annotation?.pgnSuffix ? annotation.glyph : `$${nag}`;
}

export function moveNagFromPgnEntry(entry) {
  const suffixNag = moveNagFromValue(entry?.suffix);
  return suffixNag || moveNagFromValue(entry?.nag);
}
