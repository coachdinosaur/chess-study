import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parseChapterMarkdown } from "../scripts/chapter-system.mjs";

const chapterUrl = new URL("../app/content/chapters/chapter-3-sicilian.md", import.meta.url);
const forbiddenBundledPdfUrl = new URL("../../03_2b3_pages_01-17.pdf", import.meta.url);

test("Chapter 3 preserves the PDF page structure without bundling the source PDF", async () => {
  const markdown = await readFile(chapterUrl, "utf8");
  const metadata = parseChapterMarkdown("chapter-3-sicilian.md", markdown);
  const pageNumbers = [...markdown.matchAll(/^## Page (\d+)$/gm)].map((match) => Number(match[1]));

  await assert.rejects(access(forbiddenBundledPdfUrl), { code: "ENOENT" });
  assert.equal(metadata.id, 3);
  assert.equal(metadata.title, "Chapter 3: 2.b3");
  assert.equal(metadata.pageCount, 17);
  assert.equal(metadata.visibleFenCount, 50);
  assert.deepEqual(pageNumbers, Array.from({ length: 17 }, (_, index) => index + 39));
  assert.equal((markdown.match(/^Various 2nd Moves$/gm) ?? []).length, 1);
  assert.doesNotMatch(markdown, /^Chapter 3 –/m);
  assert.doesNotMatch(markdown, /^\d{1,3}$/m);
});

test("Chapter 3 contains representative PDF-authored lines throughout pages 39-55", async () => {
  const markdown = await readFile(chapterUrl, "utf8");

  for (const required of [
    "3...e5!",
    "9...f5!N",
    "10...Be7!N",
    "9...Bd7!N",
    "Walta – Paasikangas Tella, Tampere 1991",
    "Spassky – Nemet, Lugano 1982",
    "Fernandes – Kouatly, Thessaloniki (ol) 1988",
    "MacQueen – Rees, Augsburg 2013",
    "Melnikov – Alieva, St Petersburg 2014",
    "13...Bd7!",
    "Buchnicek – Cizek, Czech Republic 2008",
    "10...a6!",
    "Lukin – Shirov, Klaipeda 1988",
    "Grosar – Kupreichik, Ljubljana 1989",
    "Blatny – Serper, New York 1996",
    "13...Bb4!",
    "25.Bxd3 Kd7=",
    "#### Conclusion",
    "The variation 2.b3 against the Sicilian can produce some interesting chess",
  ]) {
    assert.ok(markdown.includes(required), `Missing Chapter 3 PDF content: ${required}`);
  }
});

test("Chapter 3 release positions pass the strict move audit", async () => {
  const markdown = await readFile(chapterUrl, "utf8");
  const { auditChapterMarkdown } = await import("../scripts/chapter-audit.ts");
  const audit = auditChapterMarkdown(markdown, {
    chapter: 3,
    filename: "chapter-3-sicilian.md",
    expectedPages: 17,
    expectedFirstPage: 39,
    expectedDiagrams: 50,
    strictMoves: true,
  });

  assert.deepEqual(audit.errors, []);
  assert.equal(audit.visibleDiagrams, 50);
  assert.equal(audit.hiddenAnchors, 161);
  assert.equal(audit.unresolved.filter((item) => item.kind === "analysis").length, 0);

  for (const correctedFen of [
    "r1bqkb1r/pp3p1p/2np1n2/2p3p1/2B1Pp1P/1PN5/PBPPN1P1/R2QK2R b KQkq h3 0 8",
    "r1bqkb1r/pp3ppp/2np1n2/2p5/2B1Pp2/1PN2N2/PBPP2PP/R2QK2R b KQkq - 1 7",
    "r2qkb1r/pp3ppp/2np1n2/2p5/2B1Ppb1/1PN2N2/PBPP2PP/R2QK2R w KQkq - 2 8",
    "r2qk2r/5ppp/2pb4/p1p1pb2/4p3/1P3P2/PBPPQ1PP/2KR2NR w kq - 0 12",
    "r2qk2r/5ppp/2pbbp2/p1p5/4P3/1P3N2/PBPPQ1PP/2KR3R w kq - 0 14",
    "r1b1kb1r/pp5p/3q2p1/4pp2/2Bp4/1P6/PBPP1PPP/R2QK2R w KQkq - 1 13",
    "r1b1kbnr/pp1p1ppp/2np3q/2p5/2B1Pp2/1P3N2/PBPP2PP/RN1Q1K1R w kq - 3 8",
    "r2qk2r/pp3ppp/2nbbn2/7n/3p1p2/1PN2N2/PBP1Q1PP/2KR1B1R w kq - 0 12",
    "r3k2r/pp2q1pp/2n1bn2/1N6/1b1N1p2/1P6/PBP1Q1PP/2KR1B1R w kq - 2 14",
  ]) {
    assert.ok(markdown.includes(correctedFen), `Missing corrected Chapter 3 position: ${correctedFen}`);
  }

  for (const rejectedFen of [
    "r1bqkb1r/pp5p/2np1n2/2p3p1/2B1Pp1P/1PN5/PBPPN1P1/R2QK2R b KQkq h3 0 8",
    "r1bqkb1r/pp4pp/2np1n2/2p5/2B1Pp2/1PN2N2/PBPP2PP/R2QK2R b Kk - 1 7",
    "r2qkb1r/pp4pp/2np1n2/2p5/2B1Ppb1/1PN2N2/PBPP2PP/R2QK2R w Kk - 2 8",
    "r2qk2r/5ppp/2pbbp2/p1p5/4P3/1P3N2/PBP1Q1PP/2KR3R w kq - 0 14",
    "r3k2r/pp2q1pp/2n2n2/1N6/1b1N1p2/1P6/PBP1Q1PP/2KR1B1R w kq - 2 14",
  ]) {
    assert.ok(!markdown.includes(rejectedFen), `Obsolete Chapter 3 position remains: ${rejectedFen}`);
  }

  assert.match(markdown, /SOURCE ERRATUM FROM 23\.Rde1: The PDF continuation is illegal/);
});

test("Chapter 3 Pages 42-55 render links for every concrete PDF continuation", async () => {
  const React = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { createServer } = await import("vite");
  const appRoot = fileURLToPath(new URL("../", import.meta.url));
  const server = await createServer({ root: appRoot, server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });

  const intentionallyPlain = new Map([
    [42, ["Nge2", "0-0", "f2", "f4"]],
    [43, ["Nxe4", "d2", "d3"]],
    [44, ["Rg6"]],
    [46, ["f2", "f4"]],
    [47, ["Nc3", "f2", "f4", "f2", "f4", "c2", "c3"]],
    [48, ["b5", "a2", "a4", "Nxe4", "a2", "a4", "a5"]],
    [49, ["f2", "f4", "f8", "c1", "h6", "c2", "c3"]],
    [51, ["e4", "e5", "Bg4"]],
    [53, ["Qd5", "Rae8", "Ng3"]],
    [55, ["2.b3"]],
  ]);

  try {
    const { MarkdownChapterView } = await server.ssrLoadModule("/app/components/MarkdownRenderer.tsx");
    const { loadAllChapters } = await server.ssrLoadModule("/app/lib/chapter-markdown-loader.ts");
    const chapter = loadAllChapters().find((item) => item.id === "3");
    assert.ok(chapter);

    for (const page of chapter.pages.filter((item) => item.number >= 42)) {
      const html = renderToStaticMarkup(React.createElement(MarkdownChapterView, {
        markdown: page.markdown,
        onMove: () => {},
        chapterNumber: 3,
      }));
      const unresolved = [...html.matchAll(/<span>([^<]+)<\/span>/g)].map((match) => match[1]);
      assert.deepEqual(unresolved, intentionallyPlain.get(page.number) ?? [], `Unexpected no-link move on Page ${page.number}`);
      if (page.number === 45) {
        assert.equal((html.match(/source-erratum-move/g) ?? []).length, 8, "Every move in the illegal PDF suffix should remain interactive");
        assert.match(html, /Show last legal position for 23\.Rde1/);
      }
    }
  } finally {
    await server.close();
  }
});

test("Chapter 3 Page 45 exposes the illegal PDF suffix as source-aware navigation", async () => {
  const { MarkdownMoveResolver } = await import("../app/lib/markdown-moves.ts");
  const resolver = new MarkdownMoveResolver();
  resolver.setAnchor("r3k2r/pp4bp/4q1p1/5p2/4p3/1PPpQ3/P2P1PPP/2KRR3 b kq - 1 18", "Page 45 diagram");
  const issue = "The PDF continuation is illegal from 23.Rde1; the board remains at the last legal position after 22...Qc6.";
  const tokens = resolver.resolveText(`18...Kf7 19.f3 Rhe8 20.Qf4 Kg8 21.fxe4 fxe4 22.Qe3 Qc6 23.Rde1 Re6 24.Rxe4 Rxe4 25.Qxe4 Qxe4 26.Rxe4 Rf8= <!-- SOURCE ERRATUM FROM 23.Rde1: ${issue} -->`);
  const lastLegalFen = "r3r1k1/pp4bp/2q3p1/8/4p3/1PPpQ3/P2P2PP/2KRR3 w - - 2 23";
  const sourceTokens = tokens.slice(tokens.findIndex((token) => token.display === "23.Rde1"));

  assert.deepEqual(sourceTokens.map((token) => token.display), ["23.Rde1", "Re6", "24.Rxe4", "Rxe4", "25.Qxe4", "Qxe4", "26.Rxe4", "Rf8="]);
  for (const token of sourceTokens) {
    assert.ok(token.navigation, `${token.display} should expose source-aware navigation`);
    const step = token.navigation.steps[token.navigation.index];
    assert.equal(step.fen, lastLegalFen, `${token.display} must not invent an illegal board position`);
    assert.equal(step.sourceIssue, issue);
  }
});

test("Chapter 3 double fianchetto and sideline moves resolve accurately", async () => {
  const { MarkdownMoveResolver } = await import("../app/lib/markdown-moves.ts");
  const resolver = new MarkdownMoveResolver();
  resolver.setAnchor("r1bqkbnr/pp1p1ppp/2n5/2p1p3/4P3/1P6/PBPP1PPP/RN1QKBNR w KQkq e6 0 4", "After 3...e5");
  const tokens = resolver.resolveText("4.g3 4...g6! 5.Bg2 Bg7 6.Ne2 d6 7.0-0 Nge7 8.Nbc3 (8.c3?! 0-0 9.d4 exd4! 10.cxd4) 8...0-0 9.Nd5");

  for (const move of ["4.g3", "4...g6!", "5.Bg2", "Bg7", "6.Ne2", "d6", "7.0-0", "Nge7", "8.Nbc3", "8.c3?!", "0-0", "9.d4", "exd4!", "10.cxd4", "8...0-0", "9.Nd5"]) {
    const found = tokens.find((t) => t.display === move);
    assert.ok(found, `Move token ${move} should be detected`);
    assert.ok(found.navigation !== null, `Move token ${move} should be navigable`);
  }
});

test("Chapter 3 various sidelines on Pages 40-55 resolve accurately from their anchors", async () => {
  const { MarkdownMoveResolver } = await import("../app/lib/markdown-moves.ts");
  const resolver = new MarkdownMoveResolver();

  // Page 40 5.g3
  resolver.setAnchor("r1bqkb1r/pp1p1ppp/2n2n2/2p1p3/4P3/1PN5/PBPP1PPP/R2QKBNR w KQkq - 2 5", "After 4...Nf6");
  let tokens = resolver.resolveText("5.g3 is too slow: Black gets an excellent game by 5...d5! 6.exd5 Nxd5 (6...Nd4!? 7.Bg2 Bg4∞) 7.Bg2 Be6 8.Nge2 Qd7 9.0-0");
  for (const move of ["5.g3", "5...d5!", "6.exd5", "Nxd5", "6...Nd4!?", "7.Bg2", "Bg4∞", "7.Bg2", "Be6", "8.Nge2", "Qd7", "9.0-0"]) {
    const found = tokens.find((t) => t.display === move);
    assert.ok(found, `Move ${move} should be found`);
    assert.ok(found.navigation !== null, `Move ${move} should be navigable`);
  }

  // Page 43 6.Bxf7+
  resolver.setAnchor("r1bqkb1r/pp1p1ppp/2n5/2p1p3/2B1n3/1PN5/PBPP1PPP/R2QK1NR w KQkq - 0 6", "After 5...Nxe4");
  tokens = resolver.resolveText("6.Bxf7† Kxf7 7.Nxe4 d5 8.Ng3 Be6");
  for (const move of ["6.Bxf7", "Kxf7", "7.Nxe4", "d5", "8.Ng3", "Be6"]) {
    const found = tokens.find((t) => t.display.startsWith(move));
    assert.ok(found, `Move ${move} should be found`);
    assert.ok(found.navigation !== null, `Move ${move} should be navigable`);
  }

  // Page 53 7...d5!
  resolver.setAnchor("r1bqkb1r/pp1p1ppp/2n5/2p1P2n/5p2/1P3N2/PBPPQ1PP/RN2KB1R b KQkq - 1 7", "After 7.Qe2!");
  tokens = resolver.resolveText("7...d5! 8.exd6† Be6 9.Nc3 Bxd6 10.0-0-0!");
  for (const move of ["7...d5!", "8.exd6", "Be6", "9.Nc3", "Bxd6", "10.0-0-0!"]) {
    const found = tokens.find((t) => t.display.startsWith(move));
    assert.ok(found, `Move ${move} should be found`);
    assert.ok(found.navigation !== null, `Move ${move} should be navigable`);
  }

  // Page 54 12...Bc5
  resolver.setAnchor("r2qk2r/pp3ppp/2nbbn2/1N6/3p1p2/1P3N2/PBP1Q1PP/2KR1B1R b k - 1 12", "After 12.Nb5");
  tokens = resolver.resolveText("12...Bc5 13.Nfxd4 Nxd4 14.Qe5! (14.Nxd4 Qb6! 15.Nxe6 Qxe6 16.Qb5†! Qc6 17.Bxf6! gxf6)");
  for (const move of ["12...Bc5", "13.Nfxd4", "Nxd4", "14.Qe5!", "14.Nxd4", "Qb6!", "15.Nxe6", "Qxe6", "16.Qb5", "Qc6", "17.Bxf6!", "gxf6"]) {
    const found = tokens.find((t) => t.display.startsWith(move));
    assert.ok(found, `Move ${move} should be found`);
    assert.ok(found.navigation !== null, `Move ${move} should be navigable`);
  }

  // Page 40: Four tries for White
  resolver.setAnchor("r1bqkbnr/pp1p1ppp/2n5/2p1p3/4P3/1P6/PBPP1PPP/RN1QKBNR w KQkq e6 0 4", "After 3...e5");
  tokens = resolver.resolveText("We will focus on four tries for White: A) 4.Nc3, B) 4.Bc4, C) 4.Bb5 and D) 4.f4!?.");
  for (const move of ["4.Nc3", "4.Bc4", "4.Bb5", "4.f4!?"]) {
    const found = tokens.find((t) => t.display === move);
    assert.ok(found, `Move ${move} should be found`);
    assert.ok(found.navigation !== null, `Move ${move} should be navigable`);
  }

  // Page 41: 6.Bc4!?, 6.Nf3 after 5...exf4!
  resolver.setAnchor("r1bqkb1r/pp1p1ppp/2n2n2/2p5/4Pp2/1PN5/PBPP2PP/R2QKBNR w KQkq - 0 6", "After 5...exf4!");
  tokens = resolver.resolveText("6.Bc4!?");
  assert.ok(tokens.find((t) => t.display === "6.Bc4!?")?.navigation !== null, "6.Bc4!? should be navigable");

  resolver.setAnchor("r1bqkb1r/pp1p1ppp/2n2n2/2p5/4Pp2/1PN5/PBPP2PP/R2QKBNR w KQkq - 0 6", "After 5...exf4!");
  tokens = resolver.resolveText("6.Nf3 transposes to the note on 6.Nc3 in variation D2.");
  assert.ok(tokens.find((t) => t.display === "6.Nf3")?.navigation !== null, "6.Nf3 should be navigable");

  // Page 41: 9...Ne5, 9...0-0, 10.Bxe5, 12...h6 line
  resolver.setAnchor("r1bqk2r/pp4bp/2np1n2/2pN2p1/2B1Pp1P/1P6/PBPPN1P1/R2QK2R b KQkq - 1 9", "After 8...Bg7! 9.Nd5");
  tokens = resolver.resolveText("9...Ne5");
  assert.ok(tokens.find((t) => t.display === "9...Ne5")?.navigation !== null, "9...Ne5 should be navigable");

  tokens = resolver.resolveText("9...0-0 also looks interesting.");
  assert.ok(tokens.find((t) => t.display === "9...0-0")?.navigation !== null, "9...0-0 should be navigable");

  resolver.setAnchor("r1bqk2r/pp4bp/3p1n2/2pNn1p1/2B1Pp1P/1P6/PBPPN1P1/R2QK2R w KQkq - 2 10", "After 9...Ne5");
  tokens = resolver.resolveText("10.Bxe5");
  assert.ok(tokens.find((t) => t.display === "10.Bxe5")?.navigation !== null, "10.Bxe5 should be navigable");

  resolver.setAnchor("r1bqk2r/pp4bp/5n2/2pNp2P/2B1Ppp1/1PN5/P1PP2P1/R2QK2R b KQkq - 0 12", "After 12.h5!");
  tokens = resolver.resolveText("12...h6 13.Qe2 0-0 14.0-0-0 a6∓");
  for (const move of ["12...h6", "13.Qe2", "0-0", "14.0-0-0", "a6∓"]) {
    const found = tokens.find((t) => t.display === move);
    assert.ok(found, `Move ${move} should be found`);
    assert.ok(found.navigation !== null, `Move ${move} should be navigable`);
  }
});
