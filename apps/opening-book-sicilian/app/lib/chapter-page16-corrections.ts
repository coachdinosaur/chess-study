const PAGE_16_START = "## Page 16";
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

export function applyChapterPage16Corrections(filename: string, content: string): string {
  if (filename !== "chapter-1-sicilian.md") return content;

  const page16Start = content.indexOf(PAGE_16_START);
  const page18Start = content.indexOf(PAGE_18_START, page16Start);
  if (page16Start < 0 || page18Start < 0) {
    throw new Error("Chapter 1 must contain Page 16 and Page 18 boundaries.");
  }

  let page16And17 = content.slice(page16Start, page18Start);

  page16And17 = replaceExactlyOnce(
    page16And17,
    "\n6.Qd1\n\n**FEN:**",
    "\n\n**FEN:**",
    "Page 16 duplicate E1 move",
  );

  page16And17 = replaceExactlyOnce(
    page16And17,
    "8...Nc5 9.Be3 Be6 (9...Bg4!?; 9...Qb6 10.Qb5!±)",
    "8...Nc5 9.Be3 Ne6 (9...Bg4!?; 9...Qb6 10.Qb5!±)",
    "Page 16 9.Be3 continuation",
  );

  page16And17 = replaceExactlyOnce(
    page16And17,
    "\n7.Nd2\n\nThe attempt to exchange the knight leaves the queenside a bit bare, for example:",
    "\nThe attempt to exchange the knight leaves the queenside a bit bare, for example:",
    "Page 16 duplicate E11 move",
  );

  page16And17 = replaceExactlyOnce(
    page16And17,
    "8.Qxd2!N is relatively best.",
    "8.Qxd2!N\n\nThis is relatively best.",
    "Page 16 8.Qxd2 hierarchy",
  );

  page16And17 = replaceExactlyOnce(
    page16And17,
    "11.Qe3 Be6! leaves White terribly exposed",
    "11.Qe3 Be6!∓ leaves White terribly exposed",
    "Page 16 11.Qe3 evaluation",
  );

  page16And17 = replaceExactlyOnce(
    page16And17,
    "12.c3!?\n\n## Page 17\n\nWhite might hold after",
    "12.c3!?\n\nWhite might hold after",
    "Page 16 premature Page 17 boundary",
  );

  page16And17 = replaceExactlyOnce(
    page16And17,
    "12...exd6 13.Qe3! Qa5 14.0-0 d5 15.Bb3 Be6 16.Qf2! (16.Bd2?! Qb5) 16...Qb5 17.Be3 a5! Black has excellent counterplay in the IQP position that has arisen, but White has an accurate reply: 18.Rfb1! White should have enough to maintain approximate equality.",
    "12...exd6 13.Qe3! Qa5 14.0-0 d5 15.Bb3 Be6 16.Qf2!\n\n16.Bd2?! Qb5∓\n\n16...Qb5 17.Be3 a5!\n\nBlack has excellent counterplay in the IQP position that has arisen, but White has an accurate reply:\n\n## Page 17\n\n18.Rfb1! White should have enough to maintain approximate equality.",
    "Page 16 final variation and Page 17 boundary",
  );

  const page17Start = page16And17.indexOf("## Page 17");
  if (page17Start < 0) {
    throw new Error("Page 16 correction failed to restore the Page 17 boundary.");
  }
  const page16 = page16And17.slice(0, page17Start);
  const page17 = page16And17.slice(page17Start);

  const required = [
    "8...Nc5 9.Be3 Ne6",
    "10.Qb5!±",
    "8.Qxd2!N\n\nThis is relatively best.",
    "11.Qe3 Be6!∓",
    "12.Nf3 Bf5!↑",
    "18.Kf2 Bxb4",
    "20.Kf1 Nd4∓",
    "16.Bd2?! Qb5∓",
    "Black has excellent counterplay in the IQP position that has arisen, but White has an accurate reply:",
  ];
  for (const expected of required) {
    if (!page16.includes(expected)) {
      throw new Error(`Page 16 correction failed to produce: ${expected}`);
    }
  }

  const forbidden = [
    "\n6.Qd1\n\n**FEN:**",
    "9.Be3 Be6",
    "\n7.Nd2\n\nThe attempt",
    "8.Qxd2!N is relatively best.",
    "11.Qe3 Be6! leaves",
    "16.Bd2?! Qb5)",
    "18.Rfb1! White should have enough",
  ];
  for (const rejected of forbidden) {
    if (page16.includes(rejected)) {
      throw new Error(`Page 16 correction left forbidden text: ${rejected}`);
    }
  }

  if (!page17.startsWith("## Page 17\n\n18.Rfb1! White should have enough to maintain approximate equality.")) {
    throw new Error("Page 17 must begin with 18.Rfb1! and its continuation.");
  }

  return `${content.slice(0, page16Start)}${page16And17}${content.slice(page18Start)}`;
}
