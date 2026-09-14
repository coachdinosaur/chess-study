import assert from 'node:assert/strict';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.LESSON_BOARD_BASE_URL || 'http://127.0.0.1:8000';
const baseline = process.env.LESSON_BOARD_BASELINE === '1';
const browser = await chromium.launch({ headless: true });
const errors = [];
const page = await browser.newPage();
page.on('pageerror', error => errors.push(error.message));

async function measure(label) {
  const embed = page.locator('.board-iframe:visible').first();
  await embed.scrollIntoViewIfNeeded();
  const frame = await (await embed.elementHandle()).contentFrame();
  await frame.waitForSelector('#boardGrid .board-square');
  await page.waitForTimeout(700);
  const result = await frame.evaluate(() => {
    const rect = selector => document.querySelector(selector).getBoundingClientRect().toJSON();
    const visible = selector => [...document.querySelectorAll(selector)].some(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
    return {
      board: rect('#boardGrid'),
      viewport: { width: innerWidth, height: innerHeight },
      contentHeight: document.querySelector('.page-shell').getBoundingClientRect().height,
      header: visible('.lesson-header'),
      notation: visible('.lesson-notation'),
      navigation: visible('#notationToolbar'),
      squares: document.querySelectorAll('#boardGrid .board-square').length,
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
  console.log(JSON.stringify({ label, ...result }));
  if (!baseline) {
    assert.equal(result.header, false, `${label}: editor header`);
    assert.equal(result.notation, false, `${label}: notation editor`);
    assert.equal(result.navigation, false, `${label}: move toolbar`);
    assert.equal(result.squares, 64);
    assert.ok(Math.abs(result.board.width - result.board.height) < 1, `${label}: square board`);
    assert.ok(result.board.x >= 0 && result.board.y >= 0, `${label}: board origin`);
    assert.ok(result.board.right <= result.viewport.width + 1, `${label}: files fit`);
    assert.ok(result.board.bottom <= result.viewport.height + 1, `${label}: ranks fit`);
    assert.equal(result.overflow, false, `${label}: embed overflow`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${label}: page overflow`);
    assert.equal(await page.evaluate(() => {
      const scene = document.querySelector('.presentation-current');
      return scene ? scene.scrollWidth > scene.clientWidth : false;
    }), false, `${label}: scene overflow`);
    assert.ok(result.viewport.height - result.contentHeight < 2, `${label}: no obsolete iframe height`);
  }
  return frame;
}

try {
  for (const [width, height] of [[1920, 1080], [1366, 768], [768, 1024], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.goto(`${base}/lessons/bishop-m7-lesson-01-finding-weaknesses-part-1.html`, { waitUntil: 'domcontentloaded' });
    await measure(`${width}x${height} normal`);
    await page.getByRole('button', { name: 'Present Lesson', exact: true }).click();
    await measure(`${width}x${height} presentation`);
    await page.locator('[data-presentation-action="exit"]').click();
    await measure(`${width}x${height} restored`);
  }
  if (!baseline) assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
