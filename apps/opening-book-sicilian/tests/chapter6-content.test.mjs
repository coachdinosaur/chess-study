import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { auditChapterMarkdown } from "../scripts/chapter-audit.ts";
import { parseChapterMarkdown } from "../scripts/chapter-system.mjs";

const chapterUrl = new URL("../app/content/chapters/chapter-6-sicilian.md", import.meta.url);

async function readChapterSix() {
  return readFile(chapterUrl, "utf8");
}

test("Chapter 6 preserves the PDF page range 96 through 106", async () => {
  const markdown = await readChapterSix();
  const pageNumbers = [...markdown.matchAll(/^## Page (\d+)\s*$/gm)].map((match) => Number(match[1]));
  assert.deepEqual(pageNumbers, Array.from({ length: 11 }, (_, index) => index + 96));
  const chapter = parseChapterMarkdown("chapter-6-sicilian.md", markdown);
  assert.equal(chapter.pageCount, 11);
  const audit = auditChapterMarkdown(markdown, { chapter: 6, expectedPages: 11, expectedFirstPage: 96, strictMoves: true });
  assert.deepEqual(audit.errors, []);
});

test("Chapter 6 Page 96 matches the PDF variation index and title", async () => {
  const markdown = await readChapterSix();
  const start = markdown.indexOf("## Page 96");
  const end = markdown.indexOf("## Page 97", start);
  const page96 = markdown.slice(start, end);

  assert.match(page96, /# Chapter 6: c3 Sicilian – Rare 5th Moves/);
  assert.match(page96, /A\) 5\.c4 97/);
  assert.match(page96, /B\) 5\.Na3 98/);
  assert.match(page96, /C\) 5\.g3 Nc6 6\.Bg2 d6 7\.exd6 Bxd6 8\.0-0 0-0 100/);
  assert.match(page96, /C1\) 9\.Na3 100/);
  assert.match(page96, /C2\) 9\.d4 cxd4 10\.Nxd4 Nxd4 11\.Qxd4 Qc7 12\.Nd2 Bd7 13\.Ne4 Be5 102/);
  assert.match(page96, /C21\) 14\.Qd3 103/);
  assert.match(page96, /C22\) 14\.Qc5!\? 104/);
});

test("Chapter 6 Page 97 contains complete 5.c4 Ne7! line and diagrams matching PDF", async () => {
  const markdown = await readChapterSix();
  const start = markdown.indexOf("## Page 97");
  const end = markdown.indexOf("## Page 98", start);
  const page97 = markdown.slice(start, end);

  assert.match(page97, /### A\) 5\.c4/);
  assert.match(page97, /\*\*5\.\.\.Ne7!\*\*/);
  assert.match(page97, /\*\*6\.Nc3 Nbc6 7\.d4! cxd4 8\.Nxd4 Nxe5 9\.Ndb5 Nf5!\? 10\.Bf4! a6! 11\.Bxe5 axb5 12\.Nxb5 Bb4\+ 13\.Bc3 Bxc3\+ 14\.Nxc3 b5!\? 15\.Qf3\*\*/);
  assert.match(page97, /\*\*15\.\.\.d5!\?\*\*/);
});

test("Chapter 6 Page 98 contains 21...Qb6!, perpetual check line, and B) 5.Na3", async () => {
  const markdown = await readChapterSix();
  const start = markdown.indexOf("## Page 98");
  const end = markdown.indexOf("## Page 99", start);
  const page98 = markdown.slice(start, end);

  assert.match(page98, /\*\*21\.\.\.Qb6!\*\*/);
  assert.match(page98, /\*\*22\.Rc1 Rxc1\+ 23\.Qxc1 Rc8 24\.Qb1 Nh4! 25\.g3 Qb7 26\.Qe4 Rc1\+ 27\.Ke2 Bxb5\+! 28\.axb5 Qxb5\+ 29\.Qd3 Qe5\+ 30\.Qe4\*\*/);
  assert.match(page98, /\*\*30\.\.\.Qb5\+ 31\.Qd3 Qe5\+=\*\*/);
  assert.match(page98, /### B\) 5\.Na3/);
  assert.match(page98, /\*\*5\.\.\.Nc6\*\*/);
  assert.match(page98, /\*\*6\.Nc4\*\*/);
});

test("Chapter 6 Page 99 contains complete 6...Qc7!? line, 12...Qc4!, and diagrams matching PDF", async () => {
  const markdown = await readChapterSix();
  const start = markdown.indexOf("## Page 99");
  const end = markdown.indexOf("## Page 100", start);
  const page99 = markdown.slice(start, end);

  assert.match(page99, /\*\*6\.\.\.Qc7!\?\*\*/);
  assert.match(page99, /\*\*7\.d4\*\*/);
  assert.match(page99, /\*\*7\.\.\.cxd4 8\.cxd4 b5!\*\*/);
  assert.match(page99, /\*\*9\.Ne3 Ncb4! 10\.Nxd5 exd5! 11\.Bd3 Nxd3\+ 12\.Qxd3\*\*/);
  assert.match(page99, /\*\*12\.\.\.Qc4!\*\*/);
  assert.match(page99, /\*\*13\.Qxc4\*\*/);
  assert.match(page99, /\*\*13\.\.\.dxc4 14\.0-0 Bb7\*\*/);
  assert.match(page99, /\*\*15\.Re1 Be7\*\*/);
});

test("Chapter 6 Page 100 contains Bontempi – Jurcik draw, C) 5.g3, and C1) 9.Na3", async () => {
  const markdown = await readChapterSix();
  const start = markdown.indexOf("## Page 100");
  const end = markdown.indexOf("## Page 101", start);
  const page100 = markdown.slice(start, end);

  assert.match(page100, /\*\*16\.Ng5! 0-0 17\.Ne4 Bxe4 18\.Rxe4 d5 19\.exd6 Bxd6 20\.Bf4 Bxf4 21\.Rxf4 Rfe8 22\.Kf1\*\*/);
  assert.match(page100, /Bontempi – Jurcik, Stare Mesto 2010/);
  assert.match(page100, /### C\) 5\.g3/);
  assert.match(page100, /\*\*5\.\.\.Nc6 6\.Bg2 d6 7\.exd6 Bxd6 8\.0-0 0-0\*\*/);
  assert.match(page100, /#### C1\) 9\.Na3/);
  assert.match(page100, /\*\*9\.\.\.Be7\*\*/);
});

test("Chapter 6 Page 101 contains 15...Bf6!N Deviatkin – Savchenko note and 13...b5N", async () => {
  const markdown = await readChapterSix();
  const start = markdown.indexOf("## Page 101");
  const end = markdown.indexOf("## Page 102", start);
  const page101 = markdown.slice(start, end);

  assert.match(page101, /\*\*10\.d3\*\*/);
  assert.match(page101, /Deviatkin – B\. Savchenko, St Petersburg 2009/);
  assert.match(page101, /\*\*15\.\.\.Bf6!N\*\*/);
  assert.match(page101, /\*\*13\.Qe2!\?\*\*/);
  assert.match(page101, /\*\*13\.\.\.b5N 14\.a6 Bc8 15\.Ne3 Nf6!⇆\*\*/);
});

test("Chapter 6 Page 102 contains Chopin – Bertrand game and C2) 9.d4", async () => {
  const markdown = await readChapterSix();
  const start = markdown.indexOf("## Page 102");
  const end = markdown.indexOf("## Page 103", start);
  const page102 = markdown.slice(start, end);

  assert.match(page102, /Chopin – Bertrand, corr\. 1994/);
  assert.match(page102, /#### C2\) 9\.d4/);
  assert.match(page102, /\*\*9\.\.\.cxd4 10\.Nxd4\*\*/);
  assert.match(page102, /\*\*10\.\.\.Nxd4 11\.Qxd4 Qc7 12\.Nd2\*\*/);
});

test("Chapter 6 Page 103 contains Deviatkin – Tregubov line, 19...Rac8!N, and C21) 14.Qd3", async () => {
  const markdown = await readChapterSix();
  const start = markdown.indexOf("## Page 103");
  const end = markdown.indexOf("## Page 104", start);
  const page103 = markdown.slice(start, end);

  assert.match(page103, /Deviatkin – Tregubov, Dagomys 2009/);
  assert.match(page103, /\*\*19\.\.\.Rac8!N 20\.Rfd1\*\*/);
  assert.match(page103, /##### C21\) 14\.Qd3/);
  assert.match(page103, /\*\*14\.\.\.a6=\*\*/);
  assert.match(page103, /\*\*14\.\.\.Rad8\*\*/);
});

test("Chapter 6 Page 104 contains full analysis branches a-d, Rozentalis – Akopian, and C22) 14.Qc5!?", async () => {
  const markdown = await readChapterSix();
  const start = markdown.indexOf("## Page 104");
  const end = markdown.indexOf("## Page 105", start);
  const page104 = markdown.slice(start, end);

  assert.match(page104, /a\) \*\*15\.Ng5\?! g6 16\.Re1 Bc6 17\.Qe2 Bg7∓\*\*/);
  assert.match(page104, /b\) \*\*15\.f4 Qb6\+ 16\.Kh1!\*\*/);
  assert.match(page104, /c\) I also analysed the move \*\*15\.Bg5N\*\*/);
  assert.match(page104, /d\) \*\*15\.Re1\*\* is by far the main line\./);
  assert.match(page104, /Rozentalis – Akopian, Philadelphia 1994/);
  assert.match(page104, /##### C22\) 14\.Qc5!\?/);
  assert.match(page104, /\*\*14\.\.\.Qb8!\*\*/);
});

test("Chapter 6 Page 105 contains 15.Qc4 variations and Van Dooren – Coenen note", async () => {
  const markdown = await readChapterSix();
  const start = markdown.indexOf("## Page 105");
  const end = markdown.indexOf("## Page 106", start);
  const page105 = markdown.slice(start, end);

  assert.match(page105, /\*\*15\.Qc4\*\*/);
  assert.match(page105, /Van Dooren – Coenen, Maastricht 2015/);
  assert.match(page105, /\*\*16\.\.\.Nb6! 17\.Qb3 Qc7 18\.Be3 Rad8∓\*\*/);
  assert.match(page105, /\*\*15\.\.\.Bc6\*\*/);
  assert.match(page105, /\*\*16\.Qe2 Qc7 17\.f4 Bf6 18\.Nxf6\+ Nxf6⇆\*\*/);
});

test("Chapter 6 Page 106 contains Garagulya – Ionov game and Chapter Conclusion", async () => {
  const markdown = await readChapterSix();
  const start = markdown.indexOf("## Page 106");
  const page106 = markdown.slice(start);

  assert.match(page106, /\*\*19\.Be3 Bxg2 20\.Kxg2 Qc6\+ 21\.Qf3 Ne4 22\.Rfd1 Rfd8 23\.Kg1 a6\*\*/);
  assert.match(page106, /Garagulya – Ionov, Smolensk 2000/);
  assert.match(page106, /## Conclusion/);
  assert.match(page106, /This chapter dealt with less common 5th move tries for White after \*\*1\.e4 c5 2\.c3 Nf6 3\.e5 Nd5 4\.Nf3 e6\*\*\./);
});
