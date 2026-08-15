import type { BestMoveResult, Square } from "./chess";

type StockfishMoveCallback = (bestMove: BestMoveResult | null) => void;

class StockfishMasterEngine {
  private worker: Worker | null = null;
  private isReady = false;
  private pendingCallback: StockfishMoveCallback | null = null;
  private initPromise: Promise<boolean> | null = null;

  private resolveUrl(): string {
    const base = import.meta.env.BASE_URL || "/";
    const normalizedBase = base.endsWith("/") ? base : `${base}/`;
    return `${normalizedBase}stockfish/stockfish-18-lite-single.js`;
  }

  async init(): Promise<boolean> {
    if (this.isReady) return true;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise<boolean>((resolve) => {
      try {
        if (typeof Worker === "undefined") {
          resolve(false);
          return;
        }

        const url = this.resolveUrl();
        const worker = new Worker(url);
        this.worker = worker;

        let uciOkReceived = false;

        const timer = setTimeout(() => {
          if (!this.isReady) {
            console.warn("Stockfish master worker initialization timed out; using fallback.");
            resolve(false);
          }
        }, 8000);

        worker.onmessage = (event: MessageEvent<string | { data: string }>) => {
          const line = typeof event.data === "string" ? event.data : event.data?.data || "";

          if (line === "uciok") {
            uciOkReceived = true;
            // Configure Stockfish for Authentic Master Strength (~2300 Elo, not Super-GM)
            worker.postMessage("setoption name UCI_LimitStrength value true");
            worker.postMessage("setoption name UCI_Elo value 2300");
            worker.postMessage("setoption name Skill Level value 16");
            worker.postMessage("isready");
          } else if (line === "readyok" && uciOkReceived) {
            clearTimeout(timer);
            this.isReady = true;
            resolve(true);
          } else if (line.startsWith("bestmove")) {
            const parts = line.split(" ");
            const uciMove = parts[1];
            if (uciMove && uciMove !== "(none)" && uciMove.length >= 4) {
              const from = uciMove.slice(0, 2) as Square;
              const to = uciMove.slice(2, 4) as Square;
              const promotion = (uciMove.length > 4 ? uciMove[4] : undefined) as "q" | "r" | "b" | "n" | undefined;
              if (this.pendingCallback) {
                const cb = this.pendingCallback;
                this.pendingCallback = null;
                cb({ from, to, promotion });
              }
            } else {
              if (this.pendingCallback) {
                const cb = this.pendingCallback;
                this.pendingCallback = null;
                cb(null);
              }
            }
          }
        };

        worker.onerror = (err) => {
          console.warn("Stockfish master worker error:", err);
          clearTimeout(timer);
          resolve(false);
        };

        worker.postMessage("uci");
      } catch (err) {
        console.warn("Failed to create Stockfish master worker:", err);
        resolve(false);
      }
    });

    return this.initPromise;
  }

  findMasterMove(fen: string, timeoutMs = 500): Promise<BestMoveResult | null> {
    return new Promise(async (resolve) => {
      const ready = await this.init();
      if (!ready || !this.worker) {
        resolve(null);
        return;
      }

      this.pendingCallback = resolve;
      this.worker.postMessage("stop");
      this.worker.postMessage(`position fen ${fen}`);
      this.worker.postMessage(`go depth 12 movetime ${timeoutMs}`);
    });
  }

  stop(): void {
    if (this.pendingCallback) {
      this.pendingCallback(null);
      this.pendingCallback = null;
    }
    if (this.worker) {
      this.worker.postMessage("stop");
    }
  }

  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.isReady = false;
    this.initPromise = null;
    this.pendingCallback = null;
  }
}

export const stockfishMaster = new StockfishMasterEngine();
