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

export function applyChapterPages9To11AnchorCorrections(filename: string, content: string): string {
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
    "17.0-0 Rb8⇆ was double-edged in Hynes – Isigkeit, corr. 2008.\n\n6.Nc4 Ngxe5",
    "17.0-0 Rb8⇆ was double-edged in Hynes – Isigkeit, corr. 2008.\n\n<!-- FEN: r1bqkb1r/pp1pp1pp/2n2p2/2p1P3/6n1/N4N2/PPPPQPPP/R1B1KB1R w KQkq - 0 6 -->\n6.Nc4 Ngxe5",
    1,
    "Page 15 return to the 5...f6 main line",
  );

  corrected = replaceExactCount(
    corrected,
    "This looks dubious.\n\n9.Nxc6!",
    "This looks dubious.\n\n<!-- FEN: r1bqkb1r/pp1pp2p/2n3p1/2p1N3/8/8/PPPPQPPP/R1B1KB1R w KQkq - 0 9 -->\n9.Nxc6!",
    1,
    "Page 15 9.Nxc6 alternative anchor",
  );

  corrected = replaceExactCount(
    corrected,
    "where it is safely defended.\n\n9...Nd4!",
    "where it is safely defended.\n\n<!-- FEN: r1bqkb1r/pp1pp2p/2n3p1/2p1N3/8/4Q3/PPPP1PPP/R1B1KB1R b KQkq - 1 9 -->\n9...Nd4!",
    1,
    "Page 15 return to 9.Qe3",
  );

  corrected = replaceExactCount(
    corrected,
    "<!-- FEN: rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2 -->\nBlack declares his intention of transposing into lines analysed under 2.Nc3.",
    "<!-- FEN: rnbqkbnr/pp1ppp1p/6p1/2p5/4PP2/8/PPPP2PP/RNBQKBNR w KQkq - 0 3 -->\nBlack declares his intention of transposing into lines analysed under 2.Nc3.",
    1,
    "Page 15 post-2...g6 explanatory anchor",
  );

  corrected = replaceExactCount(
    corrected,
    "12.c3!?\n\nWhite might hold after 12.d7",
    "12.c3!?\n\n<!-- FEN: r1b2rk1/pp2ppbp/1qnP2p1/8/2B2P2/5N2/PPPQ2PP/R1B1K2R w KQ - 5 12 -->\nWhite might hold after 12.d7",
    1,
    "Page 16 12.d7 alternative anchor",
  );

  corrected = replaceExactCount(
    corrected,
    "16.Qf2!\n\n16.Bd2?! Qb5∓\n\n16...Qb5",
    "16.Qf2!\n\n<!-- FEN: r4rk1/pp3pbp/2n1b1p1/q2p4/5P2/1BP1QN2/PP4PP/R1B2RK1 w - - 2 16 -->\n16.Bd2?! Qb5∓\n\n<!-- FEN: r4rk1/pp3pbp/2n1b1p1/q2p4/5P2/1BP2N2/PP3QPP/R1B2RK1 b - - 3 16 -->\n16...Qb5",
    1,
    "Page 16 16th-move sibling anchors",
  );

  corrected = replaceExactCount(
    corrected,
    "## Page 17\n\n18.Rfb1!",
    "## Page 17\n\n<!-- FEN: r4rk1/1p3pbp/2n1b1p1/pq1p4/5P2/1BP1BN2/PP3QPP/R4RK1 w - - 0 18 -->\n18.Rfb1!",
    1,
    "Page 17 opening continuation anchor",
  );

  corrected = replaceExactCount(
    corrected,
    "<!-- FEN: r1bqkb1r/pp1ppp1p/2n3p1/4P3/5P2/8/PPPQ2PP/R1B1KBNR b KQkq - 0 8 -->\n8...Bg7",
    "<!-- FEN: r1bqkb1r/pp1ppp1p/2n3p1/4P3/5P2/8/PPPB2PP/R2QKBNR b KQkq - 0 8 -->\n8...Bg7",
    1,
    "Page 17 return to 8.Bxd2",
  );

  corrected = replaceExactCount(
    corrected,
    "<!-- FEN: 3r1rk1/pp2ppbp/2n3p1/8/2B2PQ1/5N2/PqPB2PP/1R2K2R b K - 1 16 -->\nWhite is having difficulty maintaining control over e5",
    "<!-- FEN: r1bq1rk1/pp2ppbp/2np2p1/4P3/5P2/2B2N2/PPP3PP/R2QKB1R w KQ - 2 11 -->\nWhite is having difficulty maintaining control over e5",
    1,
    "Page 17 post-10...0-0 explanatory anchor",
  );

  corrected = replaceExactCount(
    corrected,
    "<!-- FEN: r1bq1rk1/pp2ppbp/2nP2p1/8/5P2/2P2N2/PP1Q2PP/R1B1KB1R b KQ - 0 11 -->\n11...Qb6",
    "<!-- FEN: r1bq1rk1/pp2ppbp/2np2p1/1B2P3/5P2/2B2N2/PPP3PP/R2QK2R b KQ - 3 11 -->\n11...Qb6",
    1,
    "Page 17 return to 11.Bb5",
  );

  corrected = replaceExactCount(
    corrected,
    "Instead, 13.0-0-0 Bh6! costs White a precious pawn for little compensation.\n\n13...bxc6",
    "Instead, 13.0-0-0 Bh6! costs White a precious pawn for little compensation.\n\n<!-- FEN: r4rk1/pp2ppbp/1qBp2p1/4P3/5Pb1/2B2N2/PPP1Q1PP/R3K2R b KQ - 0 13 -->\n13...bxc6",
    1,
    "Page 17 return to 13.Bxc6",
  );

  corrected = replaceExactCount(
    corrected,
    "<!-- FEN: r4rk1/p3ppbp/q1pp2p1/4P3/5Pb1/2P2N2/PP1B1QPP/R3K2R w KQ - 2 15 -->\n15.Qe3",
    "<!-- FEN: r4rk1/p3ppbp/q1pp2p1/4P3/5Pb1/2B2N2/PPP2QPP/R3K2R w KQ - 2 15 -->\n15.Qe3",
    1,
    "Page 17 15.Qe3 main-line anchor",
  );

  corrected = replaceExactCount(
    corrected,
    "<!-- FEN: r4rk1/p3ppbp/q1pp2p1/4P3/5Pb1/2P1QN2/PP1B2PP/R3K2R b KQ - 3 15 -->\n15...Bxf3",
    "<!-- FEN: r4rk1/p3ppbp/q1pp2p1/4P3/5Pb1/2B1QN2/PPP3PP/R3K2R b KQ - 3 15 -->\n15...Bxf3",
    1,
    "Page 17 return to 15.Qe3",
  );

  const required = [
    "r1bqkb1r/pp1pp1pp/2n2p2/2p1P3/6n1/N4N2/PPPPQPPP/R1B1KB1R w KQkq - 0 6",
    "r1bqkb1r/pp1pp2p/2n3p1/2p1N3/8/8/PPPPQPPP/R1B1KB1R w KQkq - 0 9",
    "r1bqkb1r/pp1pp2p/2n3p1/2p1N3/8/4Q3/PPPP1PPP/R1B1KB1R b KQkq - 1 9",
    "r1b2rk1/pp2ppbp/1qnP2p1/8/2B2P2/5N2/PPPQ2PP/R1B1K2R w KQ - 5 12",
    "r4rk1/pp3pbp/2n1b1p1/q2p4/5P2/1BP1QN2/PP4PP/R1B2RK1 w - - 2 16",
    "r4rk1/1p3pbp/2n1b1p1/pq1p4/5P2/1BP1BN2/PP3QPP/R4RK1 w - - 0 18",
    "r1bqkb1r/pp1ppp1p/2n3p1/4P3/5P2/8/PPPB2PP/R2QKBNR b KQkq - 0 8",
    "r1bq1rk1/pp2ppbp/2np2p1/1B2P3/5P2/2B2N2/PPP3PP/R2QK2R b KQ - 3 11",
    "r4rk1/pp2ppbp/1qBp2p1/4P3/5Pb1/2B2N2/PPP1Q1PP/R3K2R b KQ - 0 13",
    "r4rk1/p3ppbp/q1pp2p1/4P3/5Pb1/2B1QN2/PPP3PP/R3K2R b KQ - 3 15",
  ];
  for (const expected of required) {
    if (!corrected.includes(expected)) {
      throw new Error(`Chapter 1 Pages 9-11 anchor correction failed to produce: ${expected}`);
    }
  }

  const forbiddenContexts = [
    "corr. 2008.\n\n6.Nc4 Ngxe5",
    "This looks dubious.\n\n9.Nxc6!",
    "safely defended.\n\n9...Nd4!",
    "12.c3!?\n\nWhite might hold after 12.d7",
    "16.Qf2!\n\n16.Bd2?!",
    "## Page 17\n\n18.Rfb1!",
    "PPPQ2PP/R1B1KBNR b KQkq - 0 8 -->\n8...Bg7",
    "2P2N2/PP1B1QPP/R3K2R w KQ - 2 15 -->\n15.Qe3",
    "2P1QN2/PP1B2PP/R3K2R b KQ - 3 15 -->\n15...Bxf3",
  ];
  for (const rejected of forbiddenContexts) {
    if (corrected.includes(rejected)) {
      throw new Error(`Chapter 1 Pages 9-11 anchor correction left stale context: ${rejected}`);
    }
  }

  return corrected;
}
