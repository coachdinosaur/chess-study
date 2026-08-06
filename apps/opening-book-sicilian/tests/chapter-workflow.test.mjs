import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { auditChapterMarkdown } from "../scripts/chapter-audit.ts";
import { SOURCE_MOVE_TOKEN, normalizeSan } from "../app/lib/chess-notation.ts";
import { MarkdownMoveResolver } from "../app/lib/markdown-moves.ts";
import { catalogSource, discoverChapters, parseChapterMarkdown } from "../scripts/chapter-system.mjs";

const chapterUrl = new URL("../app/content/chapters/chapter-1-sicilian.md", import.meta.url);

async function readChapterOne() {
  return readFile(chapterUrl, "utf8");
}

function page(markdown, number) {
  const start = markdown.indexOf(`## Page ${number}`);
  assert.notEqual(start, -1, `Missing Page ${number}`);
  const end = markdown.indexOf(`## Page ${number + 1}`, start);
  return markdown.slice(start, end < 0 ? markdown.length : end);
}

function plain(markdown) {
  return markdown
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/\*\*|\*/g, "")
    .replace(/`/g, "")
    .replace(/\[(?:\d+)(?:,\s*\d+)*\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function requireAll(text, required, label) {
  for (const item of required) {
    assert.ok(text.includes(item), `Missing ${label} content: ${item}`);
  }
}

function rejectAll(text, forbidden, label) {
  for (const item of forbidden) {
    assert.ok(!text.includes(item), `Found incorrect ${label} content: ${item}`);
  }
}

test("discovers one contiguous Markdown catalog", async () => {
  const chapters = await discoverChapters();
  assert.deepEqual(chapters.map((chapter) => chapter.id), [1]);
  assert.ok(chapters.every((chapter) => chapter.pageCount > 0));
  assert.ok(chapters.every((chapter) => chapter.visibleFenCount > 0));
  const catalog = catalogSource(chapters);
  assert.match(catalog, /CHAPTER_IDS = \["1"\]/);
  assert.doesNotMatch(catalog, /chapter-packages|manifest|pdfjs|sourcePdf/);
});

test("Chapter 1 preserves the PDF page range 7 through 23", async () => {
  const markdown = await readChapterOne();
  const pageNumbers = [...markdown.matchAll(/^## Page (\d+)\s*$/gm)].map((match) => Number(match[1]));
  assert.deepEqual(pageNumbers, Array.from({ length: 17 }, (_, index) => index + 7));
  const chapter = parseChapterMarkdown("chapter-1-sicilian.md", markdown);
  assert.equal(chapter.pageCount, 17);
  const audit = auditChapterMarkdown(markdown, { chapter: 1, expectedPages: 17, expectedFirstPage: 7 });
  assert.deepEqual(audit.errors, []);
});

test("Chapter 1 keeps printed PDF pages intact instead of splitting columns", async () => {
  const markdown = await readChapterOne();
  assert.doesNotMatch(page(markdown, 12), /16\.Rd5/);
  assert.match(page(markdown, 13), /16\.Rd5[\s\S]*16\.\.\.Qe6=/);
  assert.match(page(markdown, 13), /D1\) 3\.Bb5/);
  assert.doesNotMatch(page(markdown, 13), /4\.Bxc6 dxc6/);
  assert.match(page(markdown, 14), /4\.Bxc6 dxc6/);
  assert.match(page(markdown, 14), /D2\) 3\.Nf3/);
});

test("Chapter 1 Page 7 matches the PDF variation hierarchy", async () => {
  const markdown = await readChapterOne();
  const text = plain(page(markdown, 7));
  requireAll(text, [
    "D) 2.Na3 Nc6 (page 13)",
    "D1) 3.Bb5 (page 13)",
    "D2) 3.Nf3 (page 14)",
    "E1) 6.Qd1 Ne4!? (page 16)",
    "E11) 7.Nd2 (page 16)",
    "E12) 7.Be3 (page 18)",
  ], "Page 7");
  assert.ok(text.indexOf("D) 2.Na3 Nc6") < text.indexOf("D1) 3.Bb5"));
  assert.ok(text.indexOf("D1) 3.Bb5") < text.indexOf("D2) 3.Nf3"));
  rejectAll(text, ["D1) 2...Nc6 3.Bb5", "Version:"], "Page 7");
});

test("printed PDF Pages 8 through 13 retain their synchronized content", async () => {
  const markdown = await readChapterOne();
  const p8 = plain(page(markdown, 8));
  requireAll(p8, [
    "2.Be2 is likely to transpose elsewhere",
    "3...Nf6 4.e5 Nd5 enters the c3 Sicilian",
    "7.Qe2 [7.Na3 e5!]",
    "9.0-0 Rg8!→",
    "15.Be2 Re8∓",
    "9.Bc2 b4∓",
    "20.Na3 Bc3⇆",
    "Quaddy – Neapus",
    "Osipov – Rimkus",
    "Bersamina – Kantans",
    "Rasik – Smirin",
  ], "Page 8");
  rejectAll(p8, ["1.e4 c5 2.Bc4", "20.Na3 Nc3∞", "10...a5"], "Page 8");
  assert.ok(p8.endsWith("10.Bh4"));

  const p9 = plain(page(markdown, 9));
  requireAll(p9, [
    "12.Bxe7 Nxe7∓",
    "8.Bb3 0-0∓",
    "12.Bb3 d5⇆",
    "12...Qc7N∓",
    "13.Be3 Rab8∓",
    "16.Nxd4 cxd4∓",
  ], "Page 9");
  rejectAll(p9, ["12.Bxe7 Qxe7", "8.Bb3 0-0+", "12.Bb3 d5∓", "1.e4 c5 2.c4", "much for White"], "Page 9");
  assert.ok(p9.endsWith("Black's attack eventually proved too"));

  const p10 = plain(page(markdown, 10));
  requireAll(p10, [
    "much for White in Karacsony – S. Petkov, corr. 2012.",
    "10.Bf4∓ had to be preferred",
    "14...Bh4!N-+",
    "25.Kf2 g5!∓",
    "Tukhvatullin – Karpeshov, Sterlitamak 2011",
  ], "Page 10");
  rejectAll(p10, ["10.f4+", "25.Kf2 g5!+", "Tukhvatullin - Karpeshov", "leaves the white king too exposed"], "Page 10");
  assert.ok(p10.endsWith("8.exd5 Nxd5 9.Bxe7 Ncxe7 10.dxc5 0-0"));

  const p11 = plain(page(markdown, 11));
  requireAll(p11, [
    "16.Bf3 Qg6∓",
    "16.N2c3 Eminov – Yilmazyerli",
    "20.f3 Nd4!∓",
    "14...Qxc6 15.0-0 a5 16.Rc1 Qd6∓",
    "15...f5!?∞",
    "14.Rad1 Qa5+",
    "19.Nef4=",
    "C) 2.Ne2",
    "a g3 Dragon or a Closed Sicilian with ...e6",
  ], "Page 11");
  rejectAll(p11, ["16.Bf3 Qg6+", "16.Rc1 Qd6+", "14.Rb1 Qa5+", "1.e4 c5 2.Ne2", "That's it! Usually this pawn thrust"], "Page 11");
  assert.ok(p11.endsWith("2...Nf6!? 3.Nbc3 d5!"));

  const p12 = plain(page(markdown, 12));
  requireAll(p12, [
    "5...e6∓",
    "5...h5∓",
    "Nxf4!∓",
    "11.0-0 Be7⇆",
    "13.Qxa6 (13.Qg2 g6 14.0-0 Bg7 15.Bxa6 0-0 16.Bd3 Qc8∞) 13...Nf3+",
    "19.Bd4 f6=",
    "Hou Yifan – Ju Wenjun",
    "12.Rd1 Qc8",
    "15.Rxd8+ Qxd8",
  ], "Page 12");
  rejectAll(p12, ["11.0-0 Be7∓", "Hou Yifan - Ju Wenjun", "12.Rd1 Qe8", "22.Rd2="], "Page 12");
  assert.ok(p12.endsWith("22.Rd2±"));

  const raw13 = page(markdown, 13);
  const p13 = plain(raw13);
  requireAll(p13, [
    "16.Rd5",
    "16.Rd2 Ne5=",
    "16...Qe6=",
    "D) 2.Na3",
    "D1) 3.Bb5",
    "D2) 3.Nf3",
    "3...e5!?",
    "4.d3!N",
    "Saule – Jemec, email 2006",
    "4...Nge7!N",
    "9.Bf1 Be7∓",
    "10.a4 Be6∓ The position is simply excellent for Black.",
  ], "Page 13");
  rejectAll(p13, ["1.e4 c5 2.Na3", "Saule - Jemec", "4...Nge7!?N", "4.Bxc6 dxc6"], "Page 13");
  assert.doesNotMatch(raw13, /16\.Rd5 \(16\.Rd2/);
  assert.match(raw13, /\*\*16\.Rd5\*\*[\s\S]*\*\*16\.Rd2 Ne5=\*\*[\s\S]*\*\*16\.\.\.Qe6=\*\*/);
});

test("canonical Markdown contains the synchronized Pages 14 through 17", async () => {
  const markdown = await readChapterOne();
  const p14 = plain(page(markdown, 14));
  const p15 = plain(page(markdown, 15));
  const p16 = plain(page(markdown, 16));
  const p17 = plain(page(markdown, 17));

  requireAll(p14, [
    "5...Be6 6.Qe2 Qc7 7.a4 Ne7 8.Nf3 f6=",
    "6...a6?! 7.Ba5 Qd7 8.Nb6 Qc7 9.a4!",
    "12.a4 Bd8=, planning ...Nce7",
    "10.Bc4",
    "Gallinnis – Kabatianski",
    "The correspondence player Hynes has been the chief exponent",
    "A drastic solution – and a good one it seems.",
  ], "Page 14");
  rejectAll(p14, ["9.Ba4!", "12.a4 Nd8=", "planning ...Ne7", "Gallinnis - Kabatianski", "4...Ng4 5.Qe2 f6!?"], "Page 14");

  requireAll(p15, [
    "17.0-0 Rb8⇆",
    "Hynes – Isigkeit",
    "23.Bb2 Ra5!",
    "28.Rfb1!? must be an improvement.",
    "29.Bf1 Rhh5!",
    "33.g3 Qf5→",
    "Hynes – Benlloch Guirau",
  ], "Page 15");
  rejectAll(p15, ["Rb8∞", "23.Kh2", "29.Rf1", "Qf5-+", "Hynes - Isigkeit", "1.e4 c5 2.f4"], "Page 15");

  requireAll(p16, [
    "9.Be3 Ne6",
    "10.Qb5!±",
    "8.Qxd2!N This is relatively best.",
    "11.Qe3 Be6!∓",
    "12.Nf3 Bf5!↑",
    "18.Kf2 Bxb4",
    "20.Kf1 Nd4∓",
    "16.Bd2?! Qb5∓",
  ], "Page 16");
  rejectAll(p16, ["9.Be3 Be6", "8.Qxd2!N is relatively best.", "11.Qe3 Be6! leaves", "18.Rfb1! White should have enough"], "Page 16");

  requireAll(p17, [
    "18.Rfb1! White should have enough to maintain approximate equality.",
    "8...Bg7 9.Bc3 d6 10.Nf3 0-0",
    "16.N2c3",
    "13.0-0-0 Bh6!",
    "14...Bxe5!",
    "20.Rhd1 Kg7∓",
    "20.Qd4 e6",
    "21.Qxb6 axb6∓",
  ], "Page 17");
  rejectAll(p17, ["9.c3 d6", "13.0-0-0 h6!", "14.Bxd2", "20.Rd4 e6", "Salmensuu – Hillarp Persson"], "Page 17");

  assert.ok(plain(page(markdown, 18)).startsWith("## Page 18 The ending was slightly better for Black due to his central mass, Salmensuu – Hillarp Persson"));
});

test("evaluation and positional glyphs remain attached to move buttons", () => {
  const source = "5...e6∓, Rg8!→, Bc3⇆, and Rc8≡.";
  const displays = [...source.matchAll(SOURCE_MOVE_TOKEN)].map((match) => match[0]);
  assert.deepEqual(displays, ["5...e6∓", "Rg8!→", "Bc3⇆", "Rc8≡"]);
  assert.equal(normalizeSan("5...e6∓"), "e6");
  assert.equal(normalizeSan("Rg8!→"), "Rg8");
  assert.equal(normalizeSan("Bc3⇆"), "Bc3");
  assert.equal(normalizeSan("Rc8≡"), "Rc8");
});

test("move recovery handles bad anchors, look-ahead, and semicolon siblings", () => {
  const anchored = new MarkdownMoveResolver();
  anchored.resolveText("1.e4 c5 2.Bc4 e6 3.Qe2");
  anchored.setAnchor("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "Imported anchor");
  const recovered = anchored.resolveText("3...Nc6 4.Nf3 Nge7 5.Bb3");
  assert.ok(recovered.every((token) => token.navigation));

  const pageThree = new MarkdownMoveResolver();
  pageThree.setAnchor("r1bqkb1r/pp1pnppp/2n1p3/2p5/2B1P3/5N2/PPPPQPPP/RNB1K2R w KQkq - 4 5", "Printed page 9 variation");
  const firstLine = pageThree.resolveText("5.d3 Ng6 6.h4!? (6.0-0 Be7 7.c3 d5 8.Bb3 0-0+) 6...Bd6! 7.Nbd2 h6 8.h5 Nge5 9.Nxe5 Bxe5 10.Nf3 Bb8!? 11.c3 0-0 12.Bb3 d5");
  assert.ok(firstLine.every((token) => token.navigation));

  const correctedPdfLine = new MarkdownMoveResolver();
  const secondLine = correctedPdfLine.resolveText("1.e4 c5 2.c4 Nc6 3.Nf3 e5 4.Nc3 d6 5.d3 (5.g3 g6 6.Bg2 Bg7 7.0-0 Nge7 8.d3 0-0 9.Ng5 f6 10.Nh3 Be6 11.f4 Qd7 12.Nf2 Nd4 13.Be3 Rab8+) 5...f5!? 6.exf5 Bxf5 7.h3?! Qd7 8.Be2 Nf6 9.Nh2?! 9...Nd4 10.Bg5 0-0-0! 11.0-0 h6 12.Bxf6 gxf6 13.Kh1?!");
  assert.ok(secondLine.every((token) => token.navigation));

  const siblings = new MarkdownMoveResolver();
  const siblingTokens = siblings.resolveText("1.e4 (1.d4 d5; 1.c4 e5)");
  assert.ok(siblingTokens.every((token) => token.navigation));
});

test("comma-separated parenthetical alternatives return to the shared anchor", () => {
  const resolver = new MarkdownMoveResolver();
  const anchor = "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPPNPPP/RNBQKB1R b KQkq - 1 2";
  resolver.setAnchor(anchor, "After 2.Ne2");
  const tokens = resolver.resolveText("White can choose between (2...Nc6 3.d4), while (2...d6 3.Nbc3 Nf6 4.g3 with 4...e6).");
  const byDisplay = (display) => tokens.find((token) => token.display === display);
  for (const display of ["2...Nc6", "3.d4", "2...d6", "3.Nbc3", "Nf6", "4.g3", "4...e6"]) {
    assert.ok(byDisplay(display)?.navigation, `${display} should be navigable.`);
  }
  assert.deepEqual(byDisplay("3.d4").navigation.steps.slice(0, 3).map((step) => step.label), ["After 2.Ne2", "2...Nc6", "3.d4"]);
  assert.deepEqual(byDisplay("4...e6").navigation.steps.slice(0, 6).map((step) => step.label), ["After 2.Ne2", "2...d6", "3.Nbc3", "Nf6", "4.g3", "4...e6"]);
  assert.equal(byDisplay("2...d6").navigation.steps[0].fen, anchor);
});

test("move navigation survives PDF page and parenthesis boundaries", () => {
  const pages = new MarkdownMoveResolver();
  const beforeBreak = pages.resolveText("1.e4 c5 2.Bc4 e6 3.Qe2 Nc6 4.c3 Be7 5.Bb3 d5 6.d3 Nf6 7.Nf3 0-0 8.0-0 b5 9.Bg5 h6 10.Bh4");
  const afterBreak = pages.resolveText("10...a5!? 11.e5 Nd7 12.Bxe7 Qxe7");
  assert.ok(beforeBreak.every((token) => token.navigation));
  assert.ok(afterBreak.every((token) => token.navigation));

  const branch = new MarkdownMoveResolver();
  const branchStart = branch.resolveText("1.e4 c5 (1...e5");
  const branchEnd = branch.resolveText("2.Nf3 Nc6)");
  assert.ok(branchStart.every((token) => token.navigation));
  assert.ok(branchEnd.every((token) => token.navigation));
});

test("the Markdown contract rejects missing pages and invalid FENs", () => {
  assert.throws(() => parseChapterMarkdown("chapter-1-sicilian.md", "# Chapter 1\n\n**FEN:**\n`bad`\n"), /Page/);
  assert.throws(() => parseChapterMarkdown("chapter-1-sicilian.md", "# Chapter 1\n\n## Page 1\n\n**FEN:**\n`bad`\n"), /invalid FEN/);
  assert.throws(() => parseChapterMarkdown("chapter-1-sicilian.md", "# Chapter 1\n\n## Page 1\n## Page 3\n\n**FEN:**\n`8\/8\/8\/8\/8\/8\/4k3\/4K3 w - - 0 1`\n"), /contiguous/);
  assert.throws(() => parseChapterMarkdown("chapter-1-sicilian.md", "# Chapter 1\n\n## Page 1\n\nA&nbsp;B\n\n**FEN:**\n`8\/8\/8\/8\/8\/8\/4k3\/4K3 w - - 0 1`\n"), /non-breaking space/);
  assert.throws(() => parseChapterMarkdown("chapter-1-sicilian.md", "# Chapter 1\n\n## Page 1\n\nA\u00a0B\n\n**FEN:**\n`8\/8\/8\/8\/8\/8\/4k3\/4K3 w - - 0 1`\n"), /non-breaking space/);
});

test("Chapter 1 retains explanatory lesson prose on content pages", async () => {
  const markdown = await readChapterOne();
  for (let number = 8; number <= 23; number += 1) {
    const lines = page(markdown, number).split(/\r?\n/);
    const prose = lines.filter((line) => {
      const clean = plain(line);
      return /^[A-Z][^#`<!]*[a-z]{3}/.test(clean) && !/^Page \d+$/.test(clean);
    });
    assert.ok(prose.length > 0, `Page ${number} has no explanatory prose.`);
  }
});

test("package scripts expose the Markdown chapter workflow and read-only audit", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.deepEqual(Object.keys(packageJson.scripts).filter((name) => name.startsWith("chapters:")), ["chapters:status", "chapters:sync", "chapters:check", "chapters:audit"]);
  assert.match(packageJson.scripts["chapters:audit"], /chapter-audit\.ts/);
  assert.match(packageJson.scripts.test, /--import tsx --test/);
  assert.equal(packageJson.dependencies["pdfjs-dist"], undefined);
});
