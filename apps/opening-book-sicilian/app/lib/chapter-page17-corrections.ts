const PAGE_17_START = "## Page 17";
const PAGE_18_START = "## Page 18";

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

export function applyChapterPage17Corrections(filename: string, content: string): string {
  if (filename !== "chapter-1-sicilian.md") return content;

  const page17Start = content.indexOf(PAGE_17_START);
  const page18Start = content.indexOf(PAGE_18_START, page17Start);
  if (page17Start < 0 || page18Start < 0) {
    throw new Error("Chapter 1 must contain Page 17 and Page 18 boundaries.");
  }

  let page17 = content.slice(page17Start, page18Start);

  page17 = replaceExactlyOnce(
    page17,
    "18.Rfb1! White should have enough to maintain approximate equality.",
    "18.Rfb1!\n\nWhite should have enough to maintain approximate equality.",
    "Page 17 opening hierarchy",
  );

  page17 = replaceExactlyOnce(
    page17,
    "Weaker is instead 11.exd6?! Bxc3+ 12.bxc3 Qa5!.",
    "Weaker is instead 11.exd6?! Bxc3+ 12.bxc3 Qa5!∓.",
    "Page 17 11.exd6 evaluation",
  );

  page17 = replaceExactlyOnce(
    page17,
    "11.Qd2!? might be tenable. I consider the following line to be best for Black: 11...Bg4! 12.Be2 (12.exd6?! Bxc3! 13.Qxc3 Qxd6 14.Ne5 Nxe5 15.fxe5 Qb6+) 12...dxe5 13.Nxe5 (13.Qxd8 Rfxd8 14.Nxe5 Bxe2 15.Kxe2 Nd4+) 13...Qxd2+ 14.Bxd2 Bxe5 15.fxe5 (15.Bxe5? Nxe5 16.fxe5 Bxe2 17.Kxe2 Rac8 18.c3 Rc5-+) 15...Rfd8+ 16.Bd3 Bf5 17.Ke3 Bxd3 18.cxd3 Rd5 19.Ke4 Rad8 20.Rhd1 Kg7+ Black has good chances to press in the ending.",
    "11.Qd2!? might be tenable. I consider the following line to best for Black: 11...Bg4! 12.Be2 (12.exd6?! Bxc3! 13.Qxc3 Qxd6 14.Ne5 Nxe5 15.fxe5 Qb6∓) 12...dxe5 13.Nxe5 (13.Qxd8 Rfxd8 14.Nxe5 Bxe2 15.Kxe2 Nd4+∓) 13...Qxd2+ 14.Kxd2\n\n14...Bxe5! 15.fxe5 (15.Bxe5? Nxe5 16.fxe5 Bxe2 17.Kxe2 Rac8 18.c3 Rc5-+) 15...Rfd8+ 16.Bd3 Bf5 17.Ke3 Bxd3 18.cxd3 Rd5 19.Ke4 Rad8 20.Rhd1 Kg7∓\n\nBlack has good chances to press in the ending in view of his superior minor piece.",
    "Page 17 11.Qd2 analysis",
  );

  page17 = replaceExactlyOnce(
    page17,
    "15.Qe2! was a better try, but after 15...Qa4!? Black maintains a nagging edge.",
    "15.Qe2! was a better try, but after 15...Qa4!?∓ Black maintains a nagging edge.",
    "Page 17 15...Qa4 evaluation",
  );

  page17 = replaceExactlyOnce(
    page17,
    "19.Qd2 Rb8 20.Rd4 e6 21.Qxb6 axb6+ Black has good chances to press in the ending in view of his superior minor piece.",
    "19.Qd2 Rb8 20.Qd4 e6 21.Qxb6 axb6∓",
    "Page 17 final continuation",
  );

  page17 = replaceExactlyOnce(
    page17,
    "\nThe ending was slightly better for Black due to his central mass, Salmensuu - Hillarp Persson, Reykjavik 2000.\n",
    "\n",
    "Page 17 misplaced ending sentence",
  );

  const required = [
    "18.Rfb1!\n\nWhite should have enough to maintain approximate equality.",
    "8...Bg7 9.Bc3 d6 10.Nf3 0-0",
    "11.exd6?! Bxc3+ 12.bxc3 Qa5!∓",
    "I consider the following line to best for Black:",
    "13...Qxd2+ 14.Kxd2",
    "14...Bxe5!",
    "20.Rhd1 Kg7∓",
    "13.0-0-0 Bh6!",
    "15...Qa4!?∓",
    "20.Qd4 e6 21.Qxb6 axb6∓",
  ];
  for (const expected of required) {
    if (!page17.includes(expected)) {
      throw new Error(`Page 17 correction failed to produce: ${expected}`);
    }
  }

  const forbidden = [
    "9.c3 d6",
    "Qa5!.",
    "line to be best for Black",
    "14.Bxd2 Bxe5",
    "Qb6+)",
    "Nd4+)",
    "Kg7+ Black",
    "13.0-0-0 h6!",
    "15...Qa4!? Black",
    "20.Rd4 e6",
    "axb6+ Black",
    "Salmensuu - Hillarp Persson",
  ];
  for (const rejected of forbidden) {
    if (page17.includes(rejected)) {
      throw new Error(`Page 17 correction left forbidden text: ${rejected}`);
    }
  }

  let page18AndAfter = content.slice(page18Start);
  page18AndAfter = replaceExactlyOnce(
    page18AndAfter,
    "## Page 18\n\n",
    "## Page 18\n\nThe ending was slightly better for Black due to his central mass, Salmensuu – Hillarp Persson, Reykjavik 2000.\n\n",
    "Page 18 opening continuation",
  );

  if (!page18AndAfter.startsWith(
    "## Page 18\n\nThe ending was slightly better for Black due to his central mass, Salmensuu – Hillarp Persson, Reykjavik 2000.",
  )) {
    throw new Error("Page 18 must begin with the Salmensuu – Hillarp Persson ending sentence.");
  }

  return `${content.slice(0, page17Start)}${page17}${page18AndAfter}`;
}
