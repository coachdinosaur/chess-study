#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { pipeline } from 'node:stream/promises';
import { PassThrough } from 'node:stream';
import * as zlib from 'node:zlib';
import { Chess } from '../vendor/chess.js';

const DEFAULTS = Object.freeze({
  input: 'lichess_db_puzzle.csv.zst',
  output: 'assets/puzzles/lichess-position-training',
  limit: 250000,
  shardSize: 2000,
  minRating: 700,
  maxRating: 2600,
  minPopularity: 80,
  minPlays: 50,
});

function parseArgs(argv) {
  const result = { ...DEFAULTS };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key.startsWith('--')) continue;
    index += 1;
    const name = key.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    result[name] = ['input', 'output', 'themes'].includes(name) ? value : Number(value);
  }
  return result;
}

function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

function parseUci(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(normalized)) return null;
  return {
    from: normalized.slice(0, 2),
    to: normalized.slice(2, 4),
    promotion: normalized[4] || undefined,
  };
}

function createInputStream(inputPath) {
  const source = fs.createReadStream(inputPath);
  if (!inputPath.endsWith('.zst')) return source;
  if (typeof zlib.createZstdDecompress !== 'function') {
    throw new Error('This Node.js build cannot decompress .zst files. Decompress the CSV first or use a Node build with Zstandard support.');
  }
  const output = new PassThrough();
  pipeline(source, zlib.createZstdDecompress(), output).catch((error) => output.destroy(error));
  return output;
}

function prepareRecord(fields, filters) {
  const [id, sourceFen, movesText, ratingText, , popularityText, playsText, themesText, gameUrl, openingTagsText] = fields;
  const rating = Number(ratingText);
  const popularity = Number(popularityText);
  const plays = Number(playsText);
  const themes = String(themesText || '').split(/\s+/).filter(Boolean);
  if (!id || !sourceFen || !movesText) return null;
  if (!Number.isFinite(rating) || rating < filters.minRating || rating > filters.maxRating) return null;
  if (!Number.isFinite(popularity) || popularity < filters.minPopularity) return null;
  if (!Number.isFinite(plays) || plays < filters.minPlays) return null;
  if (themes.includes('veryLong')) return null;
  if (filters.themeSet?.size && !themes.some((theme) => filters.themeSet.has(theme))) return null;

  const firstMove = String(movesText).trim().split(/\s+/)[0];
  const move = parseUci(firstMove);
  if (!move) return null;
  try {
    const game = new Chess(sourceFen);
    const losingMoverColor = game.turn();
    const applied = game.move(move);
    if (!applied) return null;
    return {
      id,
      sourceFen,
      repairMove: firstMove,
      startFen: game.fen(),
      losingMoverColor,
      solverColor: game.turn(),
      rating,
      popularity,
      plays,
      themes,
      gameUrl: String(gameUrl || ''),
      openingTags: String(openingTagsText || '').split(/\s+/).filter(Boolean),
    };
  } catch {
    return null;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(options.input);
  const outputDir = path.resolve(options.output);
  const themeSet = String(options.themes || '').split(/\s+/).filter(Boolean);
  const filters = { ...options, themeSet: new Set(themeSet) };

  fs.mkdirSync(outputDir, { recursive: true });
  const lines = readline.createInterface({ input: createInputStream(inputPath), crlfDelay: Infinity });
  const shards = [];
  let records = [];
  let accepted = 0;
  let scanned = 0;
  let headerChecked = false;

  const flush = () => {
    if (!records.length) return;
    const file = `shard-${String(shards.length).padStart(4, '0')}.json`;
    fs.writeFileSync(path.join(outputDir, file), `${JSON.stringify({ puzzles: records })}\n`);
    shards.push({ file, count: records.length });
    records = [];
  };

  for await (const line of lines) {
    if (!line.trim()) continue;
    const fields = parseCsvLine(line);
    if (!headerChecked) {
      headerChecked = true;
      if (String(fields[0]).toLowerCase() === 'puzzleid') continue;
    }
    scanned += 1;
    const record = prepareRecord(fields, filters);
    if (!record) continue;
    records.push(record);
    accepted += 1;
    if (records.length >= options.shardSize) flush();
    if (options.limit > 0 && accepted >= options.limit) break;
    if (scanned % 100000 === 0) process.stderr.write(`Scanned ${scanned.toLocaleString()}, accepted ${accepted.toLocaleString()}\n`);
  }
  flush();

  const manifest = {
    format: 1,
    generatedAt: new Date().toISOString(),
    source: 'Lichess puzzle database',
    trainingModel: 'position-objective-dynamic-defence',
    exactLineRequired: false,
    count: accepted,
    shardSize: options.shardSize,
    filters: {
      minRating: options.minRating,
      maxRating: options.maxRating,
      minPopularity: options.minPopularity,
      minPlays: options.minPlays,
      themes: themeSet,
      excludedThemes: ['veryLong'],
    },
    shards,
  };
  fs.writeFileSync(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`Created ${shards.length} shards with ${accepted.toLocaleString()} positions in ${outputDir}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
