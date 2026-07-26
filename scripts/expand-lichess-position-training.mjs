import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { Chess } from '../vendor/chess.js';

const root = process.cwd();
const datasetDir = path.join(root, 'assets/puzzles/lichess-position-training');
const manifestPath = path.join(datasetDir, 'manifest.json');
const csvPath = process.argv[2] || '/tmp/lichess-puzzles.csv';
const requested = Number(process.argv[3] || 500);
const proofDir = path.join(root, 'proof');
const logDir = path.join(proofDir, 'logs');
const forbiddenContinuationFields = new Set([
  'moves',
  'solution',
  'solutionMoves',
  'continuation',
  'line',
  'bestMove',
  'expectedMove',
  'expectedMoves',
]);

function fail(message) {
  throw new Error(message);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value, pretty = false) {
  const text = pretty ? `${JSON.stringify(value, null, 2)}\n` : `${JSON.stringify(value)}\n`;
  fs.writeFileSync(file, text);
}

function positionKey(fen) {
  return String(fen).trim().split(/\s+/).slice(0, 4).join(' ');
}

function splitWords(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean);
}

function applyUci(game, uci) {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) return null;
  try {
    return game.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci[4] || undefined,
    });
  } catch {
    return null;
  }
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function percent(value, total) {
  return total ? `${((value / total) * 100).toFixed(1)}%` : '0.0%';
}

function bucketLabel(rating) {
  if (rating < 700) return 'Below 700';
  if (rating <= 999) return '700-999';
  if (rating <= 1299) return '1000-1299';
  if (rating <= 1599) return '1300-1599';
  if (rating <= 1899) return '1600-1899';
  if (rating <= 2199) return '1900-2199';
  if (rating <= 2600) return '2200-2600';
  return 'Above 2600';
}

function countPieces(fen) {
  return fen.split(' ')[0].replace(/[1-8/]/g, '').length;
}

function csvFields(line) {
  const fields = line.replace(/\r$/, '').split(',');
  if (fields.length < 10) return null;
  if (fields.length === 10) return fields;
  return [
    fields[0],
    fields[1],
    fields[2],
    fields[3],
    fields[4],
    fields[5],
    fields[6],
    fields[7],
    fields[8],
    fields.slice(9).join(','),
  ];
}

if (!Number.isInteger(requested) || requested <= 0 || requested % 25 !== 0) {
  fail('Requested puzzle count must be a positive multiple of 25.');
}
if (!fs.existsSync(csvPath)) fail(`CSV input not found: ${csvPath}`);

fs.mkdirSync(logDir, { recursive: true });
const manifest = readJson(manifestPath);
const originalManifestCount = Number(manifest.count);
const originalShardCount = manifest.shards.length;
const existing = [];
const baselineShardBytes = new Map();

for (const shard of manifest.shards) {
  const shardPath = path.join(datasetDir, shard.file);
  const bytes = fs.readFileSync(shardPath);
  baselineShardBytes.set(shard.file, bytes.toString('base64'));
  const data = JSON.parse(bytes.toString('utf8'));
  if (!Array.isArray(data.puzzles) || data.puzzles.length !== shard.count) {
    fail(`Existing shard ${shard.file} does not match its manifest count.`);
  }
  existing.push(...data.puzzles);
}
if (existing.length !== originalManifestCount) {
  fail(`Manifest says ${originalManifestCount} puzzles but existing shards contain ${existing.length}.`);
}

const ids = new Set();
const positions = new Set();
for (const puzzle of existing) {
  if (ids.has(puzzle.id)) fail(`Existing duplicate puzzle ID: ${puzzle.id}`);
  const key = positionKey(puzzle.startFen);
  if (positions.has(key)) fail(`Existing duplicate starting position: ${puzzle.id}`);
  ids.add(puzzle.id);
  positions.add(key);
}

const accepted = [];
const rejected = {
  malformed: 0,
  duplicateId: 0,
  duplicatePosition: 0,
  excludedTheme: 0,
  filter: 0,
  illegalFenOrRepairMove: 0,
};
let scanned = 0;
const input = readline.createInterface({
  input: fs.createReadStream(csvPath),
  crlfDelay: Infinity,
});

for await (const line of input) {
  if (!line || line.startsWith('PuzzleId,')) continue;
  scanned += 1;
  const fields = csvFields(line);
  if (!fields) {
    rejected.malformed += 1;
    continue;
  }
  const [
    id,
    sourceFen,
    movesText,
    ratingText,
    _ratingDeviation,
    popularityText,
    playsText,
    themesText,
    gameUrl,
    openingTagsText,
  ] = fields;

  if (!id || ids.has(id)) {
    rejected.duplicateId += 1;
    continue;
  }

  const rating = Number(ratingText);
  const popularity = Number(popularityText);
  const plays = Number(playsText);
  const themes = splitWords(themesText);
  const openingTags = splitWords(openingTagsText);
  const moves = splitWords(movesText);

  if (!Number.isFinite(rating) || !Number.isFinite(popularity) || !Number.isFinite(plays) || moves.length < 2) {
    rejected.malformed += 1;
    continue;
  }
  if (rating < manifest.filters.minRating || rating > manifest.filters.maxRating
      || popularity < manifest.filters.minPopularity || plays < manifest.filters.minPlays) {
    rejected.filter += 1;
    continue;
  }
  if ((manifest.filters.excludedThemes || []).some((theme) => themes.includes(theme))) {
    rejected.excludedTheme += 1;
    continue;
  }
  if ((manifest.filters.themes || []).length
      && !(manifest.filters.themes || []).some((theme) => themes.includes(theme))) {
    rejected.filter += 1;
    continue;
  }

  let game;
  try {
    game = new Chess(sourceFen);
  } catch {
    rejected.illegalFenOrRepairMove += 1;
    continue;
  }
  const losingMoverColor = game.turn();
  if (!applyUci(game, moves[0])) {
    rejected.illegalFenOrRepairMove += 1;
    continue;
  }
  const startFen = game.fen();
  const key = positionKey(startFen);
  if (positions.has(key)) {
    rejected.duplicatePosition += 1;
    continue;
  }

  const puzzle = {
    id,
    sourceFen,
    repairMove: moves[0],
    startFen,
    losingMoverColor,
    solverColor: game.turn(),
    rating,
    popularity,
    plays,
    themes,
    gameUrl,
    openingTags,
  };
  accepted.push(puzzle);
  ids.add(id);
  positions.add(key);
  if (accepted.length === requested) break;
}

if (accepted.length !== requested) {
  fail(`Only found ${accepted.length} eligible new puzzles after scanning ${scanned} rows; needed ${requested}.`);
}

for (let offset = 0; offset < accepted.length; offset += manifest.shardSize) {
  const index = originalShardCount + (offset / manifest.shardSize);
  const file = `shard-${String(index).padStart(4, '0')}.json`;
  const puzzles = accepted.slice(offset, offset + manifest.shardSize);
  writeJson(path.join(datasetDir, file), { puzzles });
  manifest.shards.push({ file, count: puzzles.length });
}
manifest.generatedAt = new Date().toISOString();
manifest.count = originalManifestCount + accepted.length;
writeJson(manifestPath, manifest, true);

for (const [file, baseline] of baselineShardBytes) {
  const current = fs.readFileSync(path.join(datasetDir, file)).toString('base64');
  if (current !== baseline) fail(`Existing shard changed unexpectedly: ${file}`);
}

const all = [];
let manifestTotal = 0;
for (const shard of manifest.shards) {
  const data = readJson(path.join(datasetDir, shard.file));
  if (!Array.isArray(data.puzzles)) fail(`${shard.file} has no puzzles array.`);
  if (data.puzzles.length !== shard.count) fail(`${shard.file} count mismatch.`);
  manifestTotal += shard.count;
  all.push(...data.puzzles);
}
if (manifestTotal !== manifest.count || all.length !== manifest.count) {
  fail(`Final manifest/shard count mismatch: manifest=${manifest.count}, listed=${manifestTotal}, loaded=${all.length}.`);
}

const validationIds = new Set();
const validationPositions = new Set();
let exactContinuationFields = 0;
let white = 0;
let black = 0;
const ratings = [];
const ratingBuckets = new Map();
const themeCounts = new Map();
const pieceCounts = new Map();

for (const puzzle of all) {
  if (validationIds.has(puzzle.id)) fail(`Duplicate final puzzle ID: ${puzzle.id}`);
  validationIds.add(puzzle.id);
  const key = positionKey(puzzle.startFen);
  if (validationPositions.has(key)) fail(`Repeated final starting position: ${puzzle.id}`);
  validationPositions.add(key);

  for (const keyName of Object.keys(puzzle)) {
    if (forbiddenContinuationFields.has(keyName)) exactContinuationFields += 1;
  }

  let game;
  try {
    game = new Chess(puzzle.sourceFen);
  } catch {
    fail(`Invalid source FEN in ${puzzle.id}`);
  }
  if (game.turn() !== puzzle.losingMoverColor) fail(`Losing mover mismatch in ${puzzle.id}`);
  if (!applyUci(game, puzzle.repairMove)) fail(`Illegal repair move in ${puzzle.id}`);
  if (game.fen() !== puzzle.startFen) fail(`Repair move does not reproduce start FEN in ${puzzle.id}`);
  if (game.turn() !== puzzle.solverColor) fail(`Solver color mismatch in ${puzzle.id}`);

  if (puzzle.solverColor === 'w') white += 1;
  else if (puzzle.solverColor === 'b') black += 1;
  else fail(`Invalid solver color in ${puzzle.id}`);

  ratings.push(Number(puzzle.rating));
  const bucket = bucketLabel(Number(puzzle.rating));
  ratingBuckets.set(bucket, (ratingBuckets.get(bucket) || 0) + 1);
  for (const theme of puzzle.themes || []) themeCounts.set(theme, (themeCounts.get(theme) || 0) + 1);
  const pieces = countPieces(puzzle.startFen);
  pieceCounts.set(pieces, (pieceCounts.get(pieces) || 0) + 1);
}
if (exactContinuationFields !== 0) fail(`Found ${exactContinuationFields} exact-continuation fields.`);

const orderedBuckets = ['Below 700', '700-999', '1000-1299', '1300-1599', '1600-1899', '1900-2199', '2200-2600', 'Above 2600'];
const topThemes = [...themeCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 20);
const sortedPieceCounts = [...pieceCounts.entries()].sort((a, b) => a[0] - b[0]);
const generated = new Date().toISOString();
const minRating = Math.min(...ratings);
const maxRating = Math.max(...ratings);

const validationMarkdown = `# Lichess Position Training Validation\n\n- Result: **PASS**\n- Generated: ${generated}\n- Records: ${all.length}\n- Shards: ${manifest.shards.length}\n- Exact continuation fields: ${exactContinuationFields}\n- Duplicate IDs: 0\n- Repeated starting-position records: 0\n\n## Solver colors\n\n- White: ${white} (${percent(white, all.length)})\n- Black: ${black} (${percent(black, all.length)})\n\n## Ratings\n\n- Minimum: ${minRating}\n- Median: ${median(ratings)}\n- Maximum: ${maxRating}\n\n| Range | Count | Share |\n|---|---:|---:|\n${orderedBuckets.map((label) => `| ${label} | ${ratingBuckets.get(label) || 0} | ${percent(ratingBuckets.get(label) || 0, all.length)} |`).join('\n')}\n\n## Most common themes\n\n| Theme | Count | Share |\n|---|---:|---:|\n${topThemes.map(([theme, count]) => `| ${theme} | ${count} | ${percent(count, all.length)} |`).join('\n')}\n\n## Piece counts after repair move\n\n| Pieces | Positions | Share |\n|---:|---:|---:|\n${sortedPieceCounts.map(([pieces, count]) => `| ${pieces} | ${count} | ${percent(count, all.length)} |`).join('\n')}\n\n## Warnings\n\n- None.\n\n## Errors\n\n- None.\n`;
fs.writeFileSync(path.join(proofDir, 'lichess-1000-validation.md'), validationMarkdown);

const summaryMarkdown = `# Lichess Position Training: 1,000-Puzzle Expansion\n\n- Previous production puzzles: ${originalManifestCount}\n- New validated puzzles: ${accepted.length}\n- Final production puzzles: ${all.length}\n- Existing shards preserved byte-for-byte: ${originalShardCount}\n- New shards: ${manifest.shards.length - originalShardCount}\n- Final shards: ${manifest.shards.length}\n- Shard size: ${manifest.shardSize}\n- First new puzzle: ${accepted[0].id}\n- Last new puzzle: ${accepted.at(-1).id}\n- Official source: Lichess puzzle database CSV export\n- Training model: ${manifest.trainingModel}\n- Exact stored continuation required: ${manifest.exactLineRequired}\n\nThe first database move is used only to repair the source FEN into the position presented to the solver. The trainer continues to judge objective-preserving moves dynamically rather than requiring the stored Lichess continuation.\n`;
fs.writeFileSync(path.join(proofDir, 'lichess-1000-expansion-summary.md'), summaryMarkdown);

const generatorLog = [
  `CSV rows scanned: ${scanned}`,
  `Existing puzzles preserved: ${existing.length}`,
  `New eligible puzzles accepted: ${accepted.length}`,
  `First new puzzle: ${accepted[0].id}`,
  `Last new puzzle: ${accepted.at(-1).id}`,
  `Rejected malformed: ${rejected.malformed}`,
  `Rejected duplicate ID: ${rejected.duplicateId}`,
  `Rejected duplicate position: ${rejected.duplicatePosition}`,
  `Rejected excluded theme: ${rejected.excludedTheme}`,
  `Rejected filters: ${rejected.filter}`,
  `Rejected illegal FEN/repair move: ${rejected.illegalFenOrRepairMove}`,
].join('\n');
fs.writeFileSync(path.join(logDir, 'lichess-1000-generator-output.txt'), `${generatorLog}\n`);

const expansionLog = [
  `Baseline preserved: ${existing.length}/${originalManifestCount}`,
  `New unique puzzles: ${accepted.length}`,
  `Production puzzles: ${all.length}`,
  `Production shards: ${manifest.shards.length}`,
  `Unique IDs: ${validationIds.size}`,
  `Unique starting positions: ${validationPositions.size}`,
  `First new puzzle: ${accepted[0].id}`,
  `Last new puzzle: ${accepted.at(-1).id}`,
].join('\n');
fs.writeFileSync(path.join(logDir, 'lichess-1000-expansion-output.txt'), `${expansionLog}\n`);

const validatorLog = [
  'Result: PASS',
  `Records: ${all.length}`,
  `Shards: ${manifest.shards.length}`,
  `Duplicate IDs: ${all.length - validationIds.size}`,
  `Repeated starting positions: ${all.length - validationPositions.size}`,
  `Exact continuation fields: ${exactContinuationFields}`,
  `Rating range: ${minRating}-${maxRating}`,
  `White solvers: ${white}`,
  `Black solvers: ${black}`,
  'Warnings: 0',
  'Errors: 0',
].join('\n');
fs.writeFileSync(path.join(logDir, 'lichess-1000-validator-output.txt'), `${validatorLog}\n`);

console.log(expansionLog);
console.log(generatorLog);
console.log(validatorLog);
