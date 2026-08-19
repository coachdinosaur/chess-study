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
  assert.match(page80, /\*\*12\.Qd1 Qb6\*\*/);
  assert.match(page80, /\*\*10\.\.\.Be6 11\.Nf3 h6 12\.0-0 0-0 13\.Bf4\*\*/);
  assert.match(page80, /\*\*13\.Be3 Re8 14\.Qa4 Qf6 15\.Nbd2 Qg6 16\.Rfe1 Rad8 17\.Rad1 Bd5! 18\.c4 Be6⩱\*\*/);
});

test("Chapter 5 Page 81 contains complete 13...Bc5!? line, 15.Rae1, Lazar-Kozul note, diagrams, and B12 matching PDF", async () => {
  const markdown = await readChapterFive();
  const start = markdown.indexOf("## Page 81");
  const end = markdown.indexOf("## Page 82", start);
  const page81 = markdown.slice(start, end);

  assert.match(page81, /\*\*13\.\.\.Bc5!\?\*\*/);
  assert.match(page81, /\*\*13\.\.\.Re8N 14\.Bxd6 Qxd6 15\.Re1\*\*/);
  assert.match(page81, /`4r1k1\/pp3pp1\/2b3qp\/4n3\/8\/2P5\/PPN2PPP\/R2QN1K1 w - - 7 21`/);
  assert.match(page81, /\*\*14\.Nbd2 Re8 15\.Rae1\*\*/);
  assert.match(page81, /15\.b4 Bf8⩱/);
  assert.match(page81, /15\.Qc2!\?N Qd5 16\.Rfe1 Rad8 17\.b4 Bf8 18\.a4 may have been the best try, when 18\.\.\.Rc8!/);
  assert.match(page81, /\*\*15\.\.\.Bxa2 16\.Qxe8\+ Qxe8 17\.Rxe8\+ Rxe8 18\.b3 g5 19\.Be3 Bxe3 20\.fxe3 Rxe3 21\.Ra1N\*\*/);
  assert.match(page81, /21\.Rc1 g4 22\.Nf1 was played in Lazar – Kozul, Rogaska Slatina 2011, and here Zdenko should have chosen 22\.\.\.Re2 23\.N3d2 Na5 24\.Ra1 Nxb3 25\.Rxa2 a5 26\.Rb2 a4 27\.Ra2 b5 28\.c4 bxc4 29\.Rxa4 Nxd2=\./);
  assert.match(page81, /`6k1\/pp3p2\/2n4p\/6p1\/8\/1PP1rN2\/b2N2PP\/R5K1 b - - 1 21`/);
  assert.match(page81, /\*\*21\.\.\.Bxb3 22\.Nxb3 Rxc3 23\.Nbd4 Nxd4 24\.Nxd4 a6=\*\*/);
  assert.match(page81, /The ensuing ending is balanced\./);
  assert.match(page81, /#### B12\) 4\.\.\.Nb6/);
  assert.match(page81, /\*\*5\.Bb3 d5!\*\*/);
  assert.match(page81, /\*\*5\.\.\.c4 6\.Bc2 Nc6 7\.Nf3 d6! 8\.exd6 Qxd6 9\.0-0 Bg4\*\*/);
  assert.match(page81, /\*\*10\.h3 Bh5 11\.Re1 0-0-0\*\*/);
  assert.match(page81, /`2kr1b1r\/pp2pppp\/1nnq4\/7b\/2p5\/2P2N1P\/PPBP1PP1\/RNBQR1K1 w - - 3 12`/);
});

test("Chapter 5 Page 95 contains conclusion", async () => {
  const start = (await readChapterFive()).indexOf("## Page 95");
  const page95 = (await readChapterFive()).slice(start);

  assert.match(page95, /## Conclusion/);
  assert.match(page95, /This chapter served as an introduction to the c3 Sicilian/);
});

