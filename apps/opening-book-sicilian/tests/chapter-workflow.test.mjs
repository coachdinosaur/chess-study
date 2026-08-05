import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { auditChapterMarkdown } from "../scripts/chapter-audit.ts";
import { catalogSource, discoverChapters, parseChapterMarkdown } from "../scripts/chapter-system.mjs";

const chapterUrl = new URL("../app/content/chapters/chapter-1-sicilian.md", import.meta.url);

async function readChapterOne() {
  return readFile(chapterUrl, "utf8");
}

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
  const markdown = await readChapterOne();
  const pageNumbers = [...markdown.matchAll(/^## Page (\d+)\s*$/gm)].map((match) => Number(match[1]));
  assert.deepEqual(pageNumbers, Array.from({ length: 17 }, (_, index) => index + 7));
  const chapter = parseChapterMarkdown("chapter-1-sicilian.md", markdown);
  assert.equal(chapter.pageCount, 17);
  const audit = auditChapterMarkdown(markdown, { chapter: 1, expectedPages: 17, expectedFirstPage: 7 });
  assert.deepEqual(audit.errors, []);
});

test("Chapter 1 retains PDF-corrected moves and source references", async () => {
  const markdown = await readChapterOne();
  assert.match(markdown, /2\.Be2 is likely to transpose elsewhere/);
  assert.match(markdown, /Bersamina - Kantans, Pune 2014, and now: 13\.Re1!N=/);
  assert.match(markdown, /16\.N2c3 Eminov - Yilmazyerli/);
  assert.match(markdown, /9\.\.\.f5\?! 10\.Qc4 Ne5[\s\S]*13\.Nb5!N Rc8 14\.Nxa7 Rxc2 15\.Qxf5\+\-/);
  assert.match(markdown, /6\.Nc4 Ngxe5 7\.Ncxe5 fxe5 8\.Nxe5 g6!\?/);
  assert.match(markdown, /13\.Bf3 Qd7! 14\.Qd3 Nc6! 15\.Bxe4/);
  assert.doesNotMatch(markdown, /2\.Ne2 is likely to transpose elsewhere/);
  assert.doesNotMatch(markdown, /11\.\.\.Re8 11\.\.\.d3/);
  assert.doesNotMatch(markdown, /6\.Bc4 Ngxe5/);
});

test("the Markdown contract rejects missing pages and invalid FENs", () => {
  assert.throws(() => parseChapterMarkdown("chapter-1-sicilian.md", "# Chapter 1\n\n**FEN:**\n`bad`\n"), /Page/);
  assert.throws(() => parseChapterMarkdown("chapter-1-sicilian.md", "# Chapter 1\n\n## Page 1\n\n**FEN:**\n`bad`\n"), /invalid FEN/);
  assert.throws(() => parseChapterMarkdown("chapter-1-sicilian.md", "# Chapter 1\n\n## Page 1\n## Page 3\n\n**FEN:**\n`8\/8\/8\/8\/8\/8\/4k3\/4K3 w - - 0 1`\n"), /contiguous/);
  assert.throws(() => parseChapterMarkdown("chapter-1-sicilian.md", "# Chapter 1\n\n## Page 1\n\nA&nbsp;B\n\n**FEN:**\n`8\/8\/8\/8\/8\/8\/4k3\/4K3 w - - 0 1`\n"), /non-breaking space/);
  assert.throws(() => parseChapterMarkdown("chapter-1-sicilian.md", "# Chapter 1\n\n## Page 1\n\nA\u00a0B\n\n**FEN:**\n`8\/8\/8\/8\/8\/8\/4k3\/4K3 w - - 0 1`\n"), /non-breaking space/);
});

test("Chapter 1 retains explanatory lesson prose on every page", async () => {
  const markdown = await readChapterOne();
  const pages = markdown.split(/^## Page \d+\s*$/m).slice(1);
  assert.ok(pages.length > 0);
  for (const page of pages) {
    const prose = page.split(/\r?\n/).filter((line) => /^[A-Z][^#*`<!]*[a-z]{3}/.test(line.trim()));
    assert.ok(prose.length > 0, "Chapter 1 has a page without explanatory prose.");
  }
});

test("package scripts expose the Markdown chapter workflow and read-only audit", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.deepEqual(Object.keys(packageJson.scripts).filter((name) => name.startsWith("chapters:")), ["chapters:status", "chapters:sync", "chapters:check", "chapters:audit"]);
  assert.match(packageJson.scripts["chapters:audit"], /chapter-audit\.ts/);
  assert.match(packageJson.scripts.test, /--import tsx --test/);
  assert.equal(packageJson.dependencies["pdfjs-dist"], undefined);
});
