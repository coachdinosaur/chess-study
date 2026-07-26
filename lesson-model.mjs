const LESSON_ID_MAX_LENGTH = 96;
const FEN_PART_COUNT = 6;

export const LESSON_DOCUMENT_FORMAT = 'coach-dinosaur-lesson';
export const LESSON_BOOK_FORMAT = 'coach-dinosaur-lesson-book';
export const LESSON_DOCUMENT_VERSION = 2;
export const LESSON_BOOK_VERSION = 2;
export const LESSON_POSITION_VERSION = 1;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function cloneLessonValue(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeMultilineText(value) {
  return String(value ?? '').replace(/\r\n?/g, '\n').trim();
}

function valueFromAliases(source, aliases, fallback = undefined) {
  if (!isPlainObject(source)) return fallback;
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(source, alias)) {
      return source[alias];
    }
  }
  return fallback;
}

export function normalizeStableId(value, fallback = 'item') {
  const normalized = normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, LESSON_ID_MAX_LENGTH);
  if (normalized) return normalized;
  const safeFallback = normalizeText(fallback)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, LESSON_ID_MAX_LENGTH);
  return safeFallback || 'item';
}

export function allocateStableId(value, usedIds = new Set(), fallback = 'item') {
  const base = normalizeStableId(value, fallback);
  let candidate = base;
  let suffix = 2;
  while (usedIds.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(candidate);
  return candidate;
}

export function normalizeOrientation(value) {
  return String(value ?? '').trim().toLowerCase() === 'black' ? 'black' : 'white';
}

export function normalizeTags(value) {
  const raw = Array.isArray(value)
    ? value
    : String(value ?? '').split(/[;,]/g);
  const seen = new Set();
  const tags = [];
  raw.forEach((item) => {
    const tag = normalizeText(item);
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) return;
    seen.add(key);
    tags.push(tag);
  });
  return tags;
}

export function normalizeFenText(value) {
  return normalizeText(value).replace(/\s+/g, ' ');
}

export function hasBasicFenShape(value) {
  const fen = normalizeFenText(value);
  if (!fen) return false;
  const parts = fen.split(' ');
  if (parts.length !== FEN_PART_COUNT) return false;
  const ranks = parts[0].split('/');
  return ranks.length === 8
    && ranks.every((rank) => {
      let squares = 0;
      for (const character of rank) {
        if (/[1-8]/.test(character)) {
          squares += Number(character);
        } else if (/[prnbqkPRNBQK]/.test(character)) {
          squares += 1;
        } else {
          return false;
        }
      }
      return squares === 8;
    })
    && (parts[1] === 'w' || parts[1] === 'b');
}

export function normalizeLessonPosition(input = {}, options = {}) {
  const source = isPlainObject(input) ? input : {};
  const fallbackId = options.fallbackId || valueFromAliases(source, ['title', 'name'], 'position');
  const id = normalizeStableId(
    valueFromAliases(source, ['id', 'positionId', 'position_id', 'slug'], fallbackId),
    fallbackId,
  );
  const title = normalizeText(valueFromAliases(source, ['title', 'positionTitle', 'position_title', 'name'], id)) || id;
  const fen = normalizeFenText(valueFromAliases(source, ['fen', 'positionFen', 'position_fen'], ''));
  const teacherNote = normalizeMultilineText(valueFromAliases(
    source,
    ['teacherNote', 'teacher_note', 'note', 'instruction'],
    '',
  ));
  const studentPrompt = normalizeMultilineText(valueFromAliases(
    source,
    ['studentPrompt', 'student_prompt', 'prompt', 'question'],
    '',
  ));
  const tags = normalizeTags(valueFromAliases(source, ['tags', 'themes', 'labels'], []));
  const sourceLessonId = normalizeText(valueFromAliases(
    source,
    ['sourceLessonId', 'source_lesson_id'],
    '',
  )) || null;
  const sourceNodeId = normalizeText(valueFromAliases(
    source,
    ['sourceNodeId', 'source_node_id'],
    '',
  )) || null;
  const defaultValue = valueFromAliases(source, ['isDefault', 'is_default', 'default'], false);
  const isDefault = defaultValue === true
    || defaultValue === 1
    || ['yes', 'true', '1', 'default'].includes(String(defaultValue ?? '').trim().toLowerCase());

  return {
    version: LESSON_POSITION_VERSION,
    id,
    title,
    fen,
    orientation: normalizeOrientation(valueFromAliases(source, ['orientation', 'boardOrientation', 'board_orientation'], 'white')),
    teacherNote,
    studentPrompt,
    tags,
    sourceLessonId,
    sourceNodeId,
    isDefault,
  };
}

export function validateLessonPosition(input, options = {}) {
  const position = normalizeLessonPosition(input, options);
  const errors = [];

  if (!position.id) errors.push('Position ID is required.');
  if (!position.title) errors.push('Position title is required.');
  if (!position.fen) {
    errors.push('Position FEN is required.');
  } else if (!hasBasicFenShape(position.fen)) {
    errors.push('Position FEN does not have a valid six-field board shape.');
  }

  if (typeof options.validateFen === 'function' && position.fen) {
    const result = options.validateFen(position.fen);
    if (result === false) {
      errors.push('Position FEN is illegal.');
    } else if (isPlainObject(result) && result.ok === false) {
      errors.push(normalizeText(result.error) || 'Position FEN is illegal.');
    }
  }

  return { ok: errors.length === 0, errors, value: position };
}

export function createRootLessonTree(fen, options = {}) {
  const rootId = normalizeStableId(options.rootId || 'root', 'root');
  const normalizedFen = normalizeFenText(fen);
  const rootComment = normalizeMultilineText(options.comment || '');
  return {
    rootId,
    currentNodeId: rootId,
    nodes: {
      [rootId]: {
        id: rootId,
        parentId: null,
        from: null,
        to: null,
        promotion: null,
        san: null,
        fen: normalizedFen,
        children: [],
        selectedChildId: null,
        comment: rootComment,
      },
    },
  };
}

function normalizeMetadata(input = {}) {
  const source = isPlainObject(input) ? input : {};
  return {
    tags: normalizeTags(source.tags),
    level: normalizeText(source.level),
    description: normalizeMultilineText(source.description),
    teacherNote: normalizeMultilineText(source.teacherNote ?? source.teacher_note),
    studentPrompt: normalizeMultilineText(source.studentPrompt ?? source.student_prompt),
    createdAt: normalizeText(source.createdAt ?? source.created_at) || null,
    updatedAt: normalizeText(source.updatedAt ?? source.updated_at) || null,
  };
}

export function normalizeLessonDocument(input = {}, options = {}) {
  const source = isPlainObject(input) ? input : {};
  const rawLessonState = isPlainObject(source.lessonState)
    ? source.lessonState
    : isPlainObject(source.lesson)
      ? source.lesson
      : isPlainObject(options.lessonState)
        ? options.lessonState
        : {};
  const title = normalizeText(source.title ?? rawLessonState.title ?? options.title) || 'Untitled lesson';
  const id = normalizeStableId(source.id ?? options.id ?? title, 'lesson');

  return {
    format: LESSON_DOCUMENT_FORMAT,
    version: LESSON_DOCUMENT_VERSION,
    id,
    title,
    metadata: normalizeMetadata(source.metadata),
    lessonState: cloneLessonValue(rawLessonState),
  };
}

export function validateLessonDocument(input) {
  const document = normalizeLessonDocument(input);
  const errors = [];

  if (input?.format && input.format !== LESSON_DOCUMENT_FORMAT) {
    errors.push(`Unsupported lesson format: ${String(input.format)}.`);
  }
  if (input?.version && Number(input.version) > LESSON_DOCUMENT_VERSION) {
    errors.push(`Lesson version ${String(input.version)} is newer than this app supports.`);
  }
  if (!isPlainObject(document.lessonState)) {
    errors.push('Lesson state must be an object.');
  }
  const setupFen = normalizeFenText(document.lessonState?.setupFen);
  if (setupFen && !hasBasicFenShape(setupFen)) {
    errors.push('Lesson setup FEN is malformed.');
  }
  const nodes = document.lessonState?.analysis?.nodes;
  if (nodes != null && !isPlainObject(nodes)) {
    errors.push('Lesson analysis nodes must be an object.');
  }

  return { ok: errors.length === 0, errors, value: document };
}

export function normalizeLessonBook(input = {}, options = {}) {
  const source = isPlainObject(input) ? input : {};
  const rawLessons = Array.isArray(source.lessons) ? source.lessons : [];
  const usedIds = new Set();
  const lessons = rawLessons.map((entry, index) => {
    const candidate = isPlainObject(entry?.document)
      ? entry.document
      : isPlainObject(entry?.lessonState)
        ? { id: entry.id, title: entry.lessonState.title, lessonState: entry.lessonState, metadata: entry.metadata }
        : entry;
    const normalized = normalizeLessonDocument(candidate, {
      id: entry?.id || `lesson-${index + 1}`,
      title: entry?.title || `Lesson ${index + 1}`,
    });
    normalized.id = allocateStableId(normalized.id, usedIds, `lesson-${index + 1}`);
    return normalized;
  });

  let activeLessonId = normalizeText(source.activeLessonId ?? source.active_lesson_id);
  if (!lessons.some((lesson) => lesson.id === activeLessonId)) {
    activeLessonId = lessons[0]?.id || null;
  }

  return {
    format: LESSON_BOOK_FORMAT,
    version: LESSON_BOOK_VERSION,
    id: normalizeStableId(source.id ?? options.id ?? source.title ?? 'lesson-book', 'lesson-book'),
    title: normalizeText(source.title ?? options.title) || 'Lesson book',
    metadata: normalizeMetadata(source.metadata),
    activeLessonId,
    lessons,
  };
}

export function validateLessonBook(input) {
  const book = normalizeLessonBook(input);
  const errors = [];
  if (input?.format && input.format !== LESSON_BOOK_FORMAT) {
    errors.push(`Unsupported lesson-book format: ${String(input.format)}.`);
  }
  if (input?.version && Number(input.version) > LESSON_BOOK_VERSION) {
    errors.push(`Lesson-book version ${String(input.version)} is newer than this app supports.`);
  }
  if (!book.lessons.length) {
    errors.push('Lesson book must contain at least one lesson.');
  }
  book.lessons.forEach((lesson, index) => {
    const result = validateLessonDocument(lesson);
    result.errors.forEach((error) => errors.push(`Lesson ${index + 1}: ${error}`));
  });
  return { ok: errors.length === 0, errors, value: book };
}
