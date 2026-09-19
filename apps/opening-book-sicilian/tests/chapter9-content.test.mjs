import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { auditChapterMarkdown } from "../scripts/chapter-audit.ts";
import { parseChapterMarkdown } from "../scripts/chapter-system.mjs";

const chapterUrl = new URL("../app/content/chapters/chapter-9-sicilian.md", import.meta.url);

async function readChapterNine() {
  return readFile(chapterUrl, "utf8");
}

test("Chapter 9 preserves the PDF page range 156 through 160", async () => {
  const markdown = await readChapterNine();
  const pageNumbers = [...markdown.matchAll(/^## Page (\d+)\s*$/gm)].map((match) => Number(match[1]));
  assert.deepEqual(pageNumbers, Array.from({ length: 5 }, (_, index) => index + 156));
  const chapter = parseChapterMarkdown("chapter-9-sicilian.md", markdown);
  assert.equal(chapter.pageCount, 5);
  const audit = auditChapterMarkdown(markdown, { chapter: 9, expectedPages: 5, expectedFirstPage: 156 });
  assert.deepEqual(audit.errors, []);
});

test("Chapter 9 Page 156 matches the PDF variation index and title", async () => {
  const markdown = await readChapterNine();
  const start = markdown.indexOf("## Page 156");
  const end = markdown.indexOf("## Page 157", start);
  const page156 = markdown.slice(start, end);

  assert.match(page156, /# Chapter 9: c3 Sicilian – 9\.Qe2/);
  assert.match(page156, /9\.\.\.0-0/);
  assert.match(page156, /A\) 10\.Rd1 157/);
  assert.match(page156, /B\) 10\.Re1 159/);
  assert.match(page156, /B1\) 10\.\.\.b6!\? 159/);
  assert.match(page156, /B2\) 10\.\.\.Qb6! 161/);
  assert.match(page156, /C\) 10\.Nc3!\? Nxc3 11\.bxc3 dxe5 12\.dxe5 Qc7 163/);
  assert.match(page156, /C1\) 13\.Bd3 164/);
  assert.match(page156, /C2\) 13\.Qe4 b6 165/);
  assert.match(page156, /C21\) 14\.Bd3 166/);
  assert.match(page156, /C22\) 14\.Bg5 167/);
  assert.match(page156, /D\) 10\.Qe4 Bd7 168/);
  assert.match(page156, /D1\) 11\.Re1 170/);
  assert.match(page156, /D2\) 11\.Bd3 172/);
  assert.match(page156, /#### C21\) note to 16\.Rad1/);
  assert.match(page156, /19\.\.\.Rd5!N/);
  assert.match(page156, /13\.\.\.Bc6!N/);
  assert.match(page156, /16\.\.\.Ne4!N/);
});

test("Chapter 9 Page 157 contains introductory moves and variation A", async () => {
  const markdown = await readChapterNine();
  const start = markdown.indexOf("## Page 157");
  const end = markdown.indexOf("## Page 158", start);
  const page157 = markdown.slice(start, end);

  assert.match(page157, /\*\*1\.e4 c5 2\.c3 Nf6 3\.e5 Nd5 4\.Nf3 e6 5\.d4 cxd4 6\.cxd4 d6 7\.Bc4 Nc6 8\.0-0 Be7 9\.Qe2\*\*/);
  assert.match(page157, /\*\*9\.\.\.0-0\*\*/);
  assert.match(page157, /10\.exd6 Bxd6 11\.Nc3 h6 12\.Bd2 Nce7 13\.Rac1 Bd7! 14\.Ne5 Bc6=/);
  assert.match(page157, /10\.Bd2 allows 10\.\.\.Qb6/);
  assert.match(page157, /### A\) 10\.Rd1/);
  assert.match(page157, /\*\*10\.\.\.Na5!\*\*/);
  assert.match(page157, /\*\*11\.b3\*\*/);
  assert.match(page157, /11\.Bd3/);
  assert.match(page157, /15\.Qxd3 b6 16\.Nc3 Bb7 17\.Ne5 f4! 18\.Ne4 Qd5 19\.f3 Rad8 20\.b3 Rf5∓/);
  assert.match(page157, /\*\*16\.\.\.Nc6!\?N\*\*/);
  assert.match(page157, /16\.\.\.Nc4 17\.Rc3/);
});

test("Chapter 9 Page 158 contains the A-line continuations and 11...Bd7", async () => {
  const markdown = await readChapterNine();
  const start = markdown.indexOf("## Page 158");
  const end = markdown.indexOf("## Page 159", start);
  const page158 = markdown.slice(start, end);

  assert.match(page158, /Bb7 19\.axb5 Bxf3 20\.gxf3 Nb6 21\.Rc6 Qxd4 22\.Bb2 Qd7=/);
  assert.match(page158, /17\.b5 Nb4 18\.Rb3/);
  assert.match(page158, /18\.Ba3 a5!!↑/);
  assert.match(page158, /11\.Bxd5 exd5 12\.Nc3 Be6 13\.Bf4/);
  assert.match(page158, /25\.\.\.Bxh3!\?N 26\.gxh3 Qd6† 27\.Kg1 Qg6†=/);
  assert.match(page158, /11\.\.\.Bd7 12\.Bxd5 exd5 13\.Nc3 Be6 14\.Ba3 Nc6/);
  assert.match(page158, /15\.Rac1/);
  assert.match(page158, /\*\*15\.\.\.Rc8 16\.h3\*\*/);
  assert.match(page158, /22\.Rxc8 Bxc8 23\.dxe5 Rxe5/);
  assert.match(page158, /16\.\.\.a6 17\.Qd3 dxe5/);
});

test("Chapter 9 Page 159 contains variation B and B1", async () => {
  const markdown = await readChapterNine();
  const start = markdown.indexOf("## Page 159");
  const end = markdown.indexOf("## Page 160", start);
  const page159 = markdown.slice(start, end);

  assert.match(page159, /\*\*19\.\.\.Rcd8 20\.Ne2N\*\*/);
  assert.match(page159, /20\.Re1 d4 21\.Ne2 Bd5 22\.Nfxd4 Qxe5/);
  assert.match(page159, /\*\*20\.\.\.Bc8!\*\*/);
  assert.match(page159, /### B\) 10\.Re1/);
  assert.match(page159, /#### B1\) 10\.\.\.b6!\?/);
  assert.match(page159, /\*\*11\.Qe4!\*\*/);
  assert.match(page159, /11\.Nc3 is a plausible idea/);
  assert.match(page159, /14\.Bd3 Na5/);
});

test("Chapter 9 Page 160 contains the B1 sacrifices and 11...Bb7!?N", async () => {
  const markdown = await readChapterNine();
  const start = markdown.indexOf("## Page 160");
  const page160 = markdown.slice(start);

  assert.match(page160, /15\.Nd4!\? \(15\.Bf4 Qd5! 16\.Rad1 Qc6 17\.Qc2 g6⇄/);
  assert.match(page160, /11\.a3 dxe5 12\.dxe5 Bb7=/);
  assert.match(page160, /13\.b4\?!/);
  assert.match(page160, /13\.Bd2!N Rc8 14\.Nc3 Nxc3 15\.Bxc3 Na5=/);
  assert.match(page160, /13\.\.\.Rc8 14\.Nbd2\?!/);
  assert.match(page160, /14\.Rd1N f6!! 15\.exf6 Bxf6 16\.Ra2/);
  assert.match(page160, /14\.\.\.Nf4 15\.Qe4/);
  assert.match(page160, /15\.\.\.Nxg2!! 16\.Kxg2 Na5 17\.bxa5 Bxe4 18\.Rxe4 bxa5∓/);
  assert.match(page160, /Zubarev – A\. Moiseenko, Lvov 2014/);
  assert.match(page160, /\*\*11\.\.\.Bb7!\?N\*\*/);
  assert.match(page160, /16\.Bb5!/);
  assert.match(page160, /16\.\.\.Bb4! 17\.Nc3 Nd4 18\.Nxd4 Qxd4/);
  assert.match(page160, /12\.Bd3 g6 13\.Bh6 Ndb4!\?/);
});
