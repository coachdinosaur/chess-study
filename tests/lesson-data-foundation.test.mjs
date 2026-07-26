import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LESSON_BOOK_FORMAT,
  LESSON_DOCUMENT_FORMAT,
  allocateStableId,
  normalizeLessonPosition,
  validateLessonPosition,
} from '../lesson-model.mjs';
import {
  detectLessonPayloadKind,
  migrateLessonBook,
  migrateLessonDocument,
  migrateLessonPayload,
} from '../lesson-migrations.mjs';
import {
  lessonBookFromPositions,
  lessonDocumentFromPosition,
  lessonPositionFromDocument,
  lessonPositionFromTreeNode,
  lessonPositionRows,
  positionsFromLessonBook,
} from '../lesson-position-adapter.mjs';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const E4_FEN = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

test('normalizes shared lesson positions from CSV-style aliases', () => {
  const position = normalizeLessonPosition({
    position_id: '  Weak Back Rank ',
    position_title: 'Weak Back Rank',
    position_fen: START_FEN,
    board_orientation: 'BLACK',
    teacher_note: '  Explain the escape square.  ',
    student_prompt: 'Find the threat.',
    tags: 'tactics, back rank, TACTICS',
    is_default: 'yes',
    source_lesson_id: 'lesson-a',
    source_node_id: 'n7',
  });

  assert.equal(position.id, 'weak-back-rank');
  assert.equal(position.orientation, 'black');
  assert.deepEqual(position.tags, ['tactics', 'back rank']);
  assert.equal(position.teacherNote, 'Explain the escape square.');
  assert.equal(position.studentPrompt, 'Find the threat.');
  assert.equal(position.isDefault, true);
  assert.equal(position.sourceLessonId, 'lesson-a');
  assert.equal(position.sourceNodeId, 'n7');
});

test('validates basic FEN shape and accepts an optional legality callback', () => {
  assert.equal(validateLessonPosition({
    id: 'valid',
    title: 'Valid',
    fen: START_FEN,
  }).ok, true);

  const malformed = validateLessonPosition({
    id: 'bad',
    title: 'Bad',
    fen: '8/8/8',
  });
  assert.equal(malformed.ok, false);
  assert.match(malformed.errors.join(' '), /six-field board shape/i);

  const illegal = validateLessonPosition({
    id: 'illegal',
    title: 'Illegal',
    fen: START_FEN,
  }, {
    validateFen: () => ({ ok: false, error: 'Custom legality failure.' }),
  });
  assert.equal(illegal.ok, false);
  assert.match(illegal.errors.join(' '), /Custom legality failure/);
});

test('allocates predictable stable IDs', () => {
  const used = new Set();
  assert.equal(allocateStableId('Fork', used), 'fork');
  assert.equal(allocateStableId('Fork', used), 'fork-2');
  assert.equal(allocateStableId('', used, 'position'), 'position');
});

test('migrates a raw legacy lesson state without mutating it', () => {
  const legacy = {
    title: 'Legacy lesson',
    setupFen: START_FEN,
    boardOrientation: 'black',
    analysis: {
      rootId: 'root',
      currentNodeId: 'root',
      nodes: {
        root: {
          id: 'root',
          parentId: null,
          fen: START_FEN,
          children: [],
          selectedChildId: null,
          comment: 'Root note',
        },
      },
    },
  };
  const before = structuredClone(legacy);
  assert.equal(detectLessonPayloadKind(legacy), 'lesson-state');

  const result = migrateLessonPayload(legacy);
  assert.equal(result.kind, 'lesson');
  assert.equal(result.value.format, LESSON_DOCUMENT_FORMAT);
  assert.equal(result.value.version, 2);
  assert.equal(result.value.lessonState.boardOrientation, 'black');
  assert.deepEqual(legacy, before);
});

test('migrates the current lesson-book entry shape', () => {
  const book = migrateLessonBook({
    activeLessonId: 'lesson-2',
    lessons: [
      { id: 'lesson-1', lessonState: { title: 'First', setupFen: START_FEN, analysis: { nodes: {} } } },
      { id: 'lesson-2', lessonState: { title: 'Second', setupFen: E4_FEN, analysis: { nodes: {} } } },
    ],
  });

  assert.equal(book.format, LESSON_BOOK_FORMAT);
  assert.equal(book.version, 2);
  assert.equal(book.activeLessonId, 'lesson-2');
  assert.deepEqual(book.lessons.map((lesson) => lesson.title), ['First', 'Second']);
});

test('migrates a browser draft that contains lessonBook', () => {
  const result = migrateLessonPayload({
    title: 'Draft shell',
    lessonBook: {
      activeLessonId: 'l1',
      lessons: [
        { id: 'l1', lessonState: { title: 'Recovered', setupFen: START_FEN, analysis: { nodes: {} } } },
      ],
    },
  });
  assert.equal(result.sourceKind, 'browser-draft');
  assert.equal(result.kind, 'lesson-book');
  assert.equal(result.value.lessons[0].title, 'Recovered');
});

test('keeps version 2 lesson documents idempotent', () => {
  const document = lessonDocumentFromPosition({
    id: 'idempotent',
    title: 'Idempotent',
    fen: START_FEN,
    teacherNote: 'Keep this.',
  });
  const migrated = migrateLessonDocument(document);
  assert.deepEqual(migrated, document);
});

test('round-trips a shared position through a lesson document', () => {
  const source = {
    id: 'pawn-break',
    title: 'Pawn Break',
    fen: START_FEN,
    orientation: 'black',
    teacherNote: 'Show the candidate break.',
    studentPrompt: 'Which pawn should move?',
    tags: ['pawn', 'calculation'],
  };
  const document = lessonDocumentFromPosition(source);
  const position = lessonPositionFromDocument(document);

  assert.equal(document.lessonState.analysis.rootId, 'root');
  assert.equal(position.title, source.title);
  assert.equal(position.fen, source.fen);
  assert.equal(position.orientation, source.orientation);
  assert.equal(position.teacherNote, source.teacherNote);
  assert.equal(position.studentPrompt, source.studentPrompt);
  assert.deepEqual(position.tags, source.tags);
  assert.equal(position.sourceLessonId, 'pawn-break');
  assert.equal(position.sourceNodeId, 'root');
});

test('exports the selected tree node rather than flattening to the root', () => {
  const document = lessonDocumentFromPosition({
    id: 'opening',
    title: 'Opening',
    fen: START_FEN,
  });
  document.lessonState.analysis.nodes.n1 = {
    id: 'n1',
    parentId: 'root',
    from: 'e2',
    to: 'e4',
    promotion: null,
    san: 'e4',
    fen: E4_FEN,
    children: [],
    selectedChildId: null,
    comment: 'Claim the centre.',
  };
  document.lessonState.analysis.nodes.root.children.push('n1');

  const position = lessonPositionFromTreeNode(document, 'n1');
  assert.equal(position.fen, E4_FEN);
  assert.equal(position.teacherNote, 'Claim the centre.');
  assert.equal(position.sourceNodeId, 'n1');
});

test('converts an ordered position set into a lesson book and back', () => {
  const book = lessonBookFromPositions([
    { id: 'same', title: 'First', fen: START_FEN },
    { id: 'same', title: 'Second', fen: E4_FEN, isDefault: true },
  ], { title: 'Set conversion' });

  assert.deepEqual(book.lessons.map((lesson) => lesson.id), ['same', 'same-2']);
  assert.equal(book.activeLessonId, 'same-2');

  const positions = positionsFromLessonBook(book);
  assert.deepEqual(positions.map((position) => position.title), ['First', 'Second']);
  assert.deepEqual(positions.map((position) => position.fen), [START_FEN, E4_FEN]);
  assert.deepEqual(positions.map((position) => position.id), ['same', 'same-2']);
  assert.equal(positions[1].isDefault, true);
});

test('builds backward-compatible spreadsheet rows with optional metadata', () => {
  const rows = lessonPositionRows([{
    id: 'row',
    title: 'Row',
    fen: START_FEN,
    orientation: 'black',
    teacherNote: 'Teacher',
    studentPrompt: 'Student',
    tags: ['one', 'two'],
    isDefault: true,
    sourceLessonId: 'lesson',
    sourceNodeId: 'node',
  }]);

  assert.deepEqual(rows[0], {
    order: 1,
    id: 'row',
    title: 'Row',
    fen: START_FEN,
    orientation: 'black',
    teacher_note: 'Teacher',
    student_prompt: 'Student',
    tags: 'one, two',
    is_default: 'yes',
    source_lesson_id: 'lesson',
    source_node_id: 'node',
  });
});
