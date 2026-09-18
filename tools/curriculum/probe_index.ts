/**
 * Probe: how many index-labeled variations does each Catalan chapter declare?
 * Dry-run of the compiler's spine pass — reads the first content page,
 * extracts the indented A)/A1)/B2) index block, counts nodes.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Chess } from "../../vendor/chess.js";
import { parseChapter, extractFenBlocks } from "../../apps/opening-book/app/lib/markdown-chapter.ts";
import { parseVariationIndexBlock, type VariationNode } from "../../apps/opening-book/app/lib/variation-index-parser.ts";
import { moveNumberKey } from "../../apps/opening-book/app/lib/chess-notation.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const CHAPTERS_DIR = join(
  HERE,
  "../../apps/opening-book/app/content/chapters",
);

function countTree(nodes: VariationNode[]): number {
  let count = 0;
  for (const node of nodes) count += 1 + countTree(node.children);
  return count;
}

function listTree(nodes: VariationNode[], depth = 0): string[] {
  const out: string[] = [];
  for (const node of nodes) {
    out.push(`${"  ".repeat(depth)}${node.label}`);
    out.push(...listTree(node.children, depth + 1));
  }
  return out;
}

function indexSlice(firstPage: string): { text: string; rootFen: string | null } {
  const lines = firstPage.split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^[A-Z]\d*\)\s+/.test(lines[i].trim())) { start = i; break; }
  }
  if (start < 0) return { text: "", rootFen: null };
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.startsWith("**") || t.startsWith("---") || t.startsWith("##")) { end = i; break; }
  }
  // Root FEN: first anchor whose move-number matches the first label token.
  const firstMove = /^[A-Z]\d*\)\s+(\S+)/.exec(lines[start].trim())?.[1] ?? "";
  const want = moveNumberKey(firstMove);
  let rootFen: string | null = null;
  for (const block of extractFenBlocks(firstPage)) {
    const parts = block.fen.split(/\s+/);
    if (parts.length >= 6 && `${parts[5]}:${parts[1]}` === want) {
      rootFen = block.fen;
      break;
    }
  }
  return { text: lines.slice(start, end).join("\n"), rootFen };
}

const files = readdirSync(CHAPTERS_DIR).filter((f) => f.includes("catalan")).sort(
  (a, b) => Number(/\d+/.exec(a)![0]) - Number(/\d+/.exec(b)![0]),
);

let total = 0;
for (const file of files) {
  const content = readFileSync(join(CHAPTERS_DIR, file), "utf8");
  const chapter = parseChapter(file, content);
  const page = chapter.pages[0];
  const { text, rootFen } = indexSlice(page.markdown);
  const blockText = rootFen ? `${rootFen}\n${text}` : text;
  let count = 0;
  let roots: string[] = [];
  let resolved = 0;
  let unresolved = 0;
  try {
    const data = parseVariationIndexBlock(blockText);
    count = countTree(data.rootNodes);
    roots = listTree(data.rootNodes);
    const walk = (nodes: VariationNode[]) => {
      for (const node of nodes) {
        for (const t of node.tokens) {
          if (t.navigation) resolved++;
          else unresolved++;
        }
        walk(node.children);
      }
    };
    walk(data.rootNodes);
  } catch (error) {
    console.log(`${file}: PARSE ERROR ${(error as Error).message}`);
    continue;
  }
  total += count;
  console.log(
    `ch${chapter.chapterNumber.toString().padStart(2)} ${file}: ${count} variations ` +
    `(${roots.length ? roots.slice(0, 20).join(",") : "-"}) ` +
    `resolved=${resolved} unresolved=${unresolved} rootFen=${rootFen ? "ok" : "MISSING"}`,
  );
}
console.log(`\nTOTAL index variations across 16 chapters: ${total}`);
