import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { loadLessonCatalog } from '../management/js/lesson-catalog.mjs';

function createFileFetcher(baseDir = new URL('../lessons/', import.meta.url)) {
  return async (path) => {
    // path is like '../lessons/pawn-index.html' or '../lessons/advanced-pawn-module-1-data.js'
    const cleanPath = path.replace(/^\.\.\/lessons\//, '');
    const fileUrl = new URL(cleanPath, baseDir);
    return readFile(fileUrl, 'utf8');
  };
}

test('loadLessonCatalog loads all curriculum levels and lessons', async () => {
  const fetcher = createFileFetcher();
  const catalog = await loadLessonCatalog(fetcher);

  assert.ok(Array.isArray(catalog), 'catalog should be an array');
  assert.equal(catalog.length, 199, 'catalog should contain 199 total lessons');

  const pawnLessons = catalog.filter((l) => l.level === 'Pawn Level');
  assert.equal(pawnLessons.length, 55, 'Pawn Level should have 55 lessons');

  const advancedPawnLessons = catalog.filter((l) => l.level === 'Advanced Pawn Level');
  assert.equal(advancedPawnLessons.length, 118, 'Advanced Pawn Level should have 118 lessons');

  const bishopLessons = catalog.filter((l) => l.level === 'Bishop Level');
  assert.equal(bishopLessons.length, 19, 'Bishop Level should have 19 lessons');

  const endgameLessons = catalog.filter((l) => l.level === 'Endgames');
  assert.equal(endgameLessons.length, 7, 'Endgames should have 7 lessons');

  const levels = [...new Set(catalog.map((l) => l.level))];
  assert.deepEqual(levels.sort(), ['Advanced Pawn Level', 'Bishop Level', 'Endgames', 'Pawn Level'].sort());
});

test('every catalog lesson has required valid properties and available is true', async () => {
  const fetcher = createFileFetcher();
  const catalog = await loadLessonCatalog(fetcher);

  for (const lesson of catalog) {
    assert.ok(typeof lesson.key === 'string' && lesson.key.length > 0, `key missing on ${JSON.stringify(lesson)}`);
    assert.ok(typeof lesson.level === 'string' && lesson.level.length > 0, `level missing on ${lesson.key}`);
    assert.ok(typeof lesson.module === 'string' && lesson.module.length > 0, `module missing on ${lesson.key}`);
    assert.ok(typeof lesson.number === 'string' && lesson.number.length > 0, `number missing on ${lesson.key}`);
    assert.ok(typeof lesson.title === 'string' && lesson.title.length > 0, `title missing on ${lesson.key}`);
    assert.ok(typeof lesson.url === 'string' && lesson.url.startsWith('../lessons/'), `url invalid on ${lesson.key}`);
    assert.equal(lesson.available, true, `available must be true on ${lesson.key}`);
  }
});

test('every Advanced Pawn lesson file exists on disk', async () => {
  const fetcher = createFileFetcher();
  const catalog = await loadLessonCatalog(fetcher);
  const advancedPawnLessons = catalog.filter((l) => l.level === 'Advanced Pawn Level');

  const checks = advancedPawnLessons.map(async (lesson) => {
    const filename = lesson.url.replace(/^\.\.\/lessons\//, '');
    const fileUrl = new URL(`../lessons/${filename}`, import.meta.url);
    await assert.doesNotReject(
      access(fileUrl, constants.R_OK),
      `Lesson file should exist and be readable: ${filename}`,
    );
  });

  await Promise.all(checks);
});
