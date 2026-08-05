import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { catalogSource, discoverChapters, parseChapterMarkdown } from "../scripts/chapter-system.mjs";

test("discovers one contiguous Markdown catalog", async () => {
  const chapters = await discoverChapters();
  assert.deepEqual(chapters.map((chapter) => chapter.id), [1]);
  assert.ok(chapters.every((chapter) => chapter.pageCount > 0));
  assert.ok(chapters.every((chapter) => chapter.visibleFenCount > 0));
  const catalog = catalogSource(chapters);
  assert.match(catalog, /CHAPTER_IDS = \["1"\]/);
  assert.doesNotMatch(catalog, /chapter-packages|manifest|pdfjs|sourcePdf/);
});

test("Chapter 1 preserves the PDF page range 7 through 23", async () => {
  const markdown = await readFile(new URL("../app/content/chapters/chapter-1-sicilian.md", import.meta.url), "utf8");
  const pageNumbers = [...markdown.matchAll(/^## Page (\d+)\s*$/gm)].map((match) => Number(match[1]));
  assert.deepEqual(pageNumbers, Array.from({ length: 17 }, (_, index) => index + 7));
  const chapter = parseChapterMarkdown("chapter-1-sicilian.md", markdown);
  assert.equal(chapter.pageCount, 17);
});

test("the Markdown contract rejects missing pages and invalid FENs", () => {
  assert.throws(() => parseChapterMarkdown("chapter-1-sicilian.md", "# Chapter 1\n\n**FEN:**\n`bad`\n"), /Page/);
  assert.throws(() => parseChapterMarkdown("chapter-1-sicilian.md", "# Chapter 1\n\n## Page 1\n\n**FEN:**\n`bad`\n"), /invalid FEN/);
  assert.throws(() => parseChapterMarkdown("chapter-1-sicilian.md", "# Chapter 1\n\n## Page 1\n## Page 3\n\n**FEN:**\n`8\/8\/8\/8\/8\/8\/4k3\/4K3 w - - 0 1`\n"), /contiguous/);
  assert.throws(() => parseChapterMarkdown("chapter-1-sicilian.md", "# Chapter 1\n\n## Page 1\n\nA&nbsp;B\n\n**FEN:**\n`8\/8\/8\/8\/8\/8\/4k3\/4K3 w - - 0 1`\n"), /non-breaking space/);
  assert.throws(() => parseChapterMarkdown("chapter-1-sicilian.md", "# Chapter 1\n\n## Page 1\n\nA\u00a0B\n\n**FEN:**\n`8\/8\/8\/8\/8\/8\/4k3\/4K3 w - - 0 1`\n"), /non-breaking space/);
});

test("Chapter 1 retains explanatory lesson prose on every page", async () => {
  const markdown = await readFile(new URL("../app/content/chapters/chapter-1-sicilian.md", import.meta.url), "utf8");
  const pages = markdown.split(/^## Page \d+\s*$/m).slice(1);
  assert.ok(pages.length > 0);
  for (const page of pages) {
    const prose = page.split(/\r?\n/).filter((line) => /^[A-Z][^#*`<!]*[a-z]{3}/.test(line.trim()));
    assert.ok(prose.length > 0, `Chapter 1 has a page without explanatory prose.`);
  }
});

test("package scripts expose the Markdown chapter workflow and read-only audit", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.deepEqual(Object.keys(packageJson.scripts).filter((name) => name.startsWith("chapters:")), ["chapters:status", "chapters:sync", "chapters:check", "chapters:audit"]);
  assert.match(packageJson.scripts["chapters:audit"], /chapter-audit\.ts/);
  assert.equal(packageJson.dependencies["pdfjs-dist"], undefined);
});
