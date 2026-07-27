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

test('move annotation helpers normalize quality and positional NAG values', () => {
  assert.equal(MOVE_ANNOTATIONS.length, 15);
  assert.equal(moveNagFromValue('!!'), 3);
  assert.equal(moveNagFromValue('$4'), 4);
  assert.equal(moveNagFromValue(5), 5);
  assert.equal(moveNagFromValue('□'), 7);
  assert.equal(moveNagFromValue('⩲'), 14);
  assert.equal(moveNagFromValue('−+'), 19);
  assert.equal(moveNagFromValue('not-a-nag'), null);
  assert.equal(moveNagGlyph(6), '?!');
  assert.equal(moveNagGlyph(14), '⩲');
  assert.equal(moveNagLabel(7), 'Forced / only move');
  assert.equal(moveNagLabel(18), 'White winning');
  assert.equal(moveNagPgnToken(3), '!!');
  assert.equal(moveNagPgnToken(7), '$7');
  assert.equal(moveNagPgnToken(14), '$14');
  assert.equal(moveNagFromPgnEntry({ suffix: '!?', nag: '2' }), 5);
  assert.equal(moveNagFromPgnEntry({ nag: '$15' }), 15);
});

test('PGN import and export preserve quality glyphs and positional NAG values', () => {
  const imported = parsePgnToLessonTree('[Event "Glyph test"]\n\n1. e4! e5 $2 2. Nf3 $14 *');
  const root = imported.analysis.nodes[imported.analysis.rootId];
  const first = imported.analysis.nodes[root.selectedChildId];
  const second = imported.analysis.nodes[first.selectedChildId];
  const third = imported.analysis.nodes[second.selectedChildId];

  assert.equal(first.nag, 1);
  assert.equal(second.nag, 2);
  assert.equal(third.nag, 14);
  assert.equal(moveNagGlyph(third.nag), '⩲');

  const exported = buildPgnFromLessonTree({
    title: imported.title,
    setupFen: imported.setupFen,
    rootId: imported.analysis.rootId,
    nodes: imported.analysis.nodes,
  });

  assert.match(exported, /1\. e4! e5\? 2\. Nf3 \$14 \*/);
});
