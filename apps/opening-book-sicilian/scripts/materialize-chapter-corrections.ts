import { readFile, writeFile } from "node:fs/promises";
import { applyChapterContentCorrections } from "../app/lib/chapter-content-corrections.ts";
import { applyChapterPage10Corrections } from "../app/lib/chapter-page10-corrections.ts";
import { applyChapterPage15Corrections } from "../app/lib/chapter-page15-corrections.ts";
import { applyChapterPage16Corrections } from "../app/lib/chapter-page16-corrections.ts";
import { applyChapterPage17Corrections } from "../app/lib/chapter-page17-corrections.ts";
import { applyChapterPages1To8AnchorCorrections } from "../app/lib/chapter-pages1-8-anchor-corrections.ts";
import { applyChapterPages9To11AnchorCorrections } from "../app/lib/chapter-pages9-11-anchor-corrections.ts";
import { applyChapterPages12To17AnchorCorrections } from "../app/lib/chapter-pages12-17-anchor-corrections.ts";

const filename = "chapter-1-sicilian.md";
const chapterUrl = new URL(`../app/content/chapters/${filename}`, import.meta.url);

let content = await readFile(chapterUrl, "utf8");
content = applyChapterPage10Corrections(filename, content);
content = applyChapterContentCorrections(filename, content);
content = applyChapterPages1To8AnchorCorrections(filename, content);
content = applyChapterPage15Corrections(filename, content);
content = applyChapterPage16Corrections(filename, content);
content = applyChapterPage17Corrections(filename, content);
content = applyChapterPages9To11AnchorCorrections(filename, content);
content = applyChapterPages12To17AnchorCorrections(filename, content);

await writeFile(chapterUrl, content, "utf8");
console.log(`Materialized PDF-derived corrections into ${filename}.`);
