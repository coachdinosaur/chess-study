export const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
export const RANKS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export type PieceColor = "white" | "black";
export type PieceType = "king" | "queen" | "rook" | "bishop" | "knight" | "pawn";
export type PieceCode = `w${"K" | "Q" | "R" | "B" | "N" | "P"}` | `b${"K" | "Q" | "R" | "B" | "N" | "P"}`;
export type Square = `${(typeof FILES)[number]}${(typeof RANKS)[number]}`;
export type BoardPosition = Partial<Record<Square, PieceCode>>;

export type PositionDocument = {
  board: BoardPosition;
  sideToMove: "w" | "b";
  castling: string;
  enPassant: string;
  halfmove: number;
  fullmove: number;
};

export const PIECE_TYPES: PieceType[] = ["king", "queen", "rook", "bishop", "knight", "pawn"];

export const PIECE_SYMBOLS: Record<PieceCode, string> = {
  wK: "♔",
  wQ: "♕",
  wR: "♖",
  wB: "♗",
  wN: "♘",
  wP: "♙",
  bK: "♚",
  bQ: "♛",
  bR: "♜",
  bB: "♝",
  bN: "♞",
  bP: "♟",
};

const TYPE_LETTERS: Record<PieceType, PieceCode[1]> = {
  king: "K",
  queen: "Q",
  rook: "R",
  bishop: "B",
  knight: "N",
  pawn: "P",
};

const FEN_TO_CODE: Record<string, PieceCode> = {
  K: "wK",
  Q: "wQ",
  R: "wR",
  B: "wB",
  N: "wN",
  P: "wP",
  k: "bK",
  q: "bQ",
  r: "bR",
  b: "bB",
  n: "bN",
  p: "bP",
};

const CODE_TO_FEN = Object.fromEntries(
  Object.entries(FEN_TO_CODE).map(([fen, code]) => [code, fen]),
) as Record<PieceCode, string>;

export function pieceCode(color: PieceColor, type: PieceType): PieceCode {
  return `${color === "white" ? "w" : "b"}${TYPE_LETTERS[type]}` as PieceCode;
}

export function pieceColor(code: PieceCode): PieceColor {
  return code[0] === "w" ? "white" : "black";
}

export function pieceType(code: PieceCode): PieceType {
  const entries = Object.entries(TYPE_LETTERS) as [PieceType, PieceCode[1]][];
  return entries.find(([, letter]) => letter === code[1])?.[0] ?? "pawn";
}

export function pieceLabel(code: PieceCode): string {
  const color = pieceColor(code);
  const type = pieceType(code);
  return `${color[0].toUpperCase()}${color.slice(1)} ${type}`;
}

export function cloneDocument(document: PositionDocument): PositionDocument {
  return { ...document, board: { ...document.board } };
}

export function emptyDocument(): PositionDocument {
  return {
    board: {},
    sideToMove: "w",
    castling: "-",
    enPassant: "-",
    halfmove: 0,
    fullmove: 1,
  };
}

export function startingDocument(): PositionDocument {
  return parseFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
}

export function kingsOnlyDocument(): PositionDocument {
  return parseFen("4k3/8/8/8/8/8/8/4K3 w - - 0 1");
}

export function parseFen(input: string): PositionDocument {
  const fields = input.trim().split(/\s+/);
  if (!fields[0]) throw new Error("Enter a FEN position first.");
  if (fields.length > 6) throw new Error("FEN can contain at most six fields.");

  const rankFields = fields[0].split("/");
  if (rankFields.length !== 8) throw new Error("Piece placement must contain exactly eight ranks.");

  const board: BoardPosition = {};
  rankFields.forEach((rankField, rowIndex) => {
    let fileIndex = 0;
    for (const token of rankField) {
      if (/^[1-8]$/.test(token)) {
        fileIndex += Number(token);
      } else {
        const code = FEN_TO_CODE[token];
        if (!code) throw new Error(`Unknown FEN piece “${token}”.`);
        if (fileIndex > 7) throw new Error(`Rank ${8 - rowIndex} contains too many squares.`);
        const square = `${FILES[fileIndex]}${8 - rowIndex}` as Square;
        board[square] = code;
        fileIndex += 1;
      }
    }
    if (fileIndex !== 8) throw new Error(`Rank ${8 - rowIndex} must contain exactly eight squares.`);
  });

  const sideToMove = fields[1] ?? "w";
  if (sideToMove !== "w" && sideToMove !== "b") throw new Error("Side to move must be w or b.");

  const castling = fields[2] ?? "-";
  if (!/^-$|^(?=.{1,4}$)(?!.*(.).*\1)[KQkq]+$/.test(castling)) {
    throw new Error("Castling must use KQkq flags or -.");
  }

  const enPassant = fields[3] ?? "-";
  if (!/^-$|^[a-h][36]$/.test(enPassant)) throw new Error("En-passant square must be - or a square on rank 3 or 6.");

  const halfmove = Number(fields[4] ?? 0);
  const fullmove = Number(fields[5] ?? 1);
  if (!Number.isInteger(halfmove) || halfmove < 0) throw new Error("Halfmove clock must be a non-negative whole number.");
  if (!Number.isInteger(fullmove) || fullmove < 1) throw new Error("Fullmove number must be at least 1.");

  return { board, sideToMove, castling, enPassant, halfmove, fullmove };
}

export function toFen(document: PositionDocument): string {
  const ranks: string[] = [];
  for (let rank = 8; rank >= 1; rank -= 1) {
    let empty = 0;
    let encoded = "";
    for (const file of FILES) {
      const square = `${file}${rank}` as Square;
      const code = document.board[square];
      if (!code) {
        empty += 1;
        continue;
      }
      if (empty) {
        encoded += String(empty);
        empty = 0;
      }
      encoded += CODE_TO_FEN[code];
    }
    if (empty) encoded += String(empty);
    ranks.push(encoded);
  }

  const castling = document.castling && document.castling !== "" ? document.castling : "-";
  const enPassant = document.enPassant && document.enPassant !== "" ? document.enPassant : "-";
  return `${ranks.join("/")} ${document.sideToMove} ${castling} ${enPassant} ${document.halfmove} ${document.fullmove}`;
}

export function positionWarnings(document: PositionDocument): string[] {
  const counts = new Map<PieceCode, number>();
  Object.values(document.board).forEach((code) => counts.set(code, (counts.get(code) ?? 0) + 1));
  const warnings: string[] = [];
  if ((counts.get("wK") ?? 0) !== 1 || (counts.get("bK") ?? 0) !== 1) {
    warnings.push("A legal position needs exactly one king of each color.");
  }
  if ((counts.get("wP") ?? 0) > 8 || (counts.get("bP") ?? 0) > 8) {
    warnings.push("A side cannot have more than eight pawns in a legal position.");
  }
  const backRankPawn = Object.entries(document.board).some(
    ([square, code]) => code?.[1] === "P" && (square.endsWith("1") || square.endsWith("8")),
  );
  if (backRankPawn) warnings.push("Pawns cannot remain on rank 1 or rank 8 in a legal position.");
  return warnings;
}

export type ThemeId = "classic-walnut" | "tournament-vinyl" | "modern-marble" | "midnight-obsidian";

export type BotDifficulty = "casual" | "club" | "master";

export type BotSide = "white" | "black" | "random";

export function parseUrlPosition(): string | null {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  const searchFen = url.searchParams.get("fen");
  if (searchFen) return decodeURIComponent(searchFen);

  const hash = window.location.hash.replace(/^#/, "");
  if (hash.startsWith("fen=")) {
    return decodeURIComponent(hash.slice(4));
  }
  if (hash.includes(" ") || hash.includes("/")) {
    return decodeURIComponent(hash);
  }
  return null;
}

export function createShareableUrl(fen: string): string {
  if (typeof window === "undefined") return "";
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#fen=${encodeURIComponent(fen)}`;
}

export function create2DStudyUrl(fen: string): string {
  if (typeof window === "undefined") return "";
  const basePath = import.meta.env.BASE_URL || "/";
  // If mounted at /3d/, parent is /
  const parentPath = basePath.replace(/3d\/?$/, "");
  return `${window.location.origin}${parentPath}#fen=${encodeURIComponent(fen)}`;
}

/* =========================================================================
   LIGHTWEIGHT CLIENT-SIDE CHESS ENGINE (AI BOT)
   ========================================================================= */

const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// Piece-Square Tables (White perspective, 8x8 from a8 to h1)
const PST_PAWN = [
  0,  0,  0,  0,  0,  0,  0,  0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
   5,  5, 10, 25, 25, 10,  5,  5,
   0,  0,  0, 20, 20,  0,  0,  0,
   5, -5,-10,  0,  0,-10, -5,  5,
   5, 10, 10,-20,-20, 10, 10,  5,
   0,  0,  0,  0,  0,  0,  0,  0,
];

const PST_KNIGHT = [
  -50,-40,-30,-30,-30,-30,-40,-50,
  -40,-20,  0,  0,  0,  0,-20,-40,
  -30,  0, 10, 15, 15, 10,  0,-30,
  -30,  5, 15, 20, 20, 15,  5,-30,
  -30,  0, 15, 20, 20, 15,  0,-30,
  -30,  5, 10, 15, 15, 10,  5,-30,
  -40,-20,  0,  5,  5,  0,-20,-40,
  -50,-40,-30,-30,-30,-30,-40,-50,
];

const PST_BISHOP = [
  -20,-10,-10,-10,-10,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5, 10, 10,  5,  0,-10,
  -10,  5,  5, 10, 10,  5,  5,-10,
  -10,  0, 10, 10, 10, 10,  0,-10,
  -10, 10, 10, 10, 10, 10, 10,-10,
  -10,  5,  0,  0,  0,  0,  5,-10,
  -20,-10,-10,-10,-10,-10,-10,-20,
];

const PST_ROOK = [
  0,  0,  0,  0,  0,  0,  0,  0,
  5, 10, 10, 10, 10, 10, 10,  5,
 -5,  0,  0,  0,  0,  0,  0, -5,
 -5,  0,  0,  0,  0,  0,  0, -5,
 -5,  0,  0,  0,  0,  0,  0, -5,
 -5,  0,  0,  0,  0,  0,  0, -5,
 -5,  0,  0,  0,  0,  0,  0, -5,
  0,  0,  0,  5,  5,  0,  0,  0,
];

const PST_QUEEN = [
  -20,-10,-10, -5, -5,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5,  5,  5,  5,  0,-10,
   -5,  0,  5,  5,  5,  5,  0, -5,
    0,  0,  5,  5,  5,  5,  0, -5,
  -10,  5,  5,  5,  5,  5,  0,-10,
  -10,  0,  5,  0,  0,  0,  0,-10,
  -20,-10,-10, -5, -5,-10,-10,-20,
];

const PST_KING = [
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -20,-30,-30,-40,-40,-30,-30,-20,
  -10,-20,-20,-20,-20,-20,-20,-10,
   20, 20,  0,  0,  0,  0, 20, 20,
   20, 30, 10,  0,  0, 10, 30, 20,
];

function getSquareIndex(file: number, rank: number, isWhite: boolean): number {
  const r = isWhite ? 7 - rank : rank;
  const f = file;
  return r * 8 + f;
}

export function evaluateFen(fen: string): number {
  let score = 0;
  let rank = 0;
  let file = 0;

  const endIdx = fen.indexOf(" ");
  const boardStr = endIdx === -1 ? fen : fen.slice(0, endIdx);

  for (let i = 0; i < boardStr.length; i++) {
    const char = boardStr[i];
    if (char === "/") {
      rank++;
      file = 0;
    } else if (char >= "1" && char <= "8") {
      file += Number(char);
    } else {
      const isWhite = char >= "A" && char <= "Z";
      const type = char.toLowerCase();
      const val = PIECE_VALUES[type] || 0;
      const sqIdx = getSquareIndex(file, 7 - rank, isWhite);

      let pstBonus = 0;
      if (type === "p") pstBonus = PST_PAWN[sqIdx];
      else if (type === "n") pstBonus = PST_KNIGHT[sqIdx];
      else if (type === "b") pstBonus = PST_BISHOP[sqIdx];
      else if (type === "r") pstBonus = PST_ROOK[sqIdx];
      else if (type === "q") pstBonus = PST_QUEEN[sqIdx];
      else if (type === "k") pstBonus = PST_KING[sqIdx];

      const totalVal = val + pstBonus;
      score += isWhite ? totalVal : -totalVal;
      file++;
    }
  }
  return score;
}

export function evaluateBoard(board: (({ type: string; color: "w" | "b" }) | null)[][]): number {
  let score = 0;
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = board[rank][file];
      if (!piece) continue;
      const isWhite = piece.color === "w";
      const val = PIECE_VALUES[piece.type] || 0;
      const sqIdx = getSquareIndex(file, 7 - rank, isWhite);

      let pstBonus = 0;
      if (piece.type === "p") pstBonus = PST_PAWN[sqIdx];
      else if (piece.type === "n") pstBonus = PST_KNIGHT[sqIdx];
      else if (piece.type === "b") pstBonus = PST_BISHOP[sqIdx];
      else if (piece.type === "r") pstBonus = PST_ROOK[sqIdx];
      else if (piece.type === "q") pstBonus = PST_QUEEN[sqIdx];
      else if (piece.type === "k") pstBonus = PST_KING[sqIdx];

      const totalVal = val + pstBonus;
      score += isWhite ? totalVal : -totalVal;
    }
  }
  return score;
}

export type BestMoveResult = {
  from: Square;
  to: Square;
  promotion?: "q" | "r" | "b" | "n";
  score?: number;
};

const VICTIM_SCORES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

type ChessEngineMove = {
  from: string;
  to: string;
  piece?: string;
  captured?: string;
  promotion?: string;
};

function scoreMoveForOrdering(move: ChessEngineMove): number {
  let score = 0;
  if (move.captured) {
    const victimVal = VICTIM_SCORES[move.captured] || 100;
    const attackerVal = VICTIM_SCORES[move.piece || "p"] || 100;
    score += 10000 + victimVal * 10 - attackerVal;
  }
  if (move.promotion) {
    score += 9000;
  }
  return score;
}

// Import dynamically typed chess engine instance
export function findBestBotMove(
  chess: {
    fen: () => string;
    turn: () => "w" | "b";
    board: () => (({ type: string; color: "w" | "b" }) | null)[][];
    moves: (options: { verbose: true }) => Array<ChessEngineMove>;
    move: (m: { from: string; to: string; promotion?: string }) => unknown;
    undo: () => unknown;
    isCheckmate: () => boolean;
    isDraw: () => boolean;
  },
  difficulty: BotDifficulty = "club",
): BestMoveResult | null {
  const legalMoves = chess.moves({ verbose: true });
  if (legalMoves.length === 0) return null;

  const isMaximizing = chess.turn() === "w";

  // 1. Casual: Beginner level with intentional tactical blunders/jitter
  if (difficulty === "casual") {
    const scoredMoves = legalMoves.map((move) => {
      chess.move(move);
      const score = evaluateFen(chess.fen()) * (isMaximizing ? 1 : -1);
      chess.undo();
      // Add noticeable jitter to create human, beginner-like inaccuracies
      const jitter = (Math.random() - 0.5) * 120;
      return { move, score: score + jitter };
    });
    scoredMoves.sort((a, b) => b.score - a.score);

    // Pick among top candidate moves with frequent beginner inaccuracies
    let chosenIndex = 0;
    const rand = Math.random();
    if (rand < 0.45 || scoredMoves.length === 1) {
      chosenIndex = 0;
    } else if (rand < 0.80 && scoredMoves.length >= 2) {
      chosenIndex = 1;
    } else if (scoredMoves.length >= 3) {
      chosenIndex = 2;
    } else {
      chosenIndex = 0;
    }

    const chosen = scoredMoves[chosenIndex].move;
    return {
      from: chosen.from as Square,
      to: chosen.to as Square,
      promotion: (chosen.promotion as "q" | "r" | "b" | "n") || undefined,
      score: scoredMoves[chosenIndex].score,
    };
  }

  // 2. Club & Master: Alpha-Beta minimax with MVV-LVA move ordering
  const maxDepth = difficulty === "master" ? 3 : 2;

  function minimax(
    depth: number,
    alpha: number,
    beta: number,
    maximizing: boolean,
  ): number {
    if (depth === 0) {
      return evaluateFen(chess.fen());
    }
    const moves = chess.moves({ verbose: true });
    if (moves.length === 0) {
      if (chess.isCheckmate()) {
        return maximizing ? -99999 + (maxDepth - depth) : 99999 - (maxDepth - depth);
      }
      return 0; // Stalemate
    }

    // MVV-LVA move ordering for maximum alpha-beta cutoff efficiency
    moves.sort((a, b) => scoreMoveForOrdering(b) - scoreMoveForOrdering(a));

    if (maximizing) {
      let maxEval = -Infinity;
      for (const move of moves) {
        chess.move(move);
        const evalScore = minimax(depth - 1, alpha, beta, false);
        chess.undo();
        maxEval = Math.max(maxEval, evalScore);
        alpha = Math.max(alpha, evalScore);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const move of moves) {
        chess.move(move);
        const evalScore = minimax(depth - 1, alpha, beta, true);
        chess.undo();
        minEval = Math.min(minEval, evalScore);
        beta = Math.min(beta, evalScore);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  let bestMove = legalMoves[0];
  let bestScore = isMaximizing ? -Infinity : Infinity;

  // Order root moves
  legalMoves.sort((a, b) => scoreMoveForOrdering(b) - scoreMoveForOrdering(a));

  for (const move of legalMoves) {
    chess.move(move);
    const score = minimax(maxDepth - 1, -Infinity, Infinity, !isMaximizing);
    chess.undo();

    if (isMaximizing) {
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    } else {
      if (score < bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }
  }

  return {
    from: bestMove.from as Square,
    to: bestMove.to as Square,
    promotion: (bestMove.promotion as "q" | "r" | "b" | "n") || undefined,
    score: bestScore,
  };
}


