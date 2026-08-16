import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { parseChapterMarkdown } from "../scripts/chapter-system.mjs";

const chapterUrl = new URL("../app/content/chapters/chapter-4-sicilian.md", import.meta.url);
const forbiddenBundledPdfUrl = new URL("../../04_Wing_Gambit.pdf", import.meta.url);

test("Chapter 4 preserves the PDF page structure without bundling the source PDF", async () => {
  const markdown = await readFile(chapterUrl, "utf8");
  const metadata = parseChapterMarkdown("chapter-4-sicilian.md", markdown);
  const pageNumbers = [...markdown.matchAll(/^## Page (\d+)$/gm)].map((match) => Number(match[1]));

  await assert.rejects(access(forbiddenBundledPdfUrl), { code: "ENOENT" });
  assert.equal(metadata.id, 4);
  assert.equal(metadata.title, "Chapter 4: Wing Gambit");
  assert.equal(metadata.pageCount, 21);
  assert.equal(metadata.visibleFenCount, 44);
  assert.deepEqual(pageNumbers, Array.from({ length: 21 }, (_, index) => index + 56));
  assert.equal((markdown.match(/^Various 2nd Moves$/gm) ?? []).length, 1);
  assert.doesNotMatch(markdown, /^Chapter 4 –/m);
  assert.doesNotMatch(markdown, /^\d{1,3}$/m);
});

test("Chapter 4 contains representative PDF-authored lines throughout pages 56-76", async () => {
  const markdown = await readFile(chapterUrl, "utf8");

  for (const required of [
    "3...e5!",
    "5...Bc5!∓",
    "6...Bd4!N",
    "Huenerkopf – Chandler, Erlangen 1986",
    "Hector – Kudrin, Palma 1989",
    "Eade – Appleberry, Berkeley 1983",
    "Jakubiec – Oral, Czech Republic 1995",
    "Zhdanenia – Florea, corr. 2007",
    "Orienter – Grünfeld, Vienna 1946",
    "Montheard – Fressinet, Auxerre 1996",
    "Spielmann – Sämisch, Marianske Lazne 1925",
    "Kuban – K. Lutz, Oberursel 1989",
    "Gulko – Pohla, Tallinn 1977",
    "Meissen – Dias, corr. 2012",
    "Bronstein – Benko, Moscow 1949",
    "K. Lutz – De Firmian, Biel 1993",
    "M. Jones – Smyth, email 2007",
    "Baum – Contrera Poblete, corr. 2008",
    "B. Ivanov – Yaroshenko, corr. 2012",
    "B. Ivanov – Mikhalchuk, corr. 2012",
    "Vidmar – Filgueira, Villa Ballester 1996",
    "Polo Alza – Rivas Romero, corr. 2012",
    "Reinke – Ostermeyer, Dusseldorf 1995",
    "K. Lutz – Nehmert, Hessen 1991",
    "Windhausen – De Oliveira, corr. 2010",
    "Bobel – Ovaskainen, corr. 2013",
    "Dotsenko – Khismatullin, St Petersburg 2012",
    "Alcala – Bernal Varela, corr. 2011",
    "Gerasimov – Gromotka, corr. 2012",
    "Tempone – Scarella, Chaco 1996",
    "Shirazi – Bonin, New York 1990",
    "Bronstein – Deep Thought, Palo Alto (rapid) 1992",
    "Grobler – Wettstein, corr. 2012",
    "### Conclusion",
    "The Wing Gambit certainly keeps Black on his toes",
  ]) {
    assert.ok(markdown.includes(required), `Missing Chapter 4 PDF content: ${required}`);
  }
});

test("Chapter 4 release positions pass the strict move audit", async () => {
  const markdown = await readFile(chapterUrl, "utf8");
  const { auditChapterMarkdown } = await import("../scripts/chapter-audit.ts");
  const audit = auditChapterMarkdown(markdown, {
    chapter: 4,
    filename: "chapter-4-sicilian.md",
    expectedPages: 21,
    expectedFirstPage: 56,
    expectedDiagrams: 44,
    strictMoves: true,
  });

  assert.deepEqual(audit.errors, []);
  assert.equal(audit.visibleDiagrams, 44);
  assert.equal(audit.hiddenAnchors, 205);
  assert.equal(audit.unresolved.filter((item) => item.kind === "analysis").length, 0);

  for (const correctedFen of [
    "r1bqkbnr/pp1p1ppp/2n5/4p3/1pP1P3/5N2/PB1P1PPP/RN1QKB1R b KQkq - 3 5",
    "r1bq1rk1/pp2bppp/2np1n2/8/1pPNP3/P2B4/1B3PPP/RN1Q1RK1 b - - 0 10",
    "r1bqk1nr/pp1p1ppp/2n5/2b1N3/1pP1P3/8/PB1P1PPP/RN1QKB1R b KQkq - 0 6",
    "r1b1k1nr/pp1p1ppp/8/8/1pPnq3/5N2/P2PBPPP/RN1Q1RK1 b kq - 1 10",
    "rnb1kbnr/pp2pppp/8/3q4/1p1P4/8/PBP2PPP/RN1QKBNR b KQkq - 0 5",
    "rnb2rk1/pp2bppp/4pn2/q7/2BP4/2N5/PB2NPPP/R2Q1RK1 w - - 4 11",
    "r1b1kb1r/pp3ppp/2n2n2/q7/3Pp3/P1N2P2/1B2Q1PP/R3KBNR w KQkq - 1 11",
    "rnb1kbnr/pp2pppp/8/3q4/1pP5/8/PB1P1PPP/RN1QKBNR b KQkq c3 0 5",
    "rnb1kbnr/pp2pppp/8/q7/2B5/2N5/PB1P1PPP/R2QK1NR b KQkq - 2 7",
    "rnb2rk1/pp2bppp/5n2/q2p4/2B5/2N2N2/PB3PPP/R2Q1RK1 w - - 0 12",
    "r1b1k2r/pp2bp1p/4qp2/8/1n1P4/N1P2N2/4QPPP/R3KB1R b KQkq - 0 13",
    "r2qkb1r/pp3ppp/4bn2/8/1nN5/2N2P2/1BPP2PP/R2QKB1R w KQkq - 2 12",
    "r1b1k2r/pp3ppp/2n2n2/3qB3/1b6/5N2/2PP1PPP/RN1QKB1R w KQkq - 1 9",
    "r1b1r1k1/ppb2p1p/2n1q3/5p2/8/2P1NNP1/3PQPBP/R3K2R b KQ - 2 16",
    "rnbqkbnr/pp2pppp/8/3P4/1p1P4/8/P1P2PPP/RNBQKBNR b KQkq - 0 4",
    "rn2kb1r/pp2pppp/5n2/3q4/1p1P2b1/P4N2/2P1BPPP/RNBQK2R b KQkq - 3 7",
    "r3k2r/pp3ppp/2n1pn2/3q3b/1bPP4/5N1P/4BPP1/RNBQ1RK1 b kq - 0 11",
    "r1bqkbnr/pp2pppp/2n5/3pP3/1p1P4/P7/2P2PPP/RNBQKBNR b KQkq - 0 5",
    "r3kbnr/pp3ppp/1qn1p3/3pPb2/1p1P4/P3BN2/2P2PPP/RN1QKB1R w KQkq - 0 8",
    "r3kbnr/pp3ppp/1qn1p3/3pP3/3P4/N2QBN2/2P2PPP/R3K2R b KQkq - 1 10",
    "r3k1nr/pp3ppp/1qn1p3/3pP3/3P4/R2QBN2/2P1NPPP/4K2R b Kkq - 0 11",
    "rnb1kbnr/pp2pppp/8/3q4/1p6/P7/2PP1PPP/RNBQKBNR w KQkq - 0 5",
    "r1b1k2r/pp2nppp/2n5/4p3/8/2BB1N2/2PP1PPP/R3K2R b KQkq - 0 11",
    "r1bqk2r/pp3ppp/2n2n2/1N2p3/1b6/5N2/1BPPBPPP/R2QK2R b KQkq - 7 10",
    "rnbq1rk1/pp2bppp/5n2/1N2N3/2P1p3/8/1B1PBPPP/R2Q1RK1 b - - 6 12",
    "r1b1k2r/ppq1nppp/2n5/4p3/2P5/B2BRN2/3P1PPP/3QK2R b Kkq - 6 12",
    "r1b1k2r/pp2nppp/1Nnb4/3qp3/8/2P2N2/3P1PPP/R1BQKB1R b KQkq - 3 10",
    "5bk1/1pQ2ppp/1p2b3/5q2/1n1P4/4p3/1B1PBPPP/4K2R w K - 0 20",
    "r1b1k1nr/pp3ppp/2nb4/3qp3/2B5/2P2N2/3P1PPP/RNBQK2R b KQkq - 2 9",
    "r3k1nr/pp3ppp/2nbb3/4p3/2B1q3/N1P2N2/3P1PPP/R1BQ1K1R w kq - 3 11",
    "rnbqkbnr/pp3ppp/8/1B1pp3/1p2P3/P4N2/2PP1PPP/RNBQK2R b KQkq - 1 5",
    "r1bqk2r/pp1pbppp/2nn4/1B2p3/1P2P3/5N2/2PP1PPP/RNBQR1K1 w kq - 3 9",
    "r1bqkbnr/pp1p1ppp/2n5/4p3/1p2P3/P4N2/1BPP1PPP/RN1QKB1R b KQkq - 1 5",
    "r1bqk2r/pp1p1ppp/2n2n2/2b1p3/1PB1P3/5N2/2PPQPPP/RNB1K2R b KQkq - 0 7",
    "r1bq1rk1/pp2bppp/2np1n2/4p3/2BPP3/2P2N2/4QPPP/RNB2RK1 w - - 0 11",
    "r1b1kb1r/pp2pppp/2n2n2/q7/1p1P4/5N2/P1P1BPPP/RNBQ1RK1 w kq - 2 8",
    "r1b1kbnr/pp2pppp/2n5/q2P4/8/2N2N2/P4PPP/R1BQKB1R b KQkq - 0 8",
    "r1b1k1nr/pp3ppp/2nb4/qB1p4/8/P1N2N2/3B1PPP/R1Q1K2R b KQkq - 2 12",
    "r1b1r1k1/p3nppp/2p2q2/2Qp4/1B6/P4N2/5PPP/R3R1K1 b - - 3 19",
    "r1b1kbnr/pp3ppp/2n1p3/q7/3P4/2N2N2/P2B1PPP/R2QKB1R w KQkq - 0 9",
    "r1br2k1/pp3ppp/2nqpn2/8/P1BP4/2B2N2/2Q2PPP/2RR2K1 b - - 2 16",
    "r4rk1/ppqbbppp/2n1pn2/8/3P4/2NB1N2/P2BQPPP/1RR3K1 b - - 11 14",
    "rq1r2k1/1p1bbppp/p1n1p3/3n4/3PB3/2N2NP1/P2BQP1P/1RR3K1 b - - 1 18",
    "r1bq1rk1/pp1nbppp/2np4/5N2/2P1P3/N2B4/1B3PPP/R2Q1RK1 b - - 2 12",
    "rnb1k2r/pp3ppp/5n2/3qB3/1b6/5N2/2PP1PPP/RN1QKB1R b KQkq - 0 8",
    "r1bq1rk1/p3bppp/2N2n2/8/8/2P5/3P1PPP/R1BQKB1R b KQ - 0 13",
  ]) {
    assert.ok(markdown.includes(correctedFen), `Missing corrected Chapter 4 position: ${correctedFen}`);
  }
});

