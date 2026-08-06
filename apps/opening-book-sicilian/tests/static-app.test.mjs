import assert from "node:assert/strict";
import { access, readFile, readdir, stat } from "node:fs/promises";
import test from "node:test";
import { applyChapterContentCorrections } from "../app/lib/chapter-content-corrections.ts";
import { isLikelyProseSquare } from "../app/lib/chess-notation.ts";

const root = new URL("../", import.meta.url);

test("the opening book has no application server dependency", async () => {
  const packageJson = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
  const viteConfig = await readFile(new URL("vite.config.ts", root), "utf8");
  const allDependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
  assert.equal(allDependencies.next, undefined);
  assert.equal(allDependencies.vinext, undefined);
  assert.equal(allDependencies.wrangler, undefined);
  assert.equal(allDependencies["@cloudflare/vite-plugin"], undefined);
  assert.match(packageJson.scripts.build, /vite build/);
  assert.match(viteConfig, /base:\s*["']\/openings-sicilian\/["']/);
});

test("all Markdown chapters are bundled as static source content", async () => {
  const filenames = (await readdir(new URL("app/content/chapters/", root)))
    .filter((name) => /^chapter-\d+-sicilian\.md$/.test(name));
  assert.equal(filenames.length, 1);
  await Promise.all([
    access(new URL("dist/index.html", root)),
    access(new URL("dist/404.html", root)),
    access(new URL("dist/chapters/1/index.html", root)),
  ]);
  const indexHtml = await readFile(new URL("dist/index.html", root), "utf8");
  const chapterRedirect = await readFile(new URL("dist/chapters/1/index.html", root), "utf8");
  assert.match(indexHtml, /(?:href|src)="\/openings-sicilian\//);
  assert.match(chapterRedirect, /\.\.\/\.\.\/#\/chapters\/1/);
});

test("the renderer replays preceding PDF pages and uses clean diagram labels", async () => {
  const renderer = await readFile(new URL("app/components/MarkdownRenderer.tsx", root), "utf8");
  assert.match(renderer, /precedingMarkdown/);
  assert.match(renderer, /parseMarkdown\(priorMarkdown, ignoreMove, resolver\)/);
  assert.doesNotMatch(renderer, /â€”/);
});

test("narrative square references remain plain text", () => {
  const contested = "Black has typically contested d5, getting rid of all his problems.";
  const contestedAt = contested.indexOf("d5");
  assert.equal(isLikelyProseSquare(contested, contestedAt, "d5"), true);

  const attacked = "With the knight on a3 this looks excellent, as e4 is now under attack.";
  const attackedAt = attacked.indexOf("e4");
  assert.equal(isLikelyProseSquare(attacked, attackedAt, "e4"), true);

  const controlled = "White is having difficulty maintaining control over e5, as the following variations show:";
  const controlledAt = controlled.indexOf("e5");
  assert.equal(isLikelyProseSquare(controlled, controlledAt, "e5"), true);

  const numberedMove = "4.e4 is now under attack.";
  assert.equal(isLikelyProseSquare(numberedMove, 0, "4.e4"), false);
});

test("printed PDF Page 14 corrections reach the rendered chapter", async () => {
  const raw = await readFile(new URL("app/content/chapters/chapter-1-sicilian.md", root), "utf8");
  const corrected = applyChapterContentCorrections("chapter-1-sicilian.md", raw);
  const start = corrected.indexOf("## Page 14");
  const end = corrected.indexOf("## Page 15", start);
  const page = corrected.slice(start, end);

  for (const required of [
    "5...Be6 6.Qe2 Qc7 7.a4 Ne7 8.Nf3 f6=",
    "6...a6?! 7.Ba5 Qd7 8.Nb6 Qc7 9.a4!",
    "12.a4 Bd8=, planning ...Nce7",
    "\n10.Bc4\n",
    "10...Nxf3+ 11.Qxf3 Bg5! 12.a4 Be6=",
    "Gallinnis – Kabatianski",
    "The correspondence player Hynes has been the chief exponent",
    "\n5...f6!?\n",
    "A drastic solution – and a good one it seems.",
  ]) {
    assert.ok(page.includes(required), `Missing PDF Page 14 content: ${required}`);
  }

  for (const forbidden of [
    "5...f6 6.Qe2 Qc7 7.a4 Be7 8.Nf3 Bd6",
    "9.Ba4!",
    "12.a4 Nd8=",
    "planning ...Ne7",
    "\n10.Nc4\n",
    "\n3.Nf3\n\n**FEN:**",
    "Gallinnis - Kabatianski",
    "4...Ng4 5.Qe2 f6!?",
    "A drastic solution - and a good one it seems.",
  ]) {
    assert.ok(!page.includes(forbidden), `Found incorrect PDF Page 14 content: ${forbidden}`);
  }

  assert.ok(corrected.slice(end).startsWith("## Page 15\n\n<!--"));
});

test("the static output contains the interactive board and shared engine references", async () => {
  const assetNames = await readdir(new URL("dist/assets/", root));
  const scripts = assetNames.filter((name) => name.endsWith(".js"));
  assert.ok(scripts.length > 0);
  const scriptBodies = await Promise.all(
    scripts.map((name) => readFile(new URL(`dist/assets/${name}`, root), "utf8")),
  );
  const source = scriptBodies.join("\n");
  assert.match(source, /Sicilian Defense/);
  assert.match(source, /Study Board/);
  assert.match(source, /\/lessons\//);
  assert.match(source, /Show on main board/);
  assert.match(source, /Stockfish/);

  // Verify pieces and stockfish load from /openings/ path at runtime
  assert.match(source, /\/openings\//);
  assert.match(source, /assets\/pieces\/mpchess\//);
  assert.match(source, /\/openings\/stockfish\/stockfish-18-lite-single\.js/);

  await Promise.all([
    access(new URL("dist/app_icon_chess_study.png", root)),
  ]);
});
