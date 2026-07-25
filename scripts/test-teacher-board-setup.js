const fs = require('fs');
const path = require('path');
const { chromium } = require('/tmp/teacher-board-pw/node_modules/playwright');

const root = path.resolve(__dirname, '..');
const fixturePath = path.join(root, 'lessons', '__teacher-board-setup-test.html');
const version = '20260725-teacher-board-setup1';
const pageFen = '8/8/3k4/8/8/4K3/8/8 b - - 7 23';
const startPlacement = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';

function fenParts(fen) {
  return String(fen || '').trim().split(/\s+/);
}

function pieceCount(fen) {
  return (fenParts(fen)[0] || '').replace(/[1-8/]/g, '').length;
}

async function currentFen(frame) {
  return (await frame.locator('#currentFenCode').textContent() || '').trim();
}

async function waitFen(frame, predicate, message) {
  await frame.page().waitForFunction(
    ({ frameName, message }) => {
      const iframe = Array.from(document.querySelectorAll('iframe')).find((item) => item.title === frameName);
      const fen = iframe?.contentDocument?.getElementById('currentFenCode')?.textContent?.trim() || '';
      return window.__teacherFenPredicate ? window.__teacherFenPredicate(fen, message) : Boolean(fen);
    },
    { frameName: 'Interactive teacher chessboard', message },
    { timeout: 10000 },
  ).catch(() => {});

  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const fen = await currentFen(frame);
    if (predicate(fen)) return fen;
    await frame.page().waitForTimeout(100);
  }
  throw new Error(message + ': ' + await currentFen(frame));
}

async function openBoardMenu(page) {
  await page.locator('[data-teacher-action="toggle-board-menu"]').click();
  await page.locator('.teacher-board-menu:not([hidden])').waitFor();
}

(async () => {
  fs.writeFileSync(fixturePath, `<!doctype html>
<html lang="en" data-theme="dark" data-teacher-fen="${pageFen}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Teacher Board setup test</title>
  <link rel="stylesheet" href="pawn-teacher-board.css?v=${version}">
</head>
<body>
  <header><div class="index-top-actions"><a class="toolbar-link" href="#">Index</a></div></header>
  <main><h1>Teacher Board setup test</h1></main>
  <script src="pawn-teacher-board.js?v=${version}"></script>
</body>
</html>`, 'utf8');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));

  try {
    await page.goto('http://127.0.0.1:8000/lessons/__teacher-board-setup-test.html', { waitUntil: 'networkidle' });
    await page.locator('[data-open-teacher-board]').click();
    const iframeElement = page.locator('iframe[title="Interactive teacher chessboard"]');
    await iframeElement.waitFor({ state: 'visible' });
    const frame = page.frames().find((item) => item !== page.mainFrame() && item.url().includes('index.html'));
    if (!frame) throw new Error('Teacher Board iframe did not load.');
    await frame.locator('#currentFenCode').waitFor();

    await waitFen(frame, (fen) => fen === pageFen, 'Initial page FEN did not load');
    await page.locator('[data-teacher-action="setup"]').click();
    await page.locator('.teacher-board-setup-tray:not([hidden])').waitFor();

    const blackSide = page.locator('[data-teacher-action="side-to-move"][data-teacher-side="b"]');
    const whiteSide = page.locator('[data-teacher-action="side-to-move"][data-teacher-side="w"]');
    if ((await blackSide.getAttribute('aria-pressed')) !== 'true') {
      throw new Error('Page side-to-move was not reflected in the setup controls.');
    }

    await openBoardMenu(page);
    await page.locator('[data-teacher-action="empty-board"]').click();
    let fen = await waitFen(
      frame,
      (value) => fenParts(value)[0] === '8/8/8/8/8/8/8/8' && fenParts(value)[1] === 'b',
      'Empty did not clear the board while preserving Black to move',
    );
    if (pieceCount(fen) !== 0) throw new Error('Empty board still contains pieces.');

    await page.locator('[data-teacher-piece="K"]').click();
    await frame.locator('.board-square[data-square="e1"]').click();
    fen = await waitFen(frame, (value) => fenParts(value)[0].includes('4K3'), 'Piece placement after Empty failed');
    if (pieceCount(fen) !== 1) throw new Error('Expected one placed piece after Empty.');

    await whiteSide.click();
    fen = await waitFen(frame, (value) => fenParts(value)[1] === 'w' && pieceCount(value) === 1, 'White side-to-move did not apply');

    await openBoardMenu(page);
    await page.locator('[data-teacher-action="start-board"]').click();
    fen = await waitFen(
      frame,
      (value) => fenParts(value)[0] === startPlacement && fenParts(value)[1] === 'w',
      'Start did not load the standard position with the selected side to move',
    );
    if (pieceCount(fen) !== 32) throw new Error('Start position does not contain 32 pieces.');

    await page.locator('[data-teacher-action="done-setup"]').click();
    await frame.locator('.board-square[data-square="e2"]').click();
    await frame.locator('.board-square[data-square="e4"]').click();
    fen = await waitFen(
      frame,
      (value) => fenParts(value)[0] !== startPlacement && fenParts(value)[1] === 'b',
      'The Start position could not be played normally after setup',
    );

    await page.locator('[data-teacher-action="setup"]').click();
    await openBoardMenu(page);
    await page.locator('[data-teacher-action="page-board"]').click();
    await waitFen(frame, (value) => value === pageFen, 'Page did not restore the lesson page FEN');
    if ((await blackSide.getAttribute('aria-pressed')) !== 'true') {
      throw new Error('Page did not resynchronize the side-to-move control.');
    }

    if (errors.length) throw new Error('Browser page errors: ' + errors.join(' | '));
    console.log(JSON.stringify({
      ok: true,
      empty: true,
      piecePlacement: true,
      start: true,
      playableAfterStart: true,
      page: true,
      sideToMove: true,
    }, null, 2));
  } finally {
    await browser.close();
    fs.rmSync(fixturePath, { force: true });
  }
})().catch((error) => {
  fs.rmSync(fixturePath, { force: true });
  console.error(error);
  process.exit(1);
});
