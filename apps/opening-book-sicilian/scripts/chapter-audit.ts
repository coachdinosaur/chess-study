import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Chess } from "chess.js";
import { isCoordinateMoveReference, isLikelyProseSquare } from "../app/lib/chess-notation";
import { extractFenBlocks, extractPages } from "../app/lib/markdown-chapter";
import { MarkdownMoveResolver } from "../app/lib/markdown-moves";

export interface ChapterAuditOptions {
  chapter: number;
  filename?: string;
  expectedPages?: number;
  expectedFirstPage?: number;
  expectedDiagrams?: number;
  strictMoves?: boolean;
}

export interface UnresolvedMoveAudit {
  page: number;
  line: number;
  token: string;
  text: string;
  kind: "analysis" | "prose-square" | "cross-reference" | "move-mention";
}

export interface PageAudit {
  page: number;
  headings: number;
  visibleFens: number;
  hiddenFens: number;
  detectedMoves: number;
  resolvedMoves: number;
  unresolvedAnalysis: number;
  unresolvedReferences: number;
}

export interface ChapterAuditResult {
  chapter: number;
  title: string;
  pages: number;
  visibleDiagrams: number;
  hiddenAnchors: number;
  detectedMoves: number;
  resolvedMoves: number;
  errors: string[];
  warnings: string[];
  pageAudits: PageAudit[];
  unresolved: UnresolvedMoveAudit[];
}

const EXACT_PAGE_HEADING = /^## Page (\d+)\s*$/gm;
const ANY_PAGE_HEADING = /^(#{1,6}) Page (\d+)\s*$/gm;
const TITLE_HEADING = /^# (?!Page \d+\s*$)(.+)$/gm;
const VISIBLE_FEN = /\*\*FEN:\*\*\s*\n\s*`([^`]+)`/g;
const HIDDEN_FEN = /<!--\s*FEN:\s*([^>]+?)\s*-->/g;
const NBSP = /\u00a0|&nbsp;|&#0*160;|&#x0*a0;/i;

function lineNumberAt(markdown: string, index: number): number {
  return markdown.slice(0, index).split(/\r?\n/).length;
}

function analysisTokenIndexes(line: string, tokens: Array<{ display: string; index: number }>): Set<number> {
  const analysis = new Set<number>();
  if (/(?:SOURCE MOVE REFERENCE|SOURCE ERRATUM)/.test(line)) return analysis;
  if (/\b(?:Chapter\s+\d+|next chapter|previous chapter|page\s+\d+)\b/i.test(line)) return analysis;
  if (/\b(?:relative sidelines|The main line is|The final part of the chapter covered)\b/i.test(line)) return analysis;
  if (/^#{3,5}\s+\d+\.\.\..*\bMain Line\b/i.test(line.trim())) return analysis;
  if (/^\s+[A-Z]\d*\)\s+/.test(line)) return analysis;
  const isDocumentReference = (token: { display: string; index: number }) => {
    const prefix = line.slice(Math.max(0, token.index - 32), token.index);
    const fullPrefix = line.slice(0, token.index);
    return isCoordinateMoveReference(line, token.index)
      || isLikelyProseSquare(line, token.index, token.display)
      || /(?:note on|see|transposes to)\s+$/i.test(prefix)
      || /\bfollow up with\b[^()]*$/i.test(fullPrefix);
  };
  const addAnalysisTokens = () => tokens.forEach((token, index) => {
    if (!isDocumentReference(token)) analysis.add(index);
  });
  const trimmed = line.trim();
  const headingContent = trimmed.replace(/^#{3,5}\s+/, "");
  if (/^#{3,5}\s+/.test(trimmed) && /^(?:[A-Z]\d*\)\s*)?\d+\.(?:\.\.)?\s*[KQRBNO0a-h]/.test(headingContent)) {
    addAnalysisTokens();
  }
  if (/^(?:[A-Z]\d*\)\s*)?\d+\.(?:\.\.)?\s*[KQRBNO0a-h]/.test(trimmed) && tokens.length >= 2) {
    addAnalysisTokens();
  }
  for (const match of line.matchAll(/\*\*(.+?)\*\*/g)) {
    const start = (match.index ?? 0) + 2;
    const end = start + match[1].length;
    const indexes = tokens.map((token, index) => ({ token, index }))
      .filter(({ token }) => token.index >= start && token.index < end)
      .map(({ index }) => index);
    if (indexes.length >= 2) indexes.forEach((index) => {
      if (!isDocumentReference(tokens[index])) analysis.add(index);
    });
  }
  return analysis;
}

function nonAnalysisKind(line: string, token: { display: string; index: number }): Exclude<UnresolvedMoveAudit["kind"], "analysis"> {
  if (/\b(?:Chapter\s+\d+|next chapter|previous chapter|page\s+\d+|transposes to|note on)\b/i.test(line)) return "cross-reference";
  if (isCoordinateMoveReference(line, token.index)) return "prose-square";
  if (/^[a-h][1-8](?:[!?]+|N)?$/.test(token.display)) return "prose-square";
  return "move-mention";
}

function validateFen(fen: string, label: string, errors: string[]): void {
  try { new Chess(fen); }
  catch { errors.push(`${label} contains an invalid FEN: ${fen}`); }
}

function structuralAudit(markdown: string, options: ChapterAuditOptions, errors: string[]): { title: string; pages: number[]; visibleFens: string[]; hiddenFens: string[] } {
  const titles = [...markdown.matchAll(TITLE_HEADING)].map((match) => match[1].trim());
  if (titles.length !== 1) errors.push(`Expected exactly one level-one chapter title, found ${titles.length}.`);
  const title = titles[0] ?? `Chapter ${options.chapter}`;
  if (!new RegExp(`\\bChapter\\s+${options.chapter}\\b`, "i").test(title)) errors.push(`The title does not identify Chapter ${options.chapter}: ${title}`);
  if (NBSP.test(markdown)) errors.push("Markdown contains a non-breaking space or HTML non-breaking-space entity.");

  const wrongPageHeadings = [...markdown.matchAll(ANY_PAGE_HEADING)]
    .filter((match) => match[1] !== "##")
    .map((match) => `Page ${match[2]} at line ${lineNumberAt(markdown, match.index ?? 0)} uses ${match[1].length} heading marks.`);
  if (wrongPageHeadings.length) errors.push(...wrongPageHeadings);

  const pageMatches = [...markdown.matchAll(EXACT_PAGE_HEADING)];
  const pages = pageMatches.map((match) => Number(match[1]));
  if (!pages.length) errors.push("Expected at least one exact ## Page N boundary.");
  if (options.expectedFirstPage !== undefined && pages[0] !== options.expectedFirstPage) {
    errors.push(`Expected the first page boundary to be ## Page ${options.expectedFirstPage}, found ${pages[0] ?? "none"}.`);
  }
  for (let index = 1; index < pages.length; index++) {
    if (pages[index] !== pages[index - 1] + 1) errors.push(`Page boundaries are not contiguous at ${pages[index - 1]} -> ${pages[index]}.`);
  }
  if (new Set(pages).size !== pages.length) errors.push("Page boundaries contain duplicates.");

  if (pageMatches.length) {
    const prelude = markdown.slice(0, pageMatches[0].index).replace(/^# .+$/m, "").trim();
    if (prelude) errors.push("Only the chapter title may appear before the first ## Page N boundary.");
  }

  const visibleFens = [...markdown.matchAll(VISIBLE_FEN)].map((match) => match[1].trim());
  const hiddenFens = [...markdown.matchAll(HIDDEN_FEN)].map((match) => match[1].trim());
  if (!visibleFens.length) errors.push("Expected at least one visible **FEN:** diagram.");
  visibleFens.forEach((fen, index) => validateFen(fen, `Visible diagram ${index + 1}`, errors));
  hiddenFens.forEach((fen, index) => validateFen(fen, `Hidden anchor ${index + 1}`, errors));

  if (options.expectedPages !== undefined && pages.length !== options.expectedPages) {
    errors.push(`Expected ${options.expectedPages} pages, found ${pages.length}.`);
  }
  if (options.expectedDiagrams !== undefined && visibleFens.length !== options.expectedDiagrams) {
    errors.push(`Expected ${options.expectedDiagrams} visible diagrams, found ${visibleFens.length}.`);
  }

  return { title, pages, visibleFens, hiddenFens };
}

function auditPage(page: ReturnType<typeof extractPages>[number]): { audit: PageAudit; unresolved: UnresolvedMoveAudit[] } {
  const resolver = new MarkdownMoveResolver(undefined, undefined, false);
  extractFenBlocks(page.markdown).forEach(({ fen }, index) => resolver.addRoot(fen, `Page ${page.number} position ${index + 1}`));
  const lines = page.markdown.split(/\r?\n/);
  const unresolved: UnresolvedMoveAudit[] = [];
  let detectedMoves = 0;
  let resolvedMoves = 0;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      index++;
      while (index < lines.length && !lines[index].trim().startsWith("```")) index++;
      continue;
    }
    const hidden = /^<!--\s*FEN:\s*([^>]+?)\s*-->$/.exec(trimmed);
    if (hidden) { resolver.setAnchor(hidden[1].trim(), `Page ${page.number} variation start`); continue; }
    if (trimmed.startsWith("**FEN:**")) {
      const visible = /^`([^`]+)`$/.exec(lines[index + 1]?.trim() ?? "");
      if (visible) { resolver.setAnchor(visible[1].trim(), `Page ${page.number} diagram`); index++; }
      continue;
    }
    if (/^`[^`]+`$/.test(trimmed)) continue;

    const tokens = resolver.resolveText(line);
    if (!tokens.length) continue;
    detectedMoves += tokens.length;
    resolvedMoves += tokens.filter((token) => token.navigation).length;
    const analysisIndexes = analysisTokenIndexes(line, tokens);
    for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex++) {
      const token = tokens[tokenIndex];
      if (token.navigation) continue;
      unresolved.push({
        page: page.number,
        line: index + 1,
        token: token.display,
        text: trimmed,
        kind: analysisIndexes.has(tokenIndex) ? "analysis" : nonAnalysisKind(line, token),
      });
    }
  }

  const unresolvedAnalysis = unresolved.filter((item) => item.kind === "analysis").length;
  return {
    audit: {
      page: page.number,
      headings: (page.markdown.match(/^#{3,6}\s+/gm) ?? []).length,
      visibleFens: (page.markdown.match(/^\*\*FEN:\*\*/gm) ?? []).length,
      hiddenFens: (page.markdown.match(/^<!--\s*FEN:/gm) ?? []).length,
      detectedMoves,
      resolvedMoves,
      unresolvedAnalysis,
      unresolvedReferences: unresolved.length - unresolvedAnalysis,
    },
    unresolved,
  };
}

export function auditChapterMarkdown(markdown: string, options: ChapterAuditOptions): ChapterAuditResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const structural = structuralAudit(markdown, options, errors);
  const pageResults = structural.pages.length ? extractPages(markdown).map(auditPage) : [];
  const pageAudits = pageResults.map((result) => result.audit);
  const unresolved = pageResults.flatMap((result) => result.unresolved);
  const unresolvedAnalysis = unresolved.filter((item) => item.kind === "analysis");
  const unresolvedReferences = unresolved.filter((item) => item.kind !== "analysis");
  if (options.strictMoves && unresolvedAnalysis.length) {
    errors.push(`Strict move audit found ${unresolvedAnalysis.length} unresolved token(s) in analysis sequences.`);
  }
  for (const kind of ["prose-square", "cross-reference", "move-mention"] as const) {
    const count = unresolvedReferences.filter((item) => item.kind === kind).length;
    if (count) warnings.push(`${count} unresolved ${kind} token(s) reported as non-navigation references.`);
  }

  return {
    chapter: options.chapter,
    title: structural.title,
    pages: structural.pages.length,
    visibleDiagrams: structural.visibleFens.length,
    hiddenAnchors: structural.hiddenFens.length,
    detectedMoves: pageAudits.reduce((sum, page) => sum + page.detectedMoves, 0),
    resolvedMoves: pageAudits.reduce((sum, page) => sum + page.resolvedMoves, 0),
    errors,
    warnings,
    pageAudits,
    unresolved,
  };
}

export function formatChapterAudit(result: ChapterAuditResult): string {
  const lines = [
    `Chapter ${result.chapter} audit: ${result.pages} pages, ${result.visibleDiagrams} visible diagrams, ${result.hiddenAnchors} hidden anchors, ${result.resolvedMoves}/${result.detectedMoves} detected moves navigable.`,
    ...result.pageAudits.map((page) => `Page ${page.page}: headings=${page.headings}, diagrams=${page.visibleFens}, anchors=${page.hiddenFens}, moves=${page.resolvedMoves}/${page.detectedMoves}, unresolved-analysis=${page.unresolvedAnalysis}, unresolved-reference=${page.unresolvedReferences}`),
  ];
  const strict = result.unresolved.filter((item) => item.kind === "analysis");
  const references = result.unresolved.filter((item) => item.kind !== "analysis");
  if (strict.length) {
    lines.push("Unresolved analysis tokens:");
    lines.push(...strict.map((item) => `  Page ${item.page}, line ${item.line}: ${item.token} :: ${item.text}`));
  }
  for (const kind of ["prose-square", "cross-reference", "move-mention"] as const) {
    const items = references.filter((item) => item.kind === kind);
    if (!items.length) continue;
    lines.push(`Unresolved ${kind} tokens:`);
    lines.push(...items.map((item) => `  Page ${item.page}, line ${item.line}: ${item.token} :: ${item.text}`));
  }
  if (result.warnings.length) lines.push(...result.warnings.map((warning) => `Warning: ${warning}`));
  if (result.errors.length) lines.push(...result.errors.map((error) => `Error: ${error}`));
  return lines.join("\n");
}

function parseInteger(value: string | undefined, flag: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${flag} requires a positive integer.`);
  return parsed;
}

function parseCli(argv: string[]): { markdownPath: string; options: ChapterAuditOptions } {
  const values = new Map<string, string>();
  let strictMoves = false;
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === "--strict-moves") { strictMoves = true; continue; }
    if (!argument.startsWith("--")) throw new Error(`Unexpected argument: ${argument}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value.`);
    values.set(argument, value);
    index++;
  }
  const markdownPath = values.get("--markdown");
  if (!markdownPath) throw new Error("--markdown is required.");
  return {
    markdownPath,
    options: {
      chapter: parseInteger(values.get("--chapter"), "--chapter"),
      filename: path.basename(markdownPath),
      expectedPages: values.has("--expected-pages") ? parseInteger(values.get("--expected-pages"), "--expected-pages") : undefined,
      expectedFirstPage: values.has("--expected-first-page") ? parseInteger(values.get("--expected-first-page"), "--expected-first-page") : undefined,
      expectedDiagrams: values.has("--expected-diagrams") ? parseInteger(values.get("--expected-diagrams"), "--expected-diagrams") : undefined,
      strictMoves,
    },
  };
}

function main(): void {
  const { markdownPath, options } = parseCli(process.argv.slice(2));
  const markdown = readFileSync(path.resolve(markdownPath), "utf8");
  const result = auditChapterMarkdown(markdown, options);
  console.log(formatChapterAudit(result));
  if (result.errors.length) process.exitCode = 1;
}

const directScriptName = process.argv[1] ? path.basename(process.argv[1]).toLowerCase() : "";
const moduleScriptName = path.basename(fileURLToPath(import.meta.url)).toLowerCase();

if (directScriptName === moduleScriptName || process.argv.includes("--markdown")) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
