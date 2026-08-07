import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Chess } from "chess.js";
import { applyChapterContentCorrections } from "../app/lib/chapter-content-corrections.ts";
import { applyChapterPage10Corrections } from "../app/lib/chapter-page10-corrections.ts";
import { applyChapterPages1To8AnchorCorrections } from "../app/lib/chapter-pages1-8-anchor-corrections.ts";

const root = new URL("../", import.meta.url);

function playLine(fen, moves) {
  const game = new Chess(fen);
  for (const move of moves) {
    const played = game.move(move);
    assert.ok(played, `Expected ${move} to be legal from ${game.fen()}`);
  }
  return game.fen();
}

test("app pages 1-8 retain the PDF main-line anchor hierarchy", async () => {
  const raw = await readFile(new URL("app/content/chapters/chapter-1-sicilian.md", root), "utf8");
  const page10Corrected = applyChapterPage10Corrections("chapter-1-sicilian.md", raw);
  const page14Corrected = applyChapterContentCorrections("chapter-1-sicilian.md", page10Corrected);
  const corrected = applyChapterPages1To8AnchorCorrections("chapter-1-sicilian.md", page14Corrected);

  const beforeQc7 = "r2q1rk1/p4pbp/bpn1p1p1/2pn2B1/8/NBPP1N2/PP2QPPP/R3R1K1 b - - 1 12";
  const afterQc7 = "r4rk1/p1q2pbp/bpn1p1p1/2pn2B1/8/NBPP1N2/PP2QPPP/R3R1K1 w - - 2 13";
  assert.equal(playLine(beforeQc7, ["Qc7"]), afterQc7);
  assert.ok(corrected.includes(`<!-- FEN: ${beforeQc7} -->\n12...Qc7N∓`));
  assert.ok(corrected.includes(`**FEN:**\n\`${afterQc7}\``));

  const afterG6 = "r2qkb1r/pp1bpp1p/2n3p1/8/4Q3/2N3P1/PPP2P1P/R1B1KB1R w KQkq - 0 10";
  const beforeBh3 = "r1q2rk1/pp2ppbp/2n3p1/5b2/Q7/2N1B1P1/PPP2PBP/R2R2K1 b - - 9 14";
  assert.equal(
    playLine(afterG6, ["Bg2", "Bg7", "O-O", "O-O", "Rd1", "Qc8", "Be3", "Bf5", "Qa4"]),
    beforeBh3,
  );
  assert.ok(corrected.includes(`<!-- FEN: ${afterG6} -->\n10.Bg2`));
  assert.ok(corrected.includes(`<!-- FEN: ${beforeBh3} -->\n14...Bh3! 15.Be4`));

  const beforeBh1 = "r1q2rk1/pp2ppbp/2n3p1/8/Q7/2N1B1Pb/PPP2PBP/R2R2K1 w - - 10 15";
  assert.equal(playLine(beforeBh3, ["Bh3"]), beforeBh1);
  assert.ok(corrected.includes(`<!-- FEN: ${beforeBh1} -->\n15.Bh1 Qg4=`));

  const beforeBg4 = "r1q2rk1/pp2ppbp/2n3p1/8/Q3B3/2N1B1Pb/PPP2P1P/R2R2K1 b - - 11 15";
  assert.equal(playLine(beforeBh3, ["Bh3", "Be4"]), beforeBg4);
  assert.ok(corrected.includes(`<!-- FEN: ${beforeBg4} -->\n15...Bg4`));
  assert.ok(corrected.includes(`<!-- FEN: ${beforeBg4} -->\n15...Bf5`));

  const afterBg4 = "r1q2rk1/pp2ppbp/2n3p1/8/Q3B1b1/2N1B1P1/PPP2P1P/R2R2K1 w - - 12 16";
  assert.equal(playLine(beforeBg4, ["Bg4"]), afterBg4);
  assert.equal(corrected.split(`<!-- FEN: ${afterBg4} -->`).length - 1, 2);

  const beforeQe6 = "r1q2rk1/pp2ppbp/2n3p1/3R4/Q3B1b1/2N1B1P1/PPP2P1P/R5K1 b - - 13 16";
  assert.equal(playLine(afterBg4, ["Rd5"]), beforeQe6);
  assert.ok(corrected.includes(`<!-- FEN: ${beforeQe6} -->\n16...Qe6=`));

  const beforeNxf3 = "r1bq1rk1/pp2bppp/3p2n1/2p1p3/2BnP3/3PNN2/PPPB1PPP/R2Q1RK1 b - - 9 10";
  const afterBe6 = "r2q1rk1/pp3ppp/3pb1n1/2p1p1b1/P1B1P3/3PNQ2/1PPB1PPP/R4RK1 w - - 1 13";
  assert.equal(playLine(beforeNxf3, ["Nxf3+", "Qxf3", "Bg5", "a4", "Be6"]), afterBe6);
  assert.ok(corrected.includes(`<!-- FEN: ${beforeNxf3} -->\n10...Nxf3+`));
  assert.ok(
    corrected.includes(
      `<!-- FEN: ${afterBe6} -->\nBlack has typically contested d5, getting rid of all his problems.`,
    ),
  );

  const afterD2Nf6 = "r1bqkb1r/pp1ppppp/2n2n2/2p5/4P3/N4N2/PPPP1PPP/R1BQKB1R w KQkq - 2 4";
  assert.ok(
    corrected.includes(
      `<!-- FEN: ${afterD2Nf6} -->\nWith the knight on a3 this looks excellent, as e4 is now under attack.`,
    ),
  );

  for (const stale of [
    "rbbq1rk1/pp1p1pp1/2n1p2p/2p4P/4P3/1BPP4/PP1NQPP1/R1B2RK1 b - - 5 12",
    "r2qkb1r/pp1bpp1p/2n3p1/8/2Q5/2N3P1/PPP2P1P/R1B1KB1R w KQkq - 0 10",
    "r1q2rk1/pp2ppbp/2n3p1/5b2/7Q/2N1B1P1/PPP2PBP/R2R2K1 b - - 9 14",
    "r1q2rk1/pp2ppbp/2n3p1/8/7Q/2N1B1Pb/PPP2P1P/R2R2KB b - - 11 15",
    "r1bq1rk1/pp2bppp/3p2n1/1Bp1p3/2NnP3/3P1N2/PPPB1PPP/R2Q1RK1 b - - 9 10",
  ]) {
    assert.ok(!corrected.includes(stale), `Stale anchor remains: ${stale}`);
  }
});

test("the visible header and browser title use the full Sicilian course name", async () => {
  const [app, html] = await Promise.all([
    readFile(new URL("app/SicilianApp.tsx", root), "utf8"),
    readFile(new URL("index.html", root), "utf8"),
  ]);
  const title = "Sicilian Defense: Beating the Anti-Sicilian";
  assert.ok(app.includes(`<strong>${title}</strong>`));
  assert.ok(html.includes(`<title>${title}</title>`));
});
