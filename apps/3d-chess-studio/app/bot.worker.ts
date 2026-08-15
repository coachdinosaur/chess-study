import { Chess } from "chess.js";
import { findBestBotMove, type BestMoveResult, type BotDifficulty } from "./chess";

export type BotWorkerRequest = {
  id: number;
  fen: string;
  difficulty: BotDifficulty;
};

export type BotWorkerResponse = {
  id: number;
  bestMove: BestMoveResult | null;
};

self.addEventListener("message", (event: MessageEvent<BotWorkerRequest>) => {
  const { id, fen, difficulty } = event.data;
  try {
    const chess = new Chess(fen);
    const bestMove = findBestBotMove(chess, difficulty);
    self.postMessage({ id, bestMove } satisfies BotWorkerResponse);
  } catch (err) {
    console.error("Bot worker search error:", err);
    self.postMessage({ id, bestMove: null } satisfies BotWorkerResponse);
  }
});
