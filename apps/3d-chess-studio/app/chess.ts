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
