import test from 'node:test';
import assert from 'node:assert/strict';

import {
  COACH_SESSION_STORAGE_KEY,
  clearCoachSession,
  createCoachSession,
  elapsedCoachSessionMinutes,
  formatCoachSessionElapsed,
  loadCoachSession,
  recommendCoachLesson,
  saveCoachSession,
} from '../management/js/coach-session-command.mjs';

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

const catalog = [
  { key: 'pawn-1', title: 'Pawn basics', level: 'Pawn', available: true },
  { key: 'pawn-2', title: 'Pawn chains', level: 'Pawn', available: true },
  { key: 'future', title: 'Future lesson', level: 'Pawn', available: false },
];

test('recommends work marked as needing practice before the latest lesson', () => {
  const result = recommendCoachLesson({
    catalog,
    progress: [
      { lesson_key: 'pawn-1', status: 'taught' },
      { lesson_key: 'pawn-2', status: 'practicing' },
    ],
    sessions: [{ lesson_key: 'pawn-1' }],
  });

  assert.equal(result.lesson.key, 'pawn-2');
  assert.equal(result.reason, 'Marked as needing practice');
});

test('uses the active session lesson as the explicit recommendation', () => {
  const result = recommendCoachLesson({
    catalog,
    progress: [{ lesson_key: 'pawn-2', status: 'practicing' }],
    preferredLessonKey: 'pawn-1',
  });

  assert.equal(result.lesson.key, 'pawn-1');
  assert.match(result.reason, /active coaching session/);
});

test('falls back to the first available lesson not yet tracked', () => {
  const result = recommendCoachLesson({
    catalog,
    progress: [],
    sessions: [],
  });

  assert.equal(result.lesson.key, 'pawn-1');
  assert.match(result.reason, /Next available/);
});

test('formats elapsed time and rounds a logged duration to the nearest minute', () => {
  const session = createCoachSession({ studentId: 'student-1', now: 1_000 });
  assert.equal(formatCoachSessionElapsed(session, 3_662_000), '01:01:01');
  assert.equal(elapsedCoachSessionMinutes(session, 91_000), 2);
});

test('persists a valid session and rejects stale or malformed state', () => {
  const storage = new MemoryStorage();
  const session = createCoachSession({
    studentId: 'student-1',
    lessonKey: 'pawn-2',
    now: 10_000,
  });

  saveCoachSession(storage, session);
  assert.deepEqual(loadCoachSession(storage, 20_000), session);

  assert.equal(loadCoachSession(storage, 13 * 60 * 60 * 1000), null);
  assert.equal(storage.getItem(COACH_SESSION_STORAGE_KEY), null);

  storage.setItem(COACH_SESSION_STORAGE_KEY, '{broken');
  assert.equal(loadCoachSession(storage, 20_000), null);

  saveCoachSession(storage, session);
  clearCoachSession(storage);
  assert.equal(storage.getItem(COACH_SESSION_STORAGE_KEY), null);
});
