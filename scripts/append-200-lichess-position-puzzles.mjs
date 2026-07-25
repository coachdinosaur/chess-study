import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const productionDir = 'assets/puzzles/lichess-position-training';
const candidateDir = '/tmp/lichess-position-candidates';
const additionsNeeded = 200;
const shardSize = 25;

function loadDataset(directory) {
  const manifestPath = path.join(directory, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const records = [];
  for (const shard of manifest.shards || []) {
    const payload = JSON.parse(fs.readFileSync(path.join(directory, shard.file), 'utf8'));
    records.push(...(Array.isArray(payload) ? payload : payload.puzzles || []));
  }
  return { manifest, records };
}

const baseline = loadDataset(productionDir);
const candidates = loadDataset(candidateDir);
assert.equal(baseline.records.length, 300, 'production baseline must contain exactly 300 puzzles');
assert.ok(candidates.records.length >= 500, 'candidate pool is unexpectedly small');

const ids = new Set(baseline.records.map((record) => String(record.id)));
const startFens = new Set(baseline.records.map((record) => String(record.startFen)));
const additions = [];

for (const candidate of candidates.records) {
  const id = String(candidate?.id || '');
  const startFen = String(candidate?.startFen || '');
  if (!id || !startFen || ids.has(id) || startFens.has(startFen)) continue;
  ids.add(id);
  startFens.add(startFen);
  additions.push(candidate);
  if (additions.length === additionsNeeded) break;
}

assert.equal(additions.length, additionsNeeded, `only ${additions.length} eligible new puzzles were found`);
assert.equal(baseline.manifest.shards.length, 12, 'expected twelve baseline shards');

const newShards = [];
for (let offset = 0; offset < additions.length; offset += shardSize) {
  const shardIndex = baseline.manifest.shards.length + Math.floor(offset / shardSize);
  const file = `shard-${String(shardIndex).padStart(4, '0')}.json`;
  const puzzles = additions.slice(offset, offset + shardSize);
  fs.writeFileSync(path.join(productionDir, file), `${JSON.stringify({ puzzles })}\n`);
  newShards.push({ file, count: puzzles.length });
}

const manifest = {
  ...baseline.manifest,
  generatedAt: new Date().toISOString(),
  count: baseline.records.length + additions.length,
  shardSize,
  shards: [...baseline.manifest.shards, ...newShards],
};
fs.writeFileSync(path.join(productionDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

const expanded = loadDataset(productionDir);
assert.equal(expanded.records.length, 500, 'expanded production dataset must contain 500 puzzles');
assert.deepEqual(expanded.records.slice(0, 300), baseline.records, 'one or more baseline puzzles changed');

const verifiedIds = new Set();
const verifiedFens = new Set();
const solverColors = new Set();
const forbiddenFields = ['moves', 'solution', 'bestLine', 'bestLineUci', 'continuation'];
for (const record of expanded.records) {
  assert.ok(record.id && !verifiedIds.has(record.id), `duplicate or missing puzzle id: ${record.id}`);
  verifiedIds.add(record.id);
  assert.ok(record.startFen && !verifiedFens.has(record.startFen), `duplicate or missing start FEN: ${record.id}`);
  verifiedFens.add(record.startFen);
  solverColors.add(record.solverColor);
  for (const field of forbiddenFields) {
    assert.equal(Object.prototype.hasOwnProperty.call(record, field), false, `${record.id} stores forbidden exact-line field ${field}`);
  }
}
assert.deepEqual([...solverColors].sort(), ['b', 'w'], 'dataset must contain both solver colors');

console.log(`Baseline preserved: ${baseline.records.length}/${baseline.records.length}`);
console.log(`New unique puzzles: ${additions.length}`);
console.log(`Production puzzles: ${expanded.records.length}`);
console.log(`Production shards: ${expanded.manifest.shards.length}`);
console.log(`Unique IDs: ${verifiedIds.size}`);
console.log(`Unique starting FENs: ${verifiedFens.size}`);
console.log(`First new puzzle: ${additions[0].id}`);
console.log(`Last new puzzle: ${additions.at(-1).id}`);
