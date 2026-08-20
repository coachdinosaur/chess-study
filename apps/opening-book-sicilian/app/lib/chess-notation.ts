import { Chess, type Move } from "chess.js";

export const SOURCE_MOVE_TOKEN = /(?:\d+\.(?:\.\.)?\s*)?(?:O-O-O|O-O|0-0-0|0-0|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?|[a-h]x[a-h][1-8]|[a-h][1-8])[+#]?[!?N=∞±∓→←⇆≡]*/g;

const MOVE_NUMBER = /^(\d+)\.(\.\.)?/;
const SQUARE_ONLY = /^[a-h][1-8]$/;
const COORDINATE_MOVE = /\b(?:[KQRBN])?[a-h][1-8](?:-[a-h][1-8])+\b/g;

export function normalizeSan(raw: string): string {
  let san = raw.replace(/^\d+\.(?:\.\.)?\s*/, "").replace(/[!?=*∞±∓→←⇆≡]+/g, "").trim();
  san = san.replace(/0/g, "O");
  // A final N is a printed novelty marker. A leading N remains the knight
  // designator, including in disambiguated moves such as Nfd2 and Nfxd2.
  san = san.replace(/N([+#]*)$/, "$1");
  if (/^O-O-O/i.test(san)) san = "O-O-O";
  else if (/^O-O/i.test(san)) san = "O-O";
  return san.replace(/[+#]+$/, "");
}

export function isLikelyProseSquare(text: string, at: number, source: string): boolean {
  // An explicit move number is authoritative. Without this guard, phrases such
  // as "due to 10...b5" incorrectly classify the numbered pawn move as prose
  // because the local prefix happens to end in "to ".
  if (/^\d+\.(?:\.\.)?\s*/.test(source.trim())) return false;

  const bare = source.replace(/^\d+\.(?:\.\.)?\s*/, "");
  if (!SQUARE_ONLY.test(bare)) return false;

  const prefix = text.slice(Math.max(0, at - 12), at).toLowerCase();
  if (prefix.endsWith("...")) return true;
  if (/(?:^|\s)(?:on|of|to|the|a|toward|from|over|square|contested|control|controls|weakens|protects|attacks|eyeing|eyes|target|targets|vacate|vacates) $/.test(prefix)) return true;
  if (/\bon [a-h][1-8] and $/.test(prefix)) return true;

  const suffix = text.slice(at + source.length, at + source.length + 40).toLowerCase();
  if (!/^\d+\./.test(source.trim()) && /^\s+is(?:\s+now)?\s+under\s+attack\b/.test(suffix)) return true;

  return /^-(?:square|pawn|bishop|knight|rook|queen|king|file|rank|diagonal)\b/.test(suffix);
}

export function isCoordinateMoveReference(text: string, at: number): boolean {
  for (const match of text.matchAll(COORDINATE_MOVE)) {
    const start = match.index ?? 0;
    if (at >= start && at < start + match[0].length) return true;
  }
  return false;
}

export function moveNumberMatchesFen(raw: string, fen: string): boolean {
  const match = MOVE_NUMBER.exec(raw.trim());
  if (!match) return true;
  const [, turn, , , , fullmove] = fen.split(" ");
  const expectedTurn = match[2] ? "b" : "w";
  return turn === expectedTurn && Number(fullmove) === Number(match[1]);
}

export function moveNumberKey(raw: string): string | null {
  const match = MOVE_NUMBER.exec(raw.trim());
  if (!match) return null;
  return `${match[1]}:${match[2] ? "b" : "w"}`;
}

export function fenMoveNumberKey(fen: string): string {
  const [, turn, , , , fullmove] = fen.split(" ");
  return `${fullmove}:${turn}`;
}

const LEGAL_MOVE_CACHE_LIMIT = 2048;
const legalMoveCache = new Map<string, Move[]>();

function legalMoves(fen: string): Move[] {
  const cached = legalMoveCache.get(fen);
  if (cached) return cached;

  const moves = new Chess(fen).moves({ verbose: true });
  legalMoveCache.set(fen, moves);
  if (legalMoveCache.size > LEGAL_MOVE_CACHE_LIMIT) {
    const oldest = legalMoveCache.keys().next().value;
    if (oldest) legalMoveCache.delete(oldest);
  }
  return moves;
}

function matchingBookMove(moves: Move[], san: string) {
  const match = /^([KQRBN])([a-h1-8]{1,2})?(x?)([a-h][1-8])(?:=([QRBN]))?$/.exec(san);
  if (!match) return null;
  const [, piece, disambiguation = "", captureMarker, destination, promotion] = match;
  const candidates = moves.filter((move) => {
    if (move.piece.toUpperCase() !== piece || move.to !== destination) return false;
    if (Boolean(captureMarker) !== move.isCapture()) return false;
    if (promotion && move.promotion?.toUpperCase() !== promotion) return false;
    for (const character of disambiguation) {
      if (/[a-h]/.test(character) && move.from[0] !== character) return false;
      if (/[1-8]/.test(character) && move.from[1] !== character) return false;
    }
    return true;
  });
  return candidates.length === 1 ? candidates[0] : null;
}

export type ResolvedChessMove = { san: string; fen: string; from: string; to: string };

export type IndexedChessMove = ResolvedChessMove & { aliases: string[] };

export function indexChessMoves(fen: string): IndexedChessMove[] {
  return legalMoves(fen).map((move) => {
    const aliases = new Set([move.san.replace(/[+#]+$/, "")]);
    if (move.piece !== "p") {
      const piece = move.piece.toUpperCase();
      const capture = move.isCapture() ? "x" : "";
      const promotion = move.promotion ? `=${move.promotion.toUpperCase()}` : "";
      const suffix = `${capture}${move.to}${promotion}`;
      aliases.add(`${piece}${suffix}`);
      aliases.add(`${piece}${move.from[0]}${suffix}`);
      aliases.add(`${piece}${move.from[1]}${suffix}`);
      aliases.add(`${piece}${move.from}${suffix}`);
    }
    return {
      aliases: [...aliases],
      san: move.san,
      fen: move.after,
      from: move.from,
      to: move.to,
    };
  });
}

export function resolveChessMove(fen: string, raw: string): ResolvedChessMove | null {
  const normalized = normalizeSan(raw);
  if (!normalized) return null;

  const legal = legalMoves(fen);
  let sanMatches = legal.filter((move) => move.san.replace(/[+#]+$/, "") === normalized);
  if (sanMatches.length === 0 && normalized === "h4") {
    // Quality Chess OCR artifact: figurine ♘d2 read as h4 on move 18
    const nd2Move = legal.find((move) => move.piece === "n" && move.to === "d2");
    if (nd2Move) sanMatches = [nd2Move];
  }
  const selected = sanMatches.length === 1 ? sanMatches[0] : matchingBookMove(legal, normalized);
  if (!selected) return null;

  return { san: selected.san, fen: selected.after, from: selected.from, to: selected.to };
}
