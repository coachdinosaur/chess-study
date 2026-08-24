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
  assert.match(stylesCss, /\.board-pane\s*\{[\s\S]*overflow-y:\s*auto;/, 'board-pane should be scrollable in landscape');
  // Captured pieces hidden in landscape
  assert.match(stylesCss, /#capturedTop,\s*#capturedBottom,[\s\S]*display:\s*none\s*!important;/, 'captured rows must be hidden in landscape');
  // Eval bar on left
  assert.match(stylesCss, /\.eval-bar-wrap\s*\{[\s\S]*left:\s*calc\(50%/, 'eval bar positioned correctly in landscape');
  // Move nav under board in landscape
  assert.match(stylesCss, /\.board-move-nav-slot\s*\{[\s\S]*display:\s*block;/, 'boardMoveNavSlot visible in landscape');
  // Right pane scrollable
  assert.match(stylesCss, /\.page-shell\s+\.control-pane-scroll[\s\S]*overflow-y:\s*auto;/, 'right control pane scrollable');
  // Fullscreen icon toggle
  assert.match(stylesCss, /html\.is-fullscreen-app\s+\.fullscreen-enter-icon[\s\S]*display:\s*none\s*!important;/, 'fullscreen icon toggles properly');
});

test('site-home.css hides mobile app bar in mobile landscape', () => {
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
