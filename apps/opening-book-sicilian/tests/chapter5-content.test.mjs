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

test("Chapter 5 Page 85 contains bold interactive move notation and accurate FEN anchors", async () => {
  const markdown = await readChapterFive();
  const start = markdown.indexOf("## Page 85");
  const end = markdown.indexOf("## Page 86", start);
  const page85 = markdown.slice(start, end);

  assert.match(page85, /\*\*23\.\.\.h6 24\.Nf5 Bf8 25\.Qxd3 Qb6\+ 26\.Be3 Qxa5 27\.Ne7\+ Bxe7 28\.Qc4\+ Kh7 29\.Qd3\+=\*\*/);
  assert.match(page85, /\*\*Qxd5 17\.Qxd5 Nxd5\*\*/);
  assert.match(page85, /Although the d3-pawn may appear weak, the position is still very complicated\./);
  assert.match(page85, /\*\*18\.h4\*\*/);
  assert.match(page85, /\*\*18\.Ndf3 f6!\*\*, planning \.\.\.0-0-0 or even \.\.\.Rc8, is not clear either\./);
  assert.match(page85, /`r3kb1r\/1p2pppp\/p7\/3n1b2\/7N\/1B1p4\/PP1N1PP1\/R1B1K2R b KQkq - 1 18`/);
  assert.match(page85, /\*\*18\.\.\.Be6 19\.Ndf3 f6 20\.Bd2 Bf7∞\*\*/);
  assert.match(page85, /### B22\) 5\.cxd4/);
  assert.match(page85, /\*\*5\.\.\.d6 6\.Bc4 Nb6\*\*/);
  assert.match(page85, /\*\*7\.Bb5\+\*\*/);
  assert.match(page85, /\*\*7\.Bb3!\? dxe5 8\.Qh5 e6 9\.dxe5 Nc6 10\.Nf3 Qd3! 11\.Nc3 Bb4 12\.Bd2 Bxc3!\? 13\.Bxc3\*\*/);
});

test("Chapter 5 Page 86 contains bold interactive move notation and accurate FEN anchors", async () => {
  const markdown = await readChapterFive();
  const start = markdown.indexOf("## Page 86");
  const end = markdown.indexOf("## Page 87", start);
  const page86 = markdown.slice(start, end);

  assert.match(page86, /\*\*13\.\.\.Nd5 14\.Rd1 Qe4\+ 15\.Kf1 Nxc3N 16\.bxc3 b6!\?\*\*/);
  assert.match(page86, /`rnbqkb1r\/pp2pppp\/1n1p4\/1B2P3\/3P4\/8\/PP3PPP\/RNBQK1NR b KQkq - 3 7`/);
  assert.match(page86, /\*\*7\.\.\.Bd7 8\.e6!\? fxe6! 9\.Bd3 g6 10\.h4 Nd5 11\.h5 Qa5\+! 12\.Bd2 Qb6 13\.Na3! Nc6!\*\*/);
  assert.match(page86, /\*\*13\.\.\.Qxd4\?\? 14\.Bc3!\+-\*\*/);
  assert.match(page86, /\*\*14\.Nf3\*\*/);
  assert.match(page86, /`r3kb1r\/pp1bp2p\/1qnpp1p1\/3n3P\/3P4\/N2B1N2\/PP1B1PP1\/R2QK2R b KQkq - 6 14`/);
  assert.match(page86, /\*\*14\.\.\.gxh5N 15\.Nc4 Qc7\*\*/);
  assert.match(page86, /\*\*16\.Rc1!\*\*/);
  assert.match(page86, /\*\*16\.\.\.0-0-0 17\.Na3\*\*/);
  assert.match(page86, /\*\*17\.Na5 Bg7!\*\*/);
  assert.match(page86, /\*\*17\.\.\.Kb8 18\.b4\*\*/);
  assert.match(page86, /\*\*18\.\.\.b5!\*\*/);
  assert.match(page86, /\*\*18\.\.\.Qb6 19\.Nc4 Qc7 20\.Ne3!\*\*/);
  assert.match(page86, /\*\*19\.Bxb5\*\*/);
  assert.match(page86, /\*\*19\.Nxb5 Qb7 20\.a4 Bg7 21\.Rxh5\*\*/);
  assert.match(page86, /\*\*19\.\.\.Qb7 20\.Bc4 Bg7 21\.Nc2 Rc8\*\*/);
});


test("Chapter 5 Page 88 contains bold interactive move notation and accurate FEN anchors", async () => {
  const markdown = await readChapterFive();
  const start = markdown.indexOf("## Page 88");
  const end = markdown.indexOf("## Page 89", start);
  const page88 = markdown.slice(start, end);

  assert.match(page88, /after \*\*18\.Qc4!N∞\*\* things are not so clear\./);
  assert.match(page88, /The game continued: \*\*17\.Bg5\?\?\*\* \(\*\*17\.Bf4!N\*\* would have been a better choice, but even then \*\*17\.\.\.Qc7 18\.f3 Rg8 19\.Bg3\*\* leaves White with an unenviable defensive task after either \*\*19\.\.\.h5-\+\*\* or \*\*19\.\.\.Rc8!\?-\+\*\*\.\)/);
  assert.match(page88, /\*\*17\.\.\.Bxe2!-\+\*\* White soon had to resign\./);
  assert.match(page88, /\*\*11\.\.\.Be7 12\.Qe2 0-0 13\.Bb3!\*\*/);
  assert.match(page88, /\*\*13\.Nb3\? Ncxe5 14\.Nxe5 Nxe5 15\.Qxe5 Qxc4 16\.Qxg7 0-0-0 17\.Qd4 Qc6 18\.f3 Rhg8 19\.Rf1 Rg6-\+\*\*/);
  assert.match(page88, /\*\*13\.\.\.f6!\?N 14\.exf6 gxf6 15\.Ne4 0-0-0 ∞\*\*/);
  assert.match(page88, /`2kr3r\/pbqpb2p\/1pn1ppn1\/8\/4N3\/1BP2N2\/PP2QPPP\/R1B1R1K1 w - - 2 16`/);
  assert.match(page88, /\*\*16\.Nfd4 Nf4 17\.Bxf4 Qxf4 18\.Rad1 Kb8 19\.g3 Rhg8 20\.Qh5 Qg4 21\.Nxc6\+ Bxc6 22\.Qxg4 Rxg4 23\.Nd2 h5 24\.Bc2 h4 25\.Be4\*\*/);
  assert.match(page88, /\*\*13\.\.\.0-0 14\.Bc2 d6 15\.exd6 Bxd6 16\.Nc4 Bf4 17\.Bxf4 Nxf4 18\.Qe4 Ng6 19\.Rad1\*\*/);
});

test("Chapter 5 Page 89 contains bold interactive move notation and accurate FEN anchors", async () => {
  const markdown = await readChapterFive();
  const start = markdown.indexOf("## Page 89");
  const end = markdown.indexOf("## Page 90", start);
  const page89 = markdown.slice(start, end);

  assert.match(page89, /\*\*19\.\.\.Qc7 20\.Nd4 Ba6 21\.Nxc6 Bxc4 22\.Qe5 Qxe5 23\.Nxe5 Be2 24\.Rd7 Rad8 25\.Rxd8 Rxd8 26\.Rxe2 Nxe5=\*\*/);
  assert.match(page89, /### B232\) 6\.Nf3 Nc6 7\.Qe4 f5!/);
  assert.match(page89, /`r1bqkb1r\/pp1p2pp\/2n1p3\/3nPp2\/4Q3\/2P2N2\/PP3PPP\/RNB1KB1R w KQkq f6 0 8`/);
  assert.match(page89, /#### B2321\) 8\.exf6 Nxf6/);
  assert.match(page89, /##### B23211\) 9\.Qc2/);
  assert.match(page89, /\*\*9\.\.\.Qc7 10\.Bd3!\*\*/);
  assert.match(page89, /\*\*10\.Bg5\?! d5! 11\.Nbd2 Bd6⩱ 12\.Nb3\? 12\.\.\.0-0 13\.Bd3 e5 14\.Bxf6 gxf6 15\.Bf5 e4 16\.Nfd4 Bxf5 17\.Nxf5 Nb4⩱\*\*/);
  assert.match(page89, /\*\*10\.Be2 b6 11\.Bg5 Bb7 12\.Nbd2 Nb4 13\.Qb3 Nbd5⩱\*\*/);
  assert.match(page89, /\*\*10\.\.\.b6 11\.0-0\*\*/);
  assert.match(page89, /\*\*11\.\.\.0-0!\?N 12\.Bg5 h6 13\.Bxf6 Bxf6 14\.Nbd2 d5⩱\*\*/);
});


test("Chapter 5 Page 95 contains conclusion", async () => {
  const start = (await readChapterFive()).indexOf("## Page 95");
  const page95 = (await readChapterFive()).slice(start);

  assert.match(page95, /## Conclusion/);
  assert.match(page95, /This chapter served as an introduction to the c3 Sicilian/);
});



