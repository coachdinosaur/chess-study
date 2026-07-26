import {
  LESSON_BOOK_FORMAT,
  LESSON_BOOK_VERSION,
  LESSON_DOCUMENT_FORMAT,
  LESSON_DOCUMENT_VERSION,
  cloneLessonValue,
  normalizeLessonBook,
  normalizeLessonDocument,
} from './lesson-model.mjs';

export const LEGACY_LESSON_VERSION = 1;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function detectLessonPayloadKind(payload) {
  if (!isPlainObject(payload)) return 'unknown';
  if (payload.format === LESSON_DOCUMENT_FORMAT) return 'lesson';
  if (payload.format === LESSON_BOOK_FORMAT) return 'lesson-book';
  if (Array.isArray(payload.lessons)) return 'lesson-book';
  if (Array.isArray(payload.lessonBook?.lessons)) return 'browser-draft';
  if (isPlainObject(payload.lessonState) || isPlainObject(payload.lesson)) return 'lesson';
  if (isPlainObject(payload.analysis) || typeof payload.setupFen === 'string') return 'lesson-state';
  return 'unknown';
}

function sourceVersion(payload) {
  const version = Number(payload?.version);
  return Number.isFinite(version) && version > 0 ? version : LEGACY_LESSON_VERSION;
}

function migrateSingleLesson(payload, options = {}) {
  if (payload.format === LESSON_DOCUMENT_FORMAT) {
    if (Number(payload.version) > LESSON_DOCUMENT_VERSION) {
      throw new Error(`Lesson version ${payload.version} is newer than supported version ${LESSON_DOCUMENT_VERSION}.`);
    }
    return normalizeLessonDocument(payload, options);
  }

  if (isPlainObject(payload.lessonState)) {
    return normalizeLessonDocument({
      id: payload.id,
      title: payload.title ?? payload.lessonState.title,
      metadata: payload.metadata,
      lessonState: payload.lessonState,
    }, options);
  }

  if (isPlainObject(payload.lesson)) {
    return normalizeLessonDocument({
      id: payload.id,
      title: payload.title ?? payload.lesson.title,
      metadata: payload.metadata,
      lessonState: payload.lesson,
    }, options);
  }

  return normalizeLessonDocument({
    id: payload.id,
    title: payload.title,
    metadata: payload.metadata,
    lessonState: payload,
  }, options);
}

function migrateBookPayload(payload, options = {}) {
  if (payload.format === LESSON_BOOK_FORMAT) {
    if (Number(payload.version) > LESSON_BOOK_VERSION) {
      throw new Error(`Lesson-book version ${payload.version} is newer than supported version ${LESSON_BOOK_VERSION}.`);
    }
    return normalizeLessonBook(payload, options);
  }

  return normalizeLessonBook({
    id: payload.id,
    title: payload.title,
    metadata: payload.metadata,
    activeLessonId: payload.activeLessonId,
    lessons: payload.lessons,
  }, options);
}

function migrateBrowserDraft(payload, options = {}) {
  const bookSource = payload.lessonBook;
  return normalizeLessonBook({
    id: options.id ?? bookSource.id ?? payload.id,
    title: options.title ?? bookSource.title ?? payload.title ?? 'Recovered lesson book',
    metadata: {
      ...(isPlainObject(payload.metadata) ? payload.metadata : {}),
      description: payload.metadata?.description || 'Migrated from browser draft.',
    },
    activeLessonId: bookSource.activeLessonId,
    lessons: bookSource.lessons,
  }, options);
}

export function migrateLessonPayload(payload, options = {}) {
  if (!isPlainObject(payload)) {
    throw new TypeError('Lesson payload must be an object.');
  }

  const original = cloneLessonValue(payload);
  const kind = detectLessonPayloadKind(original);

  if (kind === 'unknown') {
    throw new Error('Unsupported lesson payload.');
  }

  let value;
  let targetKind;
  if (kind === 'lesson' || kind === 'lesson-state') {
    value = migrateSingleLesson(original, options);
    targetKind = 'lesson';
  } else if (kind === 'browser-draft') {
    value = migrateBrowserDraft(original, options);
    targetKind = 'lesson-book';
  } else {
    value = migrateBookPayload(original, options);
    targetKind = 'lesson-book';
  }

  return {
    kind: targetKind,
    value,
    migrated: original.format !== value.format || Number(original.version) !== Number(value.version),
    sourceKind: kind,
    sourceVersion: sourceVersion(original),
    targetVersion: value.version,
  };
}

export function migrateLessonDocument(payload, options = {}) {
  const result = migrateLessonPayload(payload, options);
  if (result.kind !== 'lesson') {
    throw new Error('Expected a single lesson payload.');
  }
  return result.value;
}

export function migrateLessonBook(payload, options = {}) {
  const result = migrateLessonPayload(payload, options);
  if (result.kind !== 'lesson-book') {
    throw new Error('Expected a lesson-book payload.');
  }
  return result.value;
}
