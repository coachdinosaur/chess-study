import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('app.js configures resilient engine timeouts for network WASM downloads', async () => {
  const appSource = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  
  const readyTimeoutMatch = appSource.match(/const ENGINE_READY_TIMEOUT_MS\s*=\s*(\d+);/);
  assert.ok(readyTimeoutMatch, 'ENGINE_READY_TIMEOUT_MS should be defined');
  const readyTimeout = Number(readyTimeoutMatch[1]);
  assert.ok(readyTimeout >= 30000, `ENGINE_READY_TIMEOUT_MS should be at least 30000ms, got ${readyTimeout}ms`);

  const recheckTimeoutMatch = appSource.match(/const ENGINE_RECHECK_TIMEOUT_MS\s*=\s*(\d+);/);
  assert.ok(recheckTimeoutMatch, 'ENGINE_RECHECK_TIMEOUT_MS should be defined');
  const recheckTimeout = Number(recheckTimeoutMatch[1]);
  assert.ok(recheckTimeout >= 10000, `ENGINE_RECHECK_TIMEOUT_MS should be at least 10000ms, got ${recheckTimeout}ms`);
});

test('app.js skips cross-origin isolated candidates upfront when headers are absent', async () => {
  const appSource = await readFile(new URL('../app.js', import.meta.url), 'utf8');

  // Verify candidate check skips candidate.requiresCrossOriginIsolation when !window.crossOriginIsolated
  assert.match(
    appSource,
    /candidate\.requiresCrossOriginIsolation\s*&&\s*!window\.crossOriginIsolated/,
    'resolveStockfishBundleCandidate should skip cross-origin-isolated bundles upfront when isolation is absent',
  );

  // Verify stockfishAssetExists handles 405 Method Not Allowed fallback
  assert.match(
    appSource,
    /response\.status === 405/,
    'stockfishAssetExists should support fallback when HEAD returns 405 Method Not Allowed',
  );
});

test('opening book stockfish client resolves base-aware worker URL without subpage contamination', async () => {
  const bookClientSource = await readFile(
    new URL('../apps/opening-book/app/stockfish-client.ts', import.meta.url),
    'utf8',
  );
  assert.match(
    bookClientSource,
    /import\.meta\.env\?\.BASE_URL/,
    'Opening book stockfish-client.ts should use import.meta.env.BASE_URL for worker URL',
  );
  assert.doesNotMatch(
    bookClientSource,
    /document\.baseURI/,
    'Opening book stockfish-client.ts should not use document.baseURI which breaks nested chapter routes',
  );

  const sicilianClientSource = await readFile(
    new URL('../apps/opening-book-sicilian/app/stockfish-client.ts', import.meta.url),
    'utf8',
  );
  assert.match(
    sicilianClientSource,
    /import\.meta\.env\?\.BASE_URL/,
    'Sicilian stockfish-client.ts should use import.meta.env.BASE_URL for worker URL',
  );
  assert.doesNotMatch(
    sicilianClientSource,
    /document\.baseURI/,
    'Sicilian stockfish-client.ts should not use document.baseURI which breaks nested chapter routes',
  );
});

test('3D Chess Studio Stockfish master engine has resilient init timeout for network loading', async () => {
  const masterSource = await readFile(
    new URL('../apps/3d-chess-studio/app/stockfish-master.ts', import.meta.url),
    'utf8',
  );
  assert.match(
    masterSource,
    /30000/,
    'stockfish-master.ts should allow at least 30000ms for network WASM initialization',
  );
});
