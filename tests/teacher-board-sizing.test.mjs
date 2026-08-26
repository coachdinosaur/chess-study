import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';

const teacherCss = readFileSync(new URL('../lessons/pawn-teacher-board.css', import.meta.url), 'utf8');
const teacherJs = readFileSync(new URL('../lessons/pawn-teacher-board.js', import.meta.url), 'utf8');
const stylesCss = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const siteHomeCss = readFileSync(new URL('../site-home.css', import.meta.url), 'utf8');

test('pawn-teacher-board.css centers the chessboard container and fills available middle section space with 1:1 aspect ratio', () => {
  // .teacher-board-body must use flexbox centering
  assert.match(
    teacherCss,
    /\.teacher-board-body\s*\{[\s\S]*display:\s*flex;[\s\S]*align-items:\s*center;[\s\S]*justify-content:\s*center;/,
    '.teacher-board-body must be centered via flexbox',
  );

  // .teacher-board-frame must use height: 100% and aspect-ratio: 1 / 1
  assert.match(
    teacherCss,
    /\.teacher-board-frame\s*\{[\s\S]*height:\s*100%;[\s\S]*max-width:\s*100%;[\s\S]*aspect-ratio:\s*1\s*\/\s*1;/,
    '.teacher-board-frame must use height: 100% and aspect-ratio: 1 / 1',
  );

  // maximized mode must preserve height: 100% and aspect-ratio: 1 / 1
  assert.match(
    teacherCss,
    /\.teacher-board-panel\.is-maximized\s+\.teacher-board-frame\s*\{[\s\S]*height:\s*100%;[\s\S]*aspect-ratio:\s*1\s*\/\s*1;/,
    '.teacher-board-panel.is-maximized .teacher-board-frame must fill height with aspect-ratio: 1 / 1',
  );
});

test('pawn-teacher-board.css protects top header and bottom toolbars from shrinking or clipping', () => {
  // Top header has flex-shrink: 0
  assert.match(
    teacherCss,
    /\.teacher-board-head\s*\{[\s\S]*flex-shrink:\s*0;/,
    '.teacher-board-head must have flex-shrink: 0',
  );

  // Bottom tools bar has flex-shrink: 0
  assert.match(
    teacherCss,
    /\.teacher-board-tools\s*\{[\s\S]*flex-shrink:\s*0;/,
    '.teacher-board-tools must have flex-shrink: 0',
  );

  // Setup tray has flex-shrink: 0
  assert.match(
    teacherCss,
    /\.teacher-board-setup-tray\s*\{[\s\S]*flex-shrink:\s*0;/,
    '.teacher-board-setup-tray must have flex-shrink: 0',
  );

  // Lesson status box has flex-shrink: 0
  assert.match(
    teacherCss,
    /\.teacher-lesson-status\s*\{[\s\S]*flex-shrink:\s*0;/,
    '.teacher-lesson-status must have flex-shrink: 0',
  );
});

test('styles.css and site-home.css provide zero-padding and transparent card container for embedded board-only mode', () => {
  // styles.css zero-padding for board-only page shell
  assert.match(
    stylesCss,
    /body\.is-board-only\s+\.page-shell,[\s\S]*padding:\s*0\s*!important;/,
    'styles.css must set padding: 0 !important on page-shell in board-only mode',
  );

  // styles.css zero border/background on board-stage-card in board-only mode
  assert.match(
    stylesCss,
    /body\.is-board-only\s+\.board-stage-card,[\s\S]*background:\s*transparent\s*!important;/,
    'styles.css must remove card background in board-only mode',
  );

  // site-home.css zero-padding on board-only page-shell
  assert.match(
    siteHomeCss,
    /body\.is-board-only\s+\.page-shell\s*\{[\s\S]*padding:\s*0\s*!important;/,
    'site-home.css must set padding: 0 !important on page-shell in board-only mode',
  );
});

test('pawn-teacher-board.js observes container resize and synchronizes board iframe sizing', () => {
  assert.match(
    teacherJs,
    /ResizeObserver/,
    'pawn-teacher-board.js should initialize ResizeObserver for panel sizing updates',
  );
  assert.match(
    teacherJs,
    /window\.addEventListener\("resize"/,
    'pawn-teacher-board.js should listen to window resize events',
  );
});

test('all lesson files and consumers use the unified current cache query version', () => {
  const versionMatch = teacherJs.match(/var TEACHER_CACHE_VERSION = "([^"]+)";/);
  assert.ok(versionMatch, 'TEACHER_CACHE_VERSION must be declared in pawn-teacher-board.js');
  const currentVersion = versionMatch[1];

  const lessonsDir = new URL('../lessons/', import.meta.url);
  const files = readdirSync(lessonsDir);
  let checkedConsumers = 0;

  for (const file of files) {
    const fullUrl = new URL(file, lessonsDir);
    if (statSync(fullUrl).isFile() && (file.endsWith('.html') || file.endsWith('.js'))) {
      const content = readFileSync(fullUrl, 'utf8');
      if (content.includes('pawn-teacher-board.css') || content.includes('pawn-teacher-board.js')) {
        assert.ok(
          content.includes(`v=${currentVersion}`),
          `${file} must use cache version ?v=${currentVersion}`,
        );
        checkedConsumers++;
      }
    }
  }

  assert.ok(checkedConsumers >= 70, `Expected at least 70 lesson files checked, found ${checkedConsumers}`);
});
