const PAGE_10_START = "## Page 10";
const PAGE_11_START = "## Page 11";
const PAGE_13_START = "## Page 13";
const PAGE_14_START = "## Page 14";
const PAGE_15_START = "## Page 15";

function replaceExactlyOnce(
  content: string,
  before: string,
  after: string,
  label: string,
): string {
  const first = content.indexOf(before);
  if (first < 0) {
    throw new Error(`Missing expected ${label} source text.`);
  }
  if (content.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Expected exactly one ${label} source text occurrence.`);
  }
  return `${content.slice(0, first)}${after}${content.slice(first + before.length)}`;
}

export function applyChapterContentCorrections(filename: string, content: string): string {
  if (filename !== "chapter-1-sicilian.md") return content;

  const page10Start = content.indexOf(PAGE_10_START);
  const page11Start = content.indexOf(PAGE_11_START, page10Start);
  const page13Start = content.indexOf(PAGE_13_START, page11Start);
  const page14Start = content.indexOf(PAGE_14_START, page13Start);
  const page15Start = content.indexOf(PAGE_15_START, page14Start);
  if (page10Start < 0 || page11Start < 0 || page13Start < 0 || page14Start < 0 || page15Start < 0) {
    throw new Error("Chapter 1 must contain Page 10, Page 11, and Page 13 through Page 15 boundaries.");
  }

  let page10 = content.slice(page10Start, page11Start);
  let page13 = content.slice(page13Start, page14Start);
  let page14 = content.slice(page14Start, page15Start);

  page10 = replaceExactlyOnce(
    page10,
    "<!-- FEN: r1bqkbnr/pp1ppppp/2n5/2p5/2P1P3/5N2/PP1P1PPP/RNBQKB1R b KQkq - 2 3 -->\n3...Nf6!",
    "**FEN:**\n`r1bqkbnr/pp1ppppp/2n5/2p5/2P1P3/8/PP1PNPPP/RNBQKB1R b KQkq - 2 3`\n\n3...Nf6!",
    "Page 10 main 3...Nf6 diagram",
  );

  page10 = replaceExactlyOnce(
    page10,
    "7.e5?! led to a quick disaster for White after: 7...Ng4! 8.f4? (8.h3 cxd4 9.Nxd4 Ngxe5 10.Bf4∓ had to be preferred, although it is clear that White is struggling a pawn down.) 8...cxd4 9.Nxd4 Bc5! 10.Bb5 0-0! 11.Nxc6 bxc6 12.Bxc6 Qb6! 13.Bxa8 Bf2+ 14.Ke2 Nxe5 (14...Bh4!N-+ would have been cleaner.) 15.Kf1? (Better was 15.Qd2, although Black would still gain a sizeable advantage after: 15...Nc4! 16.Qxd5 Re8+ 17.Ne4 Nd6! 18.Qxd6 Qxd6 19.Kxf2 Qb6+ 20.Be3 Qxb2+ 21.Nd2 Rxe3 22.Kxe3 Qc3+ 23.Kf2 Qxd2+ 24.Kf3 Qc3+ 25.Kf2 g5!∓) 15...Ba6+ 16.Ne2 Bh4 17.g3 Ng4 18.Kg2 Qf2+ 19.Kh3 Bxe2 20.Qxd5 Bf6 21.Qg2 Re8 22.Qxf2 Nxf2+ 23.Kg2 Nxh1 24.Bc6 Re6 25.Ba4 Bd4 0-1 Tukhvatullin – Karpeshov, Sterlitamak 2011.",
    "7.e5?!\n\nThis led to a quick disaster for White after:\n\n7...Ng4! 8.f4?\n\n<!-- FEN: r1bqkb1r/pp3ppp/2n5/2ppP3/3P2n1/2N5/PP2NPPP/R1BQKB1R w KQkq - 1 8 -->\n8.h3 cxd4 9.Nxd4 Ngxe5 10.Bf4∓ had to be preferred, although it is clear that White is struggling a pawn down.\n\n<!-- FEN: r1bqkb1r/pp3ppp/2n5/2ppP3/3P1Pn1/2N5/PP2N1PP/R1BQKB1R b KQkq - 0 8 -->\n8...cxd4 9.Nxd4 Bc5! 10.Bb5 0-0! 11.Nxc6 bxc6 12.Bxc6 Qb6! 13.Bxa8 Bf2+ 14.Ke2 Nxe5\n\n14...Bh4!N-+ would have been cleaner.\n\n15.Kf1?\n\nBetter was 15.Qd2, although Black would still gain a sizeable advantage after: 15...Nc4! 16.Qxd5 Re8+ 17.Ne4 Nd6! 18.Qxd6 Qxd6 19.Kxf2 Qb6+ 20.Be3 Qxb2+ 21.Nd2 Rxe3 22.Kxe3 Qc3+ 23.Kf2 Qxd2+ 24.Kf3 Qc3+ 25.Kf2 g5!∓\n\n**FEN:**\n`B1b2rk1/p4ppp/1q6/3pn3/5P2/2N5/PP3bPP/R1BQ1K1R b - - 1 15`\n\n15...Ba6+ 16.Ne2 Bh4 17.g3 Ng4 18.Kg2 Qf2+ 19.Kh3 Bxe2 20.Qxd5 Bf6 21.Qg2 Re8 22.Qxf2 Nxf2+ 23.Kg2 Nxh1 24.Bc6 Re6 25.Ba4 Bd4\n\n0–1 Tukhvatullin – Karpeshov, Sterlitamak 2011.",
    "Page 10 tactical line, diagram, and paragraph hierarchy",
  );

  const page10Required = [
    "`r1bqkbnr/pp1ppppp/2n5/2p5/2P1P3/8/PP1PNPPP/RNBQKB1R b KQkq - 2 3`",
    "<!-- FEN: r1bqkb1r/pp3ppp/2n5/2ppP3/3P2n1/2N5/PP2NPPP/R1BQKB1R w KQkq - 1 8 -->",
    "<!-- FEN: r1bqkb1r/pp3ppp/2n5/2ppP3/3P1Pn1/2N5/PP2N1PP/R1BQKB1R b KQkq - 0 8 -->",
    "`B1b2rk1/p4ppp/1q6/3pn3/5P2/2N5/PP3bPP/R1BQ1K1R b - - 1 15`",
    "`r1bqk2r/pp2bppp/2n2n2/2pp2B1/3PP3/2N5/PP2NPPP/R2QKB1R w KQkq - 2 8`",
    "0–1 Tukhvatullin – Karpeshov, Sterlitamak 2011.",
    "8.exd5 Nxd5 9.Bxe7 Ncxe7 10.dxc5 0-0",
  ];
  for (const expected of page10Required) {
    if (!page10.includes(expected)) {
      throw new Error(`Page 10 correction failed to produce: ${expected}`);
    }
  }

  const page10Forbidden = [
    "r1bqkbnr/pp1ppppp/2n5/2p5/2P1P3/5N2/PP1P1PPP/RNBQKB1R b KQkq - 2 3",
    "PP4PP/R1BQ1K1R b - - 1 15",
    "0-1 Tukhvatullin – Karpeshov",
    "7.e5?! led to a quick disaster",
  ];
  for (const rejected of page10Forbidden) {
    if (page10.includes(rejected)) {
      throw new Error(`Page 10 correction left forbidden text: ${rejected}`);
    }
  }

  page13 = replaceExactlyOnce(
    page13,
    "\n\n3...e5!?\n\nThis logical approach has been tried",
    "\n\n<!-- FEN: r1bqkbnr/pp1ppppp/2n5/1Bp5/4P3/N7/PPPP1PPP/R1BQK1NR b KQkq - 3 3 -->\n3...e5!?\n\nThis logical approach has been tried",
    "Page 13 3...e5 navigation anchor",
  );

  if (!page13.includes("<!-- FEN: r1bqkbnr/pp1ppppp/2n5/1Bp5/4P3/N7/PPPP1PPP/R1BQK1NR b KQkq - 3 3 -->\n3...e5!?")) {
    throw new Error("Page 13 correction failed to anchor 3...e5!?.");
  }

  page14 = replaceExactlyOnce(
    page14,
    "4.Bxc6 dxc6 5.Nc4 (5.Nf3 b5!? 6.d3 Bd6 7.Nb1 h6 8.a4 Be6 is in no way better for White as Black will transfer his knight to d7, defending everything.) 5...f6 6.Qe2 Qc7 7.a4 Be7 8.Nf3 Bd6 gives Black the perfect Rossolimo set-up.",
    "4.Bxc6 dxc6 5.Nc4 (5.Nf3 b5!? 6.d3 Bd6 7.Nb1 h6 8.a4 Be6 is in no way better for White as Black will transfer his knight to d7, defending everything.) 5...Be6 6.Qe2 Qc7 7.a4 Ne7 8.Nf3 f6= gives Black the perfect Rossolimo set-up.",
    "Page 14 Rossolimo line",
  );

  page14 = replaceExactlyOnce(
    page14,
    "6...a6?! 7.Ba5 Qd7 8.Nb6 Qc7 9.Ba4! is not the kind of bind we'd like to fall into.",
    "6...a6?! 7.Ba5 Qd7 8.Nb6 Qc7 9.a4! is not the kind of bind we'd like to fall into.",
    "Page 14 6...a6 variation",
  );

  page14 = replaceExactlyOnce(
    page14,
    "9...Be6 10.Bc4 h6 11.Nd5 Qd7 12.a4 Nd8=, planning ...Ne7, is also quite good.",
    "9...Be6 10.Bc4 h6 11.Nd5 Qd7 12.a4 Bd8=, planning ...Nce7, is also quite good.",
    "Page 14 9...Be6 variation",
  );

  page14 = replaceExactlyOnce(
    page14,
    "\n10.Nc4\n",
    "\n10.Bc4\n",
    "Page 14 main move 10.Bc4",
  );

  page14 = replaceExactlyOnce(
    page14,
    "\nD2) 3.Nf3\n<!-- FEN: r1bqkbnr/pp1ppppp/2n5/2p5/4P3/N7/PPPP1PPP/R1BQKBNR w KQkq - 2 3 -->\n3.Nf3\n",
    "\nD2) 3.Nf3\n<!-- FEN: r1bqkbnr/pp1ppppp/2n5/2p5/4P3/N7/PPPP1PPP/R1BQKBNR w KQkq - 2 3 -->\n",
    "Page 14 duplicate D2 move",
  );

  page14 = replaceExactlyOnce(
    page14,
    "Gallinnis - Kabatianski, Germany 2007.",
    "Gallinnis – Kabatianski, Germany 2007.",
    "Page 14 game name",
  );

  page14 = replaceExactlyOnce(
    page14,
    "<!-- FEN: r1bqkb1r/pp1ppppp/2n2n2/2p5/4P3/N2P1N2/PPP2PPP/R1BQKB1R b KQkq - 0 4 -->\n4...Ng4 5.Qe2 f6!?",
    "<!-- FEN: r1bqkb1r/pp1ppppp/2n2n2/2p1P3/8/N4N2/PPPP1PPP/R1BQKB1R b KQkq - 0 4 -->\n4...Ng4 5.Qe2 f6!?",
    "Page 14 4...Ng4 continuation anchor",
  );

  page14 = replaceExactlyOnce(
    page14,
    "4...Ng4 5.Qe2 f6!?\n\n**FEN:**\n`r1bqkb1r/pp1pp1pp/2n2p2/2p1P3/6n1/N4N2/PPPPQPPP/R1B1KB1R w KQkq - 0 6`\n\nA drastic solution - and a good one it seems.",
    "4...Ng4 5.Qe2\n\nThe correspondence player Hynes has been the chief exponent of this position as White, but he barely managed to scrape half a point out of his last two encounters with it.\n\n5...f6!?\n\n**FEN:**\n`r1bqkb1r/pp1pp1pp/2n2p2/2p1P3/6n1/N4N2/PPPPQPPP/R1B1KB1R w KQkq - 0 6`\n\nA drastic solution – and a good one it seems.",
    "Page 14 Hynes paragraph and 5...f6 hierarchy",
  );

  const required = [
    "5...Be6 6.Qe2 Qc7 7.a4 Ne7 8.Nf3 f6=",
    "9.a4! is not the kind of bind",
    "12.a4 Bd8=, planning ...Nce7",
    "\n10.Bc4\n",
    "Gallinnis – Kabatianski",
    "<!-- FEN: r1bqkb1r/pp1ppppp/2n2n2/2p1P3/8/N4N2/PPPP1PPP/R1BQKB1R b KQkq - 0 4 -->\n4...Ng4 5.Qe2",
    "The correspondence player Hynes has been the chief exponent",
    "\n5...f6!?\n",
    "A drastic solution – and a good one it seems.",
  ];
  for (const expected of required) {
    if (!page14.includes(expected)) {
      throw new Error(`Page 14 correction failed to produce: ${expected}`);
    }
  }

  const forbidden = [
    "5...f6 6.Qe2 Qc7 7.a4 Be7 8.Nf3 Bd6",
    "9.Ba4!",
    "12.a4 Nd8=",
    "planning ...Ne7",
    "\n10.Nc4\n",
    "\n3.Nf3\n\n**FEN:**",
    "Gallinnis - Kabatianski",
    "<!-- FEN: r1bqkb1r/pp1ppppp/2n2n2/2p5/4P3/N2P1N2/PPP2PPP/R1BQKB1R b KQkq - 0 4 -->\n4...Ng4",
    "4...Ng4 5.Qe2 f6!?",
    "A drastic solution - and a good one it seems.",
  ];
  for (const rejected of forbidden) {
    if (page14.includes(rejected)) {
      throw new Error(`Page 14 correction left forbidden text: ${rejected}`);
    }
  }

  return `${content.slice(0, page10Start)}${page10}${content.slice(page11Start, page13Start)}${page13}${page14}${content.slice(page15Start)}`;
}
