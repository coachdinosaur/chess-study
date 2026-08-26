import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const headerCss = readFileSync(new URL('../lessons/lesson-header.css', import.meta.url), 'utf8');
const endgameCss = readFileSync(new URL('../lessons/endgame-lesson.css', import.meta.url), 'utf8');
const advPawnCss = readFileSync(new URL('../lessons/advanced-pawn-lesson.css', import.meta.url), 'utf8');

test('lesson-header.css configures horizontal swipeable pill navigation without full-width grid stacking', () => {
  // Verifies horizontal scroll track on mobile
  assert.match(headerCss, /overflow-x:\s*auto;/, 'index-top-actions must be horizontally scrollable');
  assert.match(headerCss, /flex-wrap:\s*nowrap;/, 'index-top-actions must not force wrapping on mobile scroll track');
  assert.match(headerCss, /-webkit-overflow-scrolling:\s*touch;/, 'smooth touch momentum scrolling enabled');
  assert.match(headerCss, /scrollbar-width:\s*none;/, 'scrollbar hidden on Firefox');
  assert.match(headerCss, /body \.index-top-actions::-webkit-scrollbar\s*\{[\s\S]*display:\s*none;/, 'scrollbar hidden on WebKit');

  // Verify full-width grid column stacking was removed
  assert.doesNotMatch(headerCss, /grid-template-columns:\s*1fr;/, '1-column full-width grid stack must be removed');
  assert.doesNotMatch(headerCss, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/, '2-column grid stack must be removed');
});

test('lesson-header.css configures compact landscape mobile view', () => {
  assert.match(headerCss, /@media\s*\(max-height:\s*500px\)\s*and\s*\(orientation:\s*landscape\)/, 'landscape mobile media query must exist');
});

test('shared stylesheets import lesson-header.css with current cache query version', () => {
  const versionMatch = endgameCss.match(/@import url\("lesson-header\.css\?v=([^"]+)"\);/);
  assert.ok(versionMatch, 'endgame-lesson.css must import lesson-header.css with version query');
  const currentVersion = versionMatch[1];

  assert.match(
    advPawnCss,
    new RegExp(`@import url\\("lesson-header\\.css\\?v=${currentVersion}"\\);`),
    'advanced-pawn-lesson.css must use the same cache version as endgame-lesson.css',
  );
});
