import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

test('assets/top-players.json contains all 6 required categories with valid Top 10 players', () => {
  const jsonPath = path.join(ROOT, 'assets', 'top-players.json');
  assert.ok(fs.existsSync(jsonPath), 'assets/top-players.json should exist');

  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  assert.ok(data.categories, 'Data must have a categories object');

  const requiredCategories = [
    'world_standard',
    'world_women',
    'world_blitz',
    'philippines',
    'philippines_women',
    'singapore'
  ];

  for (const catId of requiredCategories) {
    const cat = data.categories[catId];
    assert.ok(cat, `Category ${catId} must exist`);
    assert.ok(cat.title, `Category ${catId} must have a title`);
    assert.ok(Array.isArray(cat.players), `Category ${catId} must have an array of players`);
    assert.equal(cat.players.length, 10, `Category ${catId} must have 10 players`);

    for (let i = 0; i < 10; i++) {
      const p = cat.players[i];
      assert.equal(p.rank, i + 1, `Player index ${i} in ${catId} must have rank ${i + 1}`);
      assert.ok(p.name && p.name.trim().length > 0, `Player #${i + 1} in ${catId} must have a name`);
      assert.ok(typeof p.rating === 'number' && p.rating > 1000, `Player #${i + 1} in ${catId} must have a valid rating`);
      assert.ok(p.fed && p.fed.trim().length > 0, `Player #${i + 1} in ${catId} must have a federation`);
      assert.ok(p.fideId && p.fideId.length > 0, `Player #${i + 1} in ${catId} must have a fideId`);
      assert.ok(p.profileUrl && p.profileUrl.startsWith('https://ratings.fide.com/profile/'), `Player #${i + 1} in ${catId} must have a valid profileUrl`);
    }
  }
});

test('index.html contains Top Players triggers and modal dialog', () => {
  const indexPath = path.join(ROOT, 'index.html');
  const indexHtml = fs.readFileSync(indexPath, 'utf-8');

  assert.ok(indexHtml.includes('data-action="open-top-players"'), 'index.html must include open-top-players action trigger');
  assert.ok(indexHtml.includes('id="topPlayersModal"'), 'index.html must include topPlayersModal element');
  assert.ok(indexHtml.includes('top-players.mjs'), 'index.html must load top-players.mjs');
});
