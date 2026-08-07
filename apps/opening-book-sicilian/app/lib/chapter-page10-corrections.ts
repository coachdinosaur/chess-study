const PAGE_10_START = "## Page 10";
const PAGE_11_START = "## Page 11";
const PAGE_12_START = "## Page 12";

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

export function applyChapterPage10Corrections(filename: string, content: string): string {
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

  const page10Start = content.indexOf(PAGE_10_START);
  const page11Start = content.indexOf(PAGE_11_START, page10Start);
  const page12Start = content.indexOf(PAGE_12_START, page11Start);
  if (page10Start < 0 || page11Start < 0 || page12Start < 0) {
    throw new Error("Chapter 1 must contain Page 10 through Page 12 boundaries.");
  }

  let page10 = content.slice(page10Start, page11Start);
  let page11 = content.slice(page11Start, page12Start);

  page10 = replaceExactlyOnce(
    page10,
    "<!-- FEN: r1bqkbnr/pp1ppppp/2n5/2p5/2P1P3/5N2/PP1P1PPP/RNBQKB1R b KQkq - 2 3 -->\n3...Nf6!",
    "**FEN:**\n`r1bqkbnr/pp1ppppp/2n5/2p5/2P1P3/8/PP1PNPPP/RNBQKB1R b KQkq - 2 3`\n\n3...Nf6!",
    "Page 10 main 3...Nf6 diagram",
  );

  page10 = replaceExactlyOnce(
    page10,
    "7.e5?! led to a quick disaster for White after: 7...Ng4! 8.f4? (8.h3 cxd4 9.Nxd4 Ngxe5 10.Bf4∓ had to be preferred, although it is clear that White is struggling a pawn down.) 8...cxd4 9.Nxd4 Bc5! 10.Bb5 0-0! 11.Nxc6 bxc6 12.Bxc6 Qb6! 13.Bxa8 Bf2+ 14.Ke2 Nxe5 (14...Bh4!N-+ would have been cleaner.) 15.Kf1? (Better was 15.Qd2, although Black would still gain a sizeable advantage after: 15...Nc4! 16.Qxd5 Re8+ 17.Ne4 Nd6! 18.Qxd6 Qxd6 19.Kxf2 Qb6+ 20.Be3 Qxb2+ 21.Nd2 Rxe3 22.Kxe3 Qc3+ 23.Kf2 Qxd2+ 24.Kf3 Qc3+ 25.Kf2 g5!∓) 15...Ba6+ 16.Ne2 Bh4 17.g3 Ng4 18.Kg2 Qf2+ 19.Kh3 Bxe2 20.Qxd5 Bf6 21.Qg2 Re8 22.Qxf2 Nxf2+ 23.Kg2 Nxh1 24.Bc6 Re6 25.Ba4 Bd4 0-1 Tukhvatullin – Karpeshov, Sterlitamak 2011.",
    "7.e5?!\n\nThis led to a quick disaster for White after:\n\n7...Ng4! 8.f4?\n\n<!-- FEN: r1bqkb1r/pp3ppp/2n5/2ppP3/3P2n1/2N5/PP2NPPP/R1BQKB1R w KQkq - 1 8 -->\n8.h3 cxd4 9.Nxd4 Ngxe5 10.Bf4∓ had to be preferred, although it is clear that White is struggling a pawn down.\n\n<!-- FEN: r1bqkb1r/pp3ppp/2n5/2ppP3/3P1Pn1/2N5/PP2N1PP/R1BQKB1R b KQkq - 0 8 -->\n8...cxd4 9.Nxd4 Bc5! 10.Bb5 0-0! 11.Nxc6 bxc6 12.Bxc6 Qb6! 13.Bxa8 Bf2+ 14.Ke2 Nxe5\n\n<!-- FEN: B1b2rk1/p4ppp/1q6/3pP3/5Pn1/2N5/PP2KbPP/R1BQ3R b - - 2 14 -->\n14...Bh4!N-+ would have been cleaner.\n\n<!-- FEN: B1b2rk1/p4ppp/1q6/3pn3/5P2/2N5/PP2KbPP/R1BQ3R w - - 0 15 -->\n15.Kf1?\n\n<!-- FEN: B1b2rk1/p4ppp/1q6/3pn3/5P2/2N5/PP2KbPP/R1BQ3R w - - 0 15 -->\nBetter was 15.Qd2, although Black would still gain a sizeable advantage after: 15...Nc4! 16.Qxd5 Re8+ 17.Ne4 Nd6! 18.Qxd6 Qxd6 19.Kxf2 Qb6+ 20.Be3 Qxb2+ 21.Nd2 Rxe3 22.Kxe3 Qc3+ 23.Kf2 Qxd2+ 24.Kf3 Qc3+ 25.Kf2 g5!∓\n\n**FEN:**\n`B1b2rk1/p4ppp/1q6/3pn3/5P2/2N5/PP3bPP/R1BQ1K1R b - - 1 15`\n\n15...Ba6+ 16.Ne2 Bh4 17.g3 Ng4 18.Kg2 Qf2+ 19.Kh3 Bxe2 20.Qxd5 Bf6 21.Qg2 Re8 22.Qxf2 Nxf2+ 23.Kg2 Nxh1 24.Bc6 Re6 25.Ba4 Bd4\n\n0–1 Tukhvatullin – Karpeshov, Sterlitamak 2011.",
    "Page 10 tactical hierarchy and branch anchors",
  );

  page10 = replaceExactlyOnce(
    page10,
    "<!-- FEN: r1bqkb1r/pp3ppp/2n2n2/2ppP3/3P4/2N2N2/PP3PPP/R1BQKB1R b KQkq - 0 7 -->\n7...Be7!\n\n**FEN:**\n`r1bqk2r/pp2bppp/2n2n2/2pp2B1/3PP3/2N5/PP2NPPP/R2QKB1R w KQkq - 2 8`\n\nAfter this simple reply, it is rather White who is playing for equality. I think he can achieve it by:\n\n8.Bxf6!?\n\n<!-- FEN: r1bqk2r/pp2bppp/2n2n2/2pp2B1/3PP3/2N5/PP2NPPP/R2QKB1R w KQkq - 2 8 -->\n8.exd5 Nxd5 9.Bxe7 Ncxe7 10.dxc5 0-0",
    "**FEN:**\n`r1bqkb1r/pp3ppp/2n2n2/2pp2B1/3PP3/2N5/PP2NPPP/R1BQKB1R b KQkq - 1 7`\n\n7...Be7!\n\nAfter this simple reply, it is rather White who is playing for equality. I think he can achieve it by:\n\n8.Bxf6!?\n\n<!-- FEN: r1bqk2r/pp2bppp/2n2n2/2pp2B1/3PP3/2N5/PP2NPPP/R1BQKB1R w KQkq - 2 8 -->\n8.exd5 Nxd5 9.Bxe7 Ncxe7 10.dxc5 0-0",
    "Page 10 7...Be7 diagram placement and alternatives",
  );

  page11 = replaceExactlyOnce(
    page11,
    "\n8...Bxf6 9.dxc5 d4 10.Nd5 0-0\n",
    "\n<!-- FEN: r1bqk2r/pp2bppp/2n2B2/2pp4/3PP3/2N5/PP2NPPP/R1BQKB1R b KQkq - 0 8 -->\n8...Bxf6 9.dxc5 d4 10.Nd5 0-0\n",
    "Page 11 return to 8.Bxf6 main line",
  );

  const requiredPage10 = [
    "`r1bqkbnr/pp1ppppp/2n5/2p5/2P1P3/8/PP1PNPPP/RNBQKB1R b KQkq - 2 3`",
    "<!-- FEN: r1bqkb1r/pp3ppp/2n2n2/2pp4/3PP3/2N5/PP2NPPP/R1BQKB1R w KQkq - 0 7 -->",
    "<!-- FEN: r1bqkb1r/pp3ppp/2n5/2ppP3/3P2n1/2N5/PP2NPPP/R1BQKB1R w KQkq - 1 8 -->",
    "<!-- FEN: r1bqkb1r/pp3ppp/2n5/2ppP3/3P1Pn1/2N5/PP2N1PP/R1BQKB1R b KQkq - 0 8 -->",
    "<!-- FEN: B1b2rk1/p4ppp/1q6/3pP3/5Pn1/2N5/PP2KbPP/R1BQ3R b - - 2 14 -->",
    "<!-- FEN: B1b2rk1/p4ppp/1q6/3pn3/5P2/2N5/PP2KbPP/R1BQ3R w - - 0 15 -->",
    "`B1b2rk1/p4ppp/1q6/3pn3/5P2/2N5/PP3bPP/R1BQ1K1R b - - 1 15`",
    "`r1bqkb1r/pp3ppp/2n2n2/2pp2B1/3PP3/2N5/PP2NPPP/R1BQKB1R b KQkq - 1 7`",
    "<!-- FEN: r1bqk2r/pp2bppp/2n2n2/2pp2B1/3PP3/2N5/PP2NPPP/R1BQKB1R w KQkq - 2 8 -->",
    "0–1 Tukhvatullin – Karpeshov, Sterlitamak 2011.",
  ];
  for (const expected of requiredPage10) {
    if (!page10.includes(expected)) {
      throw new Error(`Page 10 correction failed to produce: ${expected}`);
    }
  }

  const forbiddenPage10 = [
    "r1bqkbnr/pp1ppppp/2n5/2p5/2P1P3/5N2/PP1P1PPP/RNBQKB1R b KQkq - 2 3",
    "r1bqkb1r/pp3ppp/2n2n2/2ppP3/3P4/2N2N2/PP3PPP/R1BQKB1R b KQkq - 0 7",
    "R2QKB1R w KQkq - 2 8",
    "PP4PP/R1BQ1K1R b - - 1 15",
    "0-1 Tukhvatullin – Karpeshov",
    "7.e5?! led to a quick disaster",
  ];
  for (const rejected of forbiddenPage10) {
    if (page10.includes(rejected)) {
      throw new Error(`Page 10 correction left forbidden text: ${rejected}`);
    }
  }

  if (!page11.includes("<!-- FEN: r1bqk2r/pp2bppp/2n2B2/2pp4/3PP3/2N5/PP2NPPP/R1BQKB1R b KQkq - 0 8 -->\n8...Bxf6")) {
    throw new Error("Page 11 correction failed to restore the 8.Bxf6 main line.");
  }

  return `${content.slice(0, page10Start)}${page10}${page11}${content.slice(page12Start)}`;
}
