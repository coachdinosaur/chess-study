import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('live-board contains 3D board container and toggle elements', async () => {
  const html = await readFile(resolve(root, 'live-board.html'), 'utf8');
  const css = await readFile(resolve(root, 'live-board.css'), 'utf8');
  const js = await readFile(resolve(root, 'live-board.js'), 'utf8');
  const js3d = await readFile(resolve(root, 'live-board-3d.js'), 'utf8');
  const model = await stat(resolve(root, 'assets/models/staunton.glb'));

  // HTML structure
  assert.match(html, /id="liveBoard3D"/);
  assert.match(html, /id="toggle3dButton"/);
  assert.match(html, /id="camera3dControls"/);
  assert.match(html, /id="camAngleBtn"/);
  assert.match(html, /id="camTopBtn"/);

  // CSS rules
  assert.match(css, /\.chess-board-3d/);
  assert.match(css, /\.live-board-3d-canvas/);
  assert.match(css, /\.camera-3d-controls/);
  assert.match(css, /\.cam-preset-btn/);

  // Live board JS integration
  assert.match(js, /import\('\.\/live-board-3d\.js'\)/);
  assert.match(js, /live-board:3d-mode/);
  assert.match(js, /liveBoard3DInstance\.syncState/);
  assert.match(js, /setCameraView/);

  // 3D module features
  assert.match(js3d, /class LiveBoard3D/);
  assert.match(js3d, /CAMERA_TARGET_Y = 0\.75/);
  assert.match(js3d, /createPieceMaterials/);
  assert.match(js3d, /createMitredBishopModel/);
  assert.match(js3d, /syncState/);
  assert.match(js3d, /updateHighlights/);

  // Model file verification
  assert.ok(model.size > 1_000_000, 'staunton.glb asset exists and is complete');
});
