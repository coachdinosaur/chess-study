import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Chess } from "chess.js";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const chaptersDirectory = path.join(appRoot, "app", "content", "chapters");
const catalogPath = path.join(appRoot, "app", "chapter-catalog.generated.ts");
const CHAPTER_FILE = /^chapter-(\d+)-sicilian\.md$/;
const NBSP_REGEX = /\u00a0|&nbsp;|&#0*160;|&#x0*a0;/i;

function fail(message) {
  throw new Error(message);
}

function lineNumberAt(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}

export function parseChapterMarkdown(filename, markdown) {
  const fileMatch = CHAPTER_FILE.exec(filename);
  if (!fileMatch) fail(`Invalid chapter filename ${filename}; expected chapter-N-sicilian.md.`);

  const nbspMatch = NBSP_REGEX.exec(markdown);
  if (nbspMatch) {
    const line = lineNumberAt(markdown, nbspMatch.index);
    fail(`${filename}:${line}: contains a non-breaking space; use a regular space instead.`);
  }

  const id = Number(fileMatch[1]);
  const titles = [...markdown.matchAll(/^# (.+)$/gm)].map((match) => match[1].trim());
  if (titles.length !== 1) {
    fail(`${filename} must contain exactly one level-one title (# Chapter Title). Found: ${titles.length}.`);
  }

  const pageMatches = [...markdown.matchAll(/^## Page (\d+)\s*$/gm)];
  if (!pageMatches.length) fail(`${filename} needs at least one ## Page N boundary.`);

  const pageNumbers = pageMatches.map((match) => Number(match[1]));
  for (let index = 1; index < pageMatches.length; index++) {
    const prev = Number(pageMatches[index - 1][1]);
    const curr = Number(pageMatches[index][1]);
    if (curr !== prev + 1) {
      const line = lineNumberAt(markdown, pageMatches[index].index ?? 0);
      fail(`${filename}:${line}: page boundaries must be contiguous and ascending; expected Page ${prev + 1}, found Page ${curr}.`);
    }
  }

  const visibleFens = [];
  for (const match of markdown.matchAll(/\*\*FEN:\*\*\s*\n\s*`([^`]+)`/g)) {
    const fen = match[1].trim();
    const line = lineNumberAt(markdown, match.index ?? 0);
    try {
      new Chess(fen);
    } catch {
      fail(`${filename}:${line}: contains an invalid FEN: ${fen}`);
    }
    visibleFens.push(fen);
  }

  const hiddenFens = [];
  for (const match of markdown.matchAll(/<!--\s*FEN:\s*([^>]+?)\s*-->/g)) {
    const fen = match[1].trim();
    const line = lineNumberAt(markdown, match.index ?? 0);
    try {
      new Chess(fen);
    } catch {
      fail(`${filename}:${line}: contains an invalid FEN: ${fen}`);
    }
    hiddenFens.push(fen);
  }

  if (!visibleFens.length) fail(`${filename} needs at least one visible FEN code block.`);

  return {
    id,
    title: titles[0],
    pageCount: pageNumbers.length,
    firstPage: pageNumbers[0],
    lastPage: pageNumbers[pageNumbers.length - 1],
    pageNumbers,
    visibleFenCount: visibleFens.length,
    hiddenFenCount: hiddenFens.length,
  };
}

export async function discoverChapters() {
  const filenames = (await readdir(chaptersDirectory)).filter((name) => CHAPTER_FILE.test(name));
  const chapters = await Promise.all(
    filenames.map(async (filename) =>
      parseChapterMarkdown(filename, await readFile(path.join(chaptersDirectory, filename), "utf8"))
    )
  );
  chapters.sort((a, b) => a.id - b.id);
  chapters.forEach((chapter, index) => {
    if (chapter.id !== index + 1) {
      fail(`Markdown chapters must be contiguous from Chapter 1; expected ${index + 1}, found ${chapter.id}.`);
    }
  });
  return chapters;
}

export function catalogSource(chapters) {
  const ids = chapters.map((chapter) => JSON.stringify(String(chapter.id))).join(", ");
  const summaries = chapters
    .map(
      (chapter) =>
        `  ${JSON.stringify({
          id: String(chapter.id),
          label: `Chapter ${chapter.id}`,
          title: chapter.title,
          pageCount: chapter.pageCount,
        })},`
    )
    .join("\n");
  return `/* Generated from app/content/chapters by \`npm run chapters:sync\`. */\nimport type { ChapterSummary } from "./lib/markdown-chapter";\n\nexport const CHAPTER_IDS = [${ids}] as const;\nexport type ChapterId = (typeof CHAPTER_IDS)[number];\n\nexport const CHAPTER_SUMMARIES = [\n${summaries}\n] as const satisfies readonly ChapterSummary[];\n\nexport function isChapterId(id: string): id is ChapterId {\n  return (CHAPTER_IDS as readonly string[]).includes(id);\n}\n`;
}

export async function createChapter({ title, pageCount = 5, startPage } = {}) {
  const chapters = await discoverChapters();
  const nextId = chapters.length + 1;
  const resolvedTitle = title?.trim() || `Sicilian Defense – Part ${nextId}`;

  let calculatedStartPage = Number(startPage);
  if (!calculatedStartPage || Number.isNaN(calculatedStartPage)) {
    if (chapters.length > 0) {
      const lastChapter = chapters[chapters.length - 1];
      calculatedStartPage = lastChapter.lastPage + 1;
    } else {
      calculatedStartPage = 1;
    }
  }

  const filename = `chapter-${nextId}-sicilian.md`;
  const filePath = path.join(chaptersDirectory, filename);

  const numPages = Math.max(1, Number(pageCount) || 5);
  const pages = [];
  const initialFen = "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";

  // First page
  pages.push(
    `## Page ${calculatedStartPage}\n\n# Chapter ${nextId}: ${resolvedTitle}\n\n**FEN:**\n\`${initialFen}\`\n\n<!-- SOURCE MOVE REFERENCE: Introductory moves. -->\n**1.e4 c5**\n\nIntroductory discussion and key ideas for ${resolvedTitle}...\n`
  );

  // Subsequent pages
  for (let i = 1; i < numPages; i++) {
    const pageNum = calculatedStartPage + i;
    pages.push(
      `## Page ${pageNum}\n\n<!-- FEN: ${initialFen} -->\n**1.e4 c5 2.Nf3**\n\nAnalysis and commentary for Page ${pageNum}...\n`
    );
  }

  const content = pages.join("\n");
  await writeFile(filePath, content, "utf8");

  // Automatically update catalog
  const updatedChapters = await discoverChapters();
  await writeFile(catalogPath, catalogSource(updatedChapters), "utf8");

  return {
    id: nextId,
    filename,
    filePath,
    title: resolvedTitle,
    firstPage: calculatedStartPage,
    lastPage: calculatedStartPage + numPages - 1,
    pageCount: numPages,
  };
}

export async function addPage({ chapterId, count = 1 } = {}) {
  const chapters = await discoverChapters();
  const targetId = Number(chapterId);
  const chapter = chapters.find((c) => c.id === targetId);
  if (!chapter) {
    fail(`Chapter ${chapterId} not found. Existing chapters: ${chapters.map((c) => c.id).join(", ")}`);
  }

  const filename = `chapter-${targetId}-sicilian.md`;
  const filePath = path.join(chaptersDirectory, filename);
  const currentMarkdown = await readFile(filePath, "utf8");

  const numPages = Math.max(1, Number(count) || 1);
  const lastPage = chapter.lastPage;
  const initialFen = "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";

  const newPages = [];
  for (let i = 1; i <= numPages; i++) {
    const pageNum = lastPage + i;
    newPages.push(
      `## Page ${pageNum}\n\n<!-- FEN: ${initialFen} -->\n**1.e4 c5**\n\nAnalysis and commentary for Page ${pageNum}...\n`
    );
  }

  const updatedMarkdown = currentMarkdown.trimEnd() + "\n\n" + newPages.join("\n");
  await writeFile(filePath, updatedMarkdown, "utf8");

  // Re-sync catalog
  const updatedChapters = await discoverChapters();
  await writeFile(catalogPath, catalogSource(updatedChapters), "utf8");

  return {
    chapterId: targetId,
    filename,
    addedPages: numPages,
    firstNewPage: lastPage + 1,
    lastNewPage: lastPage + numPages,
    totalPageCount: chapter.pageCount + numPages,
  };
}

function parseCliArgs(args) {
  const options = { _: [] };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        options[key] = next;
        i++;
      } else {
        options[key] = true;
      }
    } else {
      options._.push(arg);
    }
  }
  return options;
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const command = args._[0] ?? "status";
  const chapters = await discoverChapters();
  const nextChapter = chapters.length + 1;
  const lastPage = chapters.length > 0 ? chapters[chapters.length - 1].lastPage : 0;
  const nextExpectedPage = lastPage + 1;

  if (command === "status") {
    console.log(`\n=== Sicilian Defense Opening Book Catalog Status ===\n`);
    console.log(`Chapters detected: ${chapters.length}`);
    console.log(`Next expected Chapter: ${nextChapter}`);
    console.log(`Next expected start page: Page ${nextExpectedPage}\n`);
    console.log(`| Chapter | Title | Page Range | Pages | FENs (Vis/Hid) |`);
    console.log(`|---|---|---|---|---|`);
    for (const c of chapters) {
      console.log(
        `| ${c.id} | ${c.title} | ${c.firstPage}-${c.lastPage} | ${c.pageCount} | ${c.visibleFenCount}/${c.hiddenFenCount} |`
      );
    }
    const totalPositions = chapters.reduce((total, c) => total + c.visibleFenCount + c.hiddenFenCount, 0);
    const totalPages = chapters.reduce((total, c) => total + c.pageCount, 0);
    console.log(`\nTotal: ${chapters.length} chapters, ${totalPages} pages, ${totalPositions} positions.\n`);
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

  if (command === "new" || command === "new-chapter" || command === "add-chapter") {
    const title = args.title ?? args._[1];
    const pages = args.pages ?? args._[2];
    const startPage = args["start-page"] ?? args.startPage;
    const result = await createChapter({ title, pageCount: pages, startPage });
    console.log(`\n[SUCCESS] Created new chapter:`);
    console.log(`  File: app/content/chapters/${result.filename}`);
    console.log(`  Title: ${result.title}`);
    console.log(`  Pages: ${result.firstPage} – ${result.lastPage} (${result.pageCount} pages)`);
    console.log(`  Catalog synchronized automatically.\n`);
    return;
  }

  if (command === "add-page" || command === "new-page") {
    const chapterId = args.chapter ?? args._[1];
    if (!chapterId) {
      fail("Missing target chapter ID. Example: node scripts/chapter-system.mjs add-page 5 --count 2");
    }
    const count = args.count ?? args.pages ?? args._[2] ?? 1;
    const result = await addPage({ chapterId, count });
    console.log(`\n[SUCCESS] Appended pages to Chapter ${result.chapterId}:`);
    console.log(`  File: app/content/chapters/${result.filename}`);
    console.log(`  Added: Page ${result.firstNewPage}${result.addedPages > 1 ? ` – ${result.lastNewPage}` : ""}`);
    console.log(`  Total pages in chapter: ${result.totalPageCount}`);
    console.log(`  Catalog synchronized automatically.\n`);
    return;
  }

  fail(`Unknown command "${command}". Available commands: status, check, sync, new-chapter, add-page.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
