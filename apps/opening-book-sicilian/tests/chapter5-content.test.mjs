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

test("Chapter 5 Page 95 contains conclusion", async () => {
  const markdown = await readChapterFive();
  const start = markdown.indexOf("## Page 95");
  const page95 = markdown.slice(start);

  assert.match(page95, /## Conclusion/);
  assert.match(page95, /This chapter served as an introduction to the c3 Sicilian/);
});
