/* Generated from app/content/chapters by `npm run chapters:sync`. */
import type { ChapterSummary } from "./lib/markdown-chapter";

export const CHAPTER_IDS = ["1", "2", "3", "4", "5", "6", "7", "8"] as const;
export type ChapterId = (typeof CHAPTER_IDS)[number];

export const CHAPTER_SUMMARIES = [
  {"id":"1","label":"Chapter 1","title":"Chapter 1: Rare Options","pageCount":17},
  {"id":"2","label":"Chapter 2","title":"Chapter 2: 2.g3 and 2.d3","pageCount":15},
  {"id":"3","label":"Chapter 3","title":"Chapter 3: 2.b3","pageCount":17},
  {"id":"4","label":"Chapter 4","title":"Chapter 4: Wing Gambit","pageCount":21},
  {"id":"5","label":"Chapter 5","title":"Chapter 5: c3 Sicilian – Introduction","pageCount":19},
  {"id":"6","label":"Chapter 6","title":"Chapter 6: c3 Sicilian – Rare 5th Moves","pageCount":11},
  {"id":"7","label":"Chapter 7","title":"Chapter 7: c3 Sicilian – Various 7th Moves","pageCount":29},
  {"id":"8","label":"Chapter 8","title":"Chapter 8: c3 Sicilian – 7.Bc4","pageCount":20},
] as const satisfies readonly ChapterSummary[];

export function isChapterId(id: string): id is ChapterId {
  return (CHAPTER_IDS as readonly string[]).includes(id);
}
