/* Generated from app/content/chapters by `npm run chapters:sync`. */
import type { ChapterSummary } from "./lib/markdown-chapter";

export const CHAPTER_IDS = ["1", "2", "3", "4"] as const;
export type ChapterId = (typeof CHAPTER_IDS)[number];

export const CHAPTER_SUMMARIES = [
  {"id":"1","label":"Chapter 1","title":"Chapter 1: Rare Options","pageCount":17},
  {"id":"2","label":"Chapter 2","title":"Chapter 2: 2.g3 and 2.d3","pageCount":15},
  {"id":"3","label":"Chapter 3","title":"Chapter 3: 2.b3","pageCount":17},
  {"id":"4","label":"Chapter 4","title":"Chapter 4: Wing Gambit","pageCount":21},
] as const satisfies readonly ChapterSummary[];

export function isChapterId(id: string): id is ChapterId {
  return (CHAPTER_IDS as readonly string[]).includes(id);
}
