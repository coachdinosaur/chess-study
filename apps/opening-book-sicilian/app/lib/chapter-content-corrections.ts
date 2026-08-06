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

  const page13Start = content.indexOf(PAGE_13_START);
  const page14Start = content.indexOf(PAGE_14_START, page13Start);
  const page15Start = content.indexOf(PAGE_15_START, page14Start);
  if (page13Start < 0 || page14Start < 0 || page15Start < 0) {
    throw new Error("Chapter 1 must contain Page 13 through Page 15 boundaries.");
  }

  let page13 = content.slice(page13Start, page14Start);
  let page14 = content.slice(page14Start, page15Start);

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
    "4...Ng4 5.Qe2 f6!?",
    "A drastic solution - and a good one it seems.",
  ];
  for (const rejected of forbidden) {
    if (page14.includes(rejected)) {
      throw new Error(`Page 14 correction left forbidden text: ${rejected}`);
    }
  }

  return `${content.slice(0, page13Start)}${page13}${page14}${content.slice(page15Start)}`;
}
