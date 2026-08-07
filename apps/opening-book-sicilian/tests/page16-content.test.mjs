import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { applyChapterContentCorrections } from "../app/lib/chapter-content-corrections.ts";
import { applyChapterPage15Corrections } from "../app/lib/chapter-page15-corrections.ts";
import { applyChapterPage16Corrections } from "../app/lib/chapter-page16-corrections.ts";

const root = new URL("../", import.meta.url);

test("printed PDF Page 16 corrections reach the rendered chapter", async () => {
  const raw = await readFile(new URL("app/content/chapters/chapter-1-sicilian.md", root), "utf8");
  const page14Corrected = applyChapterContentCorrections("chapter-1-sicilian.md", raw);
  const page15Corrected = applyChapterPage15Corrections("chapter-1-sicilian.md", page14Corrected);
  const corrected = applyChapterPage16Corrections("chapter-1-sicilian.md", page15Corrected);
  const start = corrected.indexOf("## Page 16");
  const end = corrected.indexOf("## Page 17", start);
  const page = corrected.slice(start, end);

  for (const required of [
    "3.Nf3 Bg7!",
    "4.Nc3 Nc6",
    "8...Nc5 9.Be3 Ne6",
    "10.Qb5!±",
    "8.Qxd2!N\n\nThis is relatively best.",
    "11.Qe3 Be6!∓",
    "12.Nf3 Bf5!↑",
    "18.Kf2 Bxb4",
    "20.Kf1 Nd4∓",
    "16.Bd2?! Qb5∓",
    "Black has excellent counterplay in the IQP position that has arisen, but White has an accurate reply:",
  ]) {
    assert.ok(page.includes(required), `Missing PDF Page 16 content: ${required}`);
  }

  for (const forbidden of [
    "\n6.Qd1\n\n**FEN:**",
    "9.Be3 Be6",
    "\n7.Nd2\n\nThe attempt",
    "8.Qxd2!N is relatively best.",
    "11.Qe3 Be6! leaves",
    "16.Bd2?! Qb5)",
    "18.Rfb1! White should have enough",
  ]) {
    assert.ok(!page.includes(forbidden), `Found incorrect PDF Page 16 content: ${forbidden}`);
  }

  assert.ok(
    corrected.slice(end).startsWith(
      "## Page 17\n\n<!-- FEN: r4rk1/1p3pbp/2n1b1p1/pq1p4/5P2/1BP1BN2/PP3QPP/R4RK1 w - - 0 18 -->\n18.Rfb1!\n\nWhite should have enough to maintain approximate equality.",
    ),
  );
});
