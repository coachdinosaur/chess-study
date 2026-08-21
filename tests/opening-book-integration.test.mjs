import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

function file(path) {
  return new URL(path, root);
}

test('the main app, lesson index, and opening course cross-link', async () => {
  const [home, lessonIndex, openingSource] = await Promise.all([
    readFile(file('index.html'), 'utf8'),
    readFile(file('lessons/index.html'), 'utf8'),
    readFile(file('apps/opening-book/app/CatalanApp.tsx'), 'utf8'),
  ]);

  assert.match(home, /href="\.\/openings\/"/);
  assert.match(lessonIndex, /href="\.\.\/openings\/"/);
  assert.match(openingSource, /href="\/"/);
  assert.match(openingSource, /href="\/lessons\/"/);
});

test('the Pages workflow builds and mounts both opening artifacts', async () => {
  const [workflow, viteConfigCatalan, viteConfigSicilian] = await Promise.all([
    readFile(file('.github/workflows/pages.yml'), 'utf8'),
    readFile(file('apps/opening-book/vite.config.ts'), 'utf8'),
    readFile(file('apps/opening-book-sicilian/vite.config.ts'), 'utf8'),
  ]);

  assert.match(viteConfigCatalan, /base:\s*["']\/openings\/["']/);
  assert.match(viteConfigSicilian, /base:\s*["']\/openings-sicilian\/["']/);
  assert.match(workflow, /working-directory:\s*apps\/opening-book-sicilian/);
  assert.match(workflow, /mv apps\/opening-book-sicilian\/dist openings-sicilian/);
  assert.match(workflow, /rm -rf apps\/opening-book-sicilian/);
});

test('the built Catalan output is complete and rooted at /openings/', async () => {
  const [indexHtml, firstChapter] = await Promise.all([
    readFile(file('apps/opening-book/dist/index.html'), 'utf8'),
    readFile(file('apps/opening-book/dist/chapters/1/index.html'), 'utf8'),
  ]);

  assert.match(indexHtml, /(?:href|src)="\/openings\/assets\//);
  assert.match(indexHtml, /href="https:\/\/cddigital\.top\/openings\/"/);
  assert.match(firstChapter, /\.\.\/\.\.\/#\/chapters\/1/);

  await Promise.all([
    access(file('apps/opening-book/dist/chapters/16/index.html')),
    access(file('apps/opening-book/dist/assets/pieces/mpchess/wK.svg')),
    access(file('apps/opening-book/dist/stockfish/stockfish-18-lite-single.js')),
    access(file('apps/opening-book/dist/stockfish/stockfish-18-lite-single.wasm')),
  ]);
});

test('the built Sicilian output is complete, rooted at /openings-sicilian/, and uses shared resources', async () => {
  const [indexHtml, firstChapter, secondChapter, thirdChapter] = await Promise.all([
    readFile(file('apps/opening-book-sicilian/dist/index.html'), 'utf8'),
    readFile(file('apps/opening-book-sicilian/dist/chapters/1/index.html'), 'utf8'),
    readFile(file('apps/opening-book-sicilian/dist/chapters/2/index.html'), 'utf8'),
    readFile(file('apps/opening-book-sicilian/dist/chapters/3/index.html'), 'utf8'),
  ]);

  assert.match(indexHtml, /(?:href|src)="\/openings-sicilian\//);
  assert.match(indexHtml, /href="https:\/\/cddigital\.top\/openings-sicilian\/"/);
  assert.match(firstChapter, /\.\.\/\.\.\/#\/chapters\/1/);
  assert.match(secondChapter, /\.\.\/\.\.\/#\/chapters\/2/);
  assert.match(thirdChapter, /\.\.\/\.\.\/#\/chapters\/3/);

  // Sicilian should NOT duplicate stockfish or pieces assets in its dist directory
  await assert.rejects(access(file('apps/opening-book-sicilian/dist/assets/pieces/mpchess/wK.svg')));
  await assert.rejects(access(file('apps/opening-book-sicilian/dist/stockfish/stockfish-18-lite-single.js')));
});

test('the Opening Courses Hub at /openings/ presents both Sicilian and Catalan courses', async () => {
  const [hubComponent, distIndexHtml] = await Promise.all([
    readFile(file('apps/opening-book/app/components/OpeningHubView.tsx'), 'utf8'),
    readFile(file('apps/opening-book/dist/index.html'), 'utf8'),
  ]);

  // Page structure assertions
  assert.match(hubComponent, /Opening Courses/);
  assert.match(hubComponent, /Study practical opening repertoires, key ideas, and important variations through interactive chess lessons\./);
  assert.match(hubComponent, /Choose an Opening Course/);

  // Course Card 1: Beating the Anti-Sicilian
  assert.match(hubComponent, /Beating the Anti-Sicilian/);
  assert.match(hubComponent, /Sicilian Defense/);
  assert.match(hubComponent, /A practical opening course focused on how to meet the Anti-Sicilian systems and fight for an active position as Black\./);
  assert.match(hubComponent, /\/openings-sicilian\//);

  // Course Card 2: Catalan Opening
  assert.match(hubComponent, /Catalan Opening/);
  assert.match(hubComponent, /Study the Catalan, its strategic ideas, important variations, and model positions through interactive lessons\./);
  assert.match(hubComponent, /#\/chapters\/1/);

  // Verify built dist bundle exists and includes hub markup
  assert.match(distIndexHtml, /Opening Courses \| CD Digital Chess/);
});

