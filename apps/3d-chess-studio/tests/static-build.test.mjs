import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const expectedBase = process.env.VITE_BASE_PATH
  ? `/${process.env.VITE_BASE_PATH.replace(/^\/+|\/+$/g, "")}/`
  : "/";

test("emits a server-free static site", async () => {
  const html = await readFile(resolve(root, "dist/index.html"), "utf8");
  const files = await readdir(resolve(root, "dist/assets"));
  const scripts = await Promise.all(
    files
      .filter((name) => name.endsWith(".js"))
      .map((name) => readFile(resolve(root, "dist/assets", name), "utf8")),
  );
  const model = await stat(resolve(root, "dist/models/staunton.glb"));
  const bishopIcon = await stat(resolve(root, "dist/pieces/mpchess/wB.svg"));

  assert.match(html, /<div id="root"><\/div>/);
  assert.ok(html.includes(`${expectedBase}assets/`));
  assert.doesNotMatch(html, /_next|_vinext|worker\/index|server\/index/);
  assert.ok(files.some((name) => name.endsWith(".js")));
  assert.ok(files.some((name) => name.endsWith(".css")));
  assert.ok(scripts.some((script) => script.includes(`${expectedBase}models/staunton.glb`)));
  assert.ok(model.size > 1_000_000, "the approved Staunton models should be copied to the static output");
  assert.ok(bishopIcon.size > 500, "the shared MPChess artwork should be copied to the static output");
});

test("keeps deterministic board geometry and all three themes", async () => {
  const board = await readFile(resolve(root, "app/ChessBoard3D.tsx"), "utf8");
  const studio = await readFile(resolve(root, "app/ChessStudio.tsx"), "utf8");
  const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));

  assert.match(board, /BoardTheme = "classic" \| "anime" \| "samurai"/);
  assert.match(board, /new THREE\.PlaneGeometry\(0\.994, 0\.994\)/);
  assert.match(board, /file - 3\.5/);
  assert.match(board, /4\.5 - rank/);
  assert.match(board, /createMitredHeadGeometry/);
  assert.match(board, /GLTFLoader/);
  assert.match(board, /staunton\.glb/);
  assert.doesNotMatch(board, /recessedMitre|carved-mitre-core/);
  assert.doesNotMatch(board, /new RoundedBoxGeometry\(0\.06, 0\.34, 0\.075/);
  assert.doesNotMatch(board, /\[0\.015, 1\.075, 0\.153\]/);
  assert.match(board, /side: THREE\.DoubleSide/);
  assert.match(studio, /data-theme-option=\{theme\}/);
  assert.match(studio, /className="mode-switch"/);
  assert.match(studio, /new Chess\(fen\)/);
  assert.match(studio, /pieces\/mpchess\/\$\{code\}\.svg/);
  assert.equal(packageJson.scripts.dev, "vite --host 0.0.0.0");
  assert.equal(packageJson.dependencies["chess.js"], "^1.4.0");
  assert.equal(packageJson.dependencies.vinext, undefined);
  assert.equal(packageJson.dependencies["drizzle-orm"], undefined);
});
