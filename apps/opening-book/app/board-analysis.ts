import { Chess, Square } from "chess.js";

export type PromotionPiece = "q" | "r" | "b" | "n";

export type BoardMoveInput = {
  from: Square;
  to: Square;
  promotion?: PromotionPiece;
};

export type LegalTarget = {
  to: Square;
  promotion?: PromotionPiece;
  capture: boolean;
};

export type AnalysisMove = BoardMoveInput & {
  san: string;
  label: string;
  fen: string;
};

const PROMOTION_PIECES = new Set<PromotionPiece>(["q", "r", "b", "n"]);

function promotionPiece(value: string | undefined): PromotionPiece | undefined {
  return value && PROMOTION_PIECES.has(value as PromotionPiece) ? value as PromotionPiece : undefined;
}

export function legalTargets(fen: string, from: Square): LegalTarget[] {
  const chess = new Chess(fen);
  return chess.moves({ square: from, verbose: true }).map((move) => ({
    to: move.to as Square,
    promotion: promotionPiece(move.promotion),
    capture: Boolean(move.captured),
  }));
}

export function playAnalysisMove(fen: string, input: BoardMoveInput): AnalysisMove | null {
  try {
    const chess = new Chess(fen);
    const [, turn, , , , fullmove] = fen.split(/\s+/);
    const move = chess.move({
      from: input.from,
      to: input.to,
      ...(input.promotion ? { promotion: input.promotion } : {}),
    });
    const moveNumber = Number(fullmove) || 1;
    return {
      ...input,
      san: move.san,
      label: `${moveNumber}${turn === "b" ? "..." : "."}${move.san}`,
      fen: chess.fen(),
    };
  } catch {
    return null;
  }
}
