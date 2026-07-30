import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Chess } from "chess.js";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const chaptersDirectory = path.join(appRoot, "app", "content", "chapters");
const catalogPath = path.join(appRoot, "app", "chapter-catalog.generated.ts");
const CHAPTER_FILE = /^chapter-(\d+)-catalan\.md$/;

function fail(message) {
  throw new Error(message);
}

export function parseChapterMarkdown(filename, markdown) {
  const fileMatch = CHAPTER_FILE.exec(filename);
  if (!fileMatch) fail(`Invalid chapter filename ${filename}; expected chapter-N-catalan.md.`);
  if (/\u00a0|&nbsp;|&#0*160;|&#x0*a0;/i.test(markdown)) fail(`${filename} contains a non-breaking space; use a regular space instead.`);
  const id = Number(fileMatch[1]);
  const titles = [...markdown.matchAll(/^# (.+)$/gm)].map((match) => match[1].trim());
  if (titles.length !== 1) fail(`${filename} must contain exactly one level-one title.`);

  const pageNumbers = [...markdown.matchAll(/^## Page (\d+)\s*$/gm)].map((match) => Number(match[1]));
  if (!pageNumbers.length) fail(`${filename} needs at least one ## Page N boundary.`);
  for (let index = 1; index < pageNumbers.length; index++) {
    if (pageNumbers[index] !== pageNumbers[index - 1] + 1) fail(`${filename} page boundaries must be contiguous and ascending.`);
  }

  const visibleFens = [...markdown.matchAll(/\*\*FEN:\*\*\s*\n\s*`([^`]+)`/g)].map((match) => match[1].trim());
  const hiddenFens = [...markdown.matchAll(/<!--\s*FEN:\s*([^>]+?)\s*-->/g)].map((match) => match[1].trim());
  if (!visibleFens.length) fail(`${filename} needs at least one visible FEN code block.`);
  for (const fen of [...visibleFens, ...hiddenFens]) {
    try { new Chess(fen); }
    catch { fail(`${filename} contains an invalid FEN: ${fen}`); }
  }

  return {
    id,
    title: titles[0],
    pageCount: pageNumbers.length,
    visibleFenCount: visibleFens.length,
    hiddenFenCount: hiddenFens.length,
  };
}

export async function discoverChapters() {
  const filenames = (await readdir(chaptersDirectory)).filter((name) => CHAPTER_FILE.test(name));
  const chapters = await Promise.all(filenames.map(async (filename) => parseChapterMarkdown(filename, await readFile(path.join(chaptersDirectory, filename), "utf8"))));
  chapters.sort((a, b) => a.id - b.id);
  chapters.forEach((chapter, index) => {
    if (chapter.id !== index + 1) fail(`Markdown chapters must be contiguous from Chapter 1; expected ${index + 1}, found ${chapter.id}.`);
  });
  return chapters;
}

export function catalogSource(chapters) {
  const ids = chapters.map((chapter) => JSON.stringify(String(chapter.id))).join(", ");
  const summaries = chapters.map((chapter) => `  ${JSON.stringify({
    id: String(chapter.id),
    label: `Chapter ${chapter.id}`,
    title: chapter.title,
    pageCount: chapter.pageCount,
  })},`).join("\n");
  return `/* Generated from app/content/chapters by \`npm run chapters:sync\`. */\nimport type { ChapterSummary } from "./lib/markdown-chapter";\n\nexport const CHAPTER_IDS = [${ids}] as const;\nexport type ChapterId = (typeof CHAPTER_IDS)[number];\n\nexport const CHAPTER_SUMMARIES = [\n${summaries}\n] as const satisfies readonly ChapterSummary[];\n\nexport function isChapterId(id: string): id is ChapterId {\n  return (CHAPTER_IDS as readonly string[]).includes(id);\n}\n`;
}

async function main() {
  const command = process.argv[2] ?? "status";
  const chapters = await discoverChapters();
  const next = chapters.length + 1;
  if (command === "status") {
    console.log(`Chapter status: ${chapters.length} Markdown chapters (${chapters.map((chapter) => chapter.id).join(", ")}); next expected Chapter ${next}.`);
    return;
  }
  if (command === "sync") {
    await writeFile(catalogPath, catalogSource(chapters), "utf8");
    console.log(`Synced ${chapters.length} Markdown chapters into app/chapter-catalog.generated.ts.`);
    return;
  }
  if (command === "check") {
    const expected = catalogSource(chapters);
    const actual = await readFile(catalogPath, "utf8");
    if (actual !== expected) fail("Chapter catalog is stale; run npm run chapters:sync.");
    const positions = chapters.reduce((total, chapter) => total + chapter.visibleFenCount + chapter.hiddenFenCount, 0);
    console.log(`Chapter check passed: ${chapters.length} Markdown chapters, ${positions} validated FEN anchors.`);
    return;
  }
  fail(`Unknown command ${command}; use status, sync, or check.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
