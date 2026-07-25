import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { Chess } from '../vendor/chess.js';

const BASE_URL = process.env.POSITION_TRAINING_BASE_URL || 'http://127.0.0.1:8000';
const datasetBaseUrl = new URL('../assets/puzzles/lichess-position-training/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', datasetBaseUrl), 'utf8'));
const initialPositions = new Map();

for (const shard of manifest.shards || []) {
  const payload = JSON.parse(await readFile(new URL(shard.file, datasetBaseUrl), 'utf8'));
  for (const record of payload.puzzles || []) {
    const game = new Chess(record.sourceFen);
    const repair = String(record.repairMove || '');
    game.move({
      from: repair.slice(0, 2),
      to: repair.slice(2, 4),
      promotion: repair[4] || undefined,
    });
    initialPositions.set(game.fen(), game.turn());
  }
}

assert.equal(initialPositions.size, Number(manifest.count), 'smoke test should load every installed puzzle');

function uci(move) {
  return `${move.from}${move.to}${move.promotion || ''}`;
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const pageErrors = [];
const relevantConsoleErrors = [];
let activeSolverColor = null;
let tablebaseRequests = 0;

page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('console', (message) => {
  if (message.type() !== 'error') return;
  const text = message.text();
  if (/favicon|Failed to load resource/i.test(text)) return;
  relevantConsoleErrors.push(text);
});

await page.route('https://tablebase.lichess.org/standard**', async (route) => {
  tablebaseRequests += 1;
  const url = new URL(route.request().url());
  const fen = url.searchParams.get('fen') || '';
  const game = new Chess(fen);
  if (initialPositions.has(game.fen())) activeSolverColor = initialPositions.get(game.fen());
  const solverColor = activeSolverColor || game.turn();
  const solverToMove = game.turn() === solverColor;
  const legalMoves = game.moves({ verbose: true });
  const moves = solverToMove && legalMoves[0] ? [{ uci: uci(legalMoves[0]) }] : [];
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: {
      'access-control-allow-origin': '*',
      'cross-origin-resource-policy': 'cross-origin',
    },
    body: JSON.stringify({
      category: solverToMove ? 'win' : 'loss',
      dtz: solverToMove ? 1 : -1,
      moves,
    }),
  });
});

try {
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle', timeout: 60_000 });
  await page.waitForFunction(() => !document.body.classList.contains('loading'));

  await page.locator('.tab-nav [data-action="set-tab"][data-tab="puzzle"]').click();
  await page.locator('#puzzlePanel').waitFor({ state: 'visible' });
  await page.getByRole('heading', { name: 'Endgame Puzzles' }).waitFor();
  await page.locator('[data-position-training-launcher]').waitFor();
  assert.equal(await page.locator('[data-position-training-launcher]').count(), 1, 'launcher should appear once');
  assert.match(await page.locator('#puzzlePanel').innerText(), /Endgame Puzzles/, 'existing puzzle trainer should remain visible');

  await page.locator('.tab-nav [data-action="set-tab"][data-tab="analysis"]').click();
  await page.locator('.tab-nav [data-action="set-tab"][data-tab="puzzle"]').click();
  await page.locator('[data-position-training-launcher]').waitFor();
  assert.equal(await page.locator('[data-position-training-launcher]').count(), 1, 'launcher should survive puzzle-panel rerenders without duplication');

  await page.getByRole('button', { name: 'Open position training' }).click();
  const overlay = page.locator('.position-training-overlay');
  await overlay.waitFor({ state: 'visible' });
  await overlay.getByRole('heading', { name: 'Lichess Position Training' }).waitFor();
  await page.waitForFunction(() => {
    const feedback = document.querySelector('[data-pt-feedback]')?.textContent || '';
    return !/Loading and validating/i.test(feedback) && document.querySelector('[data-pt-current] dd');
  }, null, { timeout: 30_000 });

  const seenSides = new Set();
  for (let attempt = 0; attempt < 12 && seenSides.size < 2; attempt += 1) {
    const side = (await overlay.locator('[data-pt-current] dd').first().textContent())?.trim();
    assert.ok(side === 'White' || side === 'Black', `unexpected solver side: ${side}`);
    seenSides.add(side);
    const firstSquare = await overlay.locator('[data-pt-board] [data-square]').first().getAttribute('data-square');
    assert.equal(firstSquare, side === 'White' ? 'a8' : 'h1', `${side} board orientation should face the solver`);
    if (seenSides.size < 2) {
      await overlay.getByRole('button', { name: 'Next position' }).click();
      await page.waitForFunction(
        () => !/Loading and validating/i.test(document.querySelector('[data-pt-feedback]')?.textContent || ''),
        null,
        { timeout: 30_000 },
      );
    }
  }
  assert.deepEqual([...seenSides].sort(), ['Black', 'White'], 'installed dataset should exercise both solver colors');

  const side = (await overlay.locator('[data-pt-current] dd').first().textContent())?.trim();
  const colorWord = side === 'White' ? 'white' : 'black';
  const candidateSquares = await overlay.locator('[data-pt-board] [data-square]').evaluateAll(
    (nodes, color) => nodes
      .filter((node) => (node.getAttribute('aria-label') || '').includes(` ${color} `))
      .map((node) => node.dataset.square),
    colorWord,
  );

  let legalTarget = null;
  for (const square of candidateSquares) {
    await overlay.locator(`[data-pt-board] [data-square="${square}"]`).click();
    const targets = overlay.locator('[data-pt-board] .legal-target');
    if (await targets.count()) {
      legalTarget = targets.first();
      break;
    }
  }

  assert.ok(legalTarget, 'solver should have at least one movable piece');
  await legalTarget.click();
  await page.waitForFunction(() => {
    const text = document.querySelector('[data-pt-feedback]')?.textContent || '';
    return /accepted|Solved|Continue from the new position/i.test(text) || /could not|did not return|timed out/i.test(text);
  }, null, { timeout: 45_000 });
  const moveFeedback = await overlay.locator('[data-pt-feedback]').innerText();
  assert.doesNotMatch(moveFeedback, /could not|did not return|timed out/i, `dynamic reply failed: ${moveFeedback}`);
  console.log(`Dynamic evaluator completed; intercepted tablebase requests: ${tablebaseRequests}.`);

  await overlay.getByRole('button', { name: 'Close position training' }).click();
  await overlay.waitFor({ state: 'hidden' });

  const embedPage = await context.newPage();
  await embedPage.goto(`${BASE_URL}/?embed=1&boardOnly=1`, { waitUntil: 'networkidle', timeout: 60_000 });
  await embedPage.waitForFunction(() => !document.body.classList.contains('loading'));
  assert.equal(await embedPage.locator('[data-position-training-launcher]').count(), 0, 'launcher must not appear in embedded boards');
  await embedPage.close();

  assert.deepEqual(pageErrors, [], `browser page errors: ${pageErrors.join('\n')}`);
  assert.deepEqual(relevantConsoleErrors, [], `browser console errors: ${relevantConsoleErrors.join('\n')}`);
  console.log('Position training browser smoke test passed.');
} finally {
  await browser.close();
}
