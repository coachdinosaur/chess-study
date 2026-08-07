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

export function applyChapterPages12To17AnchorCorrections(filename: string, content: string): string {
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

  // App Page 12 / printed Page 18: keep the 7...d5 branch and its siblings
  // separate from the bold 7...d6!?N main recommendation.
  corrected = replaceExactCount(
    corrected,
    "\n8.Bd3\n\n8.Nf3!? Bg4 9.Be2 Bg7 10.0-0 0-0 11.Nbd2 Nxd2 12.Qxd2 Qa5!? 13.c3!? (13.Qxa5 Nxa5=) 13...e6∞\n\n8...Qa5+\n\n8...Bf5 9.Nf3 Bg7 10.0-0 0-0 11.Nbd2 Qc7=\n\n9.c3 Bg7 10.Nf3\n\n10...f6!? 11.exf6?!\n\n11.0-0!? 0-0 12.b4! Qc7 13.Qb3!± e.g. 13...e6 14.Bxe4! dxe4 15.exf6 Bxf6 16.Nfd2\n\n11...Nxf6",
    "\n<!-- FEN: r1bqkb1r/pp2pp1p/2n3p1/3pP3/4nP2/4B3/PPP3PP/RN1QKBNR w KQkq d6 0 8 -->\n8.Bd3\n\n<!-- FEN: r1bqkb1r/pp2pp1p/2n3p1/3pP3/4nP2/4B3/PPP3PP/RN1QKBNR w KQkq d6 0 8 -->\n8.Nf3!? Bg4 9.Be2 Bg7 10.0-0 0-0 11.Nbd2 Nxd2 12.Qxd2 Qa5!? 13.c3!? (13.Qxa5 Nxa5=) 13...e6∞\n\n<!-- FEN: r1bqkb1r/pp2pp1p/2n3p1/3pP3/4nP2/3BB3/PPP3PP/RN1QK1NR b KQkq - 1 8 -->\n8...Qa5+\n\n<!-- FEN: r1bqkb1r/pp2pp1p/2n3p1/3pP3/4nP2/3BB3/PPP3PP/RN1QK1NR b KQkq - 1 8 -->\n8...Bf5 9.Nf3 Bg7 10.0-0 0-0 11.Nbd2 Qc7=\n\n<!-- FEN: r1b1kb1r/pp2pp1p/2n3p1/q2pP3/4nP2/3BB3/PPP3PP/RN1QK1NR w KQkq - 2 9 -->\n9.c3 Bg7 10.Nf3\n\n10...f6!? 11.exf6?!\n\n<!-- FEN: r1b1k2r/pp2p1bp/2n2pp1/q2pP3/4nP2/2PBBN2/PP4PP/RN1QK2R w KQkq - 0 11 -->\n11.0-0!? 0-0 12.b4! Qc7 13.Qb3!± e.g. 13...e6 14.Bxe4! dxe4 15.exf6 Bxf6 16.Nfd2\n\n<!-- FEN: r1b1k2r/pp2p1bp/2n2Pp1/q2p4/4nP2/2PBBN2/PP4PP/RN1QK2R b KQkq - 0 11 -->\n11...Nxf6",
    1,
    "Page 18 7...d5 branch hierarchy",
  );

  corrected = replaceExactCount(
    corrected,
    "<!-- FEN: r3k2r/ppq1ppbp/6p1/1Q2n3/1P6/4BN2/P5PP/RN2K2R b KQkq - 1 16 -->\n13...Nxc3!!",
    "<!-- FEN: r3k2r/ppq1ppbp/2n3p1/4Pb2/1P2n3/2PBBN2/P1Q3PP/RN2K2R b KQkq - 4 13 -->\n13...Nxc3!!",
    1,
    "Page 18 13...Nxc3 continuation anchor",
  );

  // App Page 13 / printed Page 19: the 7.Nf3 d6! note has two White
  // eighth-move siblings, then returns to 8.Nc3 for 8...Bg7.
  corrected = replaceExactCount(
    corrected,
    "7.Nf3 d6! White has problems containing Black's activity.\n\n8.Nc3",
    "7.Nf3 d6! White has problems containing Black's activity.\n\n<!-- FEN: r1bqkb1r/pp2pp1p/2np2p1/4P2n/5P2/3Q1N2/PPP3PP/RNB1KB1R w KQkq - 0 8 -->\n8.Nc3",
    1,
    "Page 19 return to 8.Nc3",
  );

  corrected = replaceExactCount(
    corrected,
    "<!-- FEN: r1bqkb1r/pp2pp1p/2nP2p1/7n/5P2/3Q1N2/PPP3PP/RNB1KB1R b KQkq - 0 8 -->\n8.exd6",
    "<!-- FEN: r1bqkb1r/pp2pp1p/2np2p1/4P2n/5P2/3Q1N2/PPP3PP/RNB1KB1R w KQkq - 0 8 -->\n8.exd6",
    1,
    "Page 19 8.exd6 sibling anchor",
  );

  corrected = replaceExactCount(
    corrected,
    "<!-- FEN: r1bqkb1r/pp2pp1p/2np2p1/4P2n/5P2/2NQBN2/PPP3PP/R3KB1R b KQkq - 2 9 -->\n9.Be3?!",
    "<!-- FEN: r1bqk2r/pp2ppbp/2np2p1/4P2n/5P2/2NQ1N2/PPP3PP/R1B1KB1R w KQkq - 2 9 -->\n9.Be3?!",
    1,
    "Page 19 9.Be3 sibling anchor",
  );

  corrected = replaceExactCount(
    corrected,
    "<!-- FEN: r1bqk2r/pp2ppbp/2n3p1/7n/5P2/2NQ1N2/PPP3PP/R1B1KB1R b KQkq - 2 11 -->\n<!-- FEN: r3k2r/pp2qpbp/2n3p1/5b1n/5P2/2N1QN2/PPP3PP/R1B1KB1R b KQkq - 1 11 -->\n11...Qxe3+",
    "<!-- FEN: r3k2r/pp2qpbp/2n3p1/5b1n/5P2/2N1QN2/PPP3PP/R1B1KB1R b KQkq - 1 11 -->\n11...Qxe3+",
    1,
    "Page 19 11...Qxe3 sibling anchor",
  );

  corrected = replaceExactCount(
    corrected,
    "\n6.Qd3\n\n**FEN:**",
    "\n\n**FEN:**",
    1,
    "Page 19 duplicate E2 move",
  );

  // App Page 14 / printed Page 20: 9.Qb3 and 9.Qb5 are siblings after 8...Bf5.
  corrected = replaceExactCount(
    corrected,
    "<!-- FEN: r2qkb1r/pp2pp1p/2np2p1/4Pb1B/5P2/1Q6/PPP3PP/RNB1K1NR b KQkq - 2 9 -->\nAfter 9.Qb5",
    "<!-- FEN: r2qkb1r/pp2pp1p/2np2p1/4Pb1B/5P2/3Q4/PPP3PP/RNB1K1NR w KQkq - 1 9 -->\nAfter 9.Qb5",
    1,
    "Page 20 9.Qb5 sibling anchor",
  );

  // App Page 15 / printed Page 21: return from 9.bxc5? to the bold 9.Bb2! line.
  corrected = replaceExactCount(
    corrected,
    "<!-- FEN: rnbq1rk1/pp2ppbp/5np1/2P5/2P5/P4N2/3PBPPP/RNBQK2R b KQ - 0 9 -->\n9...b6!",
    "<!-- FEN: rnbq1rk1/pp2ppbp/5np1/2p5/1PP5/P4N2/1B1PBPPP/RN1QK2R b KQ - 2 9 -->\n9...b6!",
    1,
    "Page 21 return to 9.Bb2 main line",
  );

  corrected = replaceExactCount(
    corrected,
    "\n4.c3?!\n\n**FEN:**",
    "\n\n**FEN:**",
    1,
    "Page 21 duplicate F1 move",
  );

  // App Page 16 / printed Page 22: restore the PDF order. 5.g3 is the
  // fifth-move alternative; 6.Rb1 and 6.Bc4 are siblings of bold 6.Bb2!?N.
  corrected = replaceExactCount(
    corrected,
    "5.Nf3\n\n<!-- FEN: r1bqk1nr/p2pppbp/1pn3p1/2p5/1P2P3/P1N2N2/2PP1PPP/R1BQKB1R w KQkq - 2 6 -->\nOn 6.Rb1, holding on to the pawn, the best reply is: 6...Nf6! 7.bxc5 (7.b5 Nd4 8.e5 Nh5!∞ is fine for Black) 7...bxc5 8.Bb5!? (8.Bc4?! 0-0 9.0-0 d6+) 8...Nd4!? (8...0-0 9.Bxc6 dxc6 10.0-0 Bg4 11.Re1 Nd7 12.h3 Bxf3 13.Qxf3±) 9.e5 Ng4 10.Nxd4 cxd4 11.Qxg4 dxc3∞\n<!-- FEN: rnbqk1nr/p2pppbp/1p4p1/2p5/1P2P3/P1N5/2PP1PPP/R1BQKBNR w KQkq - 0 5 -->\nAfter 5.g3 Nc6 6.Rb1 e6! (6...d6 7.Bg2 e5 8.Nge2 Nge7 9.0-0 0-0 10.d3 Nd4 11.bxc5 bxc5 12.f4 Be6 13.f5! gxf5 14.exf5 Nexf5 15.Nxd4 cxd4 16.Bxa8 Qxa8 17.Ne4 is what White is hoping for) 7.Bg2 Nge7 8.Nge2 0-0 9.0-0 d5 Black may well be slightly better already.\n\n<!-- FEN: rnbqk1nr/p2pppbp/1p4p1/2p5/1P2P3/P1N2N2/2PP1PPP/R1BQKB1R b KQkq - 1 5 -->\n5...Nc6 6.Bb2!?N\n\nProbably the best way to sacrifice the b4-pawn.\n\n<!-- FEN: r1bqk1nr/p2pppbp/1pn3p1/2p5/1P2P3/P1N2N2/2PP1PPP/R1BQKB1R w KQkq - 2 6 -->\nAfter 6.Bc4",
    "5.Nf3\n\n<!-- FEN: rnbqk1nr/p2pppbp/1p4p1/2p5/1P2P3/P1N5/2PP1PPP/R1BQKBNR w KQkq - 0 5 -->\nAfter 5.g3 Nc6 6.Rb1 e6! (6...d6 7.Bg2 e5 8.Nge2 Nge7 9.0-0 0-0 10.d3 Nd4 11.bxc5 bxc5 12.f4 Be6 13.f5! gxf5 14.exf5 Nexf5 15.Nxd4 cxd4 16.Bxa8 Qxa8 17.Ne4 is what White is hoping for) 7.Bg2 Nge7 8.Nge2 0-0 9.0-0 d5 Black may well be slightly better already.\n\n<!-- FEN: rnbqk1nr/p2pppbp/1p4p1/2p5/1P2P3/P1N2N2/2PP1PPP/R1BQKB1R b KQkq - 1 5 -->\n5...Nc6 6.Bb2!?N\n\nProbably the best way to sacrifice the b4-pawn.\n\n<!-- FEN: r1bqk1nr/p2pppbp/1pn3p1/2p5/1P2P3/P1N2N2/2PP1PPP/R1BQKB1R w KQkq - 2 6 -->\nOn 6.Rb1, holding on to the pawn, the best reply is: 6...Nf6! 7.bxc5 (7.b5 Nd4 8.e5 Nh5!∞ is fine for Black) 7...bxc5 8.Bb5!? (8.Bc4?! 0-0 9.0-0 d6+) 8...Nd4!? (8...0-0 9.Bxc6 dxc6 10.0-0 Bg4 11.Re1 Nd7 12.h3 Bxf3 13.Qxf3±) 9.e5 Ng4 10.Nxd4 cxd4 11.Qxg4 dxc3∞\n\n<!-- FEN: r1bqk1nr/p2pppbp/1pn3p1/2p5/1P2P3/P1N2N2/2PP1PPP/R1BQKB1R w KQkq - 2 6 -->\nAfter 6.Bc4",
    1,
    "Page 22 fifth- and sixth-move hierarchy",
  );

  corrected = replaceExactCount(
    corrected,
    "\n4.Nc3!\n\n**FEN:**",
    "\n\n**FEN:**",
    1,
    "Page 22 duplicate F2 move",
  );

  // App Page 17 / printed Page 23: both Black sixth moves branch from 6.Bb2,
  // and the prose after 9...d6 must show the actual balanced position.
  corrected = replaceExactCount(
    corrected,
    "<!-- FEN: r1bqk1nr/p2pppbp/1pn3p1/2p5/1PB1P3/P1N3P1/2PP1P1P/R1BQK1NR b KQkq - 2 6 -->\n6...e5!",
    "<!-- FEN: r1bqk1nr/p2pppbp/1pn3p1/2p5/1P2P3/P1N2N2/1BPP1PPP/R2QKB1R b KQkq - 3 6 -->\n6...e5!",
    1,
    "Page 23 6...e5 main-line anchor",
  );

  corrected = replaceExactCount(
    corrected,
    "<!-- FEN: r1bqk1nr/p2pppbp/1pn3p1/2p5/1PB1P3/P1N3P1/2PP1P1P/R1BQK1NR b KQkq - 2 6 -->\n6...cxb4",
    "<!-- FEN: r1bqk1nr/p2pppbp/1pn3p1/2p5/1P2P3/P1N2N2/1BPP1PPP/R2QKB1R b KQkq - 3 6 -->\n6...cxb4",
    1,
    "Page 23 6...cxb4 sibling anchor",
  );

  corrected = replaceExactCount(
    corrected,
    "<!-- FEN: r1bqk1nr/p2p1pbp/1pn1p1p1/2p5/1PB1P3/P1N3P1/2PP1P1P/1RBQK1NR b Kkq - 1 7 -->\nThe computers are happy to be White here",
    "<!-- FEN: r1bq1rk1/p3npbp/1pnp2p1/2pNp3/1PB1P3/P4N2/1BPP1PPP/R2Q1RK1 w - - 0 10 -->\nThe computers are happy to be White here",
    1,
    "Page 23 post-9...d6 explanatory anchor",
  );

  const required = [
    "r1bqkb1r/pp2pp1p/2n3p1/3pP3/4nP2/4B3/PPP3PP/RN1QKBNR w KQkq d6 0 8",
    "r3k2r/ppq1ppbp/2n3p1/4Pb2/1P2n3/2PBBN2/P1Q3PP/RN2K2R b KQkq - 4 13",
    "r1bqkb1r/pp2pp1p/2np2p1/4P2n/5P2/3Q1N2/PPP3PP/RNB1KB1R w KQkq - 0 8",
    "r1bqk2r/pp2ppbp/2np2p1/4P2n/5P2/2NQ1N2/PPP3PP/R1B1KB1R w KQkq - 2 9",
    "r2qkb1r/pp2pp1p/2np2p1/4Pb1B/5P2/3Q4/PPP3PP/RNB1K1NR w KQkq - 1 9",
    "rnbq1rk1/pp2ppbp/5np1/2p5/1PP5/P4N2/1B1PBPPP/RN1QK2R b KQ - 2 9",
    "r1bqk1nr/p2pppbp/1pn3p1/2p5/1P2P3/P1N2N2/1BPP1PPP/R2QKB1R b KQkq - 3 6",
    "r1bq1rk1/p3npbp/1pnp2p1/2pNp3/1PB1P3/P4N2/1BPP1PPP/R2Q1RK1 w - - 0 10",
  ];
  for (const expected of required) {
    if (!corrected.includes(expected)) {
      throw new Error(`Chapter 1 app-page 12-17 correction failed to produce: ${expected}`);
    }
  }

  const forbidden = [
    "r3k2r/ppq1ppbp/6p1/1Q2n3/1P6/4BN2/P5PP/RN2K2R b KQkq - 1 16",
    "r1bqkb1r/pp2pp1p/2nP2p1/7n/5P2/3Q1N2/PPP3PP/RNB1KB1R b KQkq - 0 8",
    "r1bqkb1r/pp2pp1p/2np2p1/4P2n/5P2/2NQBN2/PPP3PP/R3KB1R b KQkq - 2 9",
    "r2qkb1r/pp2pp1p/2np2p1/4Pb1B/5P2/1Q6/PPP3PP/RNB1K1NR b KQkq - 2 9 -->\nAfter 9.Qb5",
    "rnbq1rk1/pp2ppbp/5np1/2P5/2P5/P4N2/3PBPPP/RNBQK2R b KQ - 0 9 -->\n9...b6!",
    "r1bqk1nr/p2pppbp/1pn3p1/2p5/1PB1P3/P1N3P1/2PP1P1P/R1BQK1NR b KQkq - 2 6",
  ];
  for (const rejected of forbidden) {
    if (corrected.includes(rejected)) {
      throw new Error(`Chapter 1 app-page 12-17 correction left stale anchor: ${rejected}`);
    }
  }

  return corrected;
}
