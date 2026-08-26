import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { auditChapterMarkdown } from "../scripts/chapter-audit.ts";
import { parseChapterMarkdown } from "../scripts/chapter-system.mjs";

const chapterUrl = new URL("../app/content/chapters/chapter-8-sicilian.md", import.meta.url);

async function readChapterEight() {
  return readFile(chapterUrl, "utf8");
}

test("Chapter 8 preserves the PDF page range 136 through 155", async () => {
  const markdown = await readChapterEight();
  const pageNumbers = [...markdown.matchAll(/^## Page (\d+)\s*$/gm)].map((match) => Number(match[1]));
  assert.deepEqual(pageNumbers, Array.from({ length: 20 }, (_, index) => index + 136));
  const chapter = parseChapterMarkdown("chapter-8-sicilian.md", markdown);
  assert.equal(chapter.pageCount, 20);
  const audit = auditChapterMarkdown(markdown, { chapter: 8, expectedPages: 20, expectedFirstPage: 136 });
  assert.deepEqual(audit.errors, []);
});

test("Chapter 8 Page 136 matches the PDF variation index and title", async () => {
  const markdown = await readChapterEight();
  const start = markdown.indexOf("## Page 136");
  const end = markdown.indexOf("## Page 137", start);
  const page136 = markdown.slice(start, end);

  assert.match(page136, /# Chapter 8: c3 Sicilian – 7\.Bc4/);
  assert.match(page136, /A\) 9\.Nc3 137/);
  assert.match(page136, /B\) 9\.Bxd5 138/);
  assert.match(page136, /C\) 9\.exd6!\? 139/);
  assert.match(page136, /C1\) 9\.\.\.Qxd6 139/);
  assert.match(page136, /C2\) 9\.\.\.Bxd6!\? 141/);
  assert.match(page136, /D\) 9\.Bd2 142/);
  assert.match(page136, /E\) 9\.a3 0-0 144/);
  assert.match(page136, /E1\) 10\.Bd3 Bd7 11\.Qe2 Rc8 12\.Qe4 f5 13\.exf6 Nxf6 14\.Qe2 d5 15\.Nc3 145/);
  assert.match(page136, /E11\) 15\.\.\.Bd6 145/);
  assert.match(page136, /E12\) 15\.\.\.Ne8!\? 146/);
  assert.match(page136, /E2\) 10\.Re1 Bd7 147/);
  assert.match(page136, /E21\) 11\.Bd2!\? 147/);
  assert.match(page136, /E22\) 11\.Nbd2 150/);
  assert.match(page136, /E23\) 11\.Qd3 152/);
});

test("Chapter 8 Page 137 contains introductory moves and variation A", async () => {
  const markdown = await readChapterEight();
  const start = markdown.indexOf("## Page 137");
  const end = markdown.indexOf("## Page 138", start);
  const page137 = markdown.slice(start, end);

  assert.match(page137, /\*\*1\.e4 c5 2\.c3 Nf6 3\.e5 Nd5 4\.Nf3 e6 5\.d4 cxd4 6\.cxd4 d6 7\.Bc4\*\*/);
  assert.match(page137, /\*\*7\.\.\.Nc6 8\.0-0 Be7\*\*/);
  assert.match(page137, /### A\) 9\.Nc3/);
  assert.match(page137, /\*\*9\.\.\.Nxc3 10\.bxc3 dxe5 11\.Nxe5 Nxe5 12\.dxe5 Qxd1! 13\.Rxd1 Bd7\*\*/);
});

test("Chapter 8 Page 138 contains variation B and moves", async () => {
  const markdown = await readChapterEight();
  const start = markdown.indexOf("## Page 138");
  const end = markdown.indexOf("## Page 139", start);
  const page138 = markdown.slice(start, end);

  assert.match(page138, /\*\*14\.Rb1\?!\*\*/);
  assert.match(page138, /\*\*14\.\.\.b6!\*\*/);
  assert.match(page138, /\*\*15\.Ba6 Rd8!N\*\*/);
  assert.match(page138, /### B\) 9\.Bxd5 exd5 10\.Nc3 Be6 11\.Bf4 dxe5 12\.Nxe5 Rc8 13\.Re1 0-0/);
  assert.match(page138, /\*\*14\.Rc1\*\*/);
});

test("Chapter 8 Page 139 contains variation C and C1", async () => {
  const markdown = await readChapterEight();
  const start = markdown.indexOf("## Page 139");
  const end = markdown.indexOf("## Page 140", start);
  const page139 = markdown.slice(start, end);

  assert.match(page139, /\*\*18\.\.\.Bd8!\?N∓\*\*/);
  assert.match(page139, /### C\) 9\.exd6!\?/);
  assert.match(page139, /#### C1\) 9\.\.\.Qxd6 10\.Nc3 0-0 11\.Re1 Rd8!\?/);
});

test("Chapter 8 Page 140 contains 14...Bb4!, 16.Nc3!, 18.d5!?N, and 20...Nd7!N lines", async () => {
  const markdown = await readChapterEight();
  const start = markdown.indexOf("## Page 140");
  const end = markdown.indexOf("## Page 141", start);
  const page140 = markdown.slice(start, end);

  assert.match(page140, /\*\*14\.\.\.Bb4! 15\.Re2 a6!\*\*/);
  assert.match(page140, /\*\*16\.Nc3!\*\*/);
  assert.match(page140, /\*\*16\.\.\.b5 17\.Bg5 Be7 18\.Ne5!\*\*/);
  assert.match(page140, /18\.d5!\?N/);
  assert.match(page140, /21\.\.\.Qe6! 22\.Bxe7 Re8! 23\.Nxf7! Qxe7/);
  assert.match(page140, /\*\*18\.\.\.Nxe5 19\.dxe5 Qe8 20\.Rd2!\*\*/);
  assert.match(page140, /\*\*20\.\.\.Nd7!N\*\*/);
});

test("Chapter 8 Page 141 contains variation C2", async () => {
  const markdown = await readChapterEight();
  const start = markdown.indexOf("## Page 141");
  const end = markdown.indexOf("## Page 142", start);
  const page141 = markdown.slice(start, end);

  assert.match(page141, /### C2\) 9\.\.\.Bxd6!\?/);
  assert.match(page141, /\*\*10\.Nc3 0-0 11\.Re1 h6\*\*/);
  assert.match(page141, /\*\*12\.Qd3\*\*/);
});

test("Chapter 8 Page 142 contains variation D", async () => {
  const markdown = await readChapterEight();
  const start = markdown.indexOf("## Page 142");
  const end = markdown.indexOf("## Page 143", start);
  const page142 = markdown.slice(start, end);

  assert.match(page142, /\*\*12\.\.\.Ncb4!N\*\*/);
  assert.match(page142, /### D\) 9\.Bd2/);
  assert.match(page142, /\*\*9\.\.\.0-0 10\.Nc3 dxe5!\*\*/);
});

test("Chapter 8 Page 144 contains variation E", async () => {
  const markdown = await readChapterEight();
  const start = markdown.indexOf("## Page 144");
  const end = markdown.indexOf("## Page 145", start);
  const page144 = markdown.slice(start, end);

  assert.match(page144, /\*\*12\.\.\.a6!\*\*/);
  assert.match(page144, /### E\) 9\.a3/);
  assert.match(page144, /\*\*9\.\.\.0-0\*\*/);
});

test("Chapter 8 Page 145 contains variation E1 and E11", async () => {
  const markdown = await readChapterEight();
  const start = markdown.indexOf("## Page 145");
  const end = markdown.indexOf("## Page 146", start);
  const page145 = markdown.slice(start, end);

  assert.match(page145, /#### E1\) 10\.Bd3 Bd7 11\.Qe2/);
  assert.match(page145, /##### E11\) 15\.\.\.Bd6/);
  assert.match(page145, /\*\*17\.\.\.Nh5!N\*\*/);
});

test("Chapter 8 Page 146 contains variation E12", async () => {
  const markdown = await readChapterEight();
  const start = markdown.indexOf("## Page 146");
  const end = markdown.indexOf("## Page 147", start);
  const page146 = markdown.slice(start, end);

  assert.match(page146, /\*\*18\.\.\.Rxf3!\?\*\*/);
  assert.match(page146, /##### E12\) 15\.\.\.Ne8!\?N/);
});

test("Chapter 8 Page 147 contains variation E2 and E21", async () => {
  const markdown = await readChapterEight();
  const start = markdown.indexOf("## Page 147");
  const end = markdown.indexOf("## Page 148", start);
  const page147 = markdown.slice(start, end);

  assert.match(page147, /#### E2\) 10\.Re1/);
  assert.match(page147, /##### E21\) 11\.Bd2!\?/);
});

test("Chapter 8 Page 150 contains variation E22", async () => {
  const markdown = await readChapterEight();
  const start = markdown.indexOf("## Page 150");
  const end = markdown.indexOf("## Page 151", start);
  const page150 = markdown.slice(start, end);

  assert.match(page150, /##### E22\) 11\.Nbd2/);
  assert.match(page150, /\*\*11\.\.\.dxe5!\? 12\.dxe5 Qc7!\*\*/);
  assert.match(page150, /\*\*13\.Bd3N\*\*/);
});

test("Chapter 8 Page 152 contains variation E23", async () => {
  const markdown = await readChapterEight();
  const start = markdown.indexOf("## Page 152");
  const end = markdown.indexOf("## Page 153", start);
  const page152 = markdown.slice(start, end);

  assert.match(page152, /##### E23\) 11\.Qd3/);
  assert.match(page152, /\*\*12\.\.\.dxe5!N\*\*/);
});

test("Chapter 8 Page 155 contains the conclusion", async () => {
  const markdown = await readChapterEight();
  const start = markdown.indexOf("## Page 155");
  const page155 = markdown.slice(start);

  assert.match(page155, /## Conclusion/);
  assert.match(page155, /Chapter 8 saw us begin our coverage of the critical 7\.Bc4 variation\./);
});
