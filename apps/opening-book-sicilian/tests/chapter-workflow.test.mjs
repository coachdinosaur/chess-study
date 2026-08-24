import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { auditChapterMarkdown } from "../scripts/chapter-audit.ts";
import { SOURCE_MOVE_TOKEN, normalizeSan, resolveChessMove } from "../app/lib/chess-notation.ts";
import { MarkdownMoveResolver } from "../app/lib/markdown-moves.ts";
import { addPage, catalogSource, createChapter, discoverChapters, parseChapterMarkdown } from "../scripts/chapter-system.mjs";

const chapterUrl = new URL("../app/content/chapters/chapter-1-sicilian.md", import.meta.url);

async function readChapterOne() {
  return readFile(chapterUrl, "utf8");
}

test("discovers the contiguous Markdown chapter catalog", async () => {
  const chapters = await discoverChapters();
  assert.deepEqual(chapters.map((chapter) => chapter.id), [1, 2, 3, 4, 5, 6, 7]);
  assert.ok(chapters.every((chapter) => chapter.pageCount > 0));
  assert.ok(chapters.every((chapter) => chapter.visibleFenCount > 0));
  const catalog = catalogSource(chapters);
  assert.match(catalog, /CHAPTER_IDS = \["1", "2", "3", "4", "5", "6", "7"\]/);
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
  const page = (number) => {
    const start = markdown.indexOf(`## Page ${number}`);
    const end = markdown.indexOf(`## Page ${number + 1}`, start);
    return markdown.slice(start, end < 0 ? markdown.length : end);
  };

  assert.doesNotMatch(page(12), /16\.Rd5/);
  assert.match(page(13), /16\.Rd5[\s\S]*16\.\.\.Qe6=/);
  assert.match(page(13), /D1\) 3\.Bb5/);
  assert.doesNotMatch(page(13), /4\.Bxc6 dxc6/);
  assert.match(page(14), /4\.Bxc6 dxc6/);
  assert.match(page(14), /D2\) 3\.Nf3/);
});

test("Chapter 1 Page 7 matches the PDF variation hierarchy", async () => {
  const markdown = await readChapterOne();
  const start = markdown.indexOf("## Page 7");
  const end = markdown.indexOf("## Page 8", start);
  const pageSeven = markdown.slice(start, end);

  assert.match(pageSeven, /D\) 2\.Na3 Nc6 \(page 13\)[\s\S]*D1\) 3\.Bb5 \(page 13\)[\s\S]*D2\) 3\.Nf3 \(page 14\)/);
  assert.doesNotMatch(pageSeven, /D\) 2\.Na3 \(page 13\)[\s\S]*D1\) 2\.\.\.Nc6 3\.Bb5/);
  assert.doesNotMatch(pageSeven, /Version:/);
});

test("Chapter 1 retains PDF-corrected moves and source references", async () => {
  const markdown = await readChapterOne();
  assert.match(markdown, /2\.Be2 is likely to transpose elsewhere/);
  assert.match(markdown, /Bersamina – Kantans, Pune 2014, and now: 13\.Re1!N=/);
  assert.match(markdown, /16(?:\*\*)?\.N2c3(?:\*\*)? Eminov – Yilmazyerli/);
  assert.match(markdown, /9\.\.\.f5\?! 10\.Qc4 Ne5[\s\S]*13\.Nb5!N Rc8 14\.Nxa7 Rxc2 15\.Qxf5\+\-/);
  assert.match(markdown, /6\.Nc4 Ngxe5 7\.Ncxe5 fxe5 8\.Nxe5 g6!\?/);
  assert.match(markdown, /13\.Bf3 Qd7! 14\.Qd3 Nc6! 15\.Bxe4/);
  assert.doesNotMatch(markdown, /2\.Ne2 is likely to transpose elsewhere/);
  assert.doesNotMatch(markdown, /11\.\.\.Re8 11\.\.\.d3/);
  assert.doesNotMatch(markdown, /6\.Bc4 Ngxe5/);
});

test("printed PDF Page 8 keeps its exact move content and boundary", async () => {
  const markdown = await readChapterOne();
  const start = markdown.indexOf("## Page 8");
  const end = markdown.indexOf("## Page 9", start);
  const page = markdown.slice(start, end);

  assert.match(page, /3\.\.\.Nf6 4\.e5 Nd5 enters the c3 Sicilian/);
  assert.match(page, /7\.Qe2 \[7\.Na3 e5!\]/);
  assert.match(page, /9\.0-0 Rg8!→/);
  assert.match(page, /15\.Be2 Re8∓/);
  assert.match(page, /9\.Bc2 b4∓/);
  assert.match(page, /20\.Na3 Bc3⇆/);
  assert.match(page, /Quaddy – Neapus/);
  assert.match(page, /Osipov – Rimkus/);
  assert.match(page, /Bersamina – Kantans/);
  assert.match(page, /Rasik – Smirin/);
  assert.match(page, /10\.Bh4\s*$/);
  assert.doesNotMatch(page, /1\.e4 c5 2\.Bc4/);
  assert.doesNotMatch(page, /20\.Na3 Nc3∞/);
  assert.doesNotMatch(page, /10\.\.\.a5/);
});

test("printed PDF Page 9 keeps its exact move content and boundary", async () => {
  const markdown = await readChapterOne();
  const pageStart = markdown.indexOf("## Page 9");
  const pageEnd = markdown.indexOf("## Page 10", pageStart);
  const page = markdown.slice(pageStart, pageEnd);
  const pageTen = markdown.slice(pageEnd, markdown.indexOf("## Page 11", pageEnd));

  assert.match(page, /12\.Bxe7 Nxe7∓/);
  assert.match(page, /8\.Bb3 0-0∓/);
  assert.match(page, /12\.Bb3 d5⇆/);
  assert.match(page, /12\.\.\.Qc7N∓/);
  assert.match(page, /13\.Be3 Rab8∓/);
  assert.match(page, /16\.Nxd4 cxd4∓/);
  assert.match(page, /Black's attack eventually proved too\s*$/);
  assert.doesNotMatch(page, /12\.Bxe7 Qxe7/);
  assert.doesNotMatch(page, /8\.Bb3 0-0\+/);
  assert.doesNotMatch(page, /12\.Bb3 d5∓/);
  assert.doesNotMatch(page, /13\.Be3 Rab8\+/);
  assert.doesNotMatch(page, /16\.Nxd4 cxd4\+/);
  assert.doesNotMatch(page, /1\.e4 c5 2\.c4/);
  assert.doesNotMatch(page, /much for White/);
  assert.doesNotMatch(page, /3\.\.\.Nf6!/);
  assert.match(pageTen, /^## Page 10\s+much for White in Karacsony – S\. Petkov, corr\. 2012\./);
});

test("printed PDF Page 10 keeps its exact move content and boundary", async () => {
  const markdown = await readChapterOne();
  const start = markdown.indexOf("## Page 10");
  const end = markdown.indexOf("## Page 11", start);
  const page = markdown.slice(start, end);

  assert.match(page, /much for White in Karacsony – S\. Petkov, corr\. 2012\./);
  assert.match(page, /10\.Bf4∓ had to be preferred/);
  assert.match(page, /14\.\.\.Bh4!N-\+/);
  assert.match(page, /25\.Kf2 g5!∓/);
  assert.match(page, /Tukhvatullin – Karpeshov, Sterlitamak 2011/);
  assert.match(page, /8\.exd5 Nxd5 9\.Bxe7 Ncxe7 10\.dxc5 0-0\s*$/);
  assert.doesNotMatch(page, /10\.f4\+/);
  assert.doesNotMatch(page, /25\.Kf2 g5!\+/);
  assert.doesNotMatch(page, /Tukhvatullin - Karpeshov/);
  assert.doesNotMatch(page, /leaves the white king too exposed/);
});

test("printed PDF Page 11 keeps its exact move content and boundary", async () => {
  const markdown = await readChapterOne();
  const start = markdown.indexOf("## Page 11");
  const end = markdown.indexOf("## Page 12", start);
  const page = markdown.slice(start, end);
  const pageTwelve = markdown.slice(end, markdown.indexOf("## Page 13", end));

  assert.match(page, /16\.Bf3 Qg6∓/);
  assert.match(page, /16(?:\*\*)?\.N2c3(?:\*\*)? Eminov – Yilmazyerli/);
  assert.match(page, /20\.f3 Nd4!∓/);
  assert.match(page, /14\.\.\.Qxc6 15\.0-0 a5 16\.Rc1 Qd6∓/);
  assert.match(page, /11\.\.\.Bg4/);
  assert.match(page, /15\.\.\.f5!\?∞/);
  assert.match(page, /15\.\.\.Nf3\+ 16\.Qxf3 Qxd5 17\.Bd3 Qxc5 18\.0-0 Be6∞/);
  assert.match(page, /14\.Rad1 Qa5\+/);
  assert.match(page, /19\.Nef4=/);
  assert.match(page, /C\) 2\.Ne2/);
  assert.match(page, /a g3 Dragon or a Closed Sicilian with \.\.\.e6/);
  assert.match(page, /2\.\.\.Nf6!\? 3\.Nbc3 d5!\s*$/);
  assert.doesNotMatch(page, /16\.Bf3 Qg6\+/);
  assert.doesNotMatch(page, /16\.Rc1 Qd6\+/);
  assert.doesNotMatch(page, /14\.Rb1 Qa5\+/);
  assert.doesNotMatch(page, /1\.e4 c5 2\.Ne2/);
  assert.doesNotMatch(page, /\(2\.\.\.Nc6 runs into 3\.d4\)/);
  assert.doesNotMatch(page, /with 4\.\.\.e6/);
  assert.doesNotMatch(page, /That.s it! Usually this pawn thrust/);
  assert.match(pageTwelve, /^## Page 12\s+That.s it! Usually this pawn thrust/);
});

test("printed PDF Page 12 keeps its exact move content and boundary", async () => {
  const markdown = await readChapterOne();
  const start = markdown.indexOf("## Page 12");
  const end = markdown.indexOf("## Page 13", start);
  const page = markdown.slice(start, end);
  const pageThirteen = markdown.slice(end, markdown.indexOf("## Page 14", end));

  assert.match(page, /5\.\.\.e6∓/);
  assert.match(page, /5\.\.\.h5∓/);
  assert.match(page, /Nxf4!∓/);
  assert.match(page, /11\.0-0 Be7⇆/);
  assert.match(page, /13\.Qxa6 \(13\.Qg2 g6 14\.0-0 Bg7 15\.Bxa6 0-0 16\.Bd3 Qc8∞\) 13\.\.\.Nf3\+/);
  assert.match(page, /15\.Ke1 \(15\.Bf4 Nxd3 16\.Qxd3 Qxd3\+ 17\.cxd3 Rxb2 18\.Be3 g6 19\.Bd4 f6=/);
  assert.match(page, /Hou Yifan – Ju Wenjun/);
  assert.match(page, /12\.Rd1 Qc8/);
  assert.match(page, /15\.Rxd8\+ Qxd8/);
  assert.match(page, /22\.Rd2±\s*$/);
  assert.doesNotMatch(page, /11\.0-0 Be7∓/);
  assert.doesNotMatch(page, /Hou Yifan - Ju Wenjun/);
  assert.doesNotMatch(page, /12\.Rd1 Qe8/);
  assert.doesNotMatch(page, /22\.Rd2=/);
  assert.doesNotMatch(page, /16\.Rd5/);
  assert.match(pageThirteen, /^## Page 13\s+<!--[\s\S]*?-->\s*16\.Rd5/);
});

test("printed PDF Page 13 keeps its exact move content and boundary", async () => {
  const markdown = await readChapterOne();
  const start = markdown.indexOf("## Page 13");
  const end = markdown.indexOf("## Page 14", start);
  const page = markdown.slice(start, end);
  const pageFourteen = markdown.slice(end, markdown.indexOf("## Page 15", end));

  assert.match(page, /16\.Rd5/);
  assert.match(page, / 16\.Rd2 Ne5=/);
  assert.doesNotMatch(page, /\n16\.Rd2 Ne5=/);
  assert.match(page, /16\.\.\.Qe6=/);
  assert.match(page, /A move which has some purpose, especially as jumping to d4 with the c6-knight is less appealing without a knight standing on c3\. My preference for Black is an almost untried move:/);
  assert.doesNotMatch(page, /16\.Rd5 \(16\.Rd2/);
  assert.match(page, /D\) 2\.Na3/);
  assert.match(page, /D1\) 3\.Bb5[\s\S]*D2\) 3\.Nf3/);
  assert.match(page, /3\.\.\.e5!\?/);
  assert.match(page, /4\.d3!N/);
  assert.match(page, /Saule – Jemec, email 2006/);
  assert.match(page, /4\.\.\.Nge7!N/);
  assert.match(page, /9\.Bf1 Be7∓/);
  assert.match(page, /10\.a4 Be6∓ The position is simply excellent for Black\.\s*$/);
  assert.doesNotMatch(page, /1\.e4 c5 2\.Na3/);
  assert.doesNotMatch(page, /D1\) 3\.Bb5[\s\S]*<!--[\s\S]*?-->\s*3\.Bb5/);
  assert.doesNotMatch(page, /Saule - Jemec/);
  assert.doesNotMatch(page, /4\.\.\.Nge7!\?N/);
  assert.doesNotMatch(page, /9\.Bf1 Be7 looks/);
  assert.doesNotMatch(page, /10\.a4 Be6 The/);
  assert.doesNotMatch(page, /4\.Bxc6 dxc6/);
  assert.match(pageFourteen, /^## Page 14\s+<!--[\s\S]*?-->\s*4\.Bxc6 dxc6/);
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
  assert.ok(recovered.every((token) => token.navigation), "A later numbered continuation should recover from preserved history.");

  const pageThree = new MarkdownMoveResolver();
  pageThree.setAnchor("r1bqkb1r/pp1pnppp/2n1p3/2p5/2B1P3/5N2/PPPPQPPP/RNB1K2R w KQkq - 4 5", "Printed page 9 variation");
  const firstLine = pageThree.resolveText("5.d3 Ng6 6.h4!? (6.0-0 Be7 7.c3 d5 8.Bb3 0-0+) 6...Bd6! 7.Nbd2 h6 8.h5 Nge5 9.Nxe5 Bxe5 10.Nf3 Bb8!? 11.c3 0-0 12.Bb3 d5");
  assert.ok(firstLine.every((token) => token.navigation), "The printed-page-9 side line should remain navigable through its parenthesis.");

  const correctedPdfLine = new MarkdownMoveResolver();
  const secondLine = correctedPdfLine.resolveText("1.e4 c5 2.c4 Nc6 3.Nf3 e5 4.Nc3 d6 5.d3 (5.g3 g6 6.Bg2 Bg7 7.0-0 Nge7 8.d3 0-0 9.Ng5 f6 10.Nh3 Be6 11.f4 Qd7 12.Nf2 Nd4 13.Be3 Rab8+) 5...f5!? 6.exf5 Bxf5 7.h3?! Qd7 8.Be2 Nf6 9.Nh2?! 9...Nd4 10.Bg5 0-0-0! 11.0-0 h6 12.Bxf6 gxf6 13.Kh1?!");
  assert.ok(secondLine.every((token) => token.navigation), "The PDF-corrected 9.Ng5 line should be fully navigable.");

  const siblings = new MarkdownMoveResolver();
  const siblingTokens = siblings.resolveText("1.e4 (1.d4 d5; 1.c4 e5)");
  assert.ok(siblingTokens.every((token) => token.navigation), "A semicolon should start a sibling variation from the same branch point.");
});

test("comma-separated parenthetical alternatives return to the shared anchor", () => {
  const resolver = new MarkdownMoveResolver();
  const anchor = "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPPNPPP/RNBQKB1R b KQkq - 1 2";
  resolver.setAnchor(anchor, "After 2.Ne2");

  const tokens = resolver.resolveText(
    "White can choose between (2...Nc6 3.d4), while (2...d6 3.Nbc3 Nf6 4.g3 with 4...e6).",
  );
  const byDisplay = (display) => tokens.find((token) => token.display === display);

  for (const display of ["2...Nc6", "3.d4", "2...d6", "3.Nbc3", "Nf6", "4.g3", "4...e6"]) {
    assert.ok(byDisplay(display)?.navigation, `${display} should be navigable.`);
  }

  assert.deepEqual(
    byDisplay("3.d4").navigation.steps.slice(0, 3).map((step) => step.label),
    ["After 2.Ne2", "2...Nc6", "3.d4"],
  );
  assert.deepEqual(
    byDisplay("4...e6").navigation.steps.slice(0, 6).map((step) => step.label),
    ["After 2.Ne2", "2...d6", "3.Nbc3", "Nf6", "4.g3", "4...e6"],
  );
  assert.equal(byDisplay("2...d6").navigation.steps[0].fen, anchor);
});

test("move navigation survives PDF page and parenthesis boundaries", () => {
  const pages = new MarkdownMoveResolver();
  const beforeBreak = pages.resolveText("1.e4 c5 2.Bc4 e6 3.Qe2 Nc6 4.c3 Be7 5.Bb3 d5 6.d3 Nf6 7.Nf3 0-0 8.0-0 b5 9.Bg5 h6 10.Bh4");
  const afterBreak = pages.resolveText("10...a5!? 11.e5 Nd7 12.Bxe7 Qxe7");
  assert.ok(beforeBreak.every((token) => token.navigation), "Moves before the PDF page break should be navigable.");
  assert.ok(afterBreak.every((token) => token.navigation), "Moves after the PDF page break should retain the prior position.");

  const branch = new MarkdownMoveResolver();
  const branchStart = branch.resolveText("1.e4 c5 (1...e5");
  const branchEnd = branch.resolveText("2.Nf3 Nc6)");
  assert.ok(branchStart.every((token) => token.navigation), "The opening half of a split variation should be navigable.");
  assert.ok(branchEnd.every((token) => token.navigation), "A variation continued in the next paragraph should remain navigable.");
});

test("numbered pawn moves after prose prepositions remain navigable", () => {
  const resolver = new MarkdownMoveResolver();
  resolver.setAnchor("1rbq1rk1/1p1pbppp/p4n2/2p1p3/P1BnP3/1PNP4/1BP1NPPP/R2QK2R w KQ - 0 10");

  const tokens = resolver.resolveText("10.0-0 offers nothing due to 10...b5 11.axb5 axb5");
  for (const move of ["10.0-0", "10...b5", "11.axb5", "axb5"]) {
    assert.ok(tokens.find((token) => token.display === move)?.navigation, `${move} should remain navigable`);
  }
});

test("prose-separated sibling variations return to their shared move number", () => {
  const resolver = new MarkdownMoveResolver();
  resolver.setAnchor("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1");

  const tokens = resolver.resolveText("1...c5 2.Nf3 Nc6, while 1...e5 2.Nf3 Nc6");
  assert.ok(tokens.every((token) => token.navigation), "Both prose-separated branches should be navigable.");
  assert.notEqual(tokens[0].navigation.steps.at(-1).fen, tokens[3].navigation.steps.at(-1).fen);
});

test("the active PDF anchor wins over historical lookalike positions", () => {
  const resolver = new MarkdownMoveResolver();
  resolver.addRoot("r1bqkb1r/pp3ppp/2n5/2p1P3/4p3/1P6/PBPPQ1PP/R3KBNR b KQkq - 1 8");
  const activeFen = "r2qkb1r/pp4pp/2np1n2/2p5/2B1Ppb1/1PN2N2/PBPPQ1PP/R3K2R b Kk - 3 8";
  resolver.setAnchor(activeFen, "Current PDF position");

  const tokens = resolver.resolveText("8...Be7! 9.0-0-0 0-0");
  const first = tokens.find((token) => token.display === "8...Be7!");
  const expected = resolveChessMove(activeFen, "8...Be7!");
  assert.ok(first?.navigation && expected);
  assert.equal(first.navigation.steps[first.navigation.index].fen, expected.fen);
});

test("or-introduced sibling continuations return to their local branch", () => {
  const resolver = new MarkdownMoveResolver();
  resolver.setAnchor("r1bqkb1r/pp4pp/2n2p2/2pnp3/2B5/1P1P1N2/PBP2PPP/RN1QK2R w KQkq - 0 8");

  const tokens = resolver.resolveText("8.Nc3 Nb6!? 9.Bb5 (9.0-0 Nxc4 10.bxc4 Be6= or 10...Be7=) 9...Bd7 10.0-0");
  assert.ok(tokens.every((token) => token.navigation), "Both alternatives after 10.bxc4 should be navigable.");
});

test("document move references stay plain without blocking a later concrete line", () => {
  const resolver = new MarkdownMoveResolver();
  resolver.setAnchor("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");

  const tokens = resolver.resolveText("The variation 2.b3 is dangerous after 1.e4 c5 2.b3 Nc6 3.Bb2 e5 4.f4!?");
  assert.equal(tokens[0].display, "2.b3");
  assert.equal(tokens[0].navigation, null);
  assert.ok(tokens.slice(1).every((token) => token.navigation), "The concrete conclusion line should remain navigable.");
});

test("the Markdown contract rejects missing pages and invalid FENs with line numbers", () => {
  assert.throws(() => parseChapterMarkdown("chapter-1-sicilian.md", "# Chapter 1\n\n**FEN:**\n`bad`\n"), /Page/);
  assert.throws(() => parseChapterMarkdown("chapter-1-sicilian.md", "# Chapter 1\n\n## Page 1\n\n**FEN:**\n`bad`\n"), /chapter-1-sicilian\.md:5: contains an invalid FEN: bad/);
  assert.throws(() => parseChapterMarkdown("chapter-1-sicilian.md", "# Chapter 1\n\n## Page 1\n## Page 3\n\n**FEN:**\n`8/8/8/8/8/8/4k3/4K3 w - - 0 1`\n"), /chapter-1-sicilian\.md:4: page boundaries must be contiguous/);
  assert.throws(() => parseChapterMarkdown("chapter-1-sicilian.md", "# Chapter 1\n\n## Page 1\n\nA&nbsp;B\n\n**FEN:**\n`8/8/8/8/8/8/4k3/4K3 w - - 0 1`\n"), /chapter-1-sicilian\.md:5: contains a non-breaking space/);
  assert.throws(() => parseChapterMarkdown("chapter-1-sicilian.md", "# Chapter 1\n\n## Page 1\n\nA\u00a0B\n\n**FEN:**\n`8/8/8/8/8/8/4k3/4K3 w - - 0 1`\n"), /chapter-1-sicilian\.md:5: contains a non-breaking space/);
});

test("Chapter 1 retains explanatory lesson prose on every page", async () => {
  const markdown = await readChapterOne();
  const pages = markdown.split(/^## Page \d+\s*$/m).slice(1);
  assert.ok(pages.length > 0);
  for (const page of pages) {
    const prose = page.split(/\r?\n/).filter((line) => /^[A-Z][^#*`<!]*[a-z]{3}/.test(line.trim()));
    assert.ok(prose.length > 0, "Chapter 1 has a page without explanatory prose.");
  }
});

test("package scripts expose the Markdown chapter workflow and read-only audit", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.deepEqual(Object.keys(packageJson.scripts).filter((name) => name.startsWith("chapters:")), ["chapters:status", "chapters:sync", "chapters:check", "chapters:audit"]);
  assert.match(packageJson.scripts["chapters:audit"], /chapter-audit\.ts/);
  assert.match(packageJson.scripts.test, /--import tsx --test/);
  assert.equal(packageJson.dependencies["pdfjs-dist"], undefined);
});

test("createChapter scaffolds a new contiguous chapter and syncs catalog", async () => {
  const originalChapters = await discoverChapters();
  const initialCatalog = catalogSource(originalChapters);

  try {
    const result = await createChapter({ title: "Test Scaffolding Chapter", pageCount: 3 });
    assert.equal(result.id, 8);
    assert.equal(result.firstPage, 136);
    assert.equal(result.lastPage, 138);
    assert.equal(result.pageCount, 3);

    const updatedChapters = await discoverChapters();
    assert.equal(updatedChapters.length, 8);
    assert.equal(updatedChapters[7].title, "Chapter 8: Test Scaffolding Chapter");
    assert.equal(updatedChapters[7].pageCount, 3);
  } finally {
    // Teardown and restore
    const { unlink, writeFile } = await import("node:fs/promises");
    const { fileURLToPath } = await import("node:url");
    const path = await import("node:path");
    const testChapterPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "app", "content", "chapters", "chapter-8-sicilian.md");
    const catalogPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "app", "chapter-catalog.generated.ts");
    try { await unlink(testChapterPath); } catch {}
    await writeFile(catalogPath, initialCatalog, "utf8");
  }
});

test("addPage appends contiguous pages to a chapter and syncs catalog", async () => {
  const originalChapters = await discoverChapters();
  const initialCatalog = catalogSource(originalChapters);
  const { unlink, writeFile } = await import("node:fs/promises");
  const { fileURLToPath } = await import("node:url");
  const path = await import("node:path");
  const testChapterPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "app", "content", "chapters", "chapter-8-sicilian.md");
  const catalogPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "app", "chapter-catalog.generated.ts");

  try {
    await createChapter({ title: "Test Add Page Chapter", pageCount: 2 });
    const appendResult = await addPage({ chapterId: 8, count: 2 });
    assert.equal(appendResult.chapterId, 8);
    assert.equal(appendResult.firstNewPage, 138);
    assert.equal(appendResult.lastNewPage, 139);
    assert.equal(appendResult.totalPageCount, 4);

    const updatedChapters = await discoverChapters();
    assert.equal(updatedChapters[7].pageCount, 4);
    assert.equal(updatedChapters[7].lastPage, 139);
  } finally {
    try { await unlink(testChapterPath); } catch {}
    await writeFile(catalogPath, initialCatalog, "utf8");
  }
});

