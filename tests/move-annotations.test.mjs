import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MOVE_ANNOTATIONS,
  moveNagFromPgnEntry,
  moveNagFromValue,
  moveNagGlyph,
  moveNagLabel,
  moveNagPgnToken,
} from '../move-annotations.mjs';
import { buildPgnFromLessonTree, parsePgnToLessonTree } from '../pgn.mjs';

test('move annotation helpers normalize symbolic and numeric NAG values', () => {
  assert.equal(MOVE_ANNOTATIONS.length, 6);
  assert.equal(moveNagFromValue('!!'), 3);
  assert.equal(moveNagFromValue('$4'), 4);
  assert.equal(moveNagFromValue(5), 5);
  assert.equal(moveNagFromValue('not-a-nag'), null);
  assert.equal(moveNagGlyph(6), '?!');
  assert.equal(moveNagLabel(1), 'Good move');
  assert.equal(moveNagPgnToken(3), '!!');
  assert.equal(moveNagPgnToken(14), '$14');
  assert.equal(moveNagFromPgnEntry({ suffix: '!?', nag: '2' }), 5);
  assert.equal(moveNagFromPgnEntry({ nag: '$2' }), 2);
});

test('PGN import and export preserve move glyphs and unknown NAG values', () => {
  const imported = parsePgnToLessonTree('[Event "Glyph test"]\n\n1. e4! e5 $2 2. Nf3 $14 *');
  const root = imported.analysis.nodes[imported.analysis.rootId];
  const first = imported.analysis.nodes[root.selectedChildId];
  const second = imported.analysis.nodes[first.selectedChildId];
  const third = imported.analysis.nodes[second.selectedChildId];

  assert.equal(first.nag, 1);
  assert.equal(second.nag, 2);
  assert.equal(third.nag, 14);

  const exported = buildPgnFromLessonTree({
    title: imported.title,
    setupFen: imported.setupFen,
    rootId: imported.analysis.rootId,
    nodes: imported.analysis.nodes,
  });

  assert.match(exported, /1\. e4! e5\? 2\. Nf3 \$14 \*/);
});
