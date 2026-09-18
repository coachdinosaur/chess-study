import { readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { extractFenBlocks, extractPages } from "../app/lib/markdown-chapter";
import { MarkdownMoveResolver } from "../app/lib/markdown-moves";

const DIRECT_RUN = process.argv.includes("--markdown");

function short(fen: string | undefined): string {
  return fen ? fen.split(" ").slice(0, 4).join(" ") : "—";
}

export function traceChapter(markdownPath: string, onlyPages?: Set<number>): void {
  const markdown = readFileSync(path.resolve(markdownPath), "utf8");
  const pages = extractPages(markdown);
  const resolver = new MarkdownMoveResolver(undefined, undefined, false);

  for (const page of pages) {
    const active = onlyPages && !onlyPages.has(page.number);
    extractFenBlocks(page.markdown).forEach(({ fen }, index) =>
      resolver.addRoot(fen, `Page ${page.number} position ${index + 1}`));
    const lines = page.markdown.split(/\r?\n/);
    if (active) {
      // Replay without logging so cross-page history still accumulates.
      for (let index = 0; index < lines.length; index++) {
        const trimmed = lines[index].trim();
        const hidden = /^<!--\s*FEN:\s*([^>]+?)\s*-->$/.exec(trimmed);
        if (hidden) { resolver.setAnchor(hidden[1].trim()); continue; }
        if (trimmed.startsWith("**FEN:**")) {
          const visible = /^`([^`]+)`$/.exec(lines[index + 1]?.trim() ?? "");
          if (visible) { resolver.setAnchor(visible[1].trim()); index++; }
          continue;
        }
        if (/^`[^`]+`$/.test(trimmed)) continue;
        resolver.resolveText(lines[index]);
      }
      continue;
    }

    console.log(`\n===== Page ${page.number} =====`);
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      const trimmed = line.trim();
      if (!trimmed) continue;
      const hidden = /^<!--\s*FEN:\s*([^>]+?)\s*-->$/.exec(trimmed);
      if (hidden) {
        resolver.setAnchor(hidden[1].trim());
        console.log(`L${index + 1} ANCHOR(hidden) -> ${short(hidden[1].trim())}`);
        continue;
      }
      if (trimmed.startsWith("**FEN:**")) {
        const visible = /^`([^`]+)`$/.exec(lines[index + 1]?.trim() ?? "");
        if (visible) {
          resolver.setAnchor(visible[1].trim());
          console.log(`L${index + 1} ANCHOR(visible) -> ${short(visible[1].trim())}`);
          index++;
        }
        continue;
      }
      if (/^`[^`]+`$/.test(trimmed)) continue;
      const tokens = resolver.resolveText(line);
      if (!tokens.length) continue;
      const parts = tokens.map((token) => {
        if (!token.navigation) return `[${token.display} ✗ unresolved]`;
        const before = token.navigation.steps[token.navigation.index - 1];
        const after = token.navigation.steps[token.navigation.index];
        return `[${token.display} ✓ ${short(before?.fen)} -> ${short(after?.fen)}]`;
      });
      const activeFen = resolver.currentNavigation().steps.at(-1)?.fen;
      console.log(`L${index + 1} ${parts.join(" ")}\n      active=${short(activeFen)}`);
    }
  }
}

if (DIRECT_RUN) {
  const args = process.argv.slice(2);
  const markdownPath = args[args.indexOf("--markdown") + 1];
  const pageArg = args.includes("--page") ? args[args.indexOf("--page") + 1] : undefined;
  const onlyPages = pageArg ? new Set(pageArg.split(",").map(Number)) : undefined;
  traceChapter(markdownPath, onlyPages);
}

export const __moduleName = path.basename(fileURLToPath(import.meta.url));
