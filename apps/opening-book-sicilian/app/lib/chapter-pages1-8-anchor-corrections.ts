function replaceExactCount(
  content: string,
  before: string,
  after: string,
  expectedCount: number,
  label: string,
): string {
  const actualCount = content.split(before).length - 1;
  if (actualCount !== expectedCount) {
    throw new Error(`Expected ${expectedCount} ${label} occurrence(s), found ${actualCount}.`);
  }
  return content.split(before).join(after);
}

export function applyChapterPages1To8AnchorCorrections(filename: string, content: string): string {
  if (filename !== "chapter-1-sicilian.md") return content;


  // The canonical Markdown may already contain these verified PDF-derived
  // corrections. Keep this correction function available for older source
  // content, but do not apply the same replacements twice.
  if (
    content.includes(
      "<!-- FEN: r2q1rk1/p4pbp/bpn1p1p1/2pn2B1/8/NBPP1N2/PP2QPPP/R3R1K1 b - - 1 12 -->\n12...Qc7N∓",
    ) &&
    content.includes(
      "<!-- FEN: r1bqkb1r/pp2pp1p/2n3p1/3pP3/4nP2/4B3/PPP3PP/RN1QKBNR w KQkq d6 0 8 -->\n8.Bd3",
    )
  ) {
    return content;
  }

  let corrected = content;

  corrected = replaceExactCount(
    corrected,
    "<!-- FEN: rbbq1rk1/pp1p1pp1/2n1p2p/2p4P/4P3/1BPP4/PP1NQPP1/R1B2RK1 b - - 5 12 -->\n12...Qc7N∓\n\n**FEN:**\n`r1q2rk1/p1p2pbp/bpn1p1p1/3n2B1/8/N1PP1N2/PP2QPPP/R3R1K1 w - - 1 13`",
    "<!-- FEN: r2q1rk1/p4pbp/bpn1p1p1/2pn2B1/8/NBPP1N2/PP2QPPP/R3R1K1 b - - 1 12 -->\n12...Qc7N∓\n\n**FEN:**\n`r4rk1/p1q2pbp/bpn1p1p1/2pn2B1/8/NBPP1N2/PP2QPPP/R3R1K1 w - - 2 13`",
    1,
    "Page 9 12...Qc7 anchor block",
  );

  corrected = replaceExactCount(
    corrected,
    "<!-- FEN: r2qkb1r/pp1bpp1p/2n3p1/8/2Q5/2N3P1/PPP2P1P/R1B1KB1R w KQkq - 0 10 -->\n10.Bg2",
    "<!-- FEN: r2qkb1r/pp1bpp1p/2n3p1/8/4Q3/2N3P1/PPP2P1P/R1B1KB1R w KQkq - 0 10 -->\n10.Bg2",
    1,
    "Page 12 return to 9.Qe4 main line",
  );

  corrected = replaceExactCount(
    corrected,
    "<!-- FEN: r1q2rk1/pp2ppbp/2n3p1/5b2/7Q/2N1B1P1/PPP2PBP/R2R2K1 b - - 9 14 -->\n14...Bh3! 15.Be4",
    "<!-- FEN: r1q2rk1/pp2ppbp/2n3p1/5b2/Q7/2N1B1P1/PPP2PBP/R2R2K1 b - - 9 14 -->\n14...Bh3! 15.Be4",
    1,
    "Page 12 14...Bh3 main-line anchor",
  );

  corrected = replaceExactCount(
    corrected,
    "<!-- FEN: r1q2rk1/pp2ppbp/2n3p1/8/7Q/2N1B1Pb/PPP2P1P/R2R2KB b - - 11 15 -->\n<!-- FEN: r1q2rk1/pp2ppbp/2n3p1/8/Q3B3/2N1B1Pb/PPP2P1P/R2R2K1 b - - 11 15 -->\n15...Bg4",
    "<!-- FEN: r1q2rk1/pp2ppbp/2n3p1/8/Q3B3/2N1B1Pb/PPP2P1P/R2R2K1 b - - 11 15 -->\n15...Bg4",
    1,
    "Page 12 return to 15.Be4 main line",
  );

  corrected = replaceExactCount(
    corrected,
    "<!-- FEN: r1bq1rk1/pp2bppp/3p2n1/1Bp1p3/2NnP3/3P1N2/PPPB1PPP/R2Q1RK1 b - - 9 10 -->\n10...Nxf3+",
    "<!-- FEN: r1bq1rk1/pp2bppp/3p2n1/2p1p3/2BnP3/3PNN2/PPPB1PPP/R2Q1RK1 b - - 9 10 -->\n10...Nxf3+",
    1,
    "Page 14 10.Bc4 main-line anchor",
  );

  corrected = replaceExactCount(
    corrected,
    "<!-- FEN: r1bqkb1r/pp1pnppp/2n5/1Bp1p3/2N1P3/5N2/PPPP1PPP/R1BQKB1R b KQkq - 3 5 -->\nBlack has typically contested d5, getting rid of all his problems.",
    "<!-- FEN: r2q1rk1/pp3ppp/3pb1n1/2p1p1b1/P1B1P3/3PNQ2/1PPB1PPP/R4RK1 w - - 1 13 -->\nBlack has typically contested d5, getting rid of all his problems.",
    1,
    "Page 14 post-12...Be6 anchor",
  );

  corrected = replaceExactCount(
    corrected,
    "<!-- FEN: rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1 -->\nWith the knight on a3 this looks excellent, as e4 is now under attack.",
    "<!-- FEN: r1bqkb1r/pp1ppppp/2n2n2/2p5/4P3/N4N2/PPPP1PPP/R1BQKB1R w KQkq - 2 4 -->\nWith the knight on a3 this looks excellent, as e4 is now under attack.",
    1,
    "Page 14 post-3...Nf6 explanatory anchor",
  );

  const required = [
    "r2q1rk1/p4pbp/bpn1p1p1/2pn2B1/8/NBPP1N2/PP2QPPP/R3R1K1 b - - 1 12",
    "r4rk1/p1q2pbp/bpn1p1p1/2pn2B1/8/NBPP1N2/PP2QPPP/R3R1K1 w - - 2 13",
    "r2qkb1r/pp1bpp1p/2n3p1/8/4Q3/2N3P1/PPP2P1P/R1B1KB1R w KQkq - 0 10",
    "r1q2rk1/pp2ppbp/2n3p1/5b2/Q7/2N1B1P1/PPP2PBP/R2R2K1 b - - 9 14",
    "r1q2rk1/pp2ppbp/2n3p1/8/Q3B3/2N1B1Pb/PPP2P1P/R2R2K1 b - - 11 15",
    "r1bq1rk1/pp2bppp/3p2n1/2p1p3/2BnP3/3PNN2/PPPB1PPP/R2Q1RK1 b - - 9 10",
    "r2q1rk1/pp3ppp/3pb1n1/2p1p1b1/P1B1P3/3PNQ2/1PPB1PPP/R4RK1 w - - 1 13",
    "r1bqkb1r/pp1ppppp/2n2n2/2p5/4P3/N4N2/PPPP1PPP/R1BQKB1R w KQkq - 2 4",
  ];
  for (const expected of required) {
    if (!corrected.includes(expected)) {
      throw new Error(`Chapter 1 early-page anchor correction failed to produce: ${expected}`);
    }
  }

  const forbidden = [
    "rbbq1rk1/pp1p1pp1/2n1p2p/2p4P/4P3/1BPP4/PP1NQPP1/R1B2RK1 b - - 5 12",
    "r2qkb1r/pp1bpp1p/2n3p1/8/2Q5/2N3P1/PPP2P1P/R1B1KB1R w KQkq - 0 10",
    "r1q2rk1/pp2ppbp/2n3p1/5b2/7Q/2N1B1P1/PPP2PBP/R2R2K1 b - - 9 14",
    "r1q2rk1/pp2ppbp/2n3p1/8/7Q/2N1B1Pb/PPP2P1P/R2R2KB b - - 11 15",
    "r1bq1rk1/pp2bppp/3p2n1/1Bp1p3/2NnP3/3P1N2/PPPB1PPP/R2Q1RK1 b - - 9 10",
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  ];
  for (const rejected of forbidden) {
    if (corrected.includes(rejected)) {
      throw new Error(`Chapter 1 early-page anchor correction left stale FEN: ${rejected}`);
    }
  }

  return corrected;
}
