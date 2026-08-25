import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Extract parseInfoLine logic from app.js for direct unit testing
function parseInfoLine(line) {
  const tokens = String(line ?? '').trim().split(/\s+/);
  if (!tokens.length || tokens[0] !== 'info') {
    return null;
  }
  const info = {
    depth: null,
    nps: null,
    scoreType: '',
    scoreValue: null,
    pv: [],
    hasPv: false,
    multipv: 1,
    hasMultipv: false,
    nodes: null,
  };
  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    switch (token) {
      case 'depth':
        info.depth = Number.parseInt(tokens[index + 1], 10);
        index += 1;
        break;
      case 'multipv':
        info.hasMultipv = true;
        info.multipv = Number.parseInt(tokens[index + 1], 10) || 1;
        index += 1;
        break;
      case 'score':
        info.scoreType = tokens[index + 1] || '';
        info.scoreValue = Number.parseInt(tokens[index + 2], 10);
        index += 2;
        break;
      case 'nps':
        info.nps = Number.parseInt(tokens[index + 1], 10);
        index += 1;
        break;
      case 'nodes':
        info.nodes = Number.parseInt(tokens[index + 1], 10);
        index += 1;
        break;
      case 'pv':
        info.hasPv = true;
        info.pv = tokens.slice(index + 1);
        index = tokens.length;
        break;
      default:
        break;
    }
  }
  return info;
}

test('parseInfoLine correctly identifies PV lines vs progress/currmove lines', () => {
  const pvLine = parseInfoLine('info depth 31 seldepth 40 multipv 1 score cp 35 nodes 4502000 nps 1800000 pv e2e4 c7c5 g1f3 d7d6');
  assert.equal(pvLine.hasPv, true);
  assert.equal(pvLine.hasMultipv, true);
  assert.equal(pvLine.multipv, 1);
  assert.equal(pvLine.depth, 31);
  assert.equal(pvLine.scoreType, 'cp');
  assert.equal(pvLine.scoreValue, 35);
  assert.deepEqual(pvLine.pv, ['e2e4', 'c7c5', 'g1f3', 'd7d6']);

  const currmoveLine = parseInfoLine('info depth 31 seldepth 42 currmove e2e4 currmovenumber 1 hashfull 450 nodes 4510000 nps 1800000');
  assert.equal(currmoveLine.hasPv, false);
  assert.equal(currmoveLine.hasMultipv, false);
  assert.equal(currmoveLine.multipv, 1);
  assert.equal(currmoveLine.depth, 31);
  assert.deepEqual(currmoveLine.pv, []);

  const nodesLine = parseInfoLine('info nodes 5000000 nps 1900000 time 2500');
  assert.equal(nodesLine.hasPv, false);
  assert.equal(nodesLine.hasMultipv, false);
  assert.equal(nodesLine.nodes, 5000000);
  assert.equal(nodesLine.nps, 1900000);
});

test('intermediate progress lines do not wipe existing PV1 line when continuing past depth 30', () => {
  const pvLines = [
    { index: 1, line: 'e4 e5 Nf3 Nc6', uciMoves: ['e2e4', 'e7e5', 'g1f3', 'b8c6'], depth: 30, scoreType: 'cp', scoreValue: 30, evalLabel: '+0.30' },
    { index: 2, line: 'd4 d5 c4', uciMoves: ['d2d4', 'd7d5', 'c2c4'], depth: 30, scoreType: 'cp', scoreValue: 20, evalLabel: '+0.20' },
    { index: 3, line: 'c4 e5 Nc3', uciMoves: ['c2c4', 'e7e5', 'b1c3'], depth: 30, scoreType: 'cp', scoreValue: 15, evalLabel: '+0.15' },
  ];

  function applyInfo(line, uciToSan) {
    const info = parseInfoLine(line);
    if (!info || info.multipv < 1 || info.multipv > 3) return;
    const pvIndex = info.multipv - 1;
    const existingLine = pvLines[pvIndex];
    const uciLine = Array.isArray(info.pv) ? info.pv : [];
    const sanLine = uciToSan(uciLine);
    const nextEvalLabel = info.scoreType ? `+0.${info.scoreValue}` : existingLine.evalLabel;

    if (info.hasPv && sanLine.length) {
      pvLines[pvIndex] = {
        index: info.multipv,
        line: sanLine.join(' '),
        uciMoves: uciLine.slice(0, sanLine.length),
        depth: Number.isFinite(info.depth) ? info.depth : existingLine.depth,
        scoreType: info.scoreType || existingLine.scoreType,
        scoreValue: Number.isFinite(info.scoreValue) ? info.scoreValue : existingLine.scoreValue,
        evalLabel: nextEvalLabel,
      };
    } else if (info.scoreType && info.hasMultipv) {
      pvLines[pvIndex] = {
        ...existingLine,
        index: info.multipv,
        depth: Number.isFinite(info.depth) ? info.depth : existingLine.depth,
        scoreType: info.scoreType || existingLine.scoreType,
        scoreValue: Number.isFinite(info.scoreValue) ? info.scoreValue : existingLine.scoreValue,
        evalLabel: nextEvalLabel,
      };
    }
  }

  // Stockfish begins search past depth 30, sending intermediate progress lines without PV
  applyInfo('info depth 31 seldepth 42 currmove e2e4 currmovenumber 1 hashfull 450 nodes 4510000 nps 1800000', () => []);
  applyInfo('info nodes 4600000 nps 1850000 time 2600', () => []);

  // PV1 must still hold its previous line and not be blanked out!
  assert.equal(pvLines[0].line, 'e4 e5 Nf3 Nc6');
  assert.equal(pvLines[0].depth, 30);

  // New PV1 arrives at depth 31
  applyInfo(
    'info depth 31 seldepth 42 multipv 1 score cp 35 nodes 4700000 nps 1850000 pv e2e4 c7c5 g1f3 d7d6',
    () => ['e4', 'c5', 'Nf3', 'd6'],
  );
  assert.equal(pvLines[0].line, 'e4 c5 Nf3 d6');
  assert.equal(pvLines[0].depth, 31);

  // More progress lines arrive for depth 32
  applyInfo('info depth 32 seldepth 44 currmove e2e4 currmovenumber 1 hashfull 500 nodes 5500000 nps 1900000', () => []);

  // PV1 retains depth 31 line while searching depth 32
  assert.equal(pvLines[0].line, 'e4 c5 Nf3 d6');
  assert.equal(pvLines[0].depth, 31);
});

test('app.js does not render placeholder text inside PV line boxes while analyzing', () => {
  const appJsContent = fs.readFileSync(path.resolve(process.cwd(), 'app.js'), 'utf-8');
  assert.ok(
    !appJsContent.includes('Continuing analysis past depth ${state.engine.searchTargetDepth}...'),
    'app.js must not embed "Continuing analysis past depth..." in currentPvPlaceholderText',
  );
});
