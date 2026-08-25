import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { auditChapterMarkdown } from "../scripts/chapter-audit.ts";
import { parseChapterMarkdown } from "../scripts/chapter-system.mjs";

const chapterUrl = new URL("../app/content/chapters/chapter-7-sicilian.md", import.meta.url);

async function readChapterSeven() {
  return readFile(chapterUrl, "utf8");
}

test("Chapter 7 preserves the PDF page range 107 through 135", async () => {
  const markdown = await readChapterSeven();
  const pageNumbers = [...markdown.matchAll(/^## Page (\d+)\s*$/gm)].map((match) => Number(match[1]));
  assert.deepEqual(pageNumbers, Array.from({ length: 29 }, (_, index) => index + 107));
  const chapter = parseChapterMarkdown("chapter-7-sicilian.md", markdown);
  assert.equal(chapter.pageCount, 29);
  const audit = auditChapterMarkdown(markdown, { chapter: 7, expectedPages: 29, expectedFirstPage: 107 });
  assert.deepEqual(audit.errors, []);
});

test("Chapter 7 Page 107 matches the PDF variation index and title", async () => {
  const markdown = await readChapterSeven();
  const start = markdown.indexOf("## Page 107");
  const end = markdown.indexOf("## Page 108", start);
  const page107 = markdown.slice(start, end);

  assert.match(page107, /# Chapter 7: c3 Sicilian – Various 7th Moves/);
  assert.match(page107, /A\) 7\.Bd3 Nb4! 108/);
  assert.match(page107, /A1\) 8\.Be2 108/);
  assert.match(page107, /A2\) 8\.0-0 110/);
  assert.match(page107, /A3\) 8\.Bb5\+ Bd7 112/);
  assert.match(page107, /A31\) 9\.Be2 112/);
  assert.match(page107, /A32\) 9\.Bxd7\+ 113/);
  assert.match(page107, /A4\) 8\.Bg5 114/);
  assert.match(page107, /B\) 7\.Bd2 116/);
  assert.match(page107, /C\) 7\.Nc3 Nxc3 8\.bxc3 Qc7! 9\.Bd2 Nd7 118/);
  assert.match(page107, /C1\) 10\.Bd3!\? 119/);
  assert.match(page107, /C2\) 10\.exd6 121/);
  assert.match(page107, /D\) 7\.a3 Bd7!\? 8\.Bd3 Bc6 9\.0-0 Nd7 123/);
  assert.match(page107, /D1\) 10\.Nbd2 124/);
  assert.match(page107, /D2\) 10\.Re1 126/);
  assert.match(page107, /D3\) 10\.b4 a6 128/);
  assert.match(page107, /D31\) 11\.Nbd2 128/);
  assert.match(page107, /D32\) 11\.Qe2 131/);
  assert.match(page107, /D33\) 11\.Re1 132/);
});

test("Chapter 7 Page 108 contains tabiya FEN, A) 7.Bd3 Nb4!, and A1) 8.Be2", async () => {
  const markdown = await readChapterSeven();
  const start = markdown.indexOf("## Page 108");
  const end = markdown.indexOf("## Page 109", start);
  const page108 = markdown.slice(start, end);

  assert.match(page108, /\*\*1\.e4 c5 2\.c3 Nf6 3\.e5 Nd5 4\.Nf3 e6 5\.d4\*\*/);
  assert.match(page108, /\*\*5\.\.\.cxd4 6\.cxd4 d6\*\*/);
  assert.match(page108, /### A\) 7\.Bd3/);
  assert.match(page108, /\*\*7\.\.\.Nb4!\*\*/);
  assert.match(page108, /#### A1\) 8\.Be2/);
  assert.match(page108, /\*\*8\.\.\.dxe5 9\.dxe5\*\*/);
  assert.match(page108, /9\.Nxe5\? Qxd4 is a free pawn/);
  assert.match(page108, /\*\*9\.\.\.Qxd1\+ 10\.Kxd1\*\*/);
  assert.match(page108, /\*\*10\.\.\.Bc5!\?\*\*/);
  assert.match(page108, /10\.\.\.Be7 11\.a3 Nd5 12\.Bd2 0-0/);
  assert.match(page108, /Pujos – Delchev, St Affrique 2002/);
});

test("Chapter 7 Page 109 contains Gomez Esteban – Illescas, 11.Rf1, and Olszewski – Reinderman note", async () => {
  const markdown = await readChapterSeven();
  const start = markdown.indexOf("## Page 109");
  const end = markdown.indexOf("## Page 110", start);
  const page109 = markdown.slice(start, end);

  assert.match(page109, /Gomez Esteban – Illescas, Benasque 2013/);
  assert.match(page109, /\*\*11\.Rf1\*\*/);
  assert.match(page109, /\*\*11\.\.\.0-0 12\.Bd2 Rd8\*\*/);
  assert.match(page109, /\*\*13\.Nc3\*\*/);
  assert.match(page109, /\*\*13\.\.\.N8c6\*\*/);
  assert.match(page109, /\*\*14\.Rc1N\*\*/);
  assert.match(page109, /\*\*14\.\.\.Nd4 15\.Ne4 Nxf3 16\.gxf3\*\*/);
  assert.match(page109, /\*\*16\.\.\.Be7 17\.Rg1 Bd7∓\*\*/);
});

test("Chapter 7 Page 110 contains A2) 8.0-0, 10...Bd6!N, and Gneiss – Rooze note", async () => {
  const markdown = await readChapterSeven();
  const start = markdown.indexOf("## Page 110");
  const end = markdown.indexOf("## Page 111", start);
  const page110 = markdown.slice(start, end);

  assert.match(page110, /#### A2\) 8\.0-0/);
  assert.match(page110, /\*\*8\.\.\.Nxd3 9\.Qxd3 dxe5 10\.Nxe5\*\*/);
  assert.match(page110, /\*\*10\.\.\.Bd6!N\*\*/);
  assert.match(page110, /Gneiss – Rooze, Velden 2009/);
  assert.match(page110, /\*\*11\.Qg3\*\*/);
  assert.match(page110, /\*\*11\.\.\.0-0 12\.Nc3!\*\*/);
});

test("Chapter 7 Page 111 contains 12...f6!, 15.Rad1!?, and 18...Rh5", async () => {
  const markdown = await readChapterSeven();
  const start = markdown.indexOf("## Page 111");
  const end = markdown.indexOf("## Page 112", start);
  const page111 = markdown.slice(start, end);

  assert.match(page111, /\*\*12\.\.\.f6!\*\*/);
  assert.match(page111, /\*\*13\.Bh6 Qe7 14\.Nb5 Rd8\*\*/);
  assert.match(page111, /\*\*15\.Rad1!\?\*\*/);
  assert.match(page111, /\*\*15\.\.\.Na6 16\.Nxd6 Rxd6 17\.Nc4 Rd5 18\.Ne3!\*\*/);
  assert.match(page111, /\*\*18\.\.\.Rh5\*\*/);
  assert.match(page111, /\*\*19\.Bf4 Bd7 20\.Rfe1 Qf7⇆\*\*/);
});

test("Chapter 7 Page 112 contains A3) 8.Bb5+ Bd7, A31) 9.Be2, and Kargosha – Bjelobrk note", async () => {
  const markdown = await readChapterSeven();
  const start = markdown.indexOf("## Page 112");
  const end = markdown.indexOf("## Page 113", start);
  const page112 = markdown.slice(start, end);

  assert.match(page112, /#### A3\) 8\.Bb5\+ Bd7/);
  assert.match(page112, /##### A31\) 9\.Be2/);
  assert.match(page112, /\*\*9\.\.\.Bc6 10\.0-0 Nd5\*\*/);
  assert.match(page112, /\*\*11\.Bg5\*\*/);
  assert.match(page112, /Kargosha – Bjelobrk, Sydney 2014/);
});

test("Chapter 7 Page 113 contains Barbaric Vuk – Palac, A32) 9.Bxd7+, and 11...Be7", async () => {
  const markdown = await readChapterSeven();
  const start = markdown.indexOf("## Page 113");
  const end = markdown.indexOf("## Page 114", start);
  const page113 = markdown.slice(start, end);

  assert.match(page113, /\*\*11\.\.\.Qc7\*\*/);
  assert.match(page113, /\*\*12\.Nbd2\*\*/);
  assert.match(page113, /Barbaric Vuk – Palac, Zadar 2002/);
  assert.match(page113, /##### A32\) 9\.Bxd7\+/);
  assert.match(page113, /\*\*9\.\.\.Nxd7 10\.0-0 dxe5 11\.dxe5\*\*/);
  assert.match(page113, /\*\*11\.\.\.Be7\*\*/);
  assert.match(page113, /\*\*12\.Nc3 Nc5 13\.a3N\*\*/);
});

test("Chapter 7 Page 114 contains Durarbayli – Damljanovic note and A4) 8.Bg5", async () => {
  const markdown = await readChapterSeven();
  const start = markdown.indexOf("## Page 114");
  const end = markdown.indexOf("## Page 115", start);
  const page114 = markdown.slice(start, end);

  assert.match(page114, /Durarbayli – Damljanovic, Dresden 2007/);
  assert.match(page114, /\*\*13\.\.\.Nc6 14\.b4 Qxd1 15\.Rxd1 Nb3 16\.Rb1 Nxc1 17\.Rbxc1\*\*/);
  assert.match(page114, /\*\*17\.\.\.Rd8\*\*/);
  assert.match(page114, /\*\*18\.Ne4\*\*/);
  assert.match(page114, /\*\*18\.\.\.a6 19\.g3 f6 20\.Rxd8\+ Kxd8 21\.exf6 gxf6 22\.Kf1 Kd7 23\.Rd1\+ Kc7 24\.Ke2 b5=\*\*/);
  assert.match(page114, /#### A4\) 8\.Bg5/);
  assert.match(page114, /\*\*8\.\.\.Nxd3\+\*\*/);
  assert.match(page114, /\*\*9\.Qxd3 Qb6!\*\*/);
  assert.match(page114, /\*\*10\.Nc3\*\*/);
});

test("Chapter 7 Page 115 contains Venus – Ness note, 11...d5!, and 13.Rfc1!?N note", async () => {
  const markdown = await readChapterSeven();
  const start = markdown.indexOf("## Page 115");
  const end = markdown.indexOf("## Page 116", start);
  const page115 = markdown.slice(start, end);

  assert.match(page115, /\*\*10\.\.\.h6\*\*/);
  assert.match(page115, /\*\*11\.Be3\*\*/);
  assert.match(page115, /Venus – Ness, corr\. 2009/);
  assert.match(page115, /\*\*11\.\.\.d5!\*\*/);
  assert.match(page115, /\*\*12\.0-0 Bd7 13\.a3\*\*/);
});

test("Chapter 7 Page 116 contains 13...Qa6!N, R. Stein – D. Popovic note, and B) 7.Bd2", async () => {
  const markdown = await readChapterSeven();
  const start = markdown.indexOf("## Page 116");
  const end = markdown.indexOf("## Page 117", start);
  const page116 = markdown.slice(start, end);

  assert.match(page116, /\*\*13\.\.\.Qa6!N\*\*/);
  assert.match(page116, /R\. Stein – D\. Popovic, corr\. 2000/);
  assert.match(page116, /\(\*\*15\.Rfb1\*\*\)/);
  assert.match(page116, /\*\*15\.Ne1!N Be7 16\.Nd3 0-0 17\.Qd1\*\*/);
  assert.match(page116, /\*\*14\.Qd1\*\*/);
  assert.match(page116, /\*\*14\.\.\.Nc6 15\.Rc1 Rc8 16\.Re1\*\*/);
  assert.match(page116, /\*\*16\.\.\.Be7\*\*/);
  assert.match(page116, /\*\*17\.Nd2 Qd3 18\.Qg4 Qg6=\*\*/);
  assert.match(page116, /### B\) 7\.Bd2/);
  assert.match(page116, /\*\*7\.\.\.Bd7\*\*/);
  assert.match(page116, /\*\*8\.Nc3 Bc6\*\*/);
  assert.match(page116, /\*\*9\.Rc1\*\*/);
});

test("Chapter 7 Page 117 contains Schmitz – Cramling game, 9.Bc4 Nb6!?, and Vu – Das note", async () => {
  const markdown = await readChapterSeven();
  const start = markdown.indexOf("## Page 117");
  const end = markdown.indexOf("## Page 118", start);
  const page117 = markdown.slice(start, end);

  assert.match(page117, /Schmitz – Cramling, Gibraltar 2003/);
  assert.match(page117, /\*\*9\.Bc4\*\*/);
  assert.match(page117, /\*\*9\.\.\.Nb6!\?\*\*/);
  assert.match(page117, /\*\*10\.Bb3!\*\*/);
  assert.match(page117, /Vu – Das, Kuala Lumpur 2014/);
});

test("Chapter 7 Page 118 contains 9...Nxc3!N, 10.Bxc3 Bd5!, and C) 7.Nc3", async () => {
  const markdown = await readChapterSeven();
  const start = markdown.indexOf("## Page 118");
  const end = markdown.indexOf("## Page 119", start);
  const page118 = markdown.slice(start, end);

  assert.match(page118, /\*\*9\.\.\.Nxc3!N 10\.Bxc3 Bd5!\*\*/);
  assert.match(page118, /\*\*11\.Bd3 Nc6 12\.0-0 Be7 13\.a3\*\*/);
  assert.match(page118, /\*\*15\.\.\.Bxe4 16\.Qxe4 d5 17\.Qd3 Qd7=\*\*/);
  assert.match(page118, /### C\) 7\.Nc3/);
  assert.match(page118, /\*\*7\.\.\.Nxc3 8\.bxc3\*\*/);
});

test("Chapter 7 Page 119 contains 8...Qc7!, C1) 10.Bd3!?, and 11...g6!?", async () => {
  const markdown = await readChapterSeven();
  const start = markdown.indexOf("## Page 119");
  const end = markdown.indexOf("## Page 120", start);
  const page119 = markdown.slice(start, end);

  assert.match(page119, /\*\*8\.\.\.Qc7!\*\*/);
  assert.match(page119, /\*\*9\.Bd2 Nd7\*\*/);
  assert.match(page119, /#### C1\) 10\.Bd3!\?/);
  assert.match(page119, /\*\*10\.\.\.dxe5 11\.0-0\*\*/);
  assert.match(page119, /\*\*11\.\.\.g6!\?\*\*/);
});

test("Chapter 7 Page 120 contains Karpov note, Fuentes Parra – Gajek, and Flores – Giardelli note", async () => {
  const markdown = await readChapterSeven();
  const start = markdown.indexOf("## Page 120");
  const end = markdown.indexOf("## Page 121", start);
  const page120 = markdown.slice(start, end);

  assert.match(page120, /Anatoly Karpov is a specialist in winning such endings/);
  assert.match(page120, /Fuentes Parra – Gajek, Caldas Novas 2011/);
  assert.match(page120, /\*\*12\.Qa4!\*\*/);
  assert.match(page120, /Flores – Giardelli, Tres de Febrero 2003/);
  assert.match(page120, /\*\*12\.\.\.Bg7 13\.Qa3!\*\*/);
});

test("Chapter 7 Page 121 contains 14.Bb5 a6N line and C2) 10.exd6", async () => {
  const markdown = await readChapterSeven();
  const start = markdown.indexOf("## Page 121");
  const end = markdown.indexOf("## Page 122", start);
  const page121 = markdown.slice(start, end);

  assert.match(page121, /\*\*13\.\.\.b6\*\*/);
  assert.match(page121, /\*\*14\.Bb5 a6N\*\*/);
  assert.match(page121, /\*\*15\.Bxd7\+ Qxd7 16\.Nxe5! Bxe5 17\.dxe5 Qxd2 18\.Rad1 Qg5 19\.Qd6 Bb7 20\.Qd7\+ Kf8 21\.Qxb7 Kg7 22\.f4 Qf5 23\.Qxb6 Rhc8 24\.Qd4 Rab8=\*\*/);
  assert.match(page121, /#### C2\) 10\.exd6/);
  assert.match(page121, /\*\*10\.\.\.Bxd6 11\.Bd3 b6!\*\*/);
  assert.match(page121, /\*\*12\.0-0 Bb7 13\.Re1 0-0\*\*/);
  assert.match(page121, /\*\*14\.h3\*\*/);
  assert.match(page121, /\*\*14\.\.\.Rad8!\?\*\*/);
});

test("Chapter 7 Page 122 contains Seitaj – J. Polgar, 21...a6!!, and 29.Rc4?", async () => {
  const markdown = await readChapterSeven();
  const start = markdown.indexOf("## Page 122");
  const end = markdown.indexOf("## Page 123", start);
  const page122 = markdown.slice(start, end);

  assert.match(page122, /Seitaj – J\. Polgar, Halkidiki 2002/);
  assert.match(page122, /\*\*15\.Ng5\?!\*\*/);
  assert.match(page122, /\*\*15\.\.\.Nf6 16\.Qc2\*\*/);
  assert.match(page122, /\*\*16\.\.\.g6! 17\.Ne4 Bxe4 18\.Bxe4 Nxe4 19\.Qxe4 Qc4! 20\.a4\*\*/);
  assert.match(page122, /\*\*20\.\.\.Rd7 21\.Qb1\*\*/);
  assert.match(page122, /\*\*21\.\.\.a6!!∓\*\*/);
  assert.match(page122, /\*\*22\.Qa2\*\*/);
  assert.match(page122, /\*\*22\.\.\.Rc8 23\.Reb1 Qc6 24\.Rb3 Bc7 25\.Be3 Qd6 26\.g3 h5! 27\.h4 Qd5 28\.Rb4\*\*/);
  assert.match(page122, /\*\*28\.\.\.Qf3\*\*/);
  assert.match(page122, /\*\*29\.Rc4\?\*\*/);
});

test("Chapter 7 Page 123 contains Managadze – Kotronias game and D) 7.a3", async () => {
  const markdown = await readChapterSeven();
  const start = markdown.indexOf("## Page 123");
  const end = markdown.indexOf("## Page 124", start);
  const page123 = markdown.slice(start, end);

  assert.match(page123, /\*\*29\.\.\.Re8! 30\.Re1 Qd5 31\.Qe2 Bd6-\+\*\*/);
  assert.match(page123, /Managadze – Kotronias, Achaea 2012/);
  assert.match(page123, /### D\) 7\.a3/);
  assert.match(page123, /\*\*7\.\.\.Bd7!\?\*\*/);
  assert.match(page123, /\*\*8\.Bd3 Bc6 9\.0-0 Nd7\*\*/);
});

test("Chapter 7 Page 124 contains D1) 10.Nbd2, 10...dxe5 11.dxe5!, 11...Nf4 12.Be4!, and 12...Bb5", async () => {
  const markdown = await readChapterSeven();
  const start = markdown.indexOf("## Page 124");
  const end = markdown.indexOf("## Page 125", start);
  const page124 = markdown.slice(start, end);

  assert.match(page124, /#### D1\) 10\.Nbd2/);
  assert.match(page124, /\*\*10\.\.\.dxe5 11\.dxe5!\*\*/);
  assert.match(page124, /\*\*11\.\.\.Nf4 12\.Be4!\*\*/);
  assert.match(page124, /\*\*12\.\.\.Bb5\*\*/);
  assert.match(page124, /\*\*13\.Re1\*\*/);
});

test("Chapter 7 Page 125 contains Hinojar Basa – Baron Rodriguez note and 14...Ncd3 line", async () => {
  const markdown = await readChapterSeven();
  const start = markdown.indexOf("## Page 125");
  const end = markdown.indexOf("## Page 126", start);
  const page125 = markdown.slice(start, end);

  assert.match(page125, /\*\*13\.\.\.Nc5 14\.b4!N\*\*/);
  assert.match(page125, /Hinojar Basa – Baron Rodriguez, Spain 2004/);
  assert.match(page125, /\*\*14\.\.\.Ncd3 15\.Re3 a5! 16\.Nb3!\*\*/);
  assert.match(page125, /\*\*17\.\.\.Nc5 18\.Bd2!\?\*\*/);
});

test("Chapter 7 Page 126 contains ending line on 18...Ba4 and D2) 10.Re1", async () => {
  const markdown = await readChapterSeven();
  const start = markdown.indexOf("## Page 126");
  const end = markdown.indexOf("## Page 127", start);
  const page126 = markdown.slice(start, end);

  assert.match(page126, /\*\*18\.\.\.Ba4 19\.axb4 Nxb3 20\.Nxb3 Bxb3 21\.Rxa8 Bxd1 22\.Rxd8\+ Kxd8 23\.Re1 Bxb4! 24\.Bxb4 Ba4 25\.Bxb7 Kd7 26\.Bd6 Bc6 27\.Rb1 Nd5=\*\*/);
  assert.match(page126, /#### D2\) 10\.Re1/);
  assert.match(page126, /\*\*10\.\.\.Be7!\*\*/);
  assert.match(page126, /\*\*11\.exd6\*\*/);
  assert.match(page126, /\*\*11\.\.\.Bxd6 12\.Nbd2 0-0 13\.Nc4\*\*/);
});

test("Chapter 7 Page 127 contains 13...Bf4!, 14.Bd2N, Morvay – D. Nagy note, and Rantanen – Seeman note", async () => {
  const markdown = await readChapterSeven();
  const start = markdown.indexOf("## Page 127");
  const end = markdown.indexOf("## Page 128", start);
  const page127 = markdown.slice(start, end);

  assert.match(page127, /\*\*13\.\.\.Bf4!\*\*/);
  assert.match(page127, /\*\*14\.Bd2N\*\*/);
  assert.match(page127, /Morvay – D\. Nagy, Hungary 2005/);
  assert.match(page127, /Rantanen – Seeman, Jyvaskyla 2015/);
  assert.match(page127, /\*\*14\.\.\.Bxd2\*\*/);
});

test("Chapter 7 Page 128 contains 15.Qxd2 Ne7!, 23...b6 24.Ng4 Qh4!, and D3) 10.b4", async () => {
  const markdown = await readChapterSeven();
  const start = markdown.indexOf("## Page 128");
  const end = markdown.indexOf("## Page 129", start);
  const page128 = markdown.slice(start, end);

  assert.match(page128, /\*\*15\.Qxd2 Ne7! 16\.Qf4 Bd5 17\.Ne3 Ng6! 18\.Bxg6\*\*/);
  assert.match(page128, /\*\*23\.\.\.b6 24\.Ng4 Qh4!\*\*/);
  assert.match(page128, /#### D3\) 10\.b4/);
  assert.match(page128, /\*\*10\.\.\.a6\*\*/);
  assert.match(page128, /##### D31\) 11\.Nbd2/);
});

test("Chapter 7 Page 129 contains 11...dxe5!?, Cerveny – Cvek note, and 12...a5!N", async () => {
  const markdown = await readChapterSeven();
  const start = markdown.indexOf("## Page 129");
  const end = markdown.indexOf("## Page 130", start);
  const page129 = markdown.slice(start, end);

  assert.match(page129, /\*\*11\.\.\.dxe5!\?\*\*/);
  assert.match(page129, /Cerveny – Cvek, Pardubice 2013/);
  assert.match(page129, /Lanin – Soreghy, corr\. 2009/);
  assert.match(page129, /Kalvaitis – Genutis, Lithuania 2007/);
  assert.match(page129, /\*\*12\.dxe5\*\*/);
  assert.match(page129, /\*\*12\.\.\.a5!N\*\*/);
  assert.match(page129, /\*\*13\.b5 Nc3!\*\*/);
});

test("Chapter 7 Page 130 contains 14.Qb3 line, 18.Be3 Be7 19.Rfd1 0-0-0!, and 22.Bxa5", async () => {
  const markdown = await readChapterSeven();
  const start = markdown.indexOf("## Page 130");
  const end = markdown.indexOf("## Page 131", start);
  const page130 = markdown.slice(start, end);

  assert.match(page130, /\*\*14\.Qb3\*\*/);
  assert.match(page130, /\*\*14\.\.\.Bxf3 15\.Nxf3 Nc5 16\.Qxc3 Qxd3 17\.Qxd3 Nxd3 18\.Be3 Be7 19\.Rfd1 0-0-0!\*\*/);
  assert.match(page130, /\*\*20\.a4\*\*/);
  assert.match(page130, /\*\*20\.\.\.Rd5 21\.Bb6 Kb8!\*\*/);
  assert.match(page130, /\*\*22\.Bxa5 Bc5 23\.Kf1 b6 24\.Be1 Rhd8\*\*/);
});

test("Chapter 7 Page 131 contains perpetual line, D32) 11.Qe2, and 13...Ba4!N", async () => {
  const markdown = await readChapterSeven();
  const start = markdown.indexOf("## Page 131");
  const end = markdown.indexOf("## Page 132", start);
  const page131 = markdown.slice(start, end);

  assert.match(page131, /\*\*25\.g3 g6 26\.Ng5 Nxe5 27\.Rxd5 exd5 28\.Nxh7 Rh8 29\.Nf6 Rxh2 30\.Nxd5 Nf3 31\.Ra2 Nxe1 32\.Kxe1 Rh1\+ 33\.Ke2 Bxf2 34\.Ra3=\*\*/);
  assert.match(page131, /##### D32\) 11\.Qe2/);
  assert.match(page131, /\*\*11\.\.\.Be7 12\.Re1\*\*/);
  assert.match(page131, /Khaetsky – Ortiz Suarez, Barcelona 2013/);
  assert.match(page131, /\*\*12\.\.\.Rc8\*\*/);
  assert.match(page131, /\*\*13\.Ra2\*\*/);
  assert.match(page131, /Alavkin – Negi, Moscow 2005/);
  assert.match(page131, /\*\*13\.\.\.Ba4!N\*\*/);
  assert.match(page131, /\*\*13\.\.\.N7b6\*\*/);
  assert.match(page131, /Markovic – Rublevsky, Budva 2004/);
});

test("Chapter 7 Page 132 contains 14.Qe4, 17...Rxc1+, and D33) 11.Re1", async () => {
  const markdown = await readChapterSeven();
  const start = markdown.indexOf("## Page 132");
  const end = markdown.indexOf("## Page 133", start);
  const page132 = markdown.slice(start, end);

  assert.match(page132, /\*\*14\.Qe4 dxe5 15\.dxe5 h5!\?\*\*/);
  assert.match(page132, /\*\*16\.Bd2 N7b6 17\.Rc1\*\*/);
  assert.match(page132, /\*\*17\.\.\.Rxc1\+ 18\.Bxc1 Qc7 19\.Bd2 g6 20\.Nd4 Qd7 21\.Bb2 0-0∓\*\*/);
  assert.match(page132, /##### D33\) 11\.Re1/);
  assert.match(page132, /\*\*11\.\.\.Be7 12\.exd6!\*\*/);
});

test("Chapter 7 Page 133 contains Velchev – Nielsen note and 12...Bxd6 line", async () => {
  const markdown = await readChapterSeven();
  const start = markdown.indexOf("## Page 133");
  const end = markdown.indexOf("## Page 134", start);
  const page133 = markdown.slice(start, end);

  assert.match(page133, /Velchev – P\.H\. Nielsen, Rogaska Slatina 2011/);
  assert.match(page133, /\*\*12\.\.\.Bxd6 13\.Nbd2 Be7 14\.Ne4\*\*/);
  assert.match(page133, /\*\*14\.\.\.0-0 15\.Nc5\*\*/);
});

test("Chapter 7 Page 134 contains 15...a5!?, 16.Nxd7 Bxd7 17.b5!, and 18.a4", async () => {
  const markdown = await readChapterSeven();
  const start = markdown.indexOf("## Page 134");
  const end = markdown.indexOf("## Page 135", start);
  const page134 = markdown.slice(start, end);

  assert.match(page134, /\*\*15\.\.\.a5!\?\*\*/);
  assert.match(page134, /\*\*16\.Nxd7 Bxd7 17\.b5!\*\*/);
  assert.match(page134, /\*\*17\.\.\.f6!\*\*/);
  assert.match(page134, /\*\*18\.a4\*\*/);
});

test("Chapter 7 Page 135 contains 18...Bb4 line, 24...Bf5, and Chapter Conclusion", async () => {
  const markdown = await readChapterSeven();
  const start = markdown.indexOf("## Page 135");
  const page135 = markdown.slice(start);

  assert.match(page135, /\*\*18\.\.\.Bb4 19\.Bd2 Rc8 20\.Qb1 Bxd2\*\*/);
  assert.match(page135, /\*\*21\.Nxd2 Kh8 22\.Be4 b6 23\.Bxd5 exd5 24\.Qb3\*\*/);
  assert.match(page135, /\*\*24\.\.\.Bf5 25\.Qa3 Kg8 26\.Nf1 Rf7 27\.Ne3 Be6=\*\*/);
  assert.match(page135, /## Conclusion/);
  assert.match(page135, /This chapter took us into more main line territory after \*\*1\.e4 c5 2\.c3 Nf6 3\.e5 Nd5 4\.Nf3 e6 5\.d4 cxd4 6\.cxd4 d6\*\*\./);
});
