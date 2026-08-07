import type { MarkdownChapter } from "./markdown-chapter";
import { applyChapterContentCorrections } from "./chapter-content-corrections";
import { applyChapterPage10Corrections } from "./chapter-page10-corrections";
import { applyChapterPage15Corrections } from "./chapter-page15-corrections";
import { applyChapterPage16Corrections } from "./chapter-page16-corrections";
import { applyChapterPage17Corrections } from "./chapter-page17-corrections";
import { applyChapterPages1To8AnchorCorrections } from "./chapter-pages1-8-anchor-corrections";
import { applyChapterPages9To11AnchorCorrections } from "./chapter-pages9-11-anchor-corrections";
import { applyChapterPages12To17AnchorCorrections } from "./chapter-pages12-17-anchor-corrections";
import { parseChapter } from "./markdown-chapter";

const chapterModules = import.meta.glob("../content/chapters/**/*.md", { eager: true, query: "?raw", import: "default" }) as Record<string, string>;

let _chapters: MarkdownChapter[] | null = null;

function alreadyContainsChapter1Corrections(filename: string, content: string): boolean {
  if (filename !== "chapter-1-sicilian.md") return false;

  return content.includes(
    "<!-- FEN: r2q1rk1/p4pbp/bpn1p1p1/2pn2B1/8/NBPP1N2/PP2QPPP/R3R1K1 b - - 1 12 -->\n12...Qc7N∓",
  ) && content.includes(
    "<!-- FEN: r1bqkb1r/pp2pp1p/2n3p1/3pP3/4nP2/4B3/PPP3PP/RN1QKBNR w KQkq d6 0 8 -->\n8.Bd3",
  );
}

export function loadAllChapters(): MarkdownChapter[] {
  if (_chapters) return _chapters;

  const entries = Object.entries(chapterModules).map(([filepath, content]) => {
    const filename = filepath.split("/").pop() ?? "unknown.md";
    const rawContent = content as string;

    if (alreadyContainsChapter1Corrections(filename, rawContent)) {
      return parseChapter(filename, rawContent);
    }

    const page10Corrected = applyChapterPage10Corrections(filename, rawContent);
    const page14Corrected = applyChapterContentCorrections(filename, page10Corrected);
    const earlyAnchorsCorrected = applyChapterPages1To8AnchorCorrections(filename, page14Corrected);
    const page15Corrected = applyChapterPage15Corrections(filename, earlyAnchorsCorrected);
    const page16Corrected = applyChapterPage16Corrections(filename, page15Corrected);
    const page17Corrected = applyChapterPage17Corrections(filename, page16Corrected);
    const middleAnchorsCorrected = applyChapterPages9To11AnchorCorrections(filename, page17Corrected);
    const correctedContent = applyChapterPages12To17AnchorCorrections(filename, middleAnchorsCorrected);
    return parseChapter(filename, correctedContent);
  });

  entries.sort((a, b) => a.chapterNumber - b.chapterNumber);

  const seenIds = new Set<string>();
  const seenChapterNumbers = new Set<number>();
  for (const chapter of entries) {
    if (seenIds.has(chapter.id)) {
      throw new Error(`Duplicate chapter id: ${chapter.id}`);
    }
    if (seenChapterNumbers.has(chapter.chapterNumber)) {
      throw new Error(`Duplicate chapter number: ${chapter.chapterNumber}`);
    }
    seenIds.add(chapter.id);
    seenChapterNumbers.add(chapter.chapterNumber);
  }

  _chapters = entries;
  return entries;
}

export function loadChapterById(id: string): MarkdownChapter | undefined {
  return loadAllChapters().find((c) => c.id === id);
}

export function loadChapterByNumber(number: number): MarkdownChapter | undefined {
  return loadAllChapters().find((c) => c.chapterNumber === number);
}

export function getChapterSummaries() {
  return loadAllChapters().map((c) => ({
    id: c.id,
    label: `Chapter ${c.chapterNumber}`,
    title: c.title,
    pageCount: c.pages.length,
  }));
}
