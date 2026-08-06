import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { isLikelyProseSquare } from "../app/lib/chess-notation.ts";

const root = new URL("../", import.meta.url);
const chapterUrl = new URL("app/content/chapters/chapter-1-sicilian.md", root);

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

test("only the canonical Sicilian chapter Markdown is bundled", async () => {
  const filenames = (await readdir(new URL("app/content/chapters/", root)))
    .filter((name) => name.endsWith(".md"));
  assert.deepEqual(filenames, ["chapter-1-sicilian.md"]);

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

test("the loader parses the canonical Markdown directly", async () => {
  const loader = await readFile(new URL("app/lib/chapter-markdown-loader.ts", root), "utf8");
  assert.doesNotMatch(loader, /chapter-(?:content|page\d+)-corrections/);
  assert.match(loader, /parseChapter\(filename, content as string\)/);
});

test("the renderer replays preceding PDF pages and uses clean diagram labels", async () => {
  const renderer = await readFile(new URL("app/components/MarkdownRenderer.tsx", root), "utf8");
  assert.match(renderer, /precedingMarkdown/);
  assert.match(renderer, /parseMarkdown\(priorMarkdown, ignoreMove, resolver\)/);
  assert.doesNotMatch(renderer, /â€”/);
});

test("narrative square references remain plain text", () => {
  const contested = "Black has typically contested d5, getting rid of all his problems.";
  assert.equal(isLikelyProseSquare(contested, contested.indexOf("d5"), "d5"), true);

  const attacked = "With the knight on a3 this looks excellent, as e4 is now under attack.";
  assert.equal(isLikelyProseSquare(attacked, attacked.indexOf("e4"), "e4"), true);

  const controlled = "White is having difficulty maintaining control over e5, as the following variations show:";
  assert.equal(isLikelyProseSquare(controlled, controlled.indexOf("e5"), "e5"), true);

  assert.equal(isLikelyProseSquare("4.e4 is now under attack.", 0, "4.e4"), false);
});

test("the canonical Markdown contains the synchronized Pages 14 through 17", async () => {
  const chapter = await readFile(chapterUrl, "utf8");
  assert.match(chapter, /\*\*FEN:\*\*\n`[^`]+`/);

  const page14 = chapter.slice(chapter.indexOf("## Page 14"), chapter.indexOf("## Page 15"));
  const page15 = chapter.slice(chapter.indexOf("## Page 15"), chapter.indexOf("## Page 16"));
  const page16 = chapter.slice(chapter.indexOf("## Page 16"), chapter.indexOf("## Page 17"));
  const page17 = chapter.slice(chapter.indexOf("## Page 17"), chapter.indexOf("## Page 18"));

  for (const required of [
    "5...Be6 6.Qe2 Qc7 7.a4 Ne7 8.Nf3 f6=",
    "6...a6?! 7.Ba5 Qd7 8.Nb6 Qc7 9.a4!",
    "12.a4 Bd8=",
    "10.Bc4",
    "Gallinnis – Kabatianski",
    "The correspondence player Hynes has been the chief exponent",
  ]) assert.ok(page14.includes(required), `Missing Page 14 content: ${required}`);

  for (const required of [
    "17.0-0 Rb8⇆",
    "23.Bb2 Ra5!",
    "29.Bf1 Rhh5!",
    "33.g3 Qf5→",
    "Hynes – Benlloch Guirau",
  ]) assert.ok(page15.includes(required), `Missing Page 15 content: ${required}`);

  for (const required of [
    "9.Be3 Ne6",
    "11.Qe3 Be6!∓",
    "12.Nf3 Bf5!↑",
    "18.Kf2 Bxb4",
    "16.Bd2?! Qb5∓",
  ]) assert.ok(page16.includes(required), `Missing Page 16 content: ${required}`);

  for (const required of [
    "8...Bg7 9.Bc3 d6 10.Nf3 0-0",
    "13.0-0-0 Bh6!",
    "14...Bxe5!",
    "20.Qd4 e6",
    "21.Qxb6 axb6∓",
  ]) assert.ok(page17.includes(required), `Missing Page 17 content: ${required}`);

  assert.ok(chapter.slice(chapter.indexOf("## Page 18")).startsWith(
    "## Page 18\n\nThe ending was slightly better for Black due to his central mass",
  ));
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
  assert.match(source, /\/openings\//);
  assert.match(source, /assets\/pieces\/mpchess\//);
  assert.match(source, /\/openings\/stockfish\/stockfish-18-lite-single\.js/);
  await access(new URL("dist/app_icon_chess_study.png", root));
});
