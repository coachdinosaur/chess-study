import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

function file(path) {
  return new URL(path, root);
}

test("the main Study Board links to the 3D studio", async () => {
  const home = await readFile(file("index.html"), "utf8");

  assert.match(home, /href="\.\/3d\/"/);
});

test("the Pages workflow builds and mounts the 3D studio at /3d/", async () => {
  const [workflow, viteConfig] = await Promise.all([
    readFile(file(".github/workflows/pages.yml"), "utf8"),
    readFile(file("apps/3d-chess-studio/vite.config.ts"), "utf8"),
  ]);

  assert.match(viteConfig, /process\.env\.VITE_BASE_PATH/);
  assert.match(workflow, /working-directory:\s*apps\/3d-chess-studio/);
  assert.match(workflow, /VITE_BASE_PATH:\s*\/3d\//);
  assert.match(workflow, /mv apps\/3d-chess-studio\/dist 3d/);
  assert.match(workflow, /rm -rf apps\/3d-chess-studio/);
});

test("the built studio is a complete static artifact rooted at /3d/", async () => {
  const [indexHtml, packageJson] = await Promise.all([
    readFile(file("apps/3d-chess-studio/dist/index.html"), "utf8"),
    readFile(file("apps/3d-chess-studio/package.json"), "utf8").then(JSON.parse),
  ]);

  assert.match(indexHtml, /(?:href|src)="\/3d\/assets\//);
  assert.match(indexHtml, /href="\/3d\/favicon\.svg"/);
  assert.doesNotMatch(indexHtml, /_next|_vinext|server\/index|worker\/index/);
  assert.equal(packageJson.scripts.dev, "vite --host 0.0.0.0");
  assert.equal(packageJson.dependencies.vinext, undefined);

  await Promise.all([
    access(file("apps/3d-chess-studio/dist/favicon.svg")),
    access(file("apps/3d-chess-studio/dist/models/staunton.glb")),
  ]);
});
