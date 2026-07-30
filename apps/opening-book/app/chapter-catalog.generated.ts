/* Generated from app/content/chapters by `npm run chapters:sync`. */
import type { ChapterSummary } from "./lib/markdown-chapter";

export const CHAPTER_IDS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16"] as const;
export type ChapterId = (typeof CHAPTER_IDS)[number];

export const CHAPTER_SUMMARIES = [
  {"id":"1","label":"Chapter 1","title":"Chapter 1 - Complete — The Catalan: 4...g6, 4...c6, and 4...c5","pageCount":17},
  {"id":"2","label":"Chapter 2","title":"Chapter 2 - Complete — The Catalan: 5...Bd7 and 8...Be7, 8...Nd5, and 8...Qd7","pageCount":10},
  {"id":"3","label":"Chapter 3","title":"Chapter 3 - Complete — The Catalan: 5...c6 with 6...b5 and 6...Bb4+","pageCount":17},
  {"id":"4","label":"Chapter 4","title":"Chapter 4 - Complete — The Catalan: 5...Bb4+ with 6...c5, 6...Be7 and 6...a5","pageCount":12},
  {"id":"5","label":"Chapter 5","title":"Chapter 5 - Complete — The Catalan: 5...Nbd7 with 6...c5, 6...c6 and 6...Nb6","pageCount":10},
  {"id":"6","label":"Chapter 6","title":"Chapter 6 - Complete — The Catalan: 5...c5 with 6...cxd4 and the forcing 6...Nc6 line","pageCount":14},
  {"id":"7","label":"Chapter 7","title":"Chapter 7 - Complete — The Catalan: 5...c5, 6...Nc6 and 7...Bd7","pageCount":25},
  {"id":"8","label":"Chapter 8","title":"Chapter 8 - Complete — The Catalan: 5...a6 and 6...b5","pageCount":14},
  {"id":"9","label":"Chapter 9","title":"Chapter 9 — Catalan 4...dxc4: 5...b5","pageCount":8},
  {"id":"10","label":"Chapter 10","title":"Chapter 10 — Catalan 4...dxc4: 5...a6 and 6...Nc6","pageCount":12},
  {"id":"11","label":"Chapter 11","title":"Chapter 11 — Catalan 4...dxc4: 5...Nc6","pageCount":23},
  {"id":"12","label":"Chapter 12","title":"Chapter 12 — Catalan 4...Bb4+: Various 5th Moves","pageCount":11},
  {"id":"13","label":"Chapter 13","title":"Chapter 13 — Catalan 4...Bb4+: Introduction to 5...Be7","pageCount":16},
  {"id":"14","label":"Chapter 14","title":"Chapter 14 – Catalan 4...Bb4+ 5...Be7 – Main Line","pageCount":32},
  {"id":"15","label":"Chapter 15","title":"Chapter 15 – Catalan 4...Be7 – Closed System","pageCount":24},
  {"id":"16","label":"Chapter 16","title":"Chapter 16 – Catalan 4...Be7 – 6...dxc4","pageCount":32},
] as const satisfies readonly ChapterSummary[];

export function isChapterId(id: string): id is ChapterId {
  return (CHAPTER_IDS as readonly string[]).includes(id);
}
