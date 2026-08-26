import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';

const teacherCss = readFileSync(new URL('../lessons/pawn-teacher-board.css', import.meta.url), 'utf8');
const teacherJs = readFileSync(new URL('../lessons/pawn-teacher-board.js', import.meta.url), 'utf8');
const stylesCss = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const siteHomeCss = readFileSync(new URL('../site-home.css', import.meta.url), 'utf8');

test('pawn-teacher-board.css centers the chessboard container and dynamically sizes it using min(calc(100vh - offset), 75vw) with 1:1 aspect ratio', () => {
  // .teacher-board-body must use flexbox centering and overflow hidden
  assert.match(
    teacherCss,
    /\.teacher-board-body\s*\{[\s\S]*display:\s*flex;[\s\S]*align-items:\s*center;[\s\S]*justify-content:\s*center;[\s\S]*overflow:\s*hidden\s*!important;/,
    '.teacher-board-body must be centered via flexbox and contain overflow',
  );

  // .teacher-board-frame must use dynamic min(calc(100vh - offset), 75vw) sizing and aspect-ratio: 1 / 1
  assert.match(
    teacherCss,
    /\.teacher-board-frame\s*\{[\s\S]*min\(calc\(100vh\s*-\s*var\(--teacher-header-footer-offset\)\),\s*75vw[\s\S]*aspect-ratio:\s*1\s*\/\s*1;/,
    '.teacher-board-frame must dynamically size using min(calc(100vh - offset), 75vw) with aspect-ratio: 1 / 1',
  );

  // maximized mode must preserve dynamic sizing and aspect-ratio: 1 / 1
  assert.match(
    teacherCss,
    /\.teacher-board-panel\.is-maximized\s+\.teacher-board-frame\s*\{[\s\S]*min\(calc\(100vh\s*-\s*var\(--teacher-header-footer-offset\)\),\s*75vw[\s\S]*aspect-ratio:\s*1\s*\/\s*1;/,
    '.teacher-board-panel.is-maximized .teacher-board-frame must use dynamic sizing with aspect-ratio: 1 / 1',
  );
});

test('pawn-teacher-board.css protects top header and bottom toolbars from shrinking or clipping, and keeps setup tray hidden by default', () => {
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

  // Setup tray is hidden with display: none !important when hidden or not setup open
  assert.match(
    teacherCss,
    /\.teacher-board-setup-tray\[hidden\],[\s\S]*display:\s*none\s*!important;/,
    '.teacher-board-setup-tray must be strictly hidden with display: none !important',
  );

  // Lesson status box has flex-shrink: 0
  assert.match(
    teacherCss,
    /\.teacher-lesson-status\s*\{[\s\S]*flex-shrink:\s*0;/,
    '.teacher-lesson-status must have flex-shrink: 0',
  );
});

test('styles.css and site-home.css contain overflow, eliminate captured pieces on teacher board, and hide extra piece palette unless setup active', () => {
  // styles.css zero-padding and overflow hidden for board-only page shell
  assert.match(
    stylesCss,
    /body\.is-board-only\s+\.page-shell,[\s\S]*padding:\s*0\s*!important;[\s\S]*overflow:\s*hidden\s*!important;/,
    'styles.css must set padding: 0 !important and overflow: hidden !important on page-shell in board-only mode',
  );

  // styles.css completely hides captured-row in board-only mode
  assert.match(
    stylesCss,
    /body\.is-board-only\s+\.captured-row,[\s\S]*display:\s*none\s*!important;/,
    'styles.css must hide captured-row in board-only mode',
  );

  // styles.css completely hides control-pane and piece-palette when setup is not open
  assert.match(
    stylesCss,
    /body\.is-board-only:not\(\.is-board-only-setup-open\)\s+\.control-pane,[\s\S]*body\.is-board-only:not\(\.is-board-only-setup-open\)\s+\.piece-palette,[\s\S]*display:\s*none\s*!important;/,
    'styles.css must hide piece palette when setup is not open',
  );

  // site-home.css zero-padding and overflow hidden on board-only page-shell
  assert.match(
    siteHomeCss,
    /body\.is-board-only\s+\.page-shell\s*\{[\s\S]*padding:\s*0\s*!important;[\s\S]*overflow:\s*hidden\s*!important;/,
    'site-home.css must set padding: 0 and overflow: hidden on page-shell in board-only mode',
  );

  // site-home.css hides captured-row in board-only mode
  assert.match(
    siteHomeCss,
    /body\.is-board-only\s+\.captured-row,[\s\S]*display:\s*none\s*!important;/,
    'site-home.css must hide captured-row in board-only mode',
  );
});

test('pawn-teacher-board.js observes container resize, toggles is-setup-open, and synchronizes board iframe sizing', () => {
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
  assert.match(
    teacherJs,
    /panel\.classList\.toggle\("is-setup-open",\s*setupOpen\)/,
    'pawn-teacher-board.js should toggle is-setup-open class on panel',
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
