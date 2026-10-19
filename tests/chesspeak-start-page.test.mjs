import assert from 'node:assert/strict';
import { access, readFile, stat } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const PAGE = 'chesspeak/index.html';

// Routes produced by the Pages build (see .github/workflows/pages.yml).
const BUILT_ROUTES = new Map([
  ['openings/', 'apps/opening-book/index.html'],
  ['3d/', 'apps/3d-chess-studio/index.html'],
]);

function file(path) {
  return new URL(path, root);
}

async function read(path) {
  return readFile(file(path), 'utf8');
}

function localReferences(html) {
  return [...html.matchAll(/(?:href|src)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((reference) => !reference.startsWith('#'));
}

test('every link on the ChessPeak start page resolves to a published page or asset', async () => {
  const html = await read(PAGE);
  for (const reference of localReferences(html)) {
    const resolved = new URL(reference, file(PAGE));
    if (resolved.protocol !== 'file:') continue;
    const routePath = resolved.pathname.slice(file('').pathname.length);
    const built = BUILT_ROUTES.get(routePath);
    if (built) {
      await access(file(built));
      continue;
    }
    const target = await stat(resolved);
    if (target.isDirectory()) {
      await access(new URL('index.html', resolved));
    }
  }
});

test('the start page opens study-board tools the board app accepts', async () => {
  const html = await read(PAGE);
  const app = await read('app.js');
  const tabs = [...html.matchAll(/href="\.\.\/\?tab=([a-z]+)"/g)].map((match) => match[1]);
  assert.deepEqual(tabs, ['play', 'puzzle', 'analysis']);

  for (const tab of tabs) {
    assert.match(app, new RegExp(`const TAB_[A-Z]+ = '${tab}';`), `app.js defines the ${tab} tab`);
  }
  assert.match(
    app,
    /hydratePuzzleState\(\);\s*applyStartTabDeepLink\(\);/,
    'the tab link is applied after the saved draft so it wins',
  );
  assert.match(app, /if \(!tab \|\| tab === TAB_LESSONS\) return;/, 'the coach Position Builder is not linkable');

  const index = await read('index.html');
  assert.match(index, /src="\.\/app\.js\?v=20261019-tab-deep-link"/, 'index.html loads the updated app.js');
});

test('the start page shares the study board theme and stays out of search results', async () => {
  const html = await read(PAGE);
  const index = await read('index.html');
  assert.match(index, /const storageKey = 'color-theme-v1';/);
  assert.match(html, /const storageKey = 'color-theme-v1';/);
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.match(html, /viewport-fit=cover/);
});
