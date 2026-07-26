import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePositionSetExport } from '../lesson-position-export-validation.mjs';
import {
  APP_LESSON_BOOK_VERSION,
  APP_LESSON_VERSION,
  POSITION_SET_INTEROPERABILITY_COLUMNS,
  appendPositionsToAppDraft,
  appLessonEntryFromPosition,
  enrichPositionSet,
  metadataRowsFromTable,
  parseCsvRows,
  spreadsheetMatrixForPositionSet,
} from '../lesson-position-interoperability-core.mjs';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const E4_FEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

test('enriches flat positions with optional interoperability metadata', () => {
  const positions = enrichPositionSet([
    { id: 'start', title: 'Start', fen: START_FEN, orientation: 'white' },
  ], {
    start: {
      studentPrompt: 'What is White planning?',
      tags: ['opening', 'centre'],
      sourceLessonId: 'lesson-a',
      sourceNodeId: 'root',
    },
  });
  assert.equal(positions[0].studentPrompt, 'What is White planning?');
  assert.deepEqual(positions[0].tags, ['opening', 'centre']);
  assert.equal(positions[0].sourceLessonId, 'lesson-a');
  assert.equal(positions[0].sourceNodeId, 'root');
});

test('spreadsheet matrix keeps existing columns and adds optional metadata columns', () => {
  const matrix = spreadsheetMatrixForPositionSet([
    {
      id: 'start',
      title: 'Start',
      fen: START_FEN,
      teacherNote: 'Coach note',
      isDefault: true,
    },
  ], {
    start: { studentPrompt: 'Find a plan.', tags: ['opening'] },
  });
  assert.deepEqual(matrix[0], [...POSITION_SET_INTEROPERABILITY_COLUMNS]);
  assert.equal(matrix[1][matrix[0].indexOf('student_prompt')], 'Find a plan.');
  assert.equal(matrix[1][matrix[0].indexOf('tags')], 'opening');
  assert.equal(matrix[1][matrix[0].indexOf('is_default')], 'yes');
});

test('creates an app-compatible lesson entry rooted at the position FEN', () => {
  const entry = appLessonEntryFromPosition({
    id: 'start',
    title: 'Start',
    fen: START_FEN,
    orientation: 'black',
    teacherNote: 'Explain development.',
    studentPrompt: 'Choose a move.',
    tags: ['opening'],
  });
  assert.equal(entry.version, APP_LESSON_VERSION);
  assert.equal(entry.setupFen, START_FEN);
  assert.equal(entry.boardOrientation, 'black');
  assert.equal(entry.rootId, 'root');
  assert.equal(entry.currentNodeId, 'root');
  assert.equal(entry.nodes.root.fen, START_FEN);
  assert.equal(entry.nodes.root.comment, 'Explain development.');
  assert.equal(entry.interoperability.studentPrompt, 'Choose a move.');
});

test('appends a selected position while preserving the current lesson book', () => {
  const existing = {
    version: APP_LESSON_BOOK_VERSION,
    activeLessonId: 'lesson-1',
    lessons: [{
      id: 'lesson-1',
      version: APP_LESSON_VERSION,
      title: 'Existing',
      setupFen: START_FEN,
      rootId: 'root',
      currentNodeId: 'root',
      nodes: { root: { id: 'root', parentId: null, fen: START_FEN, children: [], selectedChildId: null, comment: '' } },
    }],
    practiceKindPreference: 'branch',
    guidedReviewActive: true,
  };
  const result = appendPositionsToAppDraft(existing, [
    { id: 'new-position', title: 'New', fen: E4_FEN },
  ]);
  assert.equal(result.draft.lessons.length, 2);
  assert.equal(result.draft.lessons[0].title, 'Existing');
  assert.equal(result.draft.activeLessonId, 'new-position');
  assert.equal(result.draft.practiceKindPreference, 'branch');
  assert.equal(result.draft.guidedReviewActive, true);
  assert.equal(existing.lessons.length, 1);
});

test('resolves duplicate lesson IDs and activates the default imported position', () => {
  const result = appendPositionsToAppDraft({
    version: APP_LESSON_BOOK_VERSION,
    activeLessonId: 'same',
    lessons: [{ id: 'same', version: 1, title: 'Existing' }],
  }, [
    { id: 'same', title: 'First', fen: START_FEN },
    { id: 'same', title: 'Second', fen: E4_FEN, isDefault: true },
  ]);
  assert.deepEqual(result.addedLessonIds, ['same-2', 'same-3']);
  assert.equal(result.activeLessonId, 'same-3');
});

test('normalizes an older nested browser-draft lessonBook before appending', () => {
  const result = appendPositionsToAppDraft({
    lessonBook: {
      activeLessonId: 'lesson-1',
      lessons: [{
        id: 'lesson-1',
        lessonState: {
          title: 'Legacy',
          setupFen: START_FEN,
          boardOrientation: 'white',
          analysis: {
            rootId: 'root',
            currentNodeId: 'root',
            nodes: {
              root: { id: 'root', parentId: null, fen: START_FEN, children: [], selectedChildId: null, comment: '' },
            },
          },
          annotations: {},
          note: {},
        },
      }],
    },
  }, [
    { id: 'added', title: 'Added', fen: E4_FEN },
  ]);
  assert.equal(result.draft.version, APP_LESSON_BOOK_VERSION);
  assert.equal(result.draft.lessons[0].title, 'Legacy');
  assert.equal(result.draft.lessons[1].id, 'added');
});

test('extracts optional metadata columns from CSV and Excel-style rows', () => {
  const rows = parseCsvRows(
    'order,id,title,fen,student_prompt,tags,source_lesson_id,source_node_id\r\n'
    + `1,start,Start,"${START_FEN}","Find a move","opening, centre",lesson-a,root\r\n`,
  );
  const metadata = metadataRowsFromTable(rows);
  assert.equal(metadata.length, 1);
  assert.equal(metadata[0].id, 'start');
  assert.equal(metadata[0].studentPrompt, 'Find a move');
  assert.deepEqual(metadata[0].tags, ['opening', 'centre']);
  assert.equal(metadata[0].sourceLessonId, 'lesson-a');
  assert.equal(metadata[0].sourceNodeId, 'root');
});

test('accepts a valid export set with one default position', () => {
  const result = validatePositionSetExport([
    { id: 'start', title: 'Start', fen: START_FEN, isDefault: true },
    { id: 'e4', title: 'After e4', fen: E4_FEN },
  ], { validateFen: () => ({ ok: true }) });
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test('rejects export when the set is empty or lacks a default', () => {
  assert.equal(validatePositionSetExport([]).ok, false);
  const result = validatePositionSetExport([
    { id: 'start', title: 'Start', fen: START_FEN },
  ]);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /default position/i);
});

test('rejects duplicate IDs and illegal FEN before enhanced export', () => {
  const result = validatePositionSetExport([
    { id: 'same', title: 'First', fen: START_FEN, isDefault: true },
    { id: 'same', title: 'Second', fen: E4_FEN },
  ], {
    validateFen: (fen) => fen === E4_FEN ? { ok: false, error: 'Illegal test FEN.' } : { ok: true },
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /duplicate position ID/i);
  assert.match(result.errors.join(' '), /illegal test FEN/i);
});

test('rejects multiple default positions', () => {
  const result = validatePositionSetExport([
    { id: 'start', title: 'Start', fen: START_FEN, isDefault: true },
    { id: 'e4', title: 'After e4', fen: E4_FEN, isDefault: true },
  ]);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /only one default/i);
});
