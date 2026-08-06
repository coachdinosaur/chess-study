import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { applyChapterContentCorrections } from "../app/lib/chapter-content-corrections.ts";
import { applyChapterPage15Corrections } from "../app/lib/chapter-page15-corrections.ts";
import { applyChapterPage16Corrections } from "../app/lib/chapter-page16-corrections.ts";
import { applyChapterPage17Corrections } from "../app/lib/chapter-page17-corrections.ts";

const root = new URL("../", import.meta.url);

test("printed PDF Page 17 corrections reach the rendered chapter", async () => {
  const raw = await readFile(new URL("app/content/chapters/chapter-1-sicilian.md", root), "utf8");
  const page14Corrected = applyChapterContentCorrections("chapter-1-sicilian.md", raw);
  const page15Corrected = applyChapterPage15Corrections("chapter-1-sicilian.md", page14Corrected);
  const page16Corrected = applyChapterPage16Corrections("chapter-1-sicilian.md", page15Corrected);
  const corrected = applyChapterPage17Corrections("chapter-1-sicilian.md", page16Corrected);
  const start = corrected.indexOf("## Page 17");
  const end = corrected.indexOf("## Page 18", start);
  const page = corrected.slice(start, end);

  for (const required of [
    "18.Rfb1!\n\nWhite should have enough to maintain approximate equality.",
    "8...Bg7 9.Bc3 d6 10.Nf3 0-0",
    "11.exd6?! Bxc3+ 12.bxc3 Qa5!∓",
    "I consider the following line to best for Black:",
    "13...Qxd2+ 14.Kxd2",
    "14...Bxe5!",
    "15.Kxe2 Nd4+∓",
    "20.Rhd1 Kg7∓",
    "Black has good chances to press in the ending in view of his superior minor piece.",
    "13.0-0-0 Bh6!",
    "15...Qa4!?∓",
    "20.Qd4 e6 21.Qxb6 axb6∓",
  ]) {
    assert.ok(page.includes(required), `Missing PDF Page 17 content: ${required}`);
  }

  for (const forbidden of [
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
    "Salmensuu – Hillarp Persson",
  ]) {
    assert.ok(!page.includes(forbidden), `Found incorrect PDF Page 17 content: ${forbidden}`);
  }

  assert.ok(
    corrected.slice(end).startsWith(
      "## Page 18\n\nThe ending was slightly better for Black due to his central mass, Salmensuu – Hillarp Persson, Reykjavik 2000.",
    ),
  );
});
