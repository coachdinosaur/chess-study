import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { auditChapterMarkdown } from "../scripts/chapter-audit.ts";
import { MarkdownMoveResolver } from "../app/lib/markdown-moves.ts";
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

test("Chapter 1 keeps printed PDF pages intact instead of splitting columns", async () => {
  const markdown = await readChapterOne();
  const page = (number) => {
    const start = markdown.indexOf(`## Page ${number}`);
    const end = markdown.indexOf(`## Page ${number + 1}`, start);
    return markdown.slice(start, end < 0 ? markdown.length : end);
  };

  assert.doesNotMatch(page(12), /16\.Rd5/);
  assert.match(page(13), /16\.Rd5[\s\S]*16\.\.\.Qe6=/);
  assert.match(page(13), /D1\) 3\.Bb5/);
  assert.doesNotMatch(page(13), /4\.Bxc6 dxc6/);
  assert.match(page(14), /4\.Bxc6 dxc6/);
  assert.match(page(14), /D2\) 3\.Nf3/);
});

test("Chapter 1 retains PDF-corrected moves and source references", async () => {
  const markdown = await readChapterOne();
  assert.match(markdown, /2\.Be2 is likely to transpose elsewhere/);
  assert.match(markdown, /Bersamina - Kantans, Pune 2014, and now: 13\.Re1!N=/);
  assert.match(markdown, /16\.N2c3 Eminov - Yilmazyerli/);
  assert.match(markdown, /9\.\.\.f5\?! 10\.Qc4 Ne5[\s\S]*13\.Nb5!N Rc8 14\.Nxa7 Rxc2 15\.Qxf5\+\-/);
  assert.match(markdown, /6\.Nc4 Ngxe5 7\.Ncxe5 fxe5 8\.Nxe5 g6!\?/);
  assert.match(markdown, /13\.Bf3 Qd7! 14\.Qd3 Nc6!\s*<!--[\s\S]*?-->\s*15\.Bxe4/);
  assert.doesNotMatch(markdown, /2\.Ne2 is likely to transpose elsewhere/);
  assert.doesNotMatch(markdown, /11\.\.\.Re8 11\.\.\.d3/);
  assert.doesNotMatch(markdown, /6\.Bc4 Ngxe5/);
});

test("move recovery handles bad anchors, look-ahead, and semicolon siblings", () => {
  const anchored = new MarkdownMoveResolver();
  anchored.resolveText("1.e4 c5 2.Bc4 e6 3.Qe2");
  anchored.setAnchor("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "Imported anchor");
  const recovered = anchored.resolveText("3...Nc6 4.Nf3 Nge7 5.Bb3");
  assert.ok(recovered.every((token) => token.navigation), "A later numbered continuation should recover from preserved history.");

  const pageThree = new MarkdownMoveResolver();
  pageThree.setAnchor("r1bqkb1r/pp1pnppp/2n1p3/2p5/2B1P3/5N2/PPPPQPPP/RNB1K2R w KQkq - 4 5", "Printed page 9 variation");
  const firstLine = pageThree.resolveText("5.d3 Ng6 6.h4!? (6.0-0 Be7 7.c3 d5 8.Bb3 0-0+) 6...Bd6! 7.Nbd2 h6 8.h5 Nge5 9.Nxe5 Bxe5 10.Nf3 Bb8!? 11.c3 0-0 12.Bb3 d5");
  assert.ok(firstLine.every((token) => token.navigation), "The printed-page-9 side line should remain navigable through its parenthesis.");

  const correctedPdfLine = new MarkdownMoveResolver();
  const secondLine = correctedPdfLine.resolveText("1.e4 c5 2.c4 Nc6 3.Nf3 e5 4.Nc3 d6 5.d3 (5.g3 g6 6.Bg2 Bg7 7.0-0 Nge7 8.d3 0-0 9.Ng5 f6 10.Nh3 Be6 11.f4 Qd7 12.Nf2 Nd4 13.Be3 Rab8+) 5...f5!? 6.exf5 Bxf5 7.h3?! Qd7 8.Be2 Nf6 9.Nh2?! 9...Nd4 10.Bg5 0-0-0! 11.0-0 h6 12.Bxf6 gxf6 13.Kh1?!");
  assert.ok(secondLine.every((token) => token.navigation), "The PDF-corrected 9.Ng5 line should be fully navigable.");

  const siblings = new MarkdownMoveResolver();
  const siblingTokens = siblings.resolveText("1.e4 (1.d4 d5; 1.c4 e5)");
  assert.ok(siblingTokens.every((token) => token.navigation), "A semicolon should start a sibling variation from the same branch point.");
});

test("move navigation survives PDF page and parenthesis boundaries", () => {
  const pages = new MarkdownMoveResolver();
  const beforeBreak = pages.resolveText("1.e4 c5 2.Bc4 e6 3.Qe2 Nc6 4.c3 Be7 5.Bb3 d5 6.d3 Nf6 7.Nf3 0-0 8.0-0 b5 9.Bg5 h6 10.Bh4");
  const afterBreak = pages.resolveText("10...a5!? 11.e5 Nd7 12.Bxe7 Qxe7");
  assert.ok(beforeBreak.every((token) => token.navigation), "Moves before the PDF page break should be navigable.");
  assert.ok(afterBreak.every((token) => token.navigation), "Moves after the PDF page break should retain the prior position.");

  const branch = new MarkdownMoveResolver();
  const branchStart = branch.resolveText("1.e4 c5 (1...e5");
  const branchEnd = branch.resolveText("2.Nf3 Nc6)");
  assert.ok(branchStart.every((token) => token.navigation), "The opening half of a split variation should be navigable.");
  assert.ok(branchEnd.every((token) => token.navigation), "A variation continued in the next paragraph should remain navigable.");
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
