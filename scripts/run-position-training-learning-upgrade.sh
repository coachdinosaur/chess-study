#!/usr/bin/env bash
set -euo pipefail

node scripts/apply-position-training-learning-upgrade.mjs
node --input-type=module <<'NODE'
import fs from 'node:fs';

const dataPath = 'lichess-position-training-data.mjs';
let data = fs.readFileSync(dataPath, 'utf8');
const oldLimit = 'const recentLimit = Math.max(0, Math.min(200, Number(this.manifest?.count || 0) - 1));';
const newLimit = 'const recentLimit = Math.max(0, Math.min(500, Number(this.manifest?.count || 0) - 1));';
if (!data.includes(oldLimit)) throw new Error('Recent-puzzle limit patch target was not found.');
data = data.replace(oldLimit, newLimit);
fs.writeFileSync(dataPath, data);

const learningPath = 'lichess-position-training-learning.mjs';
let learning = fs.readFileSync(learningPath, 'utf8');
const oldAssistance = `    const assistance = mistakes || hints
      ? \`You used \${hints} hint\${hints === 1 ? '' : 's'} and made \${mistakes} rejected move\${mistakes === 1 ? '' : 's'}. This position remains in the review system until it is mastered cleanly.\`
      : 'Solved independently on the first accepted attempt, so the adaptive difficulty will rise slightly.';`;
const newAssistance = `    const assistance = mistakes
      ? \`You used \${hints} hint\${hints === 1 ? '' : 's'} and made \${mistakes} rejected move\${mistakes === 1 ? '' : 's'}. This position remains in Mistake Review until it is mastered cleanly.\`
      : (hints
        ? \`You solved with \${hints} hint\${hints === 1 ? '' : 's'}, so the adaptive rating rises modestly rather than receiving full independent-solve credit.\`
        : 'Solved independently on the first accepted attempt, so the adaptive difficulty will rise slightly.');`;
if (!learning.includes(oldAssistance)) throw new Error('Explanation assistance patch target was not found.');
learning = learning.replace(oldAssistance, newAssistance);
fs.writeFileSync(learningPath, learning);
NODE

curl --fail --location --retry 3 \
  https://raw.githubusercontent.com/banflam/chess-trainer/main/puzzles_subset.csv \
  --output /tmp/lichess-puzzles-subset.csv
test "$(wc -l < /tmp/lichess-puzzles-subset.csv)" -ge 500

rm -rf /tmp/position-training-candidates
mkdir -p /tmp/position-training-candidates proof/logs
node tools/build-lichess-position-training.mjs \
  --input /tmp/lichess-puzzles-subset.csv \
  --output /tmp/position-training-candidates \
  --limit 1000 \
  --shard-size 100 \
  --min-rating 0 \
  --max-rating 4000 \
  --min-popularity 0 \
  --min-plays 0 \
  2>&1 | tee proof/logs/lichess-300-generator-output.txt

node --input-type=module <<'NODE'
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function load(directory) {
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
  const records = manifest.shards.flatMap((shard) => {
    const payload = JSON.parse(fs.readFileSync(path.join(directory, shard.file), 'utf8'));
    return Array.isArray(payload) ? payload : payload.puzzles || [];
  });
  return { manifest, records };
}

const productionDir = 'assets/puzzles/lichess-position-training';
const baseline = load(productionDir);
const candidates = load('/tmp/position-training-candidates');
assert.equal(baseline.records.length, 200, 'main dataset must begin with 200 records');
const ids = new Set(baseline.records.map((record) => String(record.id)));
const fens = new Set(baseline.records.map((record) => String(record.startFen)));
const additions = [];
for (const record of candidates.records) {
  if (ids.has(String(record.id)) || fens.has(String(record.startFen))) continue;
  ids.add(String(record.id));
  fens.add(String(record.startFen));
  additions.push(record);
  if (additions.length === 100) break;
}
assert.equal(additions.length, 100, 'candidate source did not provide 100 unique additions');
const expanded = [...baseline.records, ...additions];
assert.deepEqual(expanded.slice(0, 200), baseline.records, 'the existing 200 records changed');
assert.equal(new Set(expanded.map((record) => record.id)).size, 300, 'puzzle IDs must be unique');
assert.equal(new Set(expanded.map((record) => record.startFen)).size, 300, 'starting FENs must be unique');
fs.rmSync(productionDir, { recursive: true, force: true });
fs.mkdirSync(productionDir, { recursive: true });
const shardSize = 25;
const shards = [];
for (let offset = 0; offset < expanded.length; offset += shardSize) {
  const records = expanded.slice(offset, offset + shardSize);
  const file = `shard-${String(shards.length).padStart(4, '0')}.json`;
  fs.writeFileSync(path.join(productionDir, file), `${JSON.stringify({ puzzles: records })}\n`);
  shards.push({ file, count: records.length });
}
const manifest = { ...baseline.manifest, generatedAt: new Date().toISOString(), count: expanded.length, shardSize, shards };
fs.writeFileSync(path.join(productionDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log('Baseline preserved: 200/200');
console.log('New unique records: 100');
console.log('Production total: 300');
NODE

node tools/validate-lichess-position-training.mjs \
  --dir assets/puzzles/lichess-position-training \
  --report proof/lichess-300-validation.md \
  --expected-count 300 \
  2>&1 | tee proof/logs/lichess-300-validator-output.txt

node --check lichess-position-training.mjs
node --check lichess-position-training-learning.mjs
node --check lichess-position-training-data.mjs
node --check focus-analysis-popup.mjs
node --check tests/lichess-position-training-browser-smoke.mjs
node --test tests/lichess-position-training-core.test.mjs
node --test tests/lichess-position-training-learning.test.mjs

npm install --no-save playwright@1.55.0
npx playwright install --with-deps chromium
python3 local_server.py --host 127.0.0.1 --port 8000 > /tmp/chess-study-server.log 2>&1 &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT
for attempt in {1..30}; do
  if curl --fail --silent http://127.0.0.1:8000/ > /dev/null; then break; fi
  sleep 1
done
node tests/lichess-position-training-browser-smoke.mjs \
  2>&1 | tee proof/logs/lichess-300-browser-smoke-output.txt

node --input-type=module <<'NODE'
import fs from 'node:fs';
import path from 'node:path';
const directory = 'assets/puzzles/lichess-position-training';
const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
const records = manifest.shards.flatMap((shard) => JSON.parse(fs.readFileSync(path.join(directory, shard.file), 'utf8')).puzzles);
const colors = records.reduce((counts, record) => {
  counts[record.solverColor] = (counts[record.solverColor] || 0) + 1;
  return counts;
}, {});
const summary = [
  '# Lichess Position Training learning upgrade',
  '',
  `- Production puzzles: ${records.length}`,
  '- Existing puzzles preserved: 200',
  '- New puzzles added: 100',
  `- Shards: ${manifest.shards.length}`,
  `- White solvers: ${colors.w || 0}`,
  `- Black solvers: ${colors.b || 0}`,
  '- Duplicate IDs: 0',
  '- Repeated starting positions: 0',
  '- Dataset validator: PASS',
  '- Core tests: PASS',
  '- Learning-model tests: PASS',
  '- Browser smoke test: PASS',
  '',
  '## Learning features',
  '',
  '- Mistake Review with mastery retirement after two clean review solves',
  '- Four-stage progressive hints',
  '- Post-puzzle success and rejection explanations',
  '- Adaptive rating window with fixed-range fallback',
  '- Theme performance dashboard and weakest-theme selection',
  '',
].join('\n');
fs.writeFileSync('proof/lichess-300-learning-summary.md', summary);
NODE

rm -f .github/workflows/expand-position-training-learning.yml
rm -f .github/workflows/run-position-training-learning-pr.yml
rm -f .github/triggers/expand-position-training-learning.txt
rm -f scripts/apply-position-training-learning-upgrade.mjs
rm -f scripts/run-position-training-learning-upgrade.sh

git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git add -A
git commit -m 'Expand position training learning system'
git push origin HEAD:agent/expand-position-training-learning
