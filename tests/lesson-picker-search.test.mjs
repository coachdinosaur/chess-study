import test from 'node:test';
import assert from 'node:assert/strict';

import {
  lessonTitleMatchesSearch,
  normalizeLessonSearchText,
  shouldAutoFocusLessonSearch,
} from '../lesson-picker-search.mjs';

test('normalizes lesson search text for case-insensitive matching', () => {
  assert.equal(normalizeLessonSearchText('  Lucena POSITION  '), 'lucena position');
});

test('matches lesson titles by case-insensitive partial text', () => {
  assert.equal(lessonTitleMatchesSearch('King and Pawn Opposition', 'pawn opp'), true);
  assert.equal(lessonTitleMatchesSearch('Rook and King Mate', 'ROOK'), true);
  assert.equal(lessonTitleMatchesSearch('Queen and King Checkmate', 'bishop'), false);
});

test('an empty search keeps all lessons visible', () => {
  assert.equal(lessonTitleMatchesSearch('Any lesson title', '   '), true);
});

test('shouldAutoFocusLessonSearch disables auto-focus on coarse/mobile devices to prevent chessboard resizing', () => {
  assert.equal(shouldAutoFocusLessonSearch(null), false);
  assert.equal(shouldAutoFocusLessonSearch({}), false);

  const mockMobileWindow = {
    matchMedia(query) {
      return { matches: query.includes('(pointer: coarse)') || query.includes('(max-width: 768px)') };
    },
  };
  assert.equal(shouldAutoFocusLessonSearch(mockMobileWindow), false);

  const mockDesktopWindow = {
    matchMedia(query) {
      return { matches: false };
    },
  };
  assert.equal(shouldAutoFocusLessonSearch(mockDesktopWindow), true);
});
