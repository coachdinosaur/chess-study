import { Chess } from "../../vendor/chess.js";

/**
 * Canonical position identity for adaptive curriculum packages.
 *
 * `board sideToMove castling enPassant` — the en-passant field is emitted
 * only when an en-passant capture is actually legal (X-FEN convention).
 * chess.js `fen()` already applies that rule (it re-checks legality,
 * including the pinned-pawn edge case), so the canonical key is simply the
 * first four fields of the round-tripped FEN.
 *
 * This must stay byte-identical to Dart `PositionKey.fromFen` in
 * endgame_trainer (lib/opening_trainer/adaptive/position_key.dart).
 * fixtures/position_key_fixtures.json is the shared parity suite.
 */
export function canonicalPositionKey(fen: string): string {
  const trimmed = fen.trim();
  if (!trimmed) return "";
  const game = new Chess(trimmed);
  return game.fen().split(/\s+/).slice(0, 4).join(" ");
}
