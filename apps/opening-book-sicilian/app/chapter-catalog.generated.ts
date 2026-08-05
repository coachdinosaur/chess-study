/* Generated from app/content/chapters by `npm run chapters:sync`. */
import type { ChapterSummary } from "./lib/markdown-chapter";

export const CHAPTER_IDS = ["1"] as const;
export type ChapterId = (typeof CHAPTER_IDS)[number];

export const CHAPTER_SUMMARIES = [
  {"id":"1","label":"Chapter 1","title":"Chapter 1: Rare Options","pageCount":14},
] as const satisfies readonly ChapterSummary[];

export function isChapterId(id: string): id is ChapterId {
  return (CHAPTER_IDS as readonly string[]).includes(id);
}
