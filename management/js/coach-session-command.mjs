export const COACH_SESSION_STORAGE_KEY = 'coach-session-command-v1';

const MAX_SESSION_AGE_MS = 12 * 60 * 60 * 1000;

function availableLesson(catalog, lessonKey) {
  return catalog.find((lesson) => lesson.available && lesson.key === lessonKey) || null;
}

export function recommendCoachLesson({
  catalog = [],
  progress = [],
  sessions = [],
  preferredLessonKey = '',
} = {}) {
  const progressByLesson = new Map(progress.map((row) => [row.lesson_key, row]));
  const withReason = (lesson, reason) => lesson ? { lesson, reason } : null;

  const preferred = availableLesson(catalog, preferredLessonKey);
  if (preferred) return withReason(preferred, 'Selected for the active coaching session');

  const needsPractice = catalog.find((lesson) =>
    lesson.available && progressByLesson.get(lesson.key)?.status === 'practicing'
  );
  if (needsPractice) return withReason(needsPractice, 'Marked as needing practice');

  const latestLesson = availableLesson(catalog, sessions[0]?.lesson_key || '');
  if (latestLesson && progressByLesson.get(latestLesson.key)?.status !== 'completed') {
    return withReason(latestLesson, 'Continue from the latest coaching session');
  }

  const taught = catalog.find((lesson) =>
    lesson.available && progressByLesson.get(lesson.key)?.status === 'taught'
  );
  if (taught) return withReason(taught, 'Previously taught and ready for follow-up');

  const notStarted = catalog.find((lesson) =>
    lesson.available && !progressByLesson.has(lesson.key)
  );
  return withReason(notStarted, notStarted ? 'Next available curriculum lesson' : '');
}

export function createCoachSession({ studentId, lessonKey = '', now = Date.now() } = {}) {
  const normalizedStudentId = String(studentId || '').trim();
  if (!normalizedStudentId) throw new Error('A student is required to start a coaching session.');
  return {
    studentId: normalizedStudentId,
    lessonKey: String(lessonKey || '').trim(),
    startedAt: Number(now),
  };
}

export function elapsedCoachSessionMs(session, now = Date.now()) {
  const startedAt = Number(session?.startedAt);
  if (!Number.isFinite(startedAt)) return 0;
  return Math.max(0, Number(now) - startedAt);
}

export function elapsedCoachSessionMinutes(session, now = Date.now()) {
  return Math.max(1, Math.round(elapsedCoachSessionMs(session, now) / 60000));
}

export function formatCoachSessionElapsed(session, now = Date.now()) {
  const totalSeconds = Math.floor(elapsedCoachSessionMs(session, now) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
}

export function loadCoachSession(storage, now = Date.now()) {
  if (!storage) return null;
  try {
    const session = JSON.parse(storage.getItem(COACH_SESSION_STORAGE_KEY) || 'null');
    const startedAt = Number(session?.startedAt);
    const valid = typeof session?.studentId === 'string'
      && session.studentId.trim()
      && Number.isFinite(startedAt)
      && startedAt <= Number(now)
      && Number(now) - startedAt <= MAX_SESSION_AGE_MS;
    if (!valid) {
      storage.removeItem(COACH_SESSION_STORAGE_KEY);
      return null;
    }
    return {
      studentId: session.studentId.trim(),
      lessonKey: String(session.lessonKey || '').trim(),
      startedAt,
    };
  } catch {
    try {
      storage.removeItem(COACH_SESSION_STORAGE_KEY);
    } catch {
      // Storage can be unavailable in hardened/private browser contexts.
    }
    return null;
  }
}

export function saveCoachSession(storage, session) {
  try {
    storage?.setItem(COACH_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // The in-memory timer still works when sessionStorage is unavailable.
  }
}

export function clearCoachSession(storage) {
  try {
    storage?.removeItem(COACH_SESSION_STORAGE_KEY);
  } catch {
    // Nothing else is required when storage is unavailable.
  }
}
