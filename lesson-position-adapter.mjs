import {
  allocateStableId,
  createRootLessonTree,
  normalizeFenText,
  normalizeLessonBook,
  normalizeLessonDocument,
  normalizeLessonPosition,
  normalizeOrientation,
  normalizeStableId,
  normalizeTags,
  validateLessonPosition,
} from './lesson-model.mjs';

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function noteText(note) {
  if (typeof note === 'string') return note.trim();
  if (!isPlainObject(note)) return '';
  return String(note.text ?? note.value ?? note.content ?? '').trim();
}

function lessonNode(document, requestedNodeId = null) {
  const lessonState = document.lessonState || {};
  const analysis = lessonState.analysis || {};
  const nodes = isPlainObject(analysis.nodes) ? analysis.nodes : {};
  const nodeId = requestedNodeId
    || analysis.currentNodeId
    || analysis.rootId
    || (Object.prototype.hasOwnProperty.call(nodes, 'root') ? 'root' : Object.keys(nodes)[0])
    || null;
  return {
    nodeId,
    node: nodeId ? nodes[nodeId] ?? null : null,
    analysis,
  };
}

export function lessonPositionFromDocument(input, options = {}) {
  const document = normalizeLessonDocument(input);
  const { nodeId, node } = lessonNode(document, options.nodeId);
  const lessonState = document.lessonState || {};
  const metadata = document.metadata || {};
  const fen = normalizeFenText(
    options.fen
      ?? node?.fen
      ?? lessonState.setupFen
      ?? lessonState.analysis?.nodes?.[lessonState.analysis?.rootId]?.fen
      ?? '',
  );
  const teacherNote = String(
    options.teacherNote
      ?? node?.comment
      ?? metadata.teacherNote
      ?? noteText(lessonState.note)
      ?? '',
  ).trim();
  const studentPrompt = String(options.studentPrompt ?? metadata.studentPrompt ?? '').trim();

  return normalizeLessonPosition({
    id: options.id || `${document.id}-${nodeId || 'root'}`,
    title: options.title || document.title,
    fen,
    orientation: options.orientation || lessonState.boardOrientation || 'white',
    teacherNote,
    studentPrompt,
    tags: options.tags || metadata.tags || [],
    sourceLessonId: document.id,
    sourceNodeId: nodeId,
    isDefault: Boolean(options.isDefault),
  });
}

export function lessonPositionFromTreeNode(input, nodeId, options = {}) {
  return lessonPositionFromDocument(input, { ...options, nodeId });
}

function defaultLessonStateFromPosition(position, options = {}) {
  const activeTab = options.activeTab === 'study' ? 'study' : 'analysis';
  const teacherNote = position.teacherNote || '';
  return {
    title: position.title,
    analysisTargetDepth: Number.isFinite(Number(options.analysisTargetDepth))
      ? Number(options.analysisTargetDepth)
      : 30,
    boardOrientation: normalizeOrientation(position.orientation),
    activeTab,
    advancedOpen: false,
    toolsExpanded: activeTab !== 'study',
    pgnCommentsVisible: true,
    pvLinesVisible: true,
    setupFen: position.fen,
    setup: options.setupState ?? null,
    analysis: createRootLessonTree(position.fen, { comment: teacherNote }),
    annotations: options.annotations ?? {
      paintedSquares: [],
      circledSquares: [],
      starredSquares: [],
      arrows: [],
    },
    note: options.note ?? {
      expanded: Boolean(teacherNote),
      text: teacherNote,
    },
  };
}

export function lessonDocumentFromPosition(input, options = {}) {
  const validation = validateLessonPosition(input, options);
  if (!validation.ok) {
    throw new Error(validation.errors.join(' '));
  }
  const position = validation.value;
  const lessonState = typeof options.lessonStateFactory === 'function'
    ? options.lessonStateFactory(position)
    : defaultLessonStateFromPosition(position, options);

  return normalizeLessonDocument({
    id: options.lessonId || position.id,
    title: options.title || position.title,
    metadata: {
      tags: normalizeTags(position.tags),
      level: String(options.level ?? '').trim(),
      description: String(options.description ?? '').trim(),
      teacherNote: position.teacherNote,
      studentPrompt: position.studentPrompt,
      createdAt: options.createdAt ?? null,
      updatedAt: options.updatedAt ?? null,
    },
    lessonState,
  });
}

export function lessonBookFromPositions(inputs = [], options = {}) {
  if (!Array.isArray(inputs)) {
    throw new TypeError('Position set must be an array.');
  }
  const usedPositionIds = new Set();
  const lessons = inputs.map((input, index) => {
    const position = normalizeLessonPosition(input, { fallbackId: `position-${index + 1}` });
    position.id = allocateStableId(position.id, usedPositionIds, `position-${index + 1}`);
    return lessonDocumentFromPosition(position, {
      ...options,
      lessonId: position.id,
      activeTab: options.activeTab || 'analysis',
    });
  });
  return normalizeLessonBook({
    id: options.bookId || options.id || options.title || 'position-set-lessons',
    title: options.title || 'Position set lessons',
    metadata: {
      tags: normalizeTags(options.tags),
      description: String(options.description ?? '').trim(),
    },
    activeLessonId: lessons[0]?.id || null,
    lessons,
  });
}

export function positionsFromLessonBook(input, options = {}) {
  const book = normalizeLessonBook(input);
  const usedIds = new Set();
  return book.lessons.map((document, index) => {
    const position = lessonPositionFromDocument(document, {
      ...options,
      id: options.useLessonId === false
        ? undefined
        : document.id,
      isDefault: document.id === book.activeLessonId,
    });
    position.id = allocateStableId(position.id, usedIds, `position-${index + 1}`);
    return position;
  });
}

export function lessonPositionRows(inputs = []) {
  if (!Array.isArray(inputs)) return [];
  return inputs.map((input, index) => {
    const position = normalizeLessonPosition(input, { fallbackId: `position-${index + 1}` });
    return {
      order: index + 1,
      id: normalizeStableId(position.id, `position-${index + 1}`),
      title: position.title,
      fen: position.fen,
      orientation: position.orientation,
      teacher_note: position.teacherNote,
      student_prompt: position.studentPrompt,
      tags: position.tags.join(', '),
      is_default: position.isDefault ? 'yes' : 'no',
      source_lesson_id: position.sourceLessonId || '',
      source_node_id: position.sourceNodeId || '',
    };
  });
}
