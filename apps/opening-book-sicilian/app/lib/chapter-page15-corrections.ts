const PAGE_15_START = "## Page 15";
const PAGE_16_START = "## Page 16";

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

export function applyChapterPage15Corrections(filename: string, content: string): string {
  if (filename !== "chapter-1-sicilian.md") return content;

  const page15Start = content.indexOf(PAGE_15_START);
  const page16Start = content.indexOf(PAGE_16_START, page15Start);
  if (page15Start < 0 || page16Start < 0) {
    throw new Error("Chapter 1 must contain Page 15 and Page 16 boundaries.");
  }

  let page15 = content.slice(page15Start, page16Start);

  page15 = replaceExactlyOnce(
    page15,
    "17.0-0 Rb8∞ was double-edged in Hynes - Isigkeit, corr. 2008.",
    "17.0-0 Rb8⇆ was double-edged in Hynes – Isigkeit, corr. 2008.",
    "Page 15 Rb8 evaluation and game name",
  );

  page15 = replaceExactlyOnce(
    page15,
    "28...h3! 29.Bf1 Rhh5! 30.Reb1 Bf5 31.R1b2 Be4 32.Rb6 Qd7 33.g3 Qf5-+",
    "28...h3! 29.Bf1 Rhh5! 30.Reb1 Bf5 31.R1b2 Be4 32.Rb6 Qd7 33.g3 Qf5→",
    "Page 15 final evaluation",
  );

  page15 = replaceExactlyOnce(
    page15,
    "Hynes - Benlloch Guirau, corr. 2008.",
    "Hynes – Benlloch Guirau, corr. 2008.",
    "Page 15 second game name",
  );

  page15 = replaceExactlyOnce(
    page15,
    "\nE) 2.f4\n1.e4 c5 2.f4\n",
    "\nE) 2.f4\n",
    "Page 15 duplicate opening line",
  );

  const required = [
    "17.0-0 Rb8⇆",
    "Hynes – Isigkeit",
    "23.Bb2 Ra5!",
    "28.Rfb1!? must be an improvement.",
    "29.Bf1 Rhh5!",
    "33.g3 Qf5→",
    "Hynes – Benlloch Guirau",
    "\nE) 2.f4\n",
    "after 2...Nc6?! 3.Nf3 g6 4.Bb5",
    "Black declares his intention of transposing into lines analysed under 2.Nc3.",
  ];
  for (const expected of required) {
    if (!page15.includes(expected)) {
      throw new Error(`Page 15 correction failed to produce: ${expected}`);
    }
  }

  const forbidden = [
    "Rb8∞",
    "23.Kh2",
    "29.Rf1",
    "Qf5-+",
    "Hynes - Isigkeit",
    "Hynes - Benlloch Guirau",
    "\n1.e4 c5 2.f4\n",
    "\n3.d4!?\n",
  ];
  for (const rejected of forbidden) {
    if (page15.includes(rejected)) {
      throw new Error(`Page 15 correction left forbidden text: ${rejected}`);
    }
  }

  return `${content.slice(0, page15Start)}${page15}${content.slice(page16Start)}`;
}
