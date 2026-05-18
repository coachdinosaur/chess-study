#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { Chess, validateFen } from '../../vendor/chess.js';

const APP_CSV = 'Endgame/wtharvey_tactics_input.csv';
const RAW_CSV = 'Endgame/wtharvey_puzzles_raw.csv';
const REPORT_CSV = 'Endgame/wtharvey_tactics_check_report.csv';
const FEN_REPAIRS = new Map([
  [
    '21qrr2k1/1p1bbppp/p1nppn2/3N4/1PPNPP2/P3B3/4B1PP/2RQ1RK1 w - - 1 1',
    '1qrr2k1/1p1bbppp/p1nppn2/3N4/1PPNPP2/P3B3/4B1PP/2RQ1RK1 w - - 1 1',
  ],
  [
    '8/4p3/1N2p1B1/1P2k2K/1P7/8/5P2/7Q w - - 0 1',
    '8/4p3/1N2p1B1/1P2k2K/1P6/8/5P2/7Q w - - 0 1',
  ],
  [
    '36r1b3k1/pp2p1b1/4pq2/3p2NQ/5BP1/8/PP3P2/2R2K2 w - - 1 1',
    'r1b3k1/pp2p1b1/4pq2/3p2NQ/5BP1/8/PP3P2/2R2K2 w - - 1 1',
  ],
  [
    '5K2/2BB3/n7/3k4/4N3/2p3P1/2P2Q2/8 w - - 0 1',
    '5K2/2BB4/n7/3k4/4N3/2p3P1/2P2Q2/8 w - - 0 1',
  ],
]);

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function rowsToObjects(rows) {
  const [headers, ...body] = rows;
  return {
    headers,
    records: body
      .filter((row) => row.length > 1 || String(row[0] ?? '').trim())
      .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? '']))),
  };
}

function escapeCsvField(value) {
  const text = String(value ?? '');
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function writeCsv(filePath, headers, records) {
  const lines = [
    headers.map(escapeCsvField).join(','),
    ...records.map((record) => headers.map((header) => escapeCsvField(record[header])).join(',')),
  ];
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8');
}

function normalizeFen(fen) {
  return String(fen ?? '').trim().replace(/\s+/g, ' ');
}

function sideToMove(fen) {
  const side = normalizeFen(fen).split(' ')[1];
  return side === 'b' ? 'black' : 'white';
}

function pieceCounts(fen) {
  const board = normalizeFen(fen).split(' ')[0] ?? '';
  let white = 0;
  let black = 0;

  for (const char of board) {
    if (!/[a-z]/i.test(char)) continue;
    if (char === char.toUpperCase()) white += 1;
    else black += 1;
  }

  return { white, black };
}

function isEndgameLike(fen) {
  const counts = pieceCounts(fen);
  return counts.white <= 4 && counts.black <= 4;
}

function extractRating(...values) {
  for (const value of values) {
    const match = String(value ?? '').match(/\((1[0-9]{3}|2[0-9]{3}|3[0-9]{3})\)/);
    if (match) return Number(match[1]);
  }
  return null;
}

function extractMateIn(...values) {
  const combined = values.map((value) => String(value ?? '')).join(' ');
  const match = combined.match(/\bmates?\s+in\s+(\d+)\b/i);
  return match ? Number(match[1]) : null;
}

function tierFromRating(rating) {
  if (rating < 1600) return 'beginner';
  if (rating < 2000) return 'intermediate';
  if (rating < 2300) return 'advanced';
  return 'expert';
}

function countSolutionMoveTokens(solution) {
  return tokenizeSolution(solution)
    .filter((token) => !/^(if|or|and|then)$/i.test(token))
    .length;
}

function retier(row, rawRow) {
  const rating = extractRating(rawRow.title, rawRow.task, row.title, row.plan);
  if (rating !== null) return tierFromRating(rating);

  const mateIn = extractMateIn(rawRow.task, row.plan, rawRow.page_title);
  if (mateIn !== null) {
    if (mateIn <= 2) return 'beginner';
    if (mateIn === 3) return 'intermediate';
    if (mateIn <= 5) return 'advanced';
    return 'expert';
  }

  const moveCount = countSolutionMoveTokens(rawRow.solution);
  if (moveCount <= 1) return 'beginner';
  if (moveCount <= 3) return 'intermediate';
  if (moveCount <= 6) return 'advanced';
  return 'expert';
}

function tokenizeSolution(solution) {
  return String(solution ?? '')
    .replace(/\b[O0]\s+[O0]\s+[O0]\b/g, 'O-O-O')
    .replace(/\b[O0]\s+[O0]\b/g, 'O-O')
    .replace(/\b([KQRBN])\(([a-h])\s+or\s+([a-h])\)([a-h][1-8][+#]?)\b/gi, '$1$2$4 $1$3$4')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(?:if|or)\b/gi, ' $& ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => token.replace(/[;,]+$/g, ''));
}

function cleanMoveToken(token) {
  let cleaned = String(token ?? '').trim();
  cleaned = cleaned.replace(/^\d+\.+/, '');
  cleaned = cleaned.replace(/^\.+/, '');
  cleaned = cleaned.replace(/^[^KQRBNabcdefghO0]+/, '');
  cleaned = cleaned.replace(/^[a-z]\.\.\./, '');
  cleaned = cleaned.replace(/[!?]+/g, '');
  cleaned = cleaned.replace(/[;,]+$/g, '');
  cleaned = cleaned.replace(/if$/i, '');
  cleaned = cleaned.replace(/^([KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]).+$/, '$1');
  cleaned = cleaned.replace(/^([a-h][18])\/([QRBN])([+#]?)$/i, '$1=$2$3');
  cleaned = cleaned.replace(/^([a-h]x[a-h][18])\/([QRBN])([+#]?)$/i, '$1=$2$3');
  cleaned = cleaned.replace(/^0-0-0$/i, 'O-O-O');
  cleaned = cleaned.replace(/^0-0$/i, 'O-O');
  return cleaned;
}

function extractFirstMove(solution) {
  for (const token of tokenizeSolution(solution)) {
    const lower = token.toLowerCase();
    if (['if', 'or', 'and', 'then'].includes(lower)) continue;
    if (/^\d+\.*$/.test(token)) continue;
    if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(token)) continue;

    const cleaned = cleanMoveToken(token);
    if (!cleaned || /^\d+\.*$/.test(cleaned)) continue;
    return cleaned;
  }
  return '';
}

function validateFirstMove(fen, solution) {
  const firstMove = extractFirstMove(solution);
  if (!String(solution ?? '').trim()) {
    return { ok: false, firstMove: '', issue: 'missing_solution' };
  }
  if (!firstMove) {
    return { ok: false, firstMove: '', issue: 'unparsed_solution' };
  }

  try {
    const game = new Chess(fen);
    game.move(firstMove, { strict: false });
    return { ok: true, firstMove, issue: '' };
  } catch (error) {
    return { ok: false, firstMove, issue: `illegal_first_move: ${error.message}` };
  }
}

function main() {
  const appPath = path.resolve(APP_CSV);
  const rawPath = path.resolve(RAW_CSV);
  const reportPath = path.resolve(REPORT_CSV);

  const app = rowsToObjects(parseCsv(fs.readFileSync(appPath, 'utf8')));
  const raw = rowsToObjects(parseCsv(fs.readFileSync(rawPath, 'utf8')));

  if (app.records.length !== raw.records.length) {
    throw new Error(`Row count mismatch: app=${app.records.length}, raw=${raw.records.length}`);
  }

  if (!app.headers.includes('endgame_like')) {
    app.headers.push('endgame_like');
  }

  const report = [];
  const summary = {
    rows: app.records.length,
    checked: 0,
    needsReview: 0,
    fenIssues: 0,
    firstMoveIssues: 0,
    playerColorChanged: 0,
    tierChanged: 0,
  };

  for (let index = 0; index < app.records.length; index += 1) {
    const row = app.records[index];
    const rawRow = raw.records[index];
    const rowNumber = index + 2;
    const originalFen = normalizeFen(row.fen);
    const fen = FEN_REPAIRS.get(originalFen) ?? originalFen;
    row.fen = fen;
    row.endgame_like = isEndgameLike(fen) ? 'yes' : 'no';

    const fenCheck = validateFen(fen);
    const issues = [];
    if (!fenCheck.ok) {
      issues.push(`invalid_fen: ${fenCheck.error}`);
      summary.fenIssues += 1;
    }

    const expectedColor = sideToMove(fen);
    if (row.player_color !== expectedColor) {
      row.player_color = expectedColor;
      summary.playerColorChanged += 1;
    }

    const newTier = retier(row, rawRow);
    if (row.level_tier !== newTier) {
      row.level_tier = newTier;
      summary.tierChanged += 1;
    }

    let firstMoveResult = { ok: false, firstMove: '', issue: 'invalid_fen' };
    if (fenCheck.ok) {
      firstMoveResult = validateFirstMove(fen, rawRow.solution);
      if (!firstMoveResult.ok) {
        issues.push(firstMoveResult.issue);
        summary.firstMoveIssues += 1;
      }
    }

    row.status = issues.length ? 'needs_review' : 'checked';
    if (row.status === 'checked') summary.checked += 1;
    else summary.needsReview += 1;

    report.push({
      row_number: rowNumber,
      status: row.status,
      level_tier: row.level_tier,
      first_move: firstMoveResult.firstMove,
      issue: issues.join(' | '),
      title: row.title,
      source_url: rawRow.source_url,
      fen: row.fen,
      solution: rawRow.solution,
    });
  }

  writeCsv(appPath, app.headers, app.records);
  writeCsv(
    reportPath,
    ['row_number', 'status', 'level_tier', 'first_move', 'issue', 'title', 'source_url', 'fen', 'solution'],
    report,
  );

  console.log(JSON.stringify(summary, null, 2));
  console.log(`Updated ${APP_CSV}`);
  console.log(`Wrote ${REPORT_CSV}`);
}

main();
