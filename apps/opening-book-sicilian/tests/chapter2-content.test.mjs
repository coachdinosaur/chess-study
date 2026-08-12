import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { parseChapterMarkdown } from "../scripts/chapter-system.mjs";

const chapterUrl = new URL("../app/content/chapters/chapter-2-sicilian.md", import.meta.url);
const forbiddenBundledPdfUrl = new URL("../../02_2g3_and_2d3.pdf", import.meta.url);

test("Chapter 2 preserves the PDF page structure without bundling the source PDF", async () => {
  const markdown = await readFile(chapterUrl, "utf8");
  const metadata = parseChapterMarkdown("chapter-2-sicilian.md", markdown);
  const pageNumbers = [...markdown.matchAll(/^## Page (\d+)$/gm)].map((match) => Number(match[1]));

  await assert.rejects(access(forbiddenBundledPdfUrl), { code: "ENOENT" });
  assert.equal(metadata.id, 2);
  assert.equal(metadata.title, "Chapter 2: 2.g3 and 2.d3");
  assert.equal(metadata.pageCount, 15);
  assert.equal(metadata.visibleFenCount, 47);
  assert.ok(metadata.hiddenFenCount >= 60, "Chapter 2 should retain its interactive variation anchors");
  assert.deepEqual(pageNumbers, Array.from({ length: 15 }, (_, index) => index + 24));
  assert.equal((markdown.match(/^Various 2nd Moves$/gm) ?? []).length, 1);
  assert.doesNotMatch(markdown, /^Chapter 2 –/m);
  assert.doesNotMatch(markdown, /^\d{1,3}$/m);
});

test("Chapter 2 contains representative PDF-authored lines throughout pages 24-38", async () => {
  const markdown = await readFile(chapterUrl, "utf8");

  for (const required of [
    "17...g5!N 18.Bg3 Bxh3↑",
    "19...Bf7=",
    "20.Qf3! Qc8 21.Na4 e5∞",
    "17.Bxd5†!N",
    "31...Re6!N↑",
    "4...Bg4!?",
    "11...Rc8 12.Nc2 0-0 13.e5 d4",
    "7...Nxf3† 8.Kf1 Nd2†=",
    "10...b5!N",
    "10...Qc7!",
    "A draw was agreed in Polugaevsky – J. Polgar, Aruba 1991",
    "### Conclusion",
    "Black equalized by brilliantly utilizing the slight weakening along the a6-f1 diagonal caused by 8.c3.",
  ]) {
    assert.ok(markdown.includes(required), `Missing Chapter 2 PDF content: ${required}`);
  }
});

test("Chapter 2 13.exf5 alternative branch resolves all moves from 12...h6", async () => {
  const { MarkdownMoveResolver } = await import("../app/lib/markdown-moves.ts");
  const resolver = new MarkdownMoveResolver();
  resolver.setAnchor("3r1bnr/ppkb4/2n3pp/2p1pp2/4P3/2P1BPPN/PPKN3P/3R1B1R w - - 0 13", "After 12...h6");
  const tokens = resolver.resolveText("(13.exf5 gxf5 14.Nf2 Nge7 15.Nc4 b6=)");

  for (const move of ["13.exf5", "gxf5", "14.Nf2", "Nge7", "15.Nc4", "b6="]) {
    const found = tokens.find((t) => t.display === move);
    assert.ok(found, `Move token ${move} should be detected`);
    assert.ok(found.navigation !== null, `Move token ${move} should be navigable`);
  }
});
