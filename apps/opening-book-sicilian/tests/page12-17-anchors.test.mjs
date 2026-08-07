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
import { applyChapterPages12To17AnchorCorrections } from "../app/lib/chapter-pages12-17-anchor-corrections.ts";

const root = new URL("../", import.meta.url);

function playLine(fen, moves) {
  const game = new Chess(fen);
  for (const move of moves) {
    const played = game.move(move);
    assert.ok(played, `Expected ${move} to be legal from ${game.fen()}`);
  }
  return game.fen();
}

async function correctedChapter() {
  const raw = await readFile(new URL("app/content/chapters/chapter-1-sicilian.md", root), "utf8");
  const page10 = applyChapterPage10Corrections("chapter-1-sicilian.md", raw);
  const page14 = applyChapterContentCorrections("chapter-1-sicilian.md", page10);
  const pages1To8 = applyChapterPages1To8AnchorCorrections("chapter-1-sicilian.md", page14);
  const page15 = applyChapterPage15Corrections("chapter-1-sicilian.md", pages1To8);
  const page16 = applyChapterPage16Corrections("chapter-1-sicilian.md", page15);
  const page17 = applyChapterPage17Corrections("chapter-1-sicilian.md", page16);
  const pages9To11 = applyChapterPages9To11AnchorCorrections("chapter-1-sicilian.md", page17);
  return applyChapterPages12To17AnchorCorrections("chapter-1-sicilian.md", pages9To11);
}

test("app page 12 preserves the PDF 7...d5 branch and 7...d6 main line", async () => {
  const corrected = await correctedChapter();
  const beforeBlackSeventh = "r1bqkb1r/pp1ppp1p/2n3p1/4P3/4nP2/4B3/PPP3PP/RN1QKBNR b KQkq - 4 7";
  const afterD5 = "r1bqkb1r/pp2pp1p/2n3p1/3pP3/4nP2/4B3/PPP3PP/RN1QKBNR w KQkq d6 0 8";
  const afterBd3 = "r1bqkb1r/pp2pp1p/2n3p1/3pP3/4nP2/3BB3/PPP3PP/RN1QK1NR b KQkq - 1 8";
  const afterQa5 = "r1b1kb1r/pp2pp1p/2n3p1/q2pP3/4nP2/3BB3/PPP3PP/RN1QK1NR w KQkq - 2 9";
  assert.equal(playLine(beforeBlackSeventh, ["d5"]), afterD5);
  assert.equal(playLine(afterD5, ["Bd3"]), afterBd3);
  assert.equal(playLine(afterBd3, ["Qa5+"]), afterQa5);
  assert.equal(corrected.split(`<!-- FEN: ${afterD5} -->`).length - 1, 2);
  assert.equal(corrected.split(`<!-- FEN: ${afterBd3} -->`).length - 1, 2);
  assert.ok(corrected.includes(`<!-- FEN: ${afterQa5} -->\n9.c3`));

  const afterF6 = "r1b1k2r/pp2p1bp/2n2pp1/q2pP3/4nP2/2PBBN2/PP4PP/RN1QK2R w KQkq - 0 11";
  const afterExf6 = "r1b1k2r/pp2p1bp/2n2Pp1/q2p4/4nP2/2PBBN2/PP4PP/RN1QK2R b KQkq - 0 11";
  assert.equal(playLine(afterQa5, ["c3", "Bg7", "Nf3", "f6"]), afterF6);
  assert.equal(playLine(afterF6, ["exf6"]), afterExf6);
  assert.ok(corrected.includes(`<!-- FEN: ${afterF6} -->\n11.0-0!?`));
  assert.ok(corrected.includes(`<!-- FEN: ${afterExf6} -->\n11...Nxf6`));

  const afterD6 = "r1bqkb1r/pp2pp1p/2np2p1/4P3/4nP2/4B3/PPP3PP/RN1QKBNR w KQkq - 0 8";
  const beforeNxc3 = "r3k2r/ppq1ppbp/2n3p1/4Pb2/1P2n3/2PBBN2/P1Q3PP/RN2K2R b KQkq - 4 13";
  assert.equal(
    playLine(afterD6, ["Nf3", "Qa5+", "c3", "dxe5", "fxe5", "Bg7", "b4", "Qc7", "Bd3", "Bf5", "Qc2"]),
    beforeNxc3,
  );
  assert.ok(corrected.includes(`<!-- FEN: ${beforeNxc3} -->\n13...Nxc3!!`));
  const afterBxd4 = playLine(beforeNxc3, [
    "Nxc3", "Qxc3", "Bxd3", "Qxd3", "Nxe5", "Qb5+", "Nd7", "Nd4", "Bxd4", "Bxd4",
  ]);
  assert.equal(
    playLine(afterBxd4, ["Qc1+", "Ke2", "Qxh1", "Bxh8", "Qxg2"]),
    "r3k2B/pp1npp1p/6p1/1Q6/1P6/8/P3K1qP/RN6 w q - 0 21",
  );
  assert.ok(corrected.includes("18.Bxd4 Qc1+ 19.Ke2 Qxh1 20.Bxh8 Qxg2+-+"));
  assert.ok(!corrected.includes("18.Bxd4 Rc1+"));
});

test("app pages 13-14 restore sibling moves to their PDF parents", async () => {
  const corrected = await correctedChapter();
  const afterNf3D6 = "r1bqkb1r/pp2pp1p/2np2p1/4P2n/5P2/3Q1N2/PPP3PP/RNB1KB1R w KQkq - 0 8";
  assert.ok(corrected.includes(`<!-- FEN: ${afterNf3D6} -->\n8.Nc3`));
  assert.ok(corrected.includes(`<!-- FEN: ${afterNf3D6} -->\n8.exd6`));

  const beforeWhiteNinth = "r1bqk2r/pp2ppbp/2np2p1/4P2n/5P2/2NQ1N2/PPP3PP/R1B1KB1R w KQkq - 2 9";
  assert.equal(playLine(afterNf3D6, ["Nc3", "Bg7"]), beforeWhiteNinth);
  assert.ok(corrected.includes(`<!-- FEN: ${beforeWhiteNinth} -->\n9.Be3?!`));

  const beforeQxe3 = "r3k2r/pp2qpbp/2n3p1/5b1n/5P2/2N1QN2/PPP3PP/R1B1KB1R b KQkq - 1 11";
  assert.equal(playLine(beforeWhiteNinth, ["exd6", "Bf5", "dxe7", "Qxe7+", "Qe3"]), beforeQxe3);
  assert.ok(corrected.includes(`<!-- FEN: ${beforeQxe3} -->\n11...Qxe3+`));

  const beforeWhiteNinthPage20 = "r2qkb1r/pp2pp1p/2np2p1/4Pb1B/5P2/3Q4/PPP3PP/RNB1K1NR w KQkq - 1 9";
  assert.ok(corrected.includes(`<!-- FEN: ${beforeWhiteNinthPage20} -->\nAfter 9.Qb5`));
  assert.ok(!corrected.includes("\n6.Qd3\n\n**FEN:**"));
});

test("app pages 15-17 return from alternatives to the bold PDF main lines", async () => {
  const corrected = await correctedChapter();
  const beforeB6 = "rnbq1rk1/pp2ppbp/5np1/2p5/1PP5/P4N2/1B1PBPPP/RN1QK2R b KQ - 2 9";
  assert.ok(corrected.includes(`<!-- FEN: ${beforeB6} -->\n9...b6!`));
  assert.ok(!corrected.includes("\n4.c3?!\n\n**FEN:**"));
  assert.ok(!corrected.includes("\n4.Nc3!\n\n**FEN:**"));

  const beforeWhiteSixth = "r1bqk1nr/p2pppbp/1pn3p1/2p5/1P2P3/P1N2N2/2PP1PPP/R1BQKB1R w KQkq - 2 6";
  const page22Start = corrected.indexOf("## Page 22");
  const page23Start = corrected.indexOf("## Page 23", page22Start);
  const page22 = corrected.slice(page22Start, page23Start);
  assert.ok(page22.indexOf("After 5.g3") < page22.indexOf("5...Nc6 6.Bb2!?N"));
  assert.ok(page22.indexOf("5...Nc6 6.Bb2!?N") < page22.indexOf("On 6.Rb1"));
  assert.ok(page22.includes(`<!-- FEN: ${beforeWhiteSixth} -->\nOn 6.Rb1`));
  assert.ok(page22.includes(`<!-- FEN: ${beforeWhiteSixth} -->\nAfter 6.Bc4`));

  const afterBb2 = "r1bqk1nr/p2pppbp/1pn3p1/2p5/1P2P3/P1N2N2/1BPP1PPP/R2QKB1R b KQkq - 3 6";
  assert.equal(playLine(beforeWhiteSixth, ["Bb2"]), afterBb2);
  assert.ok(corrected.includes(`<!-- FEN: ${afterBb2} -->\n6...e5!`));
  assert.ok(corrected.includes(`<!-- FEN: ${afterBb2} -->\n6...cxb4`));

  const afterD6 = "r1bq1rk1/p3npbp/1pnp2p1/2pNp3/1PB1P3/P4N2/1BPP1PPP/R2Q1RK1 w - - 0 10";
  assert.equal(playLine(afterBb2, ["e5", "Bc4", "Nge7", "O-O", "O-O", "Nd5", "d6"]), afterD6);
  assert.ok(
    corrected.includes(
      `<!-- FEN: ${afterD6} -->\nThe computers are happy to be White here`,
    ),
  );
});
