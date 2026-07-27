const RAW_MOVE_ANNOTATIONS = [
  { nag: 1, glyph: '!', label: 'Good move' },
  { nag: 2, glyph: '?', label: 'Mistake' },
  { nag: 3, glyph: '!!', label: 'Brilliant move' },
  { nag: 4, glyph: '??', label: 'Blunder' },
  { nag: 5, glyph: '!?', label: 'Interesting move' },
  { nag: 6, glyph: '?!', label: 'Dubious move' },
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

export function moveNagGlyph(value) {
  const nag = moveNagFromValue(value);
  return nag ? (BY_NAG.get(nag)?.glyph || '') : '';
}

export function moveNagLabel(value) {
  const nag = moveNagFromValue(value);
  return nag ? (BY_NAG.get(nag)?.label || `NAG $${nag}`) : '';
}

export function moveNagPgnToken(value) {
  const nag = moveNagFromValue(value);
  if (!nag) {
    return '';
  }
  return BY_NAG.get(nag)?.glyph || `$${nag}`;
}

export function moveNagFromPgnEntry(entry) {
  const suffixNag = moveNagFromValue(entry?.suffix);
  return suffixNag || moveNagFromValue(entry?.nag);
}
