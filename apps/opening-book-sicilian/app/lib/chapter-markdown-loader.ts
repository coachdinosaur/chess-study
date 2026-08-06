import type { MarkdownChapter } from "./markdown-chapter";
import { applyChapterContentCorrections } from "./chapter-content-corrections";
import { applyChapterPage10Corrections } from "./chapter-page10-corrections";
import { applyChapterPage15Corrections } from "./chapter-page15-corrections";
import { applyChapterPage16Corrections } from "./chapter-page16-corrections";
import { applyChapterPage17Corrections } from "./chapter-page17-corrections";
import { parseChapter } from "./markdown-chapter";

const chapterModules = import.meta.glob("../content/chapters/**/*.md", { eager: true, query: "?raw", import: "default" }) as Record<string, string>;

let _chapters: MarkdownChapter[] | null = null;

export function loadAllChapters(): MarkdownChapter[] {
  if (_chapters) return _chapters;

  const entries = Object.entries(chapterModules).map(([filepath, content]) => {
    const filename = filepath.split("/").pop() ?? "unknown.md";
    const page10Corrected = applyChapterPage10Corrections(filename, content as string);
    const page14Corrected = applyChapterContentCorrections(filename, page10Corrected);
    const page15Corrected = applyChapterPage15Corrections(filename, page14Corrected);
    const page16Corrected = applyChapterPage16Corrections(filename, page15Corrected);
    const correctedContent = applyChapterPage17Corrections(filename, page16Corrected);
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
