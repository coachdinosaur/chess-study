import assert from "node:assert/strict";
import { access, readFile, readdir, stat } from "node:fs/promises";
import test from "node:test";
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
  const text = "Black has typically contested d5, getting rid of all his problems.";
  const at = text.indexOf("d5");
  assert.equal(isLikelyProseSquare(text, at, "d5"), true);
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
