export const LEVEL_PRESETS = Object.freeze({
  new_learner: Object.freeze({ label: 'New learner', minRating: 400, maxRating: 800, puzzleCount: 5 }),
  beginner: Object.freeze({ label: 'Beginner', minRating: 600, maxRating: 1000, puzzleCount: 8 }),
  advanced_beginner: Object.freeze({ label: 'Advanced beginner', minRating: 850, maxRating: 1300, puzzleCount: 10 }),
  intermediate: Object.freeze({ label: 'Intermediate', minRating: 1100, maxRating: 1650, puzzleCount: 12 }),
  upper_intermediate: Object.freeze({ label: 'Upper intermediate', minRating: 1450, maxRating: 1950, puzzleCount: 15 }),
  advanced: Object.freeze({ label: 'Advanced', minRating: 1750, maxRating: 2400, puzzleCount: 15 }),
  custom: Object.freeze({ label: 'Custom', minRating: 800, maxRating: 1600, puzzleCount: 10 }),
});

export const ASSIGNMENT_THEMES = Object.freeze([
  ['any', 'Mixed training'],
  ['mate', 'Checkmate'],
  ['fork', 'Fork'],
  ['pin', 'Pin'],
  ['skewer', 'Skewer'],
  ['defensiveMove', 'Defensive move'],
  ['endgame', 'Endgame'],
  ['rookEndgame', 'Rook endgame'],
  ['pawnEndgame', 'Pawn endgame'],
  ['promotion', 'Promotion'],
  ['sacrifice', 'Sacrifice'],
  ['discoveredAttack', 'Discovered attack'],
  ['advancedPawn', 'Advanced pawn'],
  ['kingsideAttack', 'King attack'],
]);

const MANIFEST_URL = new URL(
  '../../assets/puzzles/lichess-position-training/manifest.json',
  import.meta.url,
);

function normalizeThemes(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  return String(value || '').trim().split(/\s+/).filter(Boolean);
}

function shuffle(values, random = Math.random) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

export function presetFor(level) {
  return LEVEL_PRESETS[level] || LEVEL_PRESETS.advanced_beginner;
}

export function normalizeAssignmentSettings(settings = {}) {
  const preset = presetFor(settings.level);
  const minRating = Math.max(400, Math.min(3000, Number(settings.minRating ?? preset.minRating)));
  const maxRating = Math.max(minRating, Math.min(3000, Number(settings.maxRating ?? preset.maxRating)));
  const puzzleCount = Math.max(1, Math.min(30, Math.round(Number(settings.puzzleCount ?? preset.puzzleCount))));
  const themes = normalizeThemes(settings.themes).filter((theme) => theme && theme !== 'any');
  return {
    level: Object.hasOwn(LEVEL_PRESETS, settings.level) ? settings.level : 'advanced_beginner',
    minRating,
    maxRating,
    puzzleCount,
    themes,
  };
}

export function snapshotPuzzle(record) {
  return {
    id: String(record?.id || record?.puzzleId || '').trim(),
    sourceFen: String(record?.sourceFen || record?.fen || '').trim(),
    startFen: String(record?.startFen || '').trim(),
    repairMove: String(record?.repairMove || '').trim(),
    solverColor: String(record?.solverColor || '').trim(),
    rating: Number.isFinite(Number(record?.rating)) ? Number(record.rating) : null,
    popularity: Number.isFinite(Number(record?.popularity)) ? Number(record.popularity) : null,
    themes: normalizeThemes(record?.themes),
    gameUrl: String(record?.gameUrl || '').trim(),
    openingTags: normalizeThemes(record?.openingTags),
  };
}

export function selectAssignmentPuzzles(records, settings = {}, { excludeIds = [], random = Math.random } = {}) {
  const normalized = normalizeAssignmentSettings(settings);
  const excluded = new Set(excludeIds.map(String));
  const themes = new Set(normalized.themes);
  const valid = records.filter((record) => {
    const id = String(record?.id || record?.puzzleId || '');
    const rating = Number(record?.rating);
    if (!id || excluded.has(id) || !Number.isFinite(rating)) return false;
    if (rating < normalized.minRating || rating > normalized.maxRating) return false;
    if (themes.size) {
      const recordThemes = new Set(normalizeThemes(record?.themes));
      if (![...themes].some((theme) => recordThemes.has(theme))) return false;
    }
    return true;
  });

  if (valid.length < normalized.puzzleCount) {
    throw new Error(
      `Only ${valid.length} puzzles match this level and theme. Widen the rating range or choose mixed training.`,
    );
  }

  return shuffle(valid, random)
    .slice(0, normalized.puzzleCount)
    .map(snapshotPuzzle);
}

export async function loadAllPositionTrainingPuzzles({ fetchImpl = fetch } = {}) {
  const manifestResponse = await fetchImpl(MANIFEST_URL, {
    cache: 'no-cache',
    headers: { Accept: 'application/json' },
  });
  if (!manifestResponse.ok) {
    throw new Error(`Unable to load the puzzle manifest (${manifestResponse.status}).`);
  }
  const manifest = await manifestResponse.json();
  const shards = Array.isArray(manifest?.shards) ? manifest.shards : [];
  if (!shards.length) throw new Error('The puzzle manifest contains no shards.');

  const payloads = await Promise.all(shards.map(async (shard) => {
    const response = await fetchImpl(new URL(shard.file, MANIFEST_URL), {
      cache: 'no-cache',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`Unable to load ${shard.file} (${response.status}).`);
    const payload = await response.json();
    return Array.isArray(payload) ? payload : (Array.isArray(payload?.puzzles) ? payload.puzzles : []);
  }));

  const records = payloads.flat().filter((record) => record?.id && (record?.startFen || record?.sourceFen));
  return { manifest, records };
}

export function randomAccessToken(byteLength = 32) {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Secure random tokens are not available in this browser.');
  }
  const bytes = new Uint8Array(byteLength);
  globalThis.crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export async function sha256Hex(value) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Secure token hashing is not available in this browser.');
  }
  const bytes = new TextEncoder().encode(String(value));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function assignmentLink(token, locationObject = globalThis.location) {
  const base = new URL('./assignment.html', locationObject.href);
  base.hash = `token=${encodeURIComponent(token)}`;
  return base.href;
}

export function formatLevel(level) {
  return presetFor(level).label;
}
