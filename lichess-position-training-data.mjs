const MANIFEST_URL = './assets/puzzles/lichess-position-training/manifest.json';
const DATABASE_NAME = 'lichess-position-training-cache-v1';
const STORE_NAME = 'shards';

function randomIndex(length) {
  return Math.floor(Math.random() * Math.max(1, length));
}

function shuffledIndexes(length) {
  const values = Array.from({ length }, (_, index) => index);
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swap = randomIndex(index + 1);
    [values[index], values[swap]] = [values[swap], values[index]];
  }
  return values;
}

function openDatabase() {
  if (!('indexedDB' in window)) return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'url' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

async function readCached(db, url) {
  if (!db) return null;
  return new Promise((resolve) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(url);
    request.onsuccess = () => resolve(request.result?.payload || null);
    request.onerror = () => resolve(null);
  });
}

async function writeCached(db, url, payload) {
  if (!db) return;
  await new Promise((resolve) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put({ url, payload, cachedAt: Date.now() });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
  });
}

async function fetchJson(url, db) {
  try {
    const response = await fetch(url, { cache: 'no-cache', headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Request failed (${response.status}).`);
    const payload = await response.json();
    writeCached(db, url, payload);
    return payload;
  } catch (error) {
    const cached = await readCached(db, url);
    if (cached) return cached;
    throw error;
  }
}

function matchesFilters(puzzle, filters) {
  const rating = Number(puzzle?.rating);
  if (Number.isFinite(filters?.minRating) && Number.isFinite(rating) && rating < filters.minRating) return false;
  if (Number.isFinite(filters?.maxRating) && Number.isFinite(rating) && rating > filters.maxRating) return false;
  const theme = String(filters?.theme || 'any').trim();
  if (theme && theme !== 'any') {
    const themes = Array.isArray(puzzle?.themes) ? puzzle.themes : String(puzzle?.themes || '').split(/\s+/);
    if (!themes.includes(theme)) return false;
  }
  return true;
}

export class LichessPositionTrainingDataSource {
  constructor() {
    this.dbPromise = openDatabase();
    this.manifest = null;
    this.shardOrder = [];
    this.shardCursor = 0;
    this.currentRecords = [];
    this.recordOrder = [];
    this.recordCursor = 0;
    this.recentIds = new Set();
  }

  async initialize() {
    if (this.manifest) return this.manifest;
    const db = await this.dbPromise;
    this.manifest = await fetchJson(MANIFEST_URL, db);
    const shards = Array.isArray(this.manifest?.shards) ? this.manifest.shards : [];
    if (!shards.length) throw new Error('The position-training manifest contains no puzzle shards.');
    this.shardOrder = shuffledIndexes(shards.length);
    return this.manifest;
  }

  async #loadNextShard() {
    await this.initialize();
    if (this.shardCursor >= this.shardOrder.length) {
      this.shardOrder = shuffledIndexes(this.manifest.shards.length);
      this.shardCursor = 0;
    }
    const shard = this.manifest.shards[this.shardOrder[this.shardCursor]];
    this.shardCursor += 1;
    const db = await this.dbPromise;
    const payload = await fetchJson(new URL(shard.file, new URL(MANIFEST_URL, window.location.href)).href, db);
    this.currentRecords = Array.isArray(payload) ? payload : (Array.isArray(payload?.puzzles) ? payload.puzzles : []);
    this.recordOrder = shuffledIndexes(this.currentRecords.length);
    this.recordCursor = 0;
  }

  async next(filters = {}) {
    await this.initialize();
    const maximumChecks = Math.max(50, Number(this.manifest?.shardSize || 1000) * 2);
    let recentReset = false;
    for (let checked = 0; checked < maximumChecks; checked += 1) {
      if (!recentReset && checked >= Math.floor(maximumChecks / 2)) {
        this.recentIds.clear();
        recentReset = true;
      }
      if (this.recordCursor >= this.recordOrder.length) {
        await this.#loadNextShard();
      }
      if (!this.recordOrder.length) continue;
      const record = this.currentRecords[this.recordOrder[this.recordCursor]];
      this.recordCursor += 1;
      const id = String(record?.id || record?.puzzleId || '');
      if (id && this.recentIds.has(id)) continue;
      if (!matchesFilters(record, filters)) continue;
      if (id) {
        this.recentIds.add(id);
        const recentLimit = Math.max(0, Math.min(500, Number(this.manifest?.count || 0) - 1));
        if (this.recentIds.size > recentLimit) {
          this.recentIds.delete(this.recentIds.values().next().value);
        }
      }
      return record;
    }
    throw new Error('No puzzle matched the selected filters.');
  }
}
