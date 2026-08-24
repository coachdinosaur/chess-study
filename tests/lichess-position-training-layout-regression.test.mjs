import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../lichess-position-training-post-answer-fix.css', import.meta.url), 'utf8');
const refreshModule = readFileSync(new URL('../lichess-position-training-style-refresh.mjs', import.meta.url), 'utf8');
const parentModule = readFileSync(new URL('../focus-analysis-popup.mjs', import.meta.url), 'utf8');

test('post-answer content stays in one explicit trainer grid column', () => {
  assert.match(css, /\.position-training-board-wrap,[\s\S]*\.position-training-actions\s*\{[\s\S]*grid-column:\s*1;/);
  assert.match(css, /\.position-training-main\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(css, /\.position-training-actions\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*row;/);
});

test('trainer coordinates use the reduced label size', () => {
  assert.match(css, /\.position-training-coordinate\s*\{[\s\S]*font-size:\s*clamp\(0\.42rem,\s*0\.8vw,\s*0\.62rem\)/);
});

test('cache refresh loads the post-answer repair stylesheet', () => {
  assert.match(refreshModule, /lichess-position-training-premium-layout\.css\?v=20260824-landscape-board2/);
  assert.match(parentModule, /lichess-position-training-style-refresh\.mjs\?v=20260824-landscape-board2/);
});

test('Position Study landscape mobile layout maximizes chessboard and places instruction below board', () => {
  const premiumCss = readFileSync(new URL('../lichess-position-training-premium-layout.css', import.meta.url), 'utf8');
  assert.match(premiumCss, /\.position-training-header\s*>\s*div\s*\{\s*display:\s*none\s*!important;\s*\}/);
  assert.match(premiumCss, /\.position-training-board-wrap\s*\{[\s\S]*grid-column:\s*1\s*!important;\s*grid-row:\s*1\s*\/\s*span\s*2\s*!important;/);
  assert.match(premiumCss, /\.position-training-feedback\s*\{[\s\S]*grid-column:\s*1\s*!important;\s*grid-row:\s*3\s*!important;/);
  assert.match(premiumCss, /\.position-training-actions\s*\{[\s\S]*grid-column:\s*2\s*!important;\s*grid-row:\s*1\s*!important;/);
  assert.match(premiumCss, /\.position-training-sidebar\s*\{[\s\S]*grid-column:\s*2\s*!important;\s*grid-row:\s*2\s*\/\s*span\s*2\s*!important;/);
});


