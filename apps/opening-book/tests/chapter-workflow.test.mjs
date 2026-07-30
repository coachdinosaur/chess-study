import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { catalogSource, discoverChapters, parseChapterMarkdown } from "../scripts/chapter-system.mjs";

test("discovers one contiguous Markdown catalog", async () => {
  const chapters = await discoverChapters();
  assert.deepEqual(chapters.map((chapter) => chapter.id), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
  assert.ok(chapters.every((chapter) => chapter.pageCount > 0));
  assert.ok(chapters.every((chapter) => chapter.visibleFenCount > 0));
  const catalog = catalogSource(chapters);
  assert.match(catalog, /CHAPTER_IDS = \["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16"\]/);
  assert.doesNotMatch(catalog, /chapter-packages|manifest|pdfjs|sourcePdf/);
});

test("the Markdown contract rejects missing pages and invalid FENs", () => {
  assert.throws(() => parseChapterMarkdown("chapter-12-catalan.md", "# Chapter 12\n\n**FEN:**\n`bad`\n"), /Page/);
  assert.throws(() => parseChapterMarkdown("chapter-12-catalan.md", "# Chapter 12\n\n## Page 1\n\n**FEN:**\n`bad`\n"), /invalid FEN/);
  assert.throws(() => parseChapterMarkdown("chapter-12-catalan.md", "# Chapter 12\n\n## Page 1\n## Page 3\n\n**FEN:**\n`8\/8\/8\/8\/8\/8\/4k3\/4K3 w - - 0 1`\n"), /contiguous/);
  assert.throws(() => parseChapterMarkdown("chapter-12-catalan.md", "# Chapter 12\n\n## Page 1\n\nA&nbsp;B\n\n**FEN:**\n`8\/8\/8\/8\/8\/8\/4k3\/4K3 w - - 0 1`\n"), /non-breaking space/);
  assert.throws(() => parseChapterMarkdown("chapter-12-catalan.md", "# Chapter 12\n\n## Page 1\n\nA\u00a0B\n\n**FEN:**\n`8\/8\/8\/8\/8\/8\/4k3\/4K3 w - - 0 1`\n"), /non-breaking space/);
});

test("Chapters 6-8 retain explanatory lesson prose on every page", async () => {
  for (const chapterNumber of [6, 7, 8]) {
    const markdown = await readFile(new URL(`../app/content/chapters/chapter-${chapterNumber}-catalan.md`, import.meta.url), "utf8");
    const pages = markdown.split(/^## Page \d+\s*$/m).slice(1);
    assert.ok(pages.length > 0);
    for (const page of pages) {
      const prose = page.split(/\r?\n/).filter((line) => /^[A-Z][^#*`<!]*[a-z]{3}/.test(line.trim()));
      assert.ok(prose.length > 0, `Chapter ${chapterNumber} has a page without explanatory prose.`);
    }
  }
});

test("package scripts expose the Markdown chapter workflow and read-only audit", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.deepEqual(Object.keys(packageJson.scripts).filter((name) => name.startsWith("chapters:")), ["chapters:status", "chapters:sync", "chapters:check", "chapters:audit"]);
  assert.match(packageJson.scripts["chapters:audit"], /chapter-audit\.ts/);
  assert.equal(packageJson.dependencies["pdfjs-dist"], undefined);
});
