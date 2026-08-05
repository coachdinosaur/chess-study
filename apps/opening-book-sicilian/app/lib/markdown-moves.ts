import { Chess } from "chess.js";
import { fenMoveNumberKey, indexChessMoves, isCoordinateMoveReference, isLikelyProseSquare, moveNumberKey, moveNumberMatchesFen, normalizeSan, resolveChessMove, SOURCE_MOVE_TOKEN, type ResolvedChessMove } from "./chess-notation";

export type NavigationStep = { fen: string; label: string };
export type MoveNavigation = { steps: NavigationStep[]; index: number };
export type MarkdownMoveToken = { display: string; index: number; navigation: MoveNavigation | null };

type PositionPath = { fen: string; steps: NavigationStep[] };
type RootMoveCandidate = { before: PositionPath; move: ResolvedChessMove };

const START_FEN = new Chess().fen();

function uniqueCandidates(candidates: PositionPath[]): PositionPath[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.fen)) return false;
    seen.add(candidate.fen);
    return true;
  });
}

function pathExtends(steps: NavigationStep[], prefix: NavigationStep[]): boolean {
  if (steps.length <= prefix.length) return false;
  return prefix.every((step, index) => step.fen === steps[index]?.fen && step.label === steps[index]?.label);
}

function parenDepthDeltaAt(text: string, pos: number): number {
  let depth = 0;
  for (let index = 0; index < pos; index++) {
    if (text[index] === "(" || text[index] === "[") depth++;
    else if (text[index] === ")" || text[index] === "]") depth--;
  }
  return depth;
}

export class MarkdownMoveResolver {
  private active: PositionPath;
  private history: PositionPath[];
  private historyByMove: Map<string, PositionPath[]>;
  private knownRootFens: Set<string>;
  private knownMoveIndex: Map<string, RootMoveCandidate[]>;
  private moveCache: Map<string, ReturnType<typeof resolveChessMove>>;
  private navigations: MoveNavigation[];
  private trackNavigationExtensions: boolean;
  private variationBase: PositionPath | null;
  private variationStack: Array<{ indent: number; path: PositionPath }>;
  private inlineDepth: number;
  private inlineReturnStates: PositionPath[];
  private inlineBranchStarts: PositionPath[];
  private inlineLastBefore: PositionPath;

  constructor(fen = START_FEN, label = "Initial position", trackNavigationExtensions = true) {
    const root = { fen, steps: [{ fen, label }] };
    this.active = root;
    this.history = [];
    this.historyByMove = new Map();
    this.knownRootFens = new Set();
    this.knownMoveIndex = new Map();
    this.moveCache = new Map();
    this.navigations = [];
    this.trackNavigationExtensions = trackNavigationExtensions;
    this.variationBase = null;
    this.variationStack = [];
    this.inlineDepth = 0;
    this.inlineReturnStates = [];
    this.inlineBranchStarts = [];
    this.inlineLastBefore = root;
    this.indexRoot(root);
    this.resetHistory(root);
  }

  addRoot(fen: string, label = "Known chapter position"): void {
    new Chess(fen);
    const root = { fen, steps: [{ fen, label }] };
    this.indexRoot(root);
  }

  setAnchor(fen: string, label = "Diagram position"): MoveNavigation {
    new Chess(fen);
    const root = { fen, steps: [{ fen, label }] };
    this.indexRoot(root);
    this.active = root;
    this.variationBase = null;
    this.variationStack = [];
    this.inlineDepth = 0;
    this.inlineReturnStates = [];
    this.inlineBranchStarts = [];
    this.inlineLastBefore = root;
    this.remember(root);
    if (root.fen !== START_FEN) {
      this.remember({ fen: START_FEN, steps: [{ fen: START_FEN, label: "Initial position" }] });
    }
    return { steps: root.steps, index: 0 };
  }

  private indexRoot(root: PositionPath): void {
    if (this.knownRootFens.has(root.fen)) return;
    this.knownRootFens.add(root.fen);
    const aliases = new Map<string, ResolvedChessMove[]>();
    for (const move of indexChessMoves(root.fen)) {
      for (const alias of move.aliases) {
        const candidates = aliases.get(alias) ?? [];
        candidates.push(move);
        aliases.set(alias, candidates);
      }
    }
    const moveKey = fenMoveNumberKey(root.fen);
    for (const [alias, moves] of aliases) {
      if (moves.length !== 1) continue;
      const key = `${moveKey}\u0000${alias}`;
      const candidates = this.knownMoveIndex.get(key) ?? [];
      candidates.push({ before: root, move: moves[0] });
      this.knownMoveIndex.set(key, candidates);
    }
  }

  private resetHistory(root: PositionPath): void {
    this.history = [];
    this.historyByMove = new Map();
    this.remember(root);
    if (root.fen !== START_FEN) {
      this.remember({ fen: START_FEN, steps: [{ fen: START_FEN, label: "Initial position" }] });
    }
  }

  private remember(path: PositionPath): void {
    if (!this.history.some((candidate) => candidate.fen === path.fen)) this.history.push(path);
    const key = fenMoveNumberKey(path.fen);
    const candidates = this.historyByMove.get(key) ?? [];
    if (!candidates.some((candidate) => candidate.fen === path.fen)) {
      candidates.push(path);
      this.historyByMove.set(key, candidates);
    }
  }

  private resolveFrom(fen: string, display: string): ReturnType<typeof resolveChessMove> {
    const key = `${fen}\u0000${display}`;
    if (this.moveCache.has(key)) return this.moveCache.get(key) ?? null;
    const move = resolveChessMove(fen, display);
    this.moveCache.set(key, move);
    return move;
  }

  private createNavigation(path: PositionPath): MoveNavigation {
    if (!this.trackNavigationExtensions) return { steps: path.steps, index: path.steps.length - 1 };
    for (const navigation of this.navigations) {
      if (pathExtends(path.steps, navigation.steps)) navigation.steps = path.steps;
    }
    const navigation = { steps: path.steps, index: path.steps.length - 1 };
    this.navigations.push(navigation);
    return navigation;
  }

  currentNavigation(): MoveNavigation {
    return { steps: this.active.steps, index: this.active.steps.length - 1 };
  }

  resolveText(text: string): MarkdownMoveToken[] {
    if (text.includes("\n")) {
      const tokens: MarkdownMoveToken[] = [];
      let offset = 0;
      for (const line of text.split("\n")) {
        tokens.push(...this.resolveText(line).map((token) => ({ ...token, index: token.index + offset })));
        offset += line.length + 1;
      }
      return tokens;
    }

    const variationLine = /^(\s*)[A-Z]\d*\)\s+/.exec(text);
    if (variationLine) {
      if (!this.variationBase) {
        this.variationBase = this.active;
        this.variationStack = [];
      }
      const indent = variationLine[1].length;
      while (this.variationStack.length && this.variationStack[this.variationStack.length - 1].indent >= indent) {
        this.variationStack.pop();
      }
      const parent = this.variationStack.at(-1)?.path ?? this.variationBase;
      this.active = parent;
      this.inlineDepth = 0;
      this.inlineReturnStates = [];
      this.inlineBranchStarts = [];
      this.inlineLastBefore = parent;
      this.resetHistory(parent);
      const tokens = this.resolveMoveText(text);
      this.variationStack.push({ indent, path: this.active });
      return tokens;
    }

    this.variationBase = null;
    this.variationStack = [];
    return this.resolveMoveText(text);
  }

  private continuationScore(
    moveText: string,
    sourceText: string,
    matches: RegExpMatchArray[],
    startIndex: number,
    fen: string,
    depth: number,
    baseDepth: number,
  ): number {
    let currentFen = fen;
    let score = 0;
    for (let index = startIndex + 1; index < matches.length; index++) {
      const match = matches[index];
      const at = match.index ?? 0;
      const tokenDepth = Math.max(0, baseDepth + parenDepthDeltaAt(moveText, at));
      if (tokenDepth < depth) break;
      if (tokenDepth > depth) continue;
      const display = match[0].trim();
      if (!display || isLikelyProseSquare(sourceText, at, display) || isCoordinateMoveReference(sourceText, at)) continue;
      if (!moveNumberMatchesFen(display, currentFen)) break;
      const move = this.resolveFrom(currentFen, display);
      if (!move) break;
      currentFen = move.fen;
      score++;
    }
    return score;
  }

  private resolveMoveText(text: string): MarkdownMoveToken[] {
    const tokens: MarkdownMoveToken[] = [];
    const forcePlain = /(?:SOURCE MOVE REFERENCE|NON-NAVIGATION)/.test(text);
    const moveText = text.replace(/<!--[\s\S]*?-->/g, (comment) => " ".repeat(comment.length));
    const isolatedEmphasisRanges = [...moveText.matchAll(/\*\*(.+?)\*\*/g)]
      .filter((match) => [...match[1].matchAll(SOURCE_MOVE_TOKEN)].length === 1)
      .map((match) => ({ start: (match.index ?? 0) + 2, end: (match.index ?? 0) + 2 + match[1].length }));
    let active = this.active;
    let lastBefore = this.inlineDepth > 0 ? this.inlineLastBefore : active;
    let depth = this.inlineDepth;
    const baseDepth = this.inlineDepth;
    const returnStates = this.inlineReturnStates;
    const branchStarts = this.inlineBranchStarts;

    const matches = [...moveText.matchAll(SOURCE_MOVE_TOKEN)];
    for (let matchIndex = 0; matchIndex < matches.length; matchIndex++) {
      const match = matches[matchIndex];
      const at = match.index ?? 0;
      const nextDepth = Math.max(0, baseDepth + parenDepthDeltaAt(moveText, at));
      while (nextDepth > depth) {
        returnStates.push(active);
        active = lastBefore;
        branchStarts.push(active);
        depth++;
      }
      while (nextDepth < depth) {
        active = returnStates.pop() ?? active;
        branchStarts.pop();
        depth--;
      }

      const display = match[0].trim();
      if (!display || isLikelyProseSquare(text, at, display)) continue;
      if (isCoordinateMoveReference(text, at)) {
        tokens.push({ display, index: at, navigation: null });
        continue;
      }
      if (forcePlain) {
        tokens.push({ display, index: at, navigation: null });
        continue;
      }

      const numberedKey = moveNumberKey(display);
      const isolatedUnnumberedMention = !numberedKey && isolatedEmphasisRanges.some((range) => at >= range.start && at < range.end);
      // A parenthetical variation has one explicit branch point. Reuse that
      // local root for sibling alternatives instead of arbitrary old history;
      // explicit FEN roots remain available for deliberately anchored branches.
      const indexedHistory = numberedKey && depth === 0 ? [...(this.historyByMove.get(numberedKey) ?? [])].reverse() : [];
      const parentheticalRoot = numberedKey && depth > 0 ? branchStarts[depth - 1] : undefined;
      const candidates = uniqueCandidates([active, ...(parentheticalRoot ? [parentheticalRoot] : []), ...indexedHistory]);
      let resolved: PositionPath | null = null;
      let before: PositionPath | null = null;
      const legalCandidates: Array<{ before: PositionPath; resolved: PositionPath }> = [];
      for (const candidate of candidates) {
        if (!moveNumberMatchesFen(display, candidate.fen)) continue;
        const move = this.resolveFrom(candidate.fen, display);
        if (!move) continue;
        legalCandidates.push({ before: candidate, resolved: {
          fen: move.fen,
          steps: [...candidate.steps, { fen: move.fen, label: display }],
        } });
      }
      if (numberedKey) {
        const rootCandidates = this.knownMoveIndex.get(`${numberedKey}\u0000${normalizeSan(display)}`) ?? [];
        for (const candidate of rootCandidates) {
          legalCandidates.push({
            before: candidate.before,
            resolved: {
              fen: candidate.move.fen,
              steps: [...candidate.before.steps, { fen: candidate.move.fen, label: display }],
            },
          });
        }
      }

      const distinct = legalCandidates.filter((candidate, index, all) => all.findIndex((other) => other.before.fen === candidate.before.fen) === index);
    const activeMatch = distinct.find((candidate) => candidate.before.fen === active.fen);
    if (distinct.length === 1) {
      ({ before, resolved } = distinct[0]);
    } else if (distinct.length > 1) {
      const scored = distinct.map((candidate) => ({
        candidate,
        score: this.continuationScore(moveText, text, matches, matchIndex, candidate.resolved.fen, nextDepth, baseDepth),
      }));
      const bestScore = Math.max(...scored.map((entry) => entry.score));
      const best = scored.filter((entry) => entry.score === bestScore);
      if (bestScore > 0 && best.length === 1) {
        ({ before, resolved } = best[0].candidate);
      } else if (activeMatch) {
        ({ before, resolved } = activeMatch);
      }
    }

      if (resolved && before) {
        if (!isolatedUnnumberedMention) {
          lastBefore = before;
          active = resolved;
          this.remember(resolved);
        }
        tokens.push({ display, index: at, navigation: this.createNavigation(resolved) });
      } else {
        tokens.push({ display, index: at, navigation: null });
      }
    }

    const finalDepth = Math.max(0, baseDepth + parenDepthDeltaAt(moveText, moveText.length));
    while (finalDepth > depth) {
      returnStates.push(active);
      active = lastBefore;
      branchStarts.push(active);
      depth++;
    }
    while (finalDepth < depth) {
      active = returnStates.pop() ?? active;
      branchStarts.pop();
      depth--;
    }
    this.active = active;
    this.inlineDepth = depth;
    this.inlineReturnStates = returnStates;
    this.inlineBranchStarts = branchStarts;
    this.inlineLastBefore = lastBefore;
    return tokens;
  }
}
