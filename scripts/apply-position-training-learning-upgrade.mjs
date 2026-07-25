import fs from 'node:fs';

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`Patch target not found: ${label}`);
  return source.replace(before, after);
}

function replaceRegex(source, pattern, replacement, label) {
  if (!pattern.test(source)) throw new Error(`Patch pattern not found: ${label}`);
  return source.replace(pattern, replacement);
}

const trainerPath = 'lichess-position-training.mjs';
let trainer = fs.readFileSync(trainerPath, 'utf8');

trainer = replaceOnce(
  trainer,
  "import { LichessPositionTrainingDataSource } from './lichess-position-training-data.mjs';\n",
  "import { LichessPositionTrainingDataSource } from './lichess-position-training-data.mjs';\nimport { PositionTrainingLearning } from './lichess-position-training-learning.mjs';\n",
  'learning import',
);
trainer = replaceOnce(
  trainer,
  "const STYLE_URL = './lichess-position-training.css?v=20260725-board-interaction3';",
  "const STYLE_URL = './lichess-position-training.css?v=20260726-learning1';",
  'style cache version',
);
trainer = replaceOnce(
  trainer,
  "    minRating: 800,\n    maxRating: 2400,\n    theme: 'any',",
  "    difficultyMode: 'adaptive',\n    minRating: 800,\n    maxRating: 2400,\n    theme: 'any',",
  'learning preferences',
);
trainer = replaceOnce(
  trainer,
  "    this.dataSource = new LichessPositionTrainingDataSource();\n    this.evaluator = new PositionTrainingEvaluator();\n    this.stats = loadStats();",
  "    this.dataSource = new LichessPositionTrainingDataSource();\n    this.evaluator = new PositionTrainingEvaluator();\n    this.learning = new PositionTrainingLearning();\n    this.stats = loadStats();",
  'learning controller',
);
trainer = replaceOnce(
  trainer,
  "    this.selectedSquare = '';\n    this.hintSquare = '';\n    this.pendingPromotion = null;",
  "    this.selectedSquare = '';\n    this.hintSquare = '';\n    this.hintFrom = '';\n    this.hintTo = '';\n    this.hintLevel = 0;\n    this.explanation = null;\n    this.reviewMode = false;\n    this.lastAcceptedMove = '';\n    this.lastVerdict = null;\n    this.pendingPromotion = null;",
  'learning state',
);
trainer = replaceOnce(
  trainer,
  "            <div class=\"position-training-feedback info\" data-pt-feedback aria-live=\"polite\"></div>\n            <div class=\"position-training-actions\">\n              <button type=\"button\" data-pt-action=\"hint\">Concept hint</button>",
  "            <div class=\"position-training-feedback info\" data-pt-feedback aria-live=\"polite\"></div>\n            <section class=\"position-training-explanation\" data-pt-explanation hidden></section>\n            <div class=\"position-training-actions\">\n              <button type=\"button\" data-pt-action=\"hint\">Hint 1 of 4</button>",
  'explanation and hint UI',
);
trainer = replaceOnce(
  trainer,
  "              <h3>Filters</h3>\n              <label>Minimum rating",
  "              <h3>Filters</h3>\n              <label>Difficulty\n                <select data-pt-pref=\"difficultyMode\">\n                  <option value=\"adaptive\">Adaptive</option>\n                  <option value=\"fixed\">Fixed range</option>\n                </select>\n              </label>\n              <label>Minimum rating",
  'difficulty selector',
);
trainer = replaceOnce(
  trainer,
  "                  <option value=\"any\">Any theme</option>\n                  <option value=\"endgame\">Endgame</option>",
  "                  <option value=\"any\">Any theme</option>\n                  <option value=\"weakest\">Weakest theme</option>\n                  <option value=\"endgame\">Endgame</option>",
  'weakest theme option',
);
trainer = replaceOnce(
  trainer,
  "            <section class=\"position-training-card\">\n              <h3>Separate statistics</h3>\n              <div class=\"position-training-stats\" data-pt-stats></div>\n            </section>",
  "            <section class=\"position-training-card\">\n              <h3>Separate statistics</h3>\n              <div class=\"position-training-stats\" data-pt-stats></div>\n            </section>\n            <section class=\"position-training-card\">\n              <h3>Learning progress</h3>\n              <div data-pt-learning></div>\n              <button type=\"button\" class=\"position-training-review-button\" data-pt-action=\"review\">Review mistakes</button>\n              <p class=\"position-training-mode-note\" data-pt-mode-note></p>\n            </section>\n            <section class=\"position-training-card\">\n              <h3>Theme performance</h3>\n              <div data-pt-theme-dashboard></div>\n            </section>",
  'learning dashboard cards',
);

trainer = replaceOnce(
  trainer,
  "    this.completed = false;\n    this.selectedSquare = '';\n    this.hintSquare = '';\n    this.pendingPromotion = null;\n    this.feedback = { kind: 'info', text: 'Loading and validating a position…' };",
  "    this.completed = false;\n    this.selectedSquare = '';\n    this.hintSquare = '';\n    this.hintFrom = '';\n    this.hintTo = '';\n    this.hintLevel = 0;\n    this.explanation = null;\n    this.lastAcceptedMove = '';\n    this.lastVerdict = null;\n    this.pendingPromotion = null;\n    this.feedback = { kind: 'info', text: 'Loading and validating a position…' };",
  'load reset state',
);
trainer = replaceOnce(
  trainer,
  "      let accepted = null;\n      for (let attempt = 0; attempt < 16; attempt += 1) {\n        const raw = await this.dataSource.next(this.prefs);",
  "      let accepted = null;\n      const reviewRecord = this.reviewMode ? this.learning.nextReview() : null;\n      if (this.reviewMode && !reviewRecord) {\n        this.reviewMode = false;\n        throw new Error('No saved mistakes are available for review.');\n      }\n      const effectiveFilters = this.learning.effectiveFilters(this.prefs);\n      for (let attempt = 0; attempt < 16; attempt += 1) {\n        const raw = reviewRecord || await this.dataSource.next(effectiveFilters);",
  'adaptive and review loading',
);
trainer = replaceOnce(
  trainer,
  "      this.startMaterial = materialBalanceForColor(this.game, this.current.solverColor);\n      this.solverMoves = 0;\n      this.stats.started += 1;",
  "      this.startMaterial = materialBalanceForColor(this.game, this.current.solverColor);\n      this.solverMoves = 0;\n      this.learning.beginPuzzle(this.current, { reviewMode: this.reviewMode });\n      this.stats.started += 1;",
  'begin learning attempt',
);
trainer = replaceOnce(
  trainer,
  "    this.selectedSquare = '';\n    this.hintSquare = '';\n    this.pendingPromotion = null;\n    this.completed = false;",
  "    this.selectedSquare = '';\n    this.hintSquare = '';\n    this.hintFrom = '';\n    this.hintTo = '';\n    this.explanation = null;\n    this.pendingPromotion = null;\n    this.completed = false;",
  'reset learning display',
);

trainer = replaceRegex(
  trainer,
  /  async showHint\(\) \{[\s\S]*?\n  \}\n\n  #handleKeydown/,
  `  async toggleReviewMode() {
    if (this.busy) return;
    if (!this.learning.reviewCount()) {
      this.feedback = { kind: 'info', text: 'No mistakes are saved for review yet.' };
      this.render();
      return;
    }
    this.reviewMode = !this.reviewMode;
    await this.loadNext();
  }

  async showHint() {
    if (!this.current || this.busy || this.completed) return;
    const hint = this.learning.nextHint({
      puzzle: this.current,
      bestMove: this.turnBaseline?.bestMove || this.initialBaseline?.bestMove || '',
      objectiveText: objectiveLabel(this.objective),
      humanTheme,
    });
    this.hintLevel = hint.level;
    this.hintFrom = hint.from || '';
    this.hintTo = hint.to || '';
    this.hintSquare = this.hintFrom;
    this.feedback = { kind: 'info', text: hint.text };
    this.render();
  }

  #handleKeydown`,
  'progressive hint method',
);
trainer = replaceOnce(
  trainer,
  "    this.prefs[key] = key === 'theme' ? field.value : Number(field.value);",
  "    this.prefs[key] = ['theme', 'difficultyMode'].includes(key) ? field.value : Number(field.value);",
  'preference typing',
);
trainer = replaceOnce(
  trainer,
  "    localStorage.setItem(PREFS_KEY, JSON.stringify(this.prefs));\n  }",
  "    localStorage.setItem(PREFS_KEY, JSON.stringify(this.prefs));\n    this.render();\n  }",
  'preference rerender',
);
trainer = replaceOnce(
  trainer,
  "    if (action === 'hint') return this.showHint();",
  "    if (action === 'hint') return this.showHint();\n    if (action === 'review') return this.toggleReviewMode();",
  'review action',
);
trainer = replaceOnce(
  trainer,
  "    this.selectedSquare = '';\n    this.hintSquare = '';\n    this.feedback = { kind: 'info', text: `Checking ${applied.san} against the position objective…` };",
  "    this.selectedSquare = '';\n    this.hintSquare = '';\n    this.hintFrom = '';\n    this.hintTo = '';\n    this.feedback = { kind: 'info', text: `Checking ${applied.san} against the position objective…` };",
  'clear hint markers on move',
);
trainer = replaceOnce(
  trainer,
  "        this.stats.mistakes += 1;\n        this.stats.streak = 0;\n        this.#saveStats();\n        this.feedback = { kind: 'danger', text: `${verdict.reason} Try another move.` };",
  "        this.stats.mistakes += 1;\n        this.stats.streak = 0;\n        this.learning.recordMistake({ puzzle: this.current, moveSan: applied.san, reason: verdict.reason });\n        this.explanation = this.learning.buildMistakeExplanation({ puzzle: this.current, moveSan: applied.san, reason: verdict.reason });\n        this.#saveStats();\n        this.feedback = { kind: 'danger', text: `${verdict.reason} Try another move.` };",
  'mistake review recording',
);
trainer = replaceOnce(
  trainer,
  "      this.solverMoves += 1;\n      if (isTrainingSolved({",
  "      this.solverMoves += 1;\n      this.lastAcceptedMove = applied.san;\n      this.lastVerdict = verdict;\n      if (isTrainingSolved({",
  'accepted move learning state',
);
trainer = trainer.replaceAll(
  "        evaluation: afterMove,\n      }))",
  "        evaluation: afterMove,\n        themes: this.current.themes,\n      }))",
);
trainer = trainer.replaceAll(
  "            evaluation: terminalEvaluation,\n          }))",
  "            evaluation: terminalEvaluation,\n            themes: this.current.themes,\n          }))",
);
trainer = trainer.replaceAll(
  "        evaluation: this.turnBaseline,\n      }))",
  "        evaluation: this.turnBaseline,\n        themes: this.current.themes,\n      }))",
);
trainer = replaceOnce(
  trainer,
  "    this.#saveStats();\n    saveHistory({",
  "    this.#saveStats();\n    this.explanation = this.learning.recordSolved({\n      puzzle: this.current,\n      moveSan: this.lastAcceptedMove,\n      objectiveText: objectiveLabel(this.objective),\n      verdictReason: this.lastVerdict?.reason || message,\n      bestMove: this.initialBaseline?.bestMove || '',\n    });\n    if (this.reviewMode && !this.learning.reviewCount()) this.reviewMode = false;\n    saveHistory({",
  'completion learning record',
);

trainer = replaceOnce(
  trainer,
  "    feedback.className = `position-training-feedback ${this.feedback.kind}`;\n    feedback.textContent = this.feedback.text;\n\n    const current",
  "    feedback.className = `position-training-feedback ${this.feedback.kind}`;\n    feedback.textContent = this.feedback.text;\n\n    const explanation = this.overlay.querySelector('[data-pt-explanation]');\n    if (this.explanation) {\n      explanation.hidden = false;\n      explanation.innerHTML = `\n        <h3>${escapeHtml(this.explanation.title)}</h3>\n        <p>${escapeHtml(this.explanation.summary)}</p>\n        <ul>${this.explanation.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>\n      `;\n    } else {\n      explanation.hidden = true;\n      explanation.innerHTML = '';\n    }\n\n    const current",
  'render explanation',
);
trainer = replaceOnce(
  trainer,
  "    this.overlay.querySelector('[data-pt-stats]').innerHTML = `\n      <div><strong>${this.stats.solved}</strong><span>Solved</span></div>\n      <div><strong>${this.stats.mistakes}</strong><span>Mistakes</span></div>\n      <div><strong>${this.stats.streak}</strong><span>Streak</span></div>\n      <div><strong>${this.stats.bestStreak}</strong><span>Best</span></div>\n    `;\n\n    for (const button",
  "    this.overlay.querySelector('[data-pt-stats]').innerHTML = `\n      <div><strong>${this.stats.solved}</strong><span>Solved</span></div>\n      <div><strong>${this.stats.mistakes}</strong><span>Mistakes</span></div>\n      <div><strong>${this.stats.streak}</strong><span>Streak</span></div>\n      <div><strong>${this.stats.bestStreak}</strong><span>Best</span></div>\n    `;\n\n    const reviewCount = this.learning.reviewCount();\n    this.overlay.querySelector('[data-pt-learning]').innerHTML = `\n      <div class=\"position-training-learning-grid\">\n        <div class=\"position-training-learning-metric\"><strong>${this.learning.adaptiveRating()}</strong><span>Adaptive rating</span></div>\n        <div class=\"position-training-learning-metric\"><strong>${reviewCount}</strong><span>Review queue</span></div>\n      </div>\n    `;\n    const reviewButton = this.overlay.querySelector('[data-pt-action=\"review\"]');\n    reviewButton.textContent = this.reviewMode ? 'Leave mistake review' : `Review mistakes (${reviewCount})`;\n    reviewButton.disabled = this.busy || reviewCount === 0;\n    reviewButton.classList.toggle('primary', this.reviewMode);\n    this.overlay.querySelector('[data-pt-mode-note]').textContent = this.reviewMode\n      ? 'Review mode is active. Two clean, hint-free review solves retire a puzzle.'\n      : (this.prefs.difficultyMode === 'adaptive'\n        ? 'Adaptive mode selects puzzles near your current training rating.'\n        : 'Fixed mode uses the selected rating range.');\n\n    const dashboardRows = this.learning.dashboard();\n    this.overlay.querySelector('[data-pt-theme-dashboard]').innerHTML = dashboardRows.length\n      ? `<table class=\"position-training-theme-table\"><thead><tr><th>Theme</th><th>Attempts</th><th>Accuracy</th></tr></thead><tbody>${dashboardRows.map((row) => `<tr><td>${escapeHtml(humanTheme(row.theme))}</td><td>${row.attempts}</td><td>${Math.round(row.accuracy * 100)}%</td></tr>`).join('')}</tbody></table>`\n      : '<p class=\"position-training-theme-empty\">Complete positions to build a theme profile.</p>';\n\n    const adaptive = this.prefs.difficultyMode === 'adaptive';\n    for (const key of ['minRating', 'maxRating']) {\n      const field = this.overlay.querySelector(`[data-pt-pref=\"${key}\"]`);\n      if (field) field.disabled = adaptive;\n    }\n    const hintButton = this.overlay.querySelector('[data-pt-action=\"hint\"]');\n    hintButton.textContent = `Hint ${Math.min(4, this.learning.hintLevel() + 1)} of 4`;\n    hintButton.disabled = this.busy || this.completed || this.learning.hintLevel() >= 4;\n\n    for (const button",
  'render learning dashboard',
);
trainer = replaceOnce(
  trainer,
  "    for (const button of this.overlay.querySelectorAll('[data-pt-action=\"hint\"], [data-pt-action=\"reset\"], [data-pt-action=\"next\"]')) {\n      button.disabled = this.busy;\n    }",
  "    for (const button of this.overlay.querySelectorAll('[data-pt-action=\"reset\"], [data-pt-action=\"next\"]')) {\n      button.disabled = this.busy;\n    }",
  'button disabled handling',
);
trainer = replaceOnce(
  trainer,
  "        square === this.hintSquare ? 'hinted' : '',",
  "        square === this.hintSquare ? 'hinted' : '',\n        square === this.hintFrom ? 'hinted-from' : '',\n        square === this.hintTo ? 'hinted-target' : '',",
  'hint board markers',
);
trainer = replaceOnce(
  trainer,
  "       <p>Train from database positions against dynamic defence. Any move that preserves the objective can be accepted; the existing Endgame vs Stockfish trainer remains unchanged.</p>",
  "       <p>Train against dynamic defence with adaptive difficulty, progressive hints, mistake review, explanations, and theme performance tracking. The existing Endgame vs Stockfish trainer remains unchanged.</p>",
  'launcher learning description',
);

fs.writeFileSync(trainerPath, trainer);

const focusPath = 'focus-analysis-popup.mjs';
let focus = fs.readFileSync(focusPath, 'utf8');
focus = replaceOnce(
  focus,
  "import './lichess-position-training.mjs?v=20260725-position-training3';",
  "import './lichess-position-training.mjs?v=20260726-learning1';",
  'trainer module cache version',
);
fs.writeFileSync(focusPath, focus);

const indexPath = 'index.html';
let index = fs.readFileSync(indexPath, 'utf8');
index = replaceOnce(
  index,
  "./focus-analysis-popup.mjs?v=20260725-grid-rows1",
  "./focus-analysis-popup.mjs?v=20260726-learning1",
  'focus wrapper cache version',
);
fs.writeFileSync(indexPath, index);

const smokePath = 'tests/lichess-position-training-browser-smoke.mjs';
let smoke = fs.readFileSync(smokePath, 'utf8');
smoke = replaceOnce(
  smoke,
  "  await page.waitForFunction(() => {\n    const feedback = document.querySelector('[data-pt-feedback]')?.textContent || '';\n    return !/Loading and validating/i.test(feedback) && document.querySelector('[data-pt-current] dd');\n  }, null, { timeout: 30_000 });\n\n  const seenSides",
  "  await page.waitForFunction(() => {\n    const feedback = document.querySelector('[data-pt-feedback]')?.textContent || '';\n    return !/Loading and validating/i.test(feedback) && document.querySelector('[data-pt-current] dd');\n  }, null, { timeout: 30_000 });\n  await overlay.getByRole('heading', { name: 'Learning progress' }).waitFor();\n  await overlay.getByRole('heading', { name: 'Theme performance' }).waitFor();\n  assert.equal(await overlay.locator('[data-pt-pref=\"difficultyMode\"]').inputValue(), 'adaptive');\n  const hintButton = overlay.locator('[data-pt-action=\"hint\"]');\n  await hintButton.click();\n  await hintButton.click();\n  assert.equal(await overlay.locator('[data-pt-board] .hinted-from').count(), 1, 'second hint should identify a source piece');\n  await hintButton.click();\n  assert.equal(await overlay.locator('[data-pt-board] .hinted-target').count(), 1, 'third hint should identify a destination');\n  await hintButton.click();\n  assert.match(await overlay.locator('[data-pt-feedback]').innerText(), /Full reveal|leading candidate/i);\n\n  const seenSides",
  'learning browser assertions',
);
fs.writeFileSync(smokePath, smoke);

console.log('Applied position-training learning upgrade.');
