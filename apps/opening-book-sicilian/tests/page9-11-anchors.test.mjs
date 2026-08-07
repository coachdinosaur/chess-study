import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Chess } from "chess.js";
import { applyChapterContentCorrections } from "../app/lib/chapter-content-corrections.ts";
import { applyChapterPage10Corrections } from "../app/lib/chapter-page10-corrections.ts";
import { applyChapterPage15Corrections } from "../app/lib/chapter-page15-corrections.ts";
import { applyChapterPage16Corrections } from "../app/lib/chapter-page16-corrections.ts";
import { applyChapterPage17Corrections } from "../app/lib/chapter-page17-corrections.ts";
import { applyChapterPages1To8AnchorCorrections } from "../app/lib/chapter-pages1-8-anchor-corrections.ts";
import { applyChapterPages9To11AnchorCorrections } from "../app/lib/chapter-pages9-11-anchor-corrections.ts";

const root = new URL("../", import.meta.url);

function playLine(fen, moves) {
  const game = new Chess(fen);
  for (const move of moves) {
    const played = game.move(move);
    assert.ok(played, `Expected ${move} to be legal from ${game.fen()}`);
  }
  return game.fen();
}

async function correctedChapterOne() {
  const raw = await readFile(new URL("app/content/chapters/chapter-1-sicilian.md", root), "utf8");
  const page10 = applyChapterPage10Corrections("chapter-1-sicilian.md", raw);
  const page14 = applyChapterContentCorrections("chapter-1-sicilian.md", page10);
  const pages1To8 = applyChapterPages1To8AnchorCorrections("chapter-1-sicilian.md", page14);
  const page15 = applyChapterPage15Corrections("chapter-1-sicilian.md", pages1To8);
  const page16 = applyChapterPage16Corrections("chapter-1-sicilian.md", page15);
  const page17 = applyChapterPage17Corrections("chapter-1-sicilian.md", page16);
  return applyChapterPages9To11AnchorCorrections("chapter-1-sicilian.md", page17);
}

test("app pages 9-11 retain the PDF bold-line and sibling hierarchy", async () => {
  const corrected = await correctedChapterOne();

  const afterF6 = "r1bqkb1r/pp1pp1pp/2n2p2/2p1P3/6n1/N4N2/PPPPQPPP/R1B1KB1R w KQkq - 0 6";
  const afterG6 = "r1bqkb1r/pp1pp2p/2n3p1/2p1N3/8/8/PPPPQPPP/R1B1KB1R w KQkq - 0 9";
  const afterQe3 = "r1bqkb1r/pp1pp2p/2n3p1/2p1N3/8/4Q3/PPPP1PPP/R1B1KB1R b KQkq - 1 9";
  assert.equal(playLine(afterF6, ["Nc4", "Ngxe5", "Ncxe5", "fxe5", "Nxe5", "g6"]), afterG6);
  assert.equal(playLine(afterG6, ["Qe3"]), afterQe3);
  assert.ok(corrected.includes(`<!-- FEN: ${afterF6} -->\n6.Nc4 Ngxe5`));
  assert.ok(corrected.includes(`<!-- FEN: ${afterG6} -->\n9.Nxc6!`));
  assert.ok(corrected.includes(`<!-- FEN: ${afterQe3} -->\n9...Nd4!`));

  const afterTwoG6 = "rnbqkbnr/pp1ppp1p/6p1/2p5/4PP2/8/PPPP2PP/RNBQKBNR w KQkq - 0 3";
  assert.equal(playLine(new Chess().fen(), ["e4", "c5", "f4", "g6"]), afterTwoG6);
  assert.ok(corrected.includes(`<!-- FEN: ${afterTwoG6} -->\nBlack declares his intention`));

  const beforeTwelve = "r1b2rk1/pp2ppbp/1qnP2p1/8/2B2P2/5N2/PPPQ2PP/R1B1K2R w KQ - 5 12";
  assert.ok(corrected.includes(`<!-- FEN: ${beforeTwelve} -->\nWhite might hold after 12.d7`));

  const beforeSixteen = "r4rk1/pp3pbp/2n1b1p1/q2p4/5P2/1BP1QN2/PP4PP/R1B2RK1 w - - 2 16";
  const afterQf2 = "r4rk1/pp3pbp/2n1b1p1/q2p4/5P2/1BP2N2/PP3QPP/R1B2RK1 b - - 3 16";
  assert.equal(playLine(beforeSixteen, ["Qf2"]), afterQf2);
  assert.ok(corrected.includes(`<!-- FEN: ${beforeSixteen} -->\n16.Bd2?! Qb5∓`));
  assert.ok(corrected.includes(`<!-- FEN: ${afterQf2} -->\n16...Qb5`));

  const beforeEighteen = "r4rk1/1p3pbp/2n1b1p1/pq1p4/5P2/1BP1BN2/PP3QPP/R4RK1 w - - 0 18";
  assert.equal(playLine(afterQf2, ["Qb5", "Be3", "a5"]), beforeEighteen);
  assert.ok(corrected.includes(`## Page 17\n\n<!-- FEN: ${beforeEighteen} -->\n18.Rfb1!`));

  const afterBxd2 = "r1bqkb1r/pp1ppp1p/2n3p1/4P3/5P2/8/PPPB2PP/R2QKBNR b KQkq - 0 8";
  const afterCastle = "r1bq1rk1/pp2ppbp/2np2p1/4P3/5P2/2B2N2/PPP3PP/R2QKB1R w KQ - 2 11";
  const afterBb5 = "r1bq1rk1/pp2ppbp/2np2p1/1B2P3/5P2/2B2N2/PPP3PP/R2QK2R b KQ - 3 11";
  assert.equal(playLine(afterBxd2, ["Bg7", "Bc3", "d6", "Nf3", "O-O"]), afterCastle);
  assert.equal(playLine(afterCastle, ["Bb5"]), afterBb5);
  assert.ok(corrected.includes(`<!-- FEN: ${afterBxd2} -->\n8...Bg7`));
  assert.ok(corrected.includes(`<!-- FEN: ${afterCastle} -->\nWhite is having difficulty`));
  assert.ok(corrected.includes(`<!-- FEN: ${afterBb5} -->\n11...Qb6`));

  const beforeThirteen = "r4rk1/pp2ppbp/1qnp2p1/1B2P3/5Pb1/2B2N2/PPP1Q1PP/R3K2R w KQ - 6 13";
  const afterBxc6 = "r4rk1/pp2ppbp/1qBp2p1/4P3/5Pb1/2B2N2/PPP1Q1PP/R3K2R b KQ - 0 13";
  assert.equal(playLine(afterBb5, ["Qb6", "Qe2", "Bg4"]), beforeThirteen);
  assert.equal(playLine(beforeThirteen, ["Bxc6"]), afterBxc6);
  assert.ok(corrected.includes(`<!-- FEN: ${afterBxc6} -->\n13...bxc6`));

  const beforeFifteen = "r4rk1/p3ppbp/q1pp2p1/4P3/5Pb1/2B2N2/PPP2QPP/R3K2R w KQ - 2 15";
  const afterQe3Main = "r4rk1/p3ppbp/q1pp2p1/4P3/5Pb1/2B1QN2/PPP3PP/R3K2R b KQ - 3 15";
  assert.equal(playLine(afterBxc6, ["bxc6", "Qf2", "Qa6"]), beforeFifteen);
  assert.equal(playLine(beforeFifteen, ["Qe3"]), afterQe3Main);
  assert.ok(corrected.includes(`<!-- FEN: ${beforeFifteen} -->\n15.Qe3`));
  assert.ok(corrected.includes(`<!-- FEN: ${beforeFifteen} -->\n15.Qe2!`));
  assert.ok(corrected.includes(`<!-- FEN: ${afterQe3Main} -->\n15...Bxf3`));
});
