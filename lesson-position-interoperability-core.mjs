import {
  allocateStableId,
  cloneLessonValue,
  normalizeLessonPosition,
  normalizeStableId,
  normalizeTags,
  validateLessonPosition,
} from './lesson-model.mjs';
import { lessonPositionRows } from './lesson-position-adapter.mjs';

export const APP_LESSON_VERSION = 1;
export const APP_LESSON_BOOK_VERSION = 2;

export const POSITION_SET_INTEROPERABILITY_COLUMNS = Object.freeze([
  'order',
  'id',
  'title',
  'fen',
  'orientation',
  'teacher_note',
  'student_prompt',
  'tags',
  'is_default',
  'source_lesson_id',
  'source_node_id',
]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value) {
  return String(value ?? '').trim();
}

function multiline(value) {
  return String(value ?? '').replace(/\r\n?/g, '\n').trim();
}

export function normalizePositionMetadata(value = {}) {
  const source = isPlainObject(value) ? value : {};
  return {
    studentPrompt: multiline(source.studentPrompt ?? source.student_prompt),
    tags: normalizeTags(source.tags),
    sourceLessonId: text(source.sourceLessonId ?? source.source_lesson_id) || null,
    sourceNodeId: text(source.sourceNodeId ?? source.source_node_id) || null,
  };
}

export function mergePositionMetadata(position, metadata = {}) {
  const base = normalizeLessonPosition(position);
  const extra = normalizePositionMetadata(metadata);
  return normalizeLessonPosition({
    ...base,
    studentPrompt: extra.studentPrompt || base.studentPrompt,
    tags: extra.tags.length ? extra.tags : base.tags,
    sourceLessonId: extra.sourceLessonId || base.sourceLessonId,
    sourceNodeId: extra.sourceNodeId || base.sourceNodeId,
  });
}

export function enrichPositionSet(positions = [], metadataById = {}) {
  if (!Array.isArray(positions)) return [];
  const source = isPlainObject(metadataById) ? metadataById : {};
  return positions.map((position) => {
    const id = text(position?.id);
    return mergePositionMetadata(position, source[id] || {});
  });
}

export function spreadsheetRowsForPositionSet(positions = [], metadataById = {}) {
  return lessonPositionRows(enrichPositionSet(positions, metadataById));
}

export function spreadsheetMatrixForPositionSet(positions = [], metadataById = {}) {
  const rows = spreadsheetRowsForPositionSet(positions, metadataById);
  return [
    [...POSITION_SET_INTEROPERABILITY_COLUMNS],
    ...rows.map((row) => POSITION_SET_INTEROPERABILITY_COLUMNS.map((column) => String(row[column] ?? ''))),
  ];
}

function rootNodeForPosition(position) {
  return {
    id: 'root',
    parentId: null,
    fen: position.fen,
    children: [],
    selectedChildId: null,
    comment: position.teacherNote || '',
  };
}

export function appLessonEntryFromPosition(input, options = {}) {
  const validation = validateLessonPosition(input, options);
  if (!validation.ok) {
    throw new Error(validation.errors.join(' '));
  }
  const position = validation.value;
  const id = normalizeStableId(options.lessonId || position.id, 'lesson');
  const activeTab = options.activeTab === 'study' ? 'study' : 'analysis';
  return {
    id,
    version: APP_LESSON_VERSION,
    title: position.title,
    setupFen: position.fen,
    analysisTargetDepth: Number.isFinite(Number(options.analysisTargetDepth))
      ? Number(options.analysisTargetDepth)
      : 30,
    boardOrientation: position.orientation === 'black' ? 'black' : 'white',
    activeTab,
    advancedOpen: false,
    toolsExpanded: activeTab !== 'study',
    pgnCommentsVisible: true,
    pvLinesVisible: true,
    currentNodeId: 'root',
    rootId: 'root',
    nodes: {
      root: rootNodeForPosition(position),
    },
    annotations: {
      paintedSquares: [],
      circledSquares: [],
      starredSquares: [],
      arrows: [],
    },
    note: {
      text: position.teacherNote || '',
      expanded: Boolean(position.teacherNote),
    },
    interoperability: {
      studentPrompt: position.studentPrompt || '',
      tags: normalizeTags(position.tags),
      sourceLessonId: position.sourceLessonId || null,
      sourceNodeId: position.sourceNodeId || null,
    },
  };
}

function normalizedDraft(value) {
  if (isPlainObject(value) && Number(value.version) === APP_LESSON_BOOK_VERSION && Array.isArray(value.lessons)) {
    return cloneLessonValue(value);
  }
  if (isPlainObject(value) && isPlainObject(value.lessonBook) && Array.isArray(value.lessonBook.lessons)) {
    const lessons = value.lessonBook.lessons.map((entry) => {
      if (isPlainObject(entry?.lessonState)) {
        const state = entry.lessonState;
        return {
          id: text(entry.id) || 'lesson',
          version: APP_LESSON_VERSION,
          title: state.title || '',
          setupFen: state.setupFen,
          analysisTargetDepth: state.analysisTargetDepth ?? 30,
          boardOrientation: state.boardOrientation || 'white',
          activeTab: state.activeTab || 'analysis',
          advancedOpen: Boolean(state.advancedOpen),
          toolsExpanded: Boolean(state.toolsExpanded),
          pgnCommentsVisible: state.pgnCommentsVisible !== false,
          pvLinesVisible: state.pvLinesVisible !== false,
          currentNodeId: state.analysis?.currentNodeId || 'root',
          rootId: state.analysis?.rootId || 'root',
          nodes: cloneLessonValue(state.analysis?.nodes || {}),
          annotations: cloneLessonValue(state.annotations || {}),
          note: cloneLessonValue(state.note || {}),
        };
      }
      return cloneLessonValue(entry);
    });
    return {
      version: APP_LESSON_BOOK_VERSION,
      activeLessonId: value.lessonBook.activeLessonId || lessons[0]?.id || '',
      lessons,
      practiceKindPreference: value.practiceKindPreference || 'line',
      guidedReviewActive: Boolean(value.guidedReviewActive),
    };
  }
  return {
    version: APP_LESSON_BOOK_VERSION,
    activeLessonId: '',
    lessons: [],
    practiceKindPreference: 'line',
    guidedReviewActive: false,
  };
}

export function appendPositionsToAppDraft(draft, inputs = [], options = {}) {
  if (!Array.isArray(inputs) || inputs.length === 0) {
    throw new Error('At least one position is required.');
  }
  const nextDraft = normalizedDraft(draft);
  const usedIds = new Set(
    nextDraft.lessons
      .map((lesson) => text(lesson?.id))
      .filter(Boolean),
  );
  const added = [];
  const normalizedPositions = inputs.map((input, index) => {
    const validation = validateLessonPosition(input, {
      ...options,
      fallbackId: `position-${index + 1}`,
    });
    if (!validation.ok) {
      throw new Error(`Position ${index + 1}: ${validation.errors.join(' ')}`);
    }
    return validation.value;
  });

  normalizedPositions.forEach((position, index) => {
    const lessonId = allocateStableId(
      options.lessonId && normalizedPositions.length === 1 ? options.lessonId : position.id,
      usedIds,
      `lesson-${nextDraft.lessons.length + index + 1}`,
    );
    const entry = appLessonEntryFromPosition(position, {
      ...options,
      lessonId,
    });
    nextDraft.lessons.push(entry);
    added.push({
      lessonId,
      positionId: position.id,
      isDefault: Boolean(position.isDefault),
    });
  });

  const preferred = added.find((entry) => entry.isDefault) || added[0];
  nextDraft.activeLessonId = preferred.lessonId;
  nextDraft.version = APP_LESSON_BOOK_VERSION;
  return {
    draft: nextDraft,
    addedLessonIds: added.map((entry) => entry.lessonId),
    activeLessonId: preferred.lessonId,
  };
}

export function normalizeHeader(value) {
  return String(value ?? '')
    .replace(/^\ufeff/, '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

export function parseCsvRows(value) {
  const input = String(value ?? '').replace(/^\ufeff/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let index = 0;
  while (index < input.length) {
    const char = input[index];
    if (quoted) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        quoted = false;
        index += 1;
        continue;
      }
      field += char;
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = true;
      index += 1;
      continue;
    }
    if (char === ',') {
      row.push(field);
      field = '';
      index += 1;
      continue;
    }
    if (char === '\r' || char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      index += char === '\r' && input[index + 1] === '\n' ? 2 : 1;
      continue;
    }
    field += char;
    index += 1;
  }
  if (quoted) throw new Error('CSV has an unterminated quoted field.');
  if (field !== '' || row.length || !/[\r\n]$/.test(input)) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function metadataRowsFromTable(rows = []) {
  if (!Array.isArray(rows) || rows.length < 2) return [];
  const headers = rows[0].map(normalizeHeader);
  const indexes = {
    id: headers.indexOf('id'),
    studentPrompt: headers.findIndex((value) => value === 'student_prompt' || value === 'prompt'),
    tags: headers.indexOf('tags'),
    sourceLessonId: headers.indexOf('source_lesson_id'),
    sourceNodeId: headers.indexOf('source_node_id'),
  };
  if (
    indexes.studentPrompt < 0
    && indexes.tags < 0
    && indexes.sourceLessonId < 0
    && indexes.sourceNodeId < 0
  ) {
    return [];
  }
  const cell = (row, index) => (index >= 0 ? String(row?.[index] ?? '') : '');
  return rows.slice(1)
    .filter((row) => Array.isArray(row) && row.some((value) => String(value ?? '').trim()))
    .map((row) => ({
      id: cell(row, indexes.id).trim(),
      ...normalizePositionMetadata({
        studentPrompt: cell(row, indexes.studentPrompt),
        tags: cell(row, indexes.tags),
        sourceLessonId: cell(row, indexes.sourceLessonId),
        sourceNodeId: cell(row, indexes.sourceNodeId),
      }),
    }));
}
