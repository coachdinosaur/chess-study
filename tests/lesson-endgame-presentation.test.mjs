import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dispatcher = readFileSync(new URL('../lessons/lesson-presentation.js', import.meta.url), 'utf8');
const runtime = readFileSync(new URL('../lessons/endgame-presentation.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../lessons/endgame-presentation.css', import.meta.url), 'utf8');
const endgameLoader = readFileSync(new URL('../lessons/endgame-lesson.js', import.meta.url), 'utf8');
const clickToggle = readFileSync(new URL('../lessons/presentation-click-toggle.js', import.meta.url), 'utf8');

const lessonFiles = [
  '01-king-pawn-rule-of-square.html',
  '02-pawn-on-the-6th-rank.html',
  '03-knights-pawn-and-key-squares.html',
  '04-distant-opposition-rooks-pawn-imprisoning.html',
  '05-rook-pawn-rule-rook-vs-bishop-knight.html',
  '06-separated-knight-corner-trap-kamsky-bacrot.html',
  '07-basic-test-positions.html',
];

test('presentation dispatcher routes endgame pages to the dedicated runtime', () => {
  assert.match(dispatcher, /data-lesson-series/);
  assert.match(dispatcher, /endgame-presentation\.js/);
  assert.match(dispatcher, /lesson-presentation-legacy\.js/);
});

test('presentation dispatcher loads the shared click-animation toggle', () => {
  assert.match(dispatcher, /presentation-click-toggle\.js/);
  assert.match(dispatcher, /data-presentation-click-toggle-runtime/);
  assert.ok(
    dispatcher.indexOf('presentation-click-toggle.js') > dispatcher.indexOf('document.body.appendChild(script)'),
    'toggle helper should be appended after the selected presentation runtime',
  );
});

test('click-animation toggle supports both presentation toolbars and persists the choice', () => {
  assert.match(clickToggle, /lesson-presentation-click-animation-v1/);
  assert.match(clickToggle, /\.lesson-presentation-toolbar/);
  assert.match(clickToggle, /\.endgame-presentation-toolbar/);
  assert.match(clickToggle, /Click animation: /);
  assert.match(clickToggle, /aria-pressed/);
  assert.match(clickToggle, /localStorage\.setItem/);
  assert.match(clickToggle, /presentation-click-animation-disabled/);
  assert.match(clickToggle, /lesson-presentation-click-indicator/);
  assert.match(clickToggle, /endgame-presentation-click-indicator/);
});

test('dedicated runtime collects the complete endgame page structures', () => {
  assert.match(runtime, /directChildren\(root,"?\.lesson"?\)/);
  assert.match(runtime, /child\.matches\("\.position"\)/);
  assert.match(runtime, /\.position-label/);
  assert.match(runtime, /\.moveline/);
  assert.match(runtime, /\.test-section \.test-card/);
  assert.match(runtime, /directChildren\(root,"?\.checklist"?\)/);
  assert.match(runtime, /Learning goals/);
});

test('endgame presentation CSS provides board, test-card, toolbar, and mobile layouts', () => {
  assert.match(css, /endgame-presentation-current\.position \.position-body/);
  assert.match(css, /endgame-presentation-current\.test-card/);
  assert.match(css, /endgame-presentation-toolbar/);
  assert.match(css, /@media \(max-width:1050px\)/);
});

test('all seven endgame pages identify themselves and load the shared endgame runtime', () => {
  for (const file of lessonFiles) {
    const html = readFileSync(new URL(`../lessons/${file}`, import.meta.url), 'utf8');
    assert.match(html, /data-lesson-series="endgame"/, file);
    assert.match(html, /endgame-lesson\.js/, file);
  }
  assert.match(endgameLoader, /lesson-presentation\.js/);
});
