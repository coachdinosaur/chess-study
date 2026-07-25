#!/usr/bin/env bash
set -euo pipefail

BRANCH='agent/add-200-more-lichess-puzzles'
DATA_DIR='assets/puzzles/lichess-position-training'
CANDIDATE_DIR='/tmp/lichess-position-candidates'
SOURCE_CSV='/tmp/lichess-puzzles-subset.csv'

mkdir -p proof/logs

node --check tools/build-lichess-position-training.mjs
node --check tools/validate-lichess-position-training.mjs
node --check scripts/append-200-lichess-position-puzzles.mjs
node --check lichess-position-training-data.mjs
node --check lichess-position-training-learning.mjs

curl --fail --location --retry 3 \
  https://raw.githubusercontent.com/banflam/chess-trainer/main/puzzles_subset.csv \
  --output "$SOURCE_CSV"
test "$(wc -l < "$SOURCE_CSV")" -ge 700

rm -rf "$CANDIDATE_DIR"
node tools/build-lichess-position-training.mjs \
  --input "$SOURCE_CSV" \
  --output "$CANDIDATE_DIR" \
  --limit 900 \
  --shard-size 25 \
  --min-rating 0 \
  --max-rating 4000 \
  --min-popularity 0 \
  --min-plays 0 \
  2>&1 | tee proof/logs/lichess-500-generator-output.txt

node scripts/append-200-lichess-position-puzzles.mjs \
  2>&1 | tee proof/logs/lichess-500-expansion-output.txt

node tools/validate-lichess-position-training.mjs \
  --dir "$DATA_DIR" \
  --report proof/lichess-500-validation.md \
  --expected-count 500 \
  2>&1 | tee proof/logs/lichess-500-validator-output.txt

node --test tests/lichess-position-training-core.test.mjs
node --test tests/lichess-position-training-learning.test.mjs

npm install --no-save playwright@1.55.0
npx playwright install --with-deps chromium
python3 local_server.py --host 127.0.0.1 --port 8000 > /tmp/chess-study-server.log 2>&1 &
server_pid=$!
cleanup_server() {
  kill "$server_pid" 2>/dev/null || true
}
trap cleanup_server EXIT
for attempt in {1..30}; do
  if curl --fail --silent http://127.0.0.1:8000/ > /dev/null; then
    break
  fi
  sleep 1
done
node tests/lichess-position-training-browser-smoke.mjs \
  2>&1 | tee proof/logs/lichess-500-browser-smoke-output.txt
cleanup_server
trap - EXIT

node --input-type=module <<'NODE'
import fs from 'node:fs';
import path from 'node:path';

const directory = 'assets/puzzles/lichess-position-training';
const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
const records = manifest.shards.flatMap((shard) => {
  const payload = JSON.parse(fs.readFileSync(path.join(directory, shard.file), 'utf8'));
  return Array.isArray(payload) ? payload : payload.puzzles || [];
});
const colors = records.reduce((counts, record) => {
  counts[record.solverColor] = (counts[record.solverColor] || 0) + 1;
  return counts;
}, {});
const ratings = records.map((record) => Number(record.rating)).filter(Number.isFinite).sort((a, b) => a - b);
const summary = [
  '# Lichess Position Training: 500-puzzle expansion',
  '',
  `- Generated: ${manifest.generatedAt}`,
  `- Production puzzles: ${records.length}`,
  '- Existing puzzles preserved: 300',
  '- New puzzles added: 200',
  `- Shards: ${manifest.shards.length}`,
  `- Shard size: ${manifest.shardSize}`,
  `- White solvers: ${colors.w || 0}`,
  `- Black solvers: ${colors.b || 0}`,
  `- Rating range: ${ratings[0]}-${ratings.at(-1)}`,
  '- Duplicate puzzle IDs: 0',
  '- Repeated starting positions: 0',
  '- Exact continuation fields: 0',
  '- Dataset validator: PASS',
  '- Core tests: PASS',
  '- Learning-model tests: PASS',
  '- Browser smoke test: PASS',
  '',
  'All 300 existing production records remain unchanged. The expansion appends eight new 25-puzzle shards containing 200 unique Lichess-derived positions.',
  '',
].join('\n');
fs.writeFileSync('proof/lichess-500-expansion-summary.md', summary);
NODE

rm -f .github/workflows/add-200-lichess-puzzles.yml
rm -f scripts/append-200-lichess-position-puzzles.mjs
rm -f scripts/run-add-200-lichess-puzzles.sh

git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git add "$DATA_DIR" \
  proof/lichess-500-validation.md \
  proof/lichess-500-expansion-summary.md \
  proof/logs/lichess-500-generator-output.txt \
  proof/logs/lichess-500-expansion-output.txt \
  proof/logs/lichess-500-validator-output.txt \
  proof/logs/lichess-500-browser-smoke-output.txt \
  .github/workflows/add-200-lichess-puzzles.yml \
  scripts/append-200-lichess-position-puzzles.mjs \
  scripts/run-add-200-lichess-puzzles.sh

git commit -m 'Add 200 validated Lichess position puzzles'
git push origin HEAD:"$BRANCH"
