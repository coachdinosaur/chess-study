const fs = require('fs');
const path = require('path');
const { chromium } = require('/tmp/presentation-pw/node_modules/playwright');

const lessons = [
  'pawn-m2-lesson-01-how-to-move-the-king.html',
  'advanced-pawn-m12-lesson-01-basic-opening-traps-in-chess.html',
  'bishop-m1-lesson-01-building-a-strong-foundation.html',
  'bishop-m15-lesson-01-calculation-process-fen-laboratory.html',
];

const endgame = fs.readdirSync('lessons').find((name) => {
  if (!/^01-.*\.html$/i.test(name)) return false;
  return fs.readFileSync(path.join('lessons', name), 'utf8').includes('lesson-presentation.js');
});
if (endgame) lessons.push(endgame);

(async () => {
  const browser = await chromium.launch({ headless: true });
  for (const lesson of lessons) {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto(`http://127.0.0.1:8000/lessons/${lesson}`, { waitUntil: 'networkidle' });

    const launch = page.locator('.lesson-present-launch');
    if (await launch.count() !== 1) throw new Error(`${lesson}: expected one Present Lesson button`);
    await launch.click();
    await page.waitForFunction(() => document.body.classList.contains('lesson-presentation-active'));

    await page.mouse.click(36, 36);
    await page.waitForTimeout(60);
    if (await page.locator('.lesson-presentation-click-indicator').count() < 1) {
      throw new Error(`${lesson}: content click did not create an indicator`);
    }
    await page.waitForTimeout(900);
    if (await page.locator('.lesson-presentation-click-indicator').count() !== 0) {
      throw new Error(`${lesson}: click indicator did not clean itself up`);
    }

    const next = page.locator('[data-presentation-action="next"]');
    if (await next.isEnabled()) {
      await next.click();
      await page.waitForTimeout(60);
      if (await page.locator('.lesson-presentation-click-indicator').count() !== 0) {
        throw new Error(`${lesson}: toolbar click should not create an indicator`);
      }
    }

    const visibleFrame = page.locator('.presentation-current iframe:visible').first();
    if (await visibleFrame.count()) {
      await page.waitForTimeout(350);
      const box = await visibleFrame.boundingBox();
      if (box && box.width > 20 && box.height > 20) {
        await page.mouse.click(box.x + Math.min(40, box.width / 2), box.y + Math.min(40, box.height / 2));
        await page.waitForTimeout(80);
        if (await page.locator('.lesson-presentation-click-indicator').count() < 1) {
          throw new Error(`${lesson}: same-origin iframe click did not create an indicator`);
        }
        await page.waitForTimeout(900);
      }
    }

    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.body.classList.contains('lesson-presentation-active'));
    if (pageErrors.length) throw new Error(`${lesson}: ${pageErrors.join('; ')}`);
    await page.close();
  }
  await browser.close();
  console.log(`Presentation click pulse passed on ${lessons.length} representative lessons.`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
