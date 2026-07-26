import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { Chess } from '../vendor/chess.js';

const ROOT = process.cwd();
const DATA_DIR = join(ROOT, 'assets', 'puzzles', 'lichess-position-training');
const MANIFEST_PATH = join(DATA_DIR, 'manifest.json');
const PROOF_DIR = join(ROOT, 'proof');
const START_COUNT = 2000;
const ADD_COUNT = 3000;
const FINAL_COUNT = START_COUNT + ADD_COUNT;
const SHARD_SIZE = 25;
const START_SHARD_INDEX = START_COUNT / SHARD_SIZE;
const FINAL_SHARD_COUNT = FINAL_COUNT / SHARD_SIZE;
const VALIDATE_ONLY = process.argv.includes('--validate-only');

function fail(message) {
  throw new Error(message);
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

function shardName(index) {
  return `shard-${String(index).padStart(4, '0')}.json`;
}

function parseCsvLine(line) {
  const fields = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      fields.push(field);
      field = '';
    } else {
      field += char;
    }
  }
  fields.push(field);
  return fields;
}

function uciToMove(uci) {
  const normalized = String(uci || '').trim().toLowerCase();
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(normalized)) return null;
  return {
    from: normalized.slice(0, 2),
    to: normalized.slice(2, 4),
    promotion: normalized[4] || undefined,
  };
}

function readManifest() {
  return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
}

function loadExistingDataset(manifest) {
  const ids = new Set();
  const positions = new Set();
  const oldHashes = new Map();
  let count = 0;

  for (const descriptor of manifest.shards) {
    const path = join(DATA_DIR, descriptor.file);
    const raw = readFileSync(path, 'utf8');
    oldHashes.set(descriptor.file, sha256(raw));
    const payload = JSON.parse(raw);
    if (!Array.isArray(payload.puzzles)) fail(`${descriptor.file} has no puzzles array.`);
    if (payload.puzzles.length !== descriptor.count) {
      fail(`${descriptor.file} count does not match its manifest descriptor.`);
    }
    for (const puzzle of payload.puzzles) {
      if (!puzzle.id || ids.has(puzzle.id)) fail(`Duplicate existing puzzle ID: ${puzzle.id}`);
      if (!puzzle.startFen || positions.has(puzzle.startFen)) {
        fail(`Duplicate existing starting position: ${puzzle.startFen}`);
      }
      ids.add(puzzle.id);
      positions.add(puzzle.startFen);
      count += 1;
    }
  }

  return { ids, positions, oldHashes, count };
}

function validateBaseline(manifest, existing) {
  if (manifest.count !== START_COUNT) {
    fail(`Expected ${START_COUNT} baseline puzzles, found ${manifest.count}.`);
  }
  if (manifest.shardSize !== SHARD_SIZE) fail(`Expected shard size ${SHARD_SIZE}.`);
  if (manifest.shards.length !== START_SHARD_INDEX) {
    fail(`Expected ${START_SHARD_INDEX} baseline shards, found ${manifest.shards.length}.`);
  }
  if (existing.count !== START_COUNT) {
    fail(`Baseline shard contents total ${existing.count}, expected ${START_COUNT}.`);
  }
  const finalBaselineName = shardName(START_SHARD_INDEX - 1);
  if (manifest.shards.at(-1)?.file !== finalBaselineName) {
    fail(`Expected baseline to end at ${finalBaselineName}.`);
  }
}

function buildRecord(fields, existingIds, existingPositions, acceptedIds, acceptedPositions, stats) {
  if (fields.length < 9) {
    stats.malformed += 1;
    return null;
  }

  const [
    rawId,
    rawFen,
    rawMoves,
    rawRating,
    _ratingDeviation,
    rawPopularity,
    rawPlays,
    rawThemes,
    rawGameUrl,
    rawOpeningTags = '',
  ] = fields;

  const id = String(rawId || '').trim();
  if (!id) {
    stats.malformed += 1;
    return null;
  }
  if (existingIds.has(id)) {
    stats.existingIds += 1;
    return null;
  }
  if (acceptedIds.has(id)) {
    stats.duplicateNewIds += 1;
    return null;
  }

  const themes = String(rawThemes || '').trim().split(/\s+/).filter(Boolean);
  if (themes.includes('veryLong')) {
    stats.excludedVeryLong += 1;
    return null;
  }

  const sourceFen = String(rawFen || '').trim();
  const sourceMoves = String(rawMoves || '').trim().split(/\s+/).filter(Boolean);
  if (!sourceFen || sourceMoves.length < 2) {
    stats.malformed += 1;
    return null;
  }

  const repairMove = sourceMoves[0].toLowerCase();
  const move = uciToMove(repairMove);
  if (!move) {
    stats.invalidRepairMove += 1;
    return null;
  }

  let game;
  let applied;
  try {
    game = new Chess(sourceFen);
    applied = game.move(move);
  } catch {
    stats.invalidFenOrMove += 1;
    return null;
  }
  if (!applied) {
    stats.invalidFenOrMove += 1;
    return null;
  }

  const losingMoverColor = game.turn() === 'w' ? 'b' : 'w';
  const solverColor = game.turn();
  if (solverColor === losingMoverColor || game.isGameOver()) {
    stats.invalidSolverPosition += 1;
    return null;
  }

  const startFen = game.fen();
  if (existingPositions.has(startFen) || acceptedPositions.has(startFen)) {
    stats.duplicatePositions += 1;
    return null;
  }

  const rating = Number(rawRating);
  const popularity = Number(rawPopularity);
  const plays = Number(rawPlays);
  if (![rating, popularity, plays].every(Number.isFinite)) {
    stats.malformed += 1;
    return null;
  }

  acceptedIds.add(id);
  acceptedPositions.add(startFen);
  return {
    id,
    sourceFen,
    repairMove,
    startFen,
    losingMoverColor,
    solverColor,
    rating,
    popularity,
    plays,
    themes,
    gameUrl: String(rawGameUrl || '').trim(),
    openingTags: String(rawOpeningTags || '').trim().split(/\s+/).filter(Boolean),
  };
}

function verifyPuzzle(puzzle, descriptorFile) {
  const forbiddenFields = ['moves', 'solution', 'continuation', 'exactLine'];
  for (const field of forbiddenFields) {
    if (Object.hasOwn(puzzle, field)) fail(`${descriptorFile}/${puzzle.id} stores forbidden field ${field}.`);
  }
  const move = uciToMove(puzzle.repairMove);
  if (!move) fail(`${descriptorFile}/${puzzle.id} has invalid repairMove.`);
  let game;
  let applied;
  try {
    game = new Chess(puzzle.sourceFen);
    const losingMoverColor = game.turn();
    applied = game.move(move);
    if (!applied) fail(`${descriptorFile}/${puzzle.id} has an illegal repair move.`);
    if (puzzle.losingMoverColor !== losingMoverColor) {
      fail(`${descriptorFile}/${puzzle.id} has the wrong losing mover color.`);
    }
    if (puzzle.solverColor !== game.turn()) {
      fail(`${descriptorFile}/${puzzle.id} has the wrong solver color.`);
    }
    if (puzzle.startFen !== game.fen()) {
      fail(`${descriptorFile}/${puzzle.id} startFen does not reconstruct from the source.`);
    }
  } catch (error) {
    fail(`${descriptorFile}/${puzzle.id} failed reconstruction: ${error.message}`);
  }
}

function validateDataset(expectedCount = FINAL_COUNT) {
  const manifest = readManifest();
  if (manifest.count !== expectedCount) fail(`Manifest count ${manifest.count} does not equal ${expectedCount}.`);
  if (manifest.shardSize !== SHARD_SIZE) fail(`Manifest shard size is not ${SHARD_SIZE}.`);
  if (manifest.shards.length !== expectedCount / SHARD_SIZE) {
    fail(`Manifest lists ${manifest.shards.length} shards, expected ${expectedCount / SHARD_SIZE}.`);
  }
  if (manifest.exactLineRequired !== false) fail('exactLineRequired must remain false.');
  if (!manifest.filters?.excludedThemes?.includes('veryLong')) fail('veryLong must remain excluded.');

  const ids = new Set();
  const positions = new Set();
  const ratings = [];
  const sideCounts = { w: 0, b: 0 };
  let total = 0;

  manifest.shards.forEach((descriptor, index) => {
    const expectedName = shardName(index);
    if (descriptor.file !== expectedName) fail(`Shard ${index} should be ${expectedName}, found ${descriptor.file}.`);
    if (descriptor.count !== SHARD_SIZE) fail(`${descriptor.file} descriptor count is not ${SHARD_SIZE}.`);
    const payload = JSON.parse(readFileSync(join(DATA_DIR, descriptor.file), 'utf8'));
    if (!Array.isArray(payload.puzzles) || payload.puzzles.length !== SHARD_SIZE) {
      fail(`${descriptor.file} does not contain exactly ${SHARD_SIZE} puzzles.`);
    }
    for (const puzzle of payload.puzzles) {
      if (ids.has(puzzle.id)) fail(`Duplicate puzzle ID: ${puzzle.id}`);
      if (positions.has(puzzle.startFen)) fail(`Repeated starting position: ${puzzle.startFen}`);
      ids.add(puzzle.id);
      positions.add(puzzle.startFen);
      verifyPuzzle(puzzle, descriptor.file);
      ratings.push(Number(puzzle.rating));
      sideCounts[puzzle.solverColor] += 1;
      total += 1;
    }
  });

  if (total !== expectedCount) fail(`Validated ${total} puzzles, expected ${expectedCount}.`);
  ratings.sort((a, b) => a - b);
  const midpoint = Math.floor(ratings.length / 2);
  const median = ratings.length % 2
    ? ratings[midpoint]
    : Math.round((ratings[midpoint - 1] + ratings[midpoint]) / 2);

  return {
    total,
    shards: manifest.shards.length,
    shardSize: manifest.shardSize,
    duplicateIds: 0,
    repeatedStartingPositions: 0,
    forbiddenContinuationFields: 0,
    ratingMin: ratings[0],
    ratingMax: ratings.at(-1),
    ratingMedian: median,
    whiteToSolve: sideCounts.w,
    blackToSolve: sideCounts.b,
  };
}

function writeProof(summary, validation) {
  mkdirSync(PROOF_DIR, { recursive: true });
  const expansion = `# Lichess 5,000-puzzle expansion\n\n` +
    `- Baseline puzzles: ${START_COUNT}\n` +
    `- Added puzzles: ${ADD_COUNT}\n` +
    `- Final puzzles: ${validation.total}\n` +
    `- Baseline shards preserved: ${START_SHARD_INDEX}\n` +
    `- New shards: ${START_SHARD_INDEX} through ${FINAL_SHARD_COUNT - 1}\n` +
    `- Final shards: ${validation.shards}\n` +
    `- Source rows scanned: ${summary.scanned}\n` +
    `- Existing IDs skipped: ${summary.existingIds}\n` +
    `- veryLong puzzles excluded: ${summary.excludedVeryLong}\n` +
    `- Duplicate new positions rejected: ${summary.duplicatePositions}\n` +
    `- Malformed or illegal records rejected: ${summary.malformed + summary.invalidRepairMove + summary.invalidFenOrMove + summary.invalidSolverPosition}\n`;
  writeFileSync(join(PROOF_DIR, 'lichess-5000-expansion-summary.md'), expansion, 'utf8');

  const report = `# Lichess 5,000-puzzle validation\n\n` +
    `- Total puzzles: ${validation.total}\n` +
    `- Total shards: ${validation.shards}\n` +
    `- Shard size: ${validation.shardSize}\n` +
    `- Duplicate puzzle IDs: ${validation.duplicateIds}\n` +
    `- Repeated starting positions: ${validation.repeatedStartingPositions}\n` +
    `- Forbidden continuation fields: ${validation.forbiddenContinuationFields}\n` +
    `- Rating range: ${validation.ratingMin}-${validation.ratingMax}\n` +
    `- Median rating: ${validation.ratingMedian}\n` +
    `- White to solve: ${validation.whiteToSolve}\n` +
    `- Black to solve: ${validation.blackToSolve}\n`;
  writeFileSync(join(PROOF_DIR, 'lichess-5000-validation.md'), report, 'utf8');
}

async function generate() {
  const manifest = readManifest();
  const existing = loadExistingDataset(manifest);
  validateBaseline(manifest, existing);

  const accepted = [];
  const acceptedIds = new Set();
  const acceptedPositions = new Set();
  const stats = {
    scanned: 0,
    existingIds: 0,
    excludedVeryLong: 0,
    malformed: 0,
    invalidRepairMove: 0,
    invalidFenOrMove: 0,
    invalidSolverPosition: 0,
    duplicateNewIds: 0,
    duplicatePositions: 0,
  };

  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const originalLine of lines) {
    const line = originalLine.replace(/^\uFEFF/, '');
    if (!line || line.startsWith('PuzzleId,FEN,Moves,')) continue;
    stats.scanned += 1;
    const record = buildRecord(
      parseCsvLine(line),
      existing.ids,
      existing.positions,
      acceptedIds,
      acceptedPositions,
      stats,
    );
    if (record) accepted.push(record);
    if (accepted.length === ADD_COUNT) break;
  }
  lines.close();

  if (accepted.length !== ADD_COUNT) {
    fail(`Source stream ended after accepting ${accepted.length} of ${ADD_COUNT} required puzzles.`);
  }

  for (let offset = 0; offset < accepted.length; offset += SHARD_SIZE) {
    const index = START_SHARD_INDEX + offset / SHARD_SIZE;
    const file = shardName(index);
    const path = join(DATA_DIR, file);
    if (existsSync(path)) fail(`Refusing to overwrite existing ${file}.`);
    writeFileSync(path, `${JSON.stringify({ puzzles: accepted.slice(offset, offset + SHARD_SIZE) })}\n`, 'utf8');
    manifest.shards.push({ file, count: SHARD_SIZE });
  }

  manifest.generatedAt = new Date().toISOString();
  manifest.count = FINAL_COUNT;
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  for (const [file, beforeHash] of existing.oldHashes) {
    const afterHash = sha256(readFileSync(join(DATA_DIR, file), 'utf8'));
    if (beforeHash !== afterHash) fail(`Baseline shard changed unexpectedly: ${file}`);
  }

  const validation = validateDataset(FINAL_COUNT);
  writeProof(stats, validation);
  console.log(JSON.stringify({ generation: stats, validation }, null, 2));
}

if (VALIDATE_ONLY) {
  console.log(JSON.stringify({ validation: validateDataset(FINAL_COUNT) }, null, 2));
} else {
  await generate();
}
