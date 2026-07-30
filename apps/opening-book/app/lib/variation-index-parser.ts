import { Chess } from "chess.js";
import { resolveChessMove } from "./chess-notation";
import type { MoveNavigation, NavigationStep } from "./markdown-moves";

export interface VariationToken {
  display: string;
  navigation: MoveNavigation | null;
}

export interface VariationNode {
  label: string;
  labelDisplay: string;
  tokens: VariationToken[];
  children: VariationNode[];
}

export interface VariationIndexData {
  sharedLine: string;
  sharedTokens: VariationToken[];
  rootNodes: VariationNode[];
}

const FEN_LIKE = /^[rnbqkpRNBQKP1-8]+\/[rnbqkpRNBQKP1-8]+(?:\/[rnbqkpRNBQKP1-8]+){6}\s+(w|b)\s+/;
const LABEL_REGEX = /^([A-Z]\d*)\)\s+(.+)$/;
const MOVE_TOKEN_SPLIT = /(?:\d+\.(?:\.\.)?\s*)?(?:O-O-O|O-O|0-0-0|0-0|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?|[a-h]x[a-h][1-8]|[a-h][1-8])[+#]?[!?N=±∓∞←→*]*/g;

function parseMovesToTokens(movesStr: string): string[] {
  const tokens: string[] = [];
  for (const match of movesStr.matchAll(MOVE_TOKEN_SPLIT)) {
    const tok = match[0].trim();
    if (tok) tokens.push(tok);
  }
  return tokens;
}

function resolveTokens(
  tokens: string[],
  ancestorSteps: NavigationStep[],
  sharedSteps: NavigationStep[]
): VariationToken[] {
  const result: VariationToken[] = [];
  let currentFen = ancestorSteps.length > 0
    ? ancestorSteps[ancestorSteps.length - 1].fen
    : sharedSteps.length > 0
      ? sharedSteps[sharedSteps.length - 1].fen
      : new Chess().fen();

  const lineSteps: NavigationStep[] = [...ancestorSteps];

  for (const token of tokens) {
    const move = resolveChessMove(currentFen, token);
    if (move) {
      lineSteps.push({ fen: move.fen, label: token });
      const fullSteps = [...sharedSteps, ...lineSteps];
      result.push({
        display: token,
        navigation: { steps: fullSteps, index: fullSteps.length - 1 },
      });
      currentFen = move.fen;
    } else {
      result.push({ display: token, navigation: null });
    }
  }

  return result;
}

export function parseVariationIndexBlock(content: string): VariationIndexData {
  const lines = content.split(/\r?\n/);
  let idx = 0;

  let initialFen = "";
  let sharedMoves = "";

  if (lines.length > 0 && FEN_LIKE.test(lines[0].trim())) {
    initialFen = lines[0].trim();
    idx = 1;
  }

  const sharedParts: string[] = [];
  while (idx < lines.length) {
    const line = lines[idx].trim();
    if (!line) { idx++; continue; }
    if (LABEL_REGEX.test(line)) break;
    sharedParts.push(line);
    idx++;
  }
  sharedMoves = sharedParts.join(" ");

  const startFen = initialFen || new Chess().fen();
  const sharedTokenStrings = parseMovesToTokens(sharedMoves);
  const sharedSteps = computeSteps(startFen, sharedTokenStrings);
  const sharedTokens = resolveTokens(sharedTokenStrings, [], sharedSteps);

  const rootNodes: VariationNode[] = [];
  const stack: Array<{ node: VariationNode; ancestorSteps: NavigationStep[] }> = [];

  while (idx < lines.length) {
    const line = lines[idx];
    const trimmed = line.trim();
    if (!trimmed) { idx++; continue; }

    const indent = line.length - line.trimStart().length;
    const depth = Math.round(indent / 2);

    const labelMatch = LABEL_REGEX.exec(trimmed);
    if (!labelMatch) { idx++; continue; }

    const label = labelMatch[1];
    const labelDisplay = labelMatch[0];
    const movesStr = labelMatch[2].trim();

    const tokens = parseMovesToTokens(movesStr);

    while (stack.length > depth) stack.pop();

    const ancestorSteps = stack.length > 0 ? stack[stack.length - 1].ancestorSteps : [];

    const nodeTokens = resolveTokens(tokens, ancestorSteps, sharedSteps);

    const nodeAncestorSteps = [...ancestorSteps];
    for (const t of nodeTokens) {
      if (t.navigation) {
        const lastStep = t.navigation.steps[t.navigation.steps.length - 1];
        nodeAncestorSteps.push(lastStep);
      }
    }

    const node: VariationNode = {
      label,
      labelDisplay,
      tokens: nodeTokens,
      children: [],
    };

    if (stack.length === 0) {
      rootNodes.push(node);
    } else {
      stack[stack.length - 1].node.children.push(node);
    }

    stack.push({ node, ancestorSteps: nodeAncestorSteps });
    idx++;
  }

  return { sharedLine: sharedMoves, sharedTokens, rootNodes };
}

function computeSteps(startFen: string, tokenStrings: string[]): NavigationStep[] {
  const steps: NavigationStep[] = [{ fen: startFen, label: "Initial position" }];
  const chess = new Chess(startFen);
  for (const tok of tokenStrings) {
    const move = resolveChessMove(chess.fen(), tok);
    if (!move) break;
    chess.move(move.san);
    steps.push({ fen: chess.fen(), label: tok });
  }
  return steps;
}
