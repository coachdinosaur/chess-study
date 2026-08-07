import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Chess } from "chess.js";

const root = new URL("../", import.meta.url);
const chapterUrl = new URL("app/content/chapters/chapter-1-sicilian.md", root);

function pageSection(markdown, page, nextPage = page + 1) {
  const start = markdown.indexOf(`## Page ${page}`);
  const end = markdown.indexOf(`## Page ${nextPage}`, start + 1);
  assert.ok(start >= 0, `Missing Page ${page}`);
  return markdown.slice(start, end >= 0 ? end : undefined);
}

test("Chapter 1 Markdown directly contains the PDF-derived app corrections", async () => {
  const [markdown, loader, app, html] = await Promise.all([
    readFile(chapterUrl, "utf8"),
    readFile(new URL("app/lib/chapter-markdown-loader.ts", root), "utf8"),
    readFile(new URL("app/SicilianApp.tsx", root), "utf8"),
    readFile(new URL("index.html", root), "utf8"),
  ]);

  assert.deepEqual(
    [...markdown.matchAll(/^## Page (\d+)$/gm)].map((match) => Number(match[1])),
    Array.from({ length: 17 }, (_, index) => index + 7),
  );

  assert.ok(!loader.includes("applyChapter"), "The loader must not repair canonical Markdown at runtime.");
  assert.ok(loader.includes("parseChapter(filename, content as string)"));

  const requiredAnchors = [
    "r2q1rk1/p4pbp/bpn1p1p1/2pn2B1/8/NBPP1N2/PP2QPPP/R3R1K1 b - - 1 12",
    "r4rk1/p1q2pbp/bpn1p1p1/2pn2B1/8/NBPP1N2/PP2QPPP/R3R1K1 w - - 2 13",
    "r2qkb1r/pp1bpp1p/2n3p1/8/4Q3/2N3P1/PPP2P1P/R1B1KB1R w KQkq - 0 10",
    "r1q2rk1/pp2ppbp/2n3p1/5b2/Q7/2N1B1P1/PPP2PBP/R2R2K1 b - - 9 14",
    "r1bq1rk1/pp2bppp/3p2n1/2p1p3/2BnP3/3PNN2/PPPB1PPP/R2Q1RK1 b - - 9 10",
    "r1bqkb1r/pp1pp1pp/2n2p2/2p1P3/6n1/N4N2/PPPPQPPP/R1B1KB1R w KQkq - 0 6",
    "r1b2rk1/pp2ppbp/1qnP2p1/8/2B2P2/5N2/PPPQ2PP/R1B1K2R w KQ - 5 12",
    "r4rk1/1p3pbp/2n1b1p1/pq1p4/5P2/1BP1BN2/PP3QPP/R4RK1 w - - 0 18",
    "r1bqkb1r/pp1ppp1p/2n3p1/4P3/5P2/8/PPPB2PP/R2QKBNR b KQkq - 0 8",
    "r4rk1/pp2ppbp/1qBp2p1/4P3/5Pb1/2B2N2/PPP1Q1PP/R3K2R b KQ - 0 13",
    "r1bqkb1r/pp2pp1p/2n3p1/3pP3/4nP2/4B3/PPP3PP/RN1QKBNR w KQkq d6 0 8",
    "r3k2r/ppq1ppbp/2n3p1/4Pb2/1P2n3/2PBBN2/P1Q3PP/RN2K2R b KQkq - 4 13",
    "r1bqkb1r/pp2pp1p/2np2p1/4P2n/5P2/3Q1N2/PPP3PP/RNB1KB1R w KQkq - 0 8",
    "r2qkb1r/pp2pp1p/2np2p1/4Pb1B/5P2/3Q4/PPP3PP/RNB1K1NR w KQkq - 1 9",
    "rnbq1rk1/pp2ppbp/5np1/2p5/1PP5/P4N2/1B1PBPPP/RN1QK2R b KQ - 2 9",
  ];

  for (const fen of requiredAnchors) {
    assert.doesNotThrow(() => new Chess(fen), `Invalid required FEN: ${fen}`);
    assert.ok(markdown.includes(fen), `Missing canonical PDF-derived FEN: ${fen}`);
  }

  const requiredText = [
    "12...Qc7N∓",
    "10.Bc4",
    "10...Nxf3+ 11.Qxf3 Bg5! 12.a4 Be6=",
    "8...Nc5 9.Be3 Ne6",
    "8.Qxd2!N\n\nThis is relatively best.",
    "18.Rfb1!\n\nWhite should have enough to maintain approximate equality.",
    "13...Qxd2+ 14.Kxd2",
    "14...Bxe5!",
    "20.Qd4 e6 21.Qxb6 axb6∓",
    "E12) 7.Be3 d6!?N",
    "6...e5!",
  ];
  for (const text of requiredText) {
    assert.ok(markdown.includes(text), `Missing canonical PDF text: ${text}`);
  }

  const stale = [
    "rbbq1rk1/pp1p1pp1/2n1p2p/2p4P/4P3/1BPP4/PP1NQPP1/R1B2RK1 b - - 5 12",
    "r2qkb1r/pp1bpp1p/2n3p1/8/2Q5/2N3P1/PPP2P1P/R1B1KB1R w KQkq - 0 10",
    "r1q2rk1/pp2ppbp/2n3p1/5b2/7Q/2N1B1P1/PPP2PBP/R2R2K1 b - - 9 14",
    "r1bq1rk1/pp2bppp/3p2n1/1Bp1p3/2NnP3/3P1N2/PPPB1PPP/R2Q1RK1 b - - 9 10",
    "corr. 2008.\n\n6.Nc4 Ngxe5",
    "This looks dubious.\n\n9.Nxc6!",
    "12.c3!?\n\nWhite might hold after 12.d7",
    "## Page 17\n\n18.Rfb1!",
    "\n6.Qd3\n\n**FEN:**",
    "\n4.c3?!\n\n**FEN:**",
    "\n4.Nc3!\n\n**FEN:**",
  ];
  for (const text of stale) {
    assert.ok(!markdown.includes(text), `Stale runtime-patch source remains in Markdown: ${text}`);
  }

  const page22 = pageSection(markdown, 22, 23);
  const page22Order = ["After 5.g3", "5...Nc6 6.Bb2!?N", "On 6.Rb1", "After 6.Bc4"];
  for (let index = 1; index < page22Order.length; index++) {
    assert.ok(
      page22.indexOf(page22Order[index - 1]) < page22.indexOf(page22Order[index]),
      `Incorrect PDF hierarchy on Page 22: ${page22Order.join(" -> ")}`,
    );
  }

  const title = "Sicilian Defense: Beating the Anti-Sicilian";
  assert.ok(app.includes(`<strong>${title}</strong>`));
  assert.ok(html.includes(`<title>${title}</title>`));
});
