import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const stylesCss = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const siteHomeCss = readFileSync(new URL('../site-home.css', import.meta.url), 'utf8');
const appJs = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const appNavJs = readFileSync(new URL('../app-navigation.js', import.meta.url), 'utf8');

test('index.html contains all landscape mobile slots and fullscreen controls', () => {
  assert.match(html, /id="boardMoveNavSlot"/, 'boardMoveNavSlot must exist in board-column');
  assert.match(html, /id="notationToolbarSlot"/, 'notationToolbarSlot must wrap notation toolbar');
  assert.match(html, /id="landscapeMenuToggle"/, 'landscapeMenuToggle must exist in right header');
  assert.match(html, /id="headerFullscreenButton"/, 'headerFullscreenButton must exist in header');
  assert.match(html, /id="mobileFullscreenToggle"/, 'mobileFullscreenToggle must exist in mobile app bar');
  assert.match(html, /id="toggleFullscreenMenuButton"/, 'toggleFullscreenMenuButton must exist in settings menu');
});

test('styles.css configures mobile landscape two-column layout with left board pane and right content pane', () => {
  // Left pane scrollable
  assert.match(stylesCss, /\.board-pane\s*\{[\s\S]*overflow-y:\s*auto\s*!important;/, 'board-pane should be scrollable in landscape');
  // Captured pieces hidden in landscape
  assert.match(stylesCss, /#capturedTop,\s*#capturedBottom,[\s\S]*display:\s*none\s*!important;/, 'captured rows must be hidden in landscape');
  // Eval bar on left
  assert.match(stylesCss, /\.eval-bar-wrap\s*\{[\s\S]*left:\s*calc\(50%/, 'eval bar positioned correctly in landscape');
  // Move nav under board in landscape
  assert.match(stylesCss, /\.board-move-nav-slot\s*\{[\s\S]*display:\s*block;/, 'boardMoveNavSlot visible in landscape');
  // Right pane scrollable
  assert.match(stylesCss, /\.page-shell\s+\.control-pane-scroll[\s\S]*overflow-y:\s*auto\s*!important;/, 'right control pane scrollable');
  // Fullscreen icon toggle
  assert.match(stylesCss, /html\.is-fullscreen-app\s+\.fullscreen-enter-icon[\s\S]*display:\s*none\s*!important;/, 'fullscreen icon toggles properly');
});

test('site-home.css locks outer viewport and enables independent scrolling for left and right columns in landscape', () => {
  assert.match(siteHomeCss, /@media\s*\(max-width:\s*930px\)\s*and\s*\(orientation:\s*landscape\)[\s\S]*html,\s*body\s*\{[\s\S]*overflow:\s*hidden\s*!important;/);
  assert.match(siteHomeCss, /@media\s*\(max-width:\s*930px\)\s*and\s*\(orientation:\s*landscape\)[\s\S]*\.workspace-view\s+\.board-pane[\s\S]*overflow-y:\s*auto\s*!important;/);
  assert.match(siteHomeCss, /@media\s*\(max-width:\s*930px\)\s*and\s*\(orientation:\s*landscape\)[\s\S]*\.workspace-view\s+\.control-pane-scroll[\s\S]*overflow-y:\s*auto\s*!important;/);
  assert.match(siteHomeCss, /@media\s*\(max-width:\s*930px\)\s*and\s*\(orientation:\s*landscape\)[\s\S]*\.mobile-app-bar\s*\{\s*display:\s*none\s*!important;\s*\}/);
});

test('app.js dynamically manages notation toolbar slotting and fullscreen', () => {
  assert.match(appJs, /function syncNotationToolbarSlot\(\)/, 'syncNotationToolbarSlot must be defined');
  assert.match(appJs, /boardMoveNavSlot/, 'dom.boardMoveNavSlot referenced');
  assert.match(appJs, /notationToolbarSlot/, 'dom.notationToolbarSlot referenced');
  assert.match(appJs, /mobileLandscapeLayoutActive\(\)/, 'mobileLandscapeLayoutActive handled in sizing');
  assert.match(appJs, /async function toggleFullscreenMode\(\)/, 'toggleFullscreenMode handles fullscreen');
});

test('app-navigation.js binds all mobile drawer toggle triggers', () => {
  assert.match(appNavJs, /#landscapeMenuToggle/);
  assert.match(appNavJs, /toggle-mobile-menu/);
});

test('styles.css and site-home.css keep tab-nav sticky and accessible in mobile landscape across all tabs', () => {
  assert.match(stylesCss, /\.control-pane-scroll\s*>\s*\.tab-nav[\s\S]*position:\s*sticky\s*!important;/, 'tab-nav must be sticky in landscape');
  assert.match(stylesCss, /\.control-pane-scroll\s*>\s*\.tab-nav[\s\S]*order:\s*1\s*!important;/, 'tab-nav must have order: 1');
  assert.match(stylesCss, /\.control-pane-scroll\s*>\s*\.workspace-tools\s*\{[\s\S]*order:\s*2\s*!important;/, 'workspace-tools must have order: 2');
  assert.match(siteHomeCss, /\.control-pane-scroll\s*>\s*\.tab-nav[\s\S]*position:\s*sticky\s*!important;/, 'tab-nav must be sticky in site-home.css landscape block');
});

test('styles.css and site-home.css suppress control-pane, tab-nav, and under-board move nav in board-only mode across landscape', () => {
  // Suppress control pane in board-only mode when setup is not open
  assert.match(stylesCss, /body\.is-board-only:not\(\.is-board-only-setup-open\)\s+\.control-pane[\s\S]*display:\s*none\s*!important;/);
  assert.match(siteHomeCss, /body\.is-board-only:not\(\.is-board-only-setup-open\)\s+\.control-pane[\s\S]*display:\s*none\s*!important;/);
  // Suppress tab-nav and under-board move nav slot in board-only mode
  assert.match(stylesCss, /body\.is-board-only\s+\.tab-nav[\s\S]*display:\s*none\s*!important;/);
  assert.match(stylesCss, /body\.is-board-only\s+\.board-move-nav-slot[\s\S]*display:\s*none\s*!important;/);
  assert.match(siteHomeCss, /body\.is-board-only\s+\.tab-nav[\s\S]*display:\s*none\s*!important;/);
  assert.match(siteHomeCss, /body\.is-board-only\s+\.board-move-nav-slot[\s\S]*display:\s*none\s*!important;/);
  // Keep workspace single-column in board-only mode
});

test('app.js calculates board-only dynamic sizing at the start of syncBoardSize and handles syncSize messages', () => {
  assert.match(appJs, /if\s*\(state\.boardOnlyMode\)\s*\{[\s\S]*const vh = currentViewportHeight\(\)[\s\S]*Math\.floor\(Math\.min\(availWidth,\s*availHeight\)\)/, 'syncBoardSize computes board-only size from full viewport');
  assert.match(appJs, /if\s*\(data\.type === 'syncSize'\)\s*\{\s*syncBoardSize\(\);\s*return;\s*\}/, 'app.js handles syncSize message');
  assert.match(appJs, /new ResizeObserver\(\(\) => \{\s*syncBoardSize\(\);/, 'app.js monitors resize via ResizeObserver');
});


