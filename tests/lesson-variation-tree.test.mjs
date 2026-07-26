import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPgnFromLessonTree, parsePgnToLessonTree } from '../pgn.mjs';
import {
  appendChildPreservingMainLine,
  ensureExistingChildMainLine,
  isNodeMainLine,
  preferredChildId,
  promoteNodeToMainLine,
  variationDepth,
} from '../lesson-variation-tree.mjs';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const E4_FEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
const D4_FEN = 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1';
const E4_E5_FEN = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
const E4_C5_FEN = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
const E4_C5_NF3_FEN = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2';
const E4_C5_D3_FEN = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/3P4/PPP2PPP/RNBQKBNR b KQkq - 0 2';

function rootTree() {
  return {
    root: {
      id: 'root',
      parentId: null,
      fen: START_FEN,
      children: [],
      selectedChildId: null,
      comment: '',
    },
  };
}

function moveNode(id, san, fen, extra = {}) {
  return {
    id,
    parentId: null,
    from: extra.from || null,
    to: extra.to || null,
    promotion: extra.promotion || null,
    san,
    fen,
    children: [],
    selectedChildId: null,
    comment: extra.comment || '',
  };
}

test('the first recorded move becomes the main line', () => {
  const nodes = rootTree();
  const result = appendChildPreservingMainLine(nodes, 'root', moveNode('n1', 'e4', E4_FEN));

  assert.equal(result.addedAsVariation, false);
  assert.equal(nodes.root.selectedChildId, 'n1');
  assert.equal(preferredChildId(nodes, 'root'), 'n1');
  assert.equal(isNodeMainLine(nodes, 'n1'), true);
});

test('later moves from the same position remain variations', () => {
  const nodes = rootTree();
  appendChildPreservingMainLine(nodes, 'root', moveNode('n1', 'e4', E4_FEN));
  const result = appendChildPreservingMainLine(nodes, 'root', moveNode('n2', 'd4', D4_FEN));

  assert.equal(result.addedAsVariation, true);
  assert.equal(nodes.root.selectedChildId, 'n1');
  assert.deepEqual(nodes.root.children, ['n1', 'n2']);
  assert.equal(isNodeMainLine(nodes, 'n2'), false);
});

test('following an existing variation does not silently promote it', () => {
  const nodes = rootTree();
  appendChildPreservingMainLine(nodes, 'root', moveNode('n1', 'e4', E4_FEN));
  appendChildPreservingMainLine(nodes, 'root', moveNode('n2', 'd4', D4_FEN));

  const result = ensureExistingChildMainLine(nodes, 'root', 'n2');

  assert.equal(result.changed, false);
  assert.equal(result.mainLineChildId, 'n1');
  assert.equal(nodes.root.selectedChildId, 'n1');
});

test('Make main line explicitly promotes the selected move', () => {
  const nodes = rootTree();
  appendChildPreservingMainLine(nodes, 'root', moveNode('n1', 'e4', E4_FEN));
  appendChildPreservingMainLine(nodes, 'root', moveNode('n2', 'd4', D4_FEN));

  const result = promoteNodeToMainLine(nodes, 'n2');

  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  assert.equal(result.previousMainLineId, 'n1');
  assert.equal(nodes.root.selectedChildId, 'n2');
  assert.equal(isNodeMainLine(nodes, 'n2'), true);
  assert.equal(isNodeMainLine(nodes, 'n1'), false);
});

test('nested sub-variations preserve a main line at every branch point', () => {
  const nodes = rootTree();
  appendChildPreservingMainLine(nodes, 'root', moveNode('n1', 'e4', E4_FEN));
  appendChildPreservingMainLine(nodes, 'n1', moveNode('n3', 'e5', E4_E5_FEN));
  appendChildPreservingMainLine(nodes, 'n1', moveNode('n4', 'c5', E4_C5_FEN));
  appendChildPreservingMainLine(nodes, 'n4', moveNode('n5', 'Nf3', E4_C5_NF3_FEN));
  appendChildPreservingMainLine(nodes, 'n4', moveNode('n6', 'd3', E4_C5_D3_FEN));

  assert.equal(preferredChildId(nodes, 'n1'), 'n3');
  assert.equal(preferredChildId(nodes, 'n4'), 'n5');
  assert.equal(variationDepth(nodes, 'n4'), 1);
  assert.equal(variationDepth(nodes, 'n6'), 2);

  promoteNodeToMainLine(nodes, 'n6');
  assert.equal(preferredChildId(nodes, 'n4'), 'n6');
  assert.equal(variationDepth(nodes, 'n6'), 1);
  assert.equal(variationDepth(nodes, 'n5'), 2);
});

test('PGN export keeps comments in braces and recursive variations in parentheses', () => {
  const nodes = rootTree();
  nodes.root.comment = 'Choose a central plan.';
  appendChildPreservingMainLine(nodes, 'root', moveNode('n1', 'e4', E4_FEN, {
    from: 'e2',
    to: 'e4',
    comment: 'King pawn opening',
  }));
  appendChildPreservingMainLine(nodes, 'root', moveNode('n2', 'd4', D4_FEN, {
    from: 'd2',
    to: 'd4',
  }));
  appendChildPreservingMainLine(nodes, 'n1', moveNode('n3', 'e5', E4_E5_FEN, {
    from: 'e7',
    to: 'e5',
  }));
  appendChildPreservingMainLine(nodes, 'n1', moveNode('n4', 'c5', E4_C5_FEN, {
    from: 'c7',
    to: 'c5',
  }));
  appendChildPreservingMainLine(nodes, 'n4', moveNode('n5', 'Nf3', E4_C5_NF3_FEN, {
    from: 'g1',
    to: 'f3',
  }));
  appendChildPreservingMainLine(nodes, 'n4', moveNode('n6', 'd3', E4_C5_D3_FEN, {
    from: 'd2',
    to: 'd3',
  }));

  const pgn = buildPgnFromLessonTree({
    title: 'Nested variations',
    setupFen: START_FEN,
    rootId: 'root',
    nodes,
  });

  assert.match(pgn, /\{Choose a central plan\.\}/);
  assert.match(pgn, /1\. e4 \{King pawn opening\}/);
  assert.match(pgn, /\(1\. d4\)/);
  assert.match(pgn, /\(1\.\.\. c5 2\. Nf3 \(2\. d3\)\)/);

  const imported = parsePgnToLessonTree(pgn);
  const importedNodes = imported.analysis.nodes;
  const root = importedNodes[imported.analysis.rootId];
  assert.equal(root.children.length, 2);
  const e4 = importedNodes[root.selectedChildId];
  assert.equal(e4.children.length, 2);
  const c5 = e4.children.map((id) => importedNodes[id]).find((node) => node.san === 'c5');
  assert.ok(c5);
  assert.equal(c5.children.length, 2);
});
