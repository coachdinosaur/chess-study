#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { Chess } from '../vendor/chess.js';

function parseArgs(argv) {
  const options = {
    dir: 'assets/puzzles/lichess-position-training',
    report: 'docs/lichess-position-training-validation.md',
    expectedCount: 0,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key.startsWith('--')) continue;
    index += 1;
    const name = key.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    options[name] = name === 'expectedCount' ? Number(value) : value;
  }
  return options;
}

function parseUci(value) {
  const move = String(value || '').trim().toLowerCase();
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)) return null;
  return {
    from: move.slice(0, 2),
    to: move.slice(2, 4),
    promotion: move[4] || undefined,
  };
}

function pieceCount(fen) {
  return [...String(fen || '').split(' ')[0]].filter((character) => /[prnbqk]/i.test(character)).length;
}

function percentage(value, total) {
  if (!total) return '0.0%';
  return `${((value / total) * 100).toFixed(1)}%`;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

const options = parseArgs(process.argv.slice(2));
const directory = path.resolve(options.dir);
const manifestPath = path.join(directory, 'manifest.json');
const reportPath = path.resolve(options.report);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const shardEntries = Array.isArray(manifest.shards) ? manifest.shards : [];
const errors = [];
const warnings = [];
const ids = new Set();
const startFens = new Map();
const ratings = [];
const themeCounts = new Map();
const colorCounts = { w: 0, b: 0 };
const pieceCounts = new Map();
let records = 0;
let exactLineFields = 0;

for (const shard of shardEntries) {
  const shardPath = path.join(directory, shard.file);
  if (!fs.existsSync(shardPath)) {
    errors.push(`Missing shard: ${shard.file}`);
    continue;
  }
  const payload = JSON.parse(fs.readFileSync(shardPath, 'utf8'));
  const puzzles = Array.isArray(payload) ? payload : payload.puzzles;
  if (!Array.isArray(puzzles)) {
    errors.push(`Shard ${shard.file} has no puzzles array.`);
    continue;
  }
  if (Number(shard.count) !== puzzles.length) {
    errors.push(`Shard ${shard.file} manifest count ${shard.count} does not match ${puzzles.length}.`);
  }

  for (const record of puzzles) {
    records += 1;
    const id = String(record?.id || '').trim();
    if (!id) errors.push(`Record ${records} has no id.`);
    else if (ids.has(id)) errors.push(`Duplicate puzzle id: ${id}`);
    else ids.add(id);

    for (const field of ['moves', 'solution', 'bestLine', 'bestLineUci', 'continuation']) {
      if (Object.prototype.hasOwnProperty.call(record || {}, field)) exactLineFields += 1;
    }

    const sourceFen = String(record?.sourceFen || '').trim();
    const startFen = String(record?.startFen || '').trim();
    const repairMove = parseUci(record?.repairMove);
    if (!sourceFen || !startFen || !repairMove) {
      errors.push(`${id || `Record ${records}`} is missing sourceFen, startFen, or a legal-looking repairMove.`);
      continue;
    }

    try {
      const game = new Chess(sourceFen);
      const losingMoverColor = game.turn();
      if (record.losingMoverColor !== losingMoverColor) {
        errors.push(`${id}: losingMoverColor ${record.losingMoverColor} does not match source turn ${losingMoverColor}.`);
      }
      const applied = game.move(repairMove);
      if (!applied) {
        errors.push(`${id}: repair move is illegal.`);
        continue;
      }
      if (game.fen() !== startFen) {
        errors.push(`${id}: stored startFen does not equal the position after the repair move.`);
      }
      if (record.solverColor !== game.turn()) {
        errors.push(`${id}: solverColor ${record.solverColor} does not match resulting turn ${game.turn()}.`);
      }
      if (record.solverColor === losingMoverColor) {
        errors.push(`${id}: solver color did not change after the repair move.`);
      }
      colorCounts[game.turn()] += 1;
      const pieces = pieceCount(startFen);
      pieceCounts.set(pieces, (pieceCounts.get(pieces) || 0) + 1);
    } catch (error) {
      errors.push(`${id}: ${error.message}`);
    }

    const duplicateCount = startFens.get(startFen) || 0;
    startFens.set(startFen, duplicateCount + 1);

    const rating = Number(record?.rating);
    if (!Number.isFinite(rating)) errors.push(`${id}: rating is missing or invalid.`);
    else ratings.push(rating);

    for (const theme of Array.isArray(record?.themes) ? record.themes : []) {
      themeCounts.set(theme, (themeCounts.get(theme) || 0) + 1);
    }
  }
}

if (records !== Number(manifest.count)) {
  errors.push(`Manifest count ${manifest.count} does not match ${records} loaded records.`);
}
if (options.expectedCount > 0 && records !== options.expectedCount) {
  errors.push(`Expected ${options.expectedCount} records but found ${records}.`);
}
if (exactLineFields > 0) {
  errors.push(`${exactLineFields} exact-continuation fields were found.`);
}
if (!colorCounts.w || !colorCounts.b) {
  errors.push('The validation set does not contain both White and Black solvers.');
}

const duplicatePositionGroups = [...startFens.values()].filter((count) => count > 1);
const duplicatePositionRecords = duplicatePositionGroups.reduce((total, count) => total + count - 1, 0);
if (duplicatePositionRecords > Math.max(10, Math.round(records * 0.02))) {
  warnings.push(`${duplicatePositionRecords} records repeat a starting FEN.`);
}

const ratingBuckets = [
  [700, 999],
  [1000, 1299],
  [1300, 1599],
  [1600, 1899],
  [1900, 2199],
  [2200, 2600],
].map(([minimum, maximum]) => ({
  label: `${minimum}-${maximum}`,
  count: ratings.filter((rating) => rating >= minimum && rating <= maximum).length,
}));

const topThemes = [...themeCounts.entries()]
  .sort((left, right) => right[1] - left[1])
  .slice(0, 20);
const pieceRows = [...pieceCounts.entries()].sort((left, right) => left[0] - right[0]);
const result = errors.length ? 'FAIL' : 'PASS';

const report = [
  '# Lichess Position Training Validation',
  '',
  `- Result: **${result}**`,
  `- Generated: ${new Date().toISOString()}`,
  `- Records: ${records.toLocaleString()}`,
  `- Shards: ${shardEntries.length}`,
  `- Exact continuation fields: ${exactLineFields}`,
  `- Duplicate IDs: ${records - ids.size}`,
  `- Repeated starting-position records: ${duplicatePositionRecords}`,
  '',
  '## Solver colors',
  '',
  `- White: ${colorCounts.w.toLocaleString()} (${percentage(colorCounts.w, records)})`,
  `- Black: ${colorCounts.b.toLocaleString()} (${percentage(colorCounts.b, records)})`,
  '',
  '## Ratings',
  '',
  `- Minimum: ${ratings.length ? Math.min(...ratings) : 'n/a'}`,
  `- Median: ${median(ratings) ?? 'n/a'}`,
  `- Maximum: ${ratings.length ? Math.max(...ratings) : 'n/a'}`,
  '',
  '| Range | Count | Share |',
  '|---|---:|---:|',
  ...ratingBuckets.map((bucket) => `| ${bucket.label} | ${bucket.count.toLocaleString()} | ${percentage(bucket.count, ratings.length)} |`),
  '',
  '## Most common themes',
  '',
  '| Theme | Count | Share |',
  '|---|---:|---:|',
  ...topThemes.map(([theme, count]) => `| ${theme} | ${count.toLocaleString()} | ${percentage(count, records)} |`),
  '',
  '## Piece counts after repair move',
  '',
  '| Pieces | Positions | Share |',
  '|---:|---:|---:|',
  ...pieceRows.map(([pieces, count]) => `| ${pieces} | ${count.toLocaleString()} | ${percentage(count, records)} |`),
  '',
  '## Warnings',
  '',
  ...(warnings.length ? warnings.map((warning) => `- ${warning}`) : ['- None.']),
  '',
  '## Errors',
  '',
  ...(errors.length ? errors.slice(0, 200).map((error) => `- ${error}`) : ['- None.']),
  '',
].join('\n');

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, report);
process.stdout.write(report);
if (errors.length) process.exitCode = 1;
