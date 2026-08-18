import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { auditChapterMarkdown } from "../scripts/chapter-audit.ts";
import { parseChapterMarkdown } from "../scripts/chapter-system.mjs";

const chapterUrl = new URL("../app/content/chapters/chapter-5-sicilian.md", import.meta.url);

async function readChapterFive() {
  return readFile(chapterUrl, "utf8");
}

test("Chapter 5 preserves the PDF page range 77 through 95", async () => {
  const markdown = await readChapterFive();
  const pageNumbers = [...markdown.matchAll(/^## Page (\d+)\s*$/gm)].map((match) => Number(match[1]));
  assert.deepEqual(pageNumbers, Array.from({ length: 19 }, (_, index) => index + 77));
  const chapter = parseChapterMarkdown("chapter-5-sicilian.md", markdown);
  assert.equal(chapter.pageCount, 19);
  auditChapterMarkdown(markdown, { chapter: 5, expectedPages: 19, expectedFirstPage: 77 });
});

test("Chapter 5 Page 77 matches the PDF variation index and title", async () => {
  const markdown = await readChapterFive();
  const start = markdown.indexOf("## Page 77");
  const end = markdown.indexOf("## Page 78", start);
  const page77 = markdown.slice(start, end);

  assert.match(page77, /# Chapter 5: c3 Sicilian – Introduction/);
  assert.match(page77, /A\) 3\.d3 78/);
  assert.match(page77, /B\) 3\.e5 Nd5 79/);
  assert.match(page77, /B23222\) 9\.Qxb5 94/);
});

test("Chapter 5 Page 80 contains complete 10.Qe4+! line, notes, and diagrams matching PDF", async () => {
  const markdown = await readChapterFive();
  const start = markdown.indexOf("## Page 80");
  const end = markdown.indexOf("## Page 81", start);
  const page80 = markdown.slice(start, end);

  assert.match(page80, /\*\*10\.Qe4\+!\*\*/);
  assert.match(page80, /Dangerous is \*\*10\.Nf3 0-0 11\.Be3\*\*/);
  assert.match(page80, /12\.Nbd2\?\? Rxe3\+!-+/);
  assert.match(page80, /\*\*12\.Qd2 Bg4 13\.Nd4 Ne5\*\*/);
  assert.match(page80, /\(\*\*12\.Qd1 Qb6\*\*\)/);
  assert.match(page80, /\*\*10\.\.\.Be6 11\.Nf3 h6 12\.0-0 0-0 13\.Bf4\*\*/);
  assert.match(page80, /\*\*13\.Be3 Re8 14\.Qa4 Qf6 15\.Nbd2 Qg6 16\.Rfe1 Rad8 17\.Rad1 Bd5! 18\.c4 Be6⩱\*\*/);
});

test("Chapter 5 Page 95 contains conclusion", async () => {
  const start = (await readChapterFive()).indexOf("## Page 95");
  const page95 = (await readChapterFive()).slice(start);

  assert.match(page95, /## Conclusion/);
  assert.match(page95, /This chapter served as an introduction to the c3 Sicilian/);
});
