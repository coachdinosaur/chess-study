import { Chess } from "chess.js";

export type EnginePhase =
  | "uninitialized"
  | "loading"
  | "ready"
  | "searching"
  | "stopping"
  | "restarting"
  | "error"
  | "disposed";

export interface EngineScore {
  kind: "cp" | "mate";
  /** Centipawns or mate distance, always from White's point of view. */
  whiteValue: number;
  label: string;
}

export interface AnalysisUpdate {
  searchId: number;
  fen: string;
  depth: number | null;
  score: EngineScore | null;
  pvUci: string[];
  pvSan: string[];
  formattedPv: string;
}

export interface StockfishEvent {
  type: "state";
  phase: EnginePhase;
  analysis: AnalysisUpdate | null;
  error: string | null;
}

export interface ParsedInfoLine {
  depth: number | null;
  multiPv: number;
  score: { kind: "cp" | "mate"; value: number } | null;
  pv: string[];
}

export interface StockfishWorkerEvent {
  data?: unknown;
  message?: string;
  error?: unknown;
}

export interface StockfishWorkerLike {
  postMessage(message: string): void;
  addEventListener(type: string, listener: (event: StockfishWorkerEvent) => void): void;
  removeEventListener(type: string, listener: (event: StockfishWorkerEvent) => void): void;
  terminate(): void;
}

export interface StockfishClientOptions {
  workerUrl?: string | URL;
  workerFactory?: (url: string) => StockfishWorkerLike;
  handshakeTimeoutMs?: number;
  stopTimeoutMs?: number;
}

type Listener = (event: StockfishEvent) => void;
type SearchRequest = { id: number; fen: string };
type HandshakeWaiter = {
  generation: number;
  resolve: () => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};
type StopCompletion = { promise: Promise<void>; resolve: () => void };

const ENGINE_FILE = "stockfish/stockfish-18-lite-single.js";
const MAX_PV_PLIES = 12;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || "Unknown Stockfish error.");
}

function validateFen(fen: string): string {
  if (typeof fen !== "string" || !fen || fen.trim() !== fen || /[\r\n]/.test(fen)) {
    throw new Error("Stockfish requires a single-line, unmodified FEN string.");
  }
  try {
    new Chess(fen);
  } catch {
    throw new Error("Stockfish cannot analyze an invalid FEN.");
  }
  return fen;
}

export function formatEngineScore(kind: "cp" | "mate", whiteValue: number): string {
  if (!Number.isFinite(whiteValue)) throw new Error("Engine score must be finite.");
  if (kind === "mate") {
    if (whiteValue < 0) return `\u2212M${Math.abs(whiteValue)}`;
    return `M${Math.abs(whiteValue)}`;
  }
  const pawns = (whiteValue / 100).toFixed(2);
  return whiteValue >= 0 ? `+${pawns}` : `\u2212${Math.abs(whiteValue / 100).toFixed(2)}`;
}

export function normalizeScoreToWhite(kind: "cp" | "mate", value: number, fen: string): EngineScore {
  validateFen(fen);
  if (!Number.isFinite(value)) throw new Error("Engine score must be finite.");
  const sideToMove = fen.split(/\s+/)[1];
  const whiteValue = sideToMove === "b" ? -value : value;
  return { kind, whiteValue, label: formatEngineScore(kind, whiteValue) };
}

export function scoreToWhiteFraction(score: EngineScore | null): number | null {
  if (!score) return null;
  if (score.kind === "mate") {
    if (score.whiteValue > 0) return 0.98;
    if (score.whiteValue < 0) return 0.02;
    return 0.5;
  }
  return Math.min(0.94, Math.max(0.06, 0.5 + score.whiteValue / 1200));
}

export function parseInfoLine(line: string): ParsedInfoLine | null {
  const tokens = line.trim().split(/\s+/);
  if (tokens[0] !== "info") return null;

  let depth: number | null = null;
  let multiPv = 1;
  let score: ParsedInfoLine["score"] = null;
  let pv: string[] = [];

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === "depth") {
      const value = Number(tokens[index + 1]);
      if (Number.isFinite(value)) depth = value;
      index += 1;
    } else if (token === "multipv") {
      const value = Number(tokens[index + 1]);
      if (Number.isInteger(value) && value > 0) multiPv = value;
      index += 1;
    } else if (token === "score") {
      const kind = tokens[index + 1];
      const value = Number(tokens[index + 2]);
      if ((kind === "cp" || kind === "mate") && Number.isFinite(value)) score = { kind, value };
      index += 2;
    } else if (token === "pv") {
      pv = tokens.slice(index + 1);
      break;
    }
  }

  return { depth, multiPv, score, pv };
}

export function uciMovesToSan(fen: string, moves: readonly string[], maxPlies = MAX_PV_PLIES): string[] {
  let game: Chess;
  try {
    validateFen(fen);
    game = new Chess(fen);
  } catch {
    return [];
  }

  const san: string[] = [];
  for (const rawMove of moves.slice(0, Math.max(0, maxPlies))) {
    const move = String(rawMove).trim().toLowerCase();
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)) break;
    try {
      const played = game.move({
        from: move.slice(0, 2),
        to: move.slice(2, 4),
        ...(move[4] ? { promotion: move[4] } : {}),
      });
      if (!played) break;
      san.push(played.san);
    } catch {
      break;
    }
  }
  return san;
}

export function formatPvSan(fen: string, sanMoves: readonly string[], maxPlies = MAX_PV_PLIES): string {
  const fields = fen.trim().split(/\s+/);
  let whiteToMove = fields[1] !== "b";
  let moveNumber = Number(fields[5]);
  if (!Number.isInteger(moveNumber) || moveNumber < 1) moveNumber = 1;

  const output: string[] = [];
  sanMoves.slice(0, Math.max(0, maxPlies)).forEach((san, index) => {
    if (whiteToMove) {
      output.push(`${moveNumber}.`, san);
    } else {
      if (index === 0) output.push(`${moveNumber}...`);
      output.push(san);
      moveNumber += 1;
    }
    whiteToMove = !whiteToMove;
  });
  return output.join(" ");
}

export function resolveWorkerUrl(baseUrl?: string | URL): string {
  if (baseUrl) {
    return new URL(ENGINE_FILE, baseUrl).href;
  }
  const base = (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL) || "/openings/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  return `${normalizedBase}${ENGINE_FILE}`;
}

function defaultWorkerUrl(): string {
  return resolveWorkerUrl();
}

function defaultWorkerFactory(url: string): StockfishWorkerLike {
  if (typeof Worker === "undefined") throw new Error("Stockfish requires browser Web Worker support.");
  // No options object is intentional: Stockfish.js is a classic worker, not an ES module worker.
  return new Worker(url) as unknown as StockfishWorkerLike;
}

export class StockfishClient {
  private readonly options: Required<Pick<StockfishClientOptions, "handshakeTimeoutMs" | "stopTimeoutMs">> &
    Pick<StockfishClientOptions, "workerUrl" | "workerFactory">;
  private worker: StockfishWorkerLike | null = null;
  private workerGeneration = 0;
  private workerMessageListener: ((event: StockfishWorkerEvent) => void) | null = null;
  private workerErrorListener: ((event: StockfishWorkerEvent) => void) | null = null;
  private listeners = new Set<Listener>();
  private phase: EnginePhase = "uninitialized";
  private analysis: AnalysisUpdate | null = null;
  private error: string | null = null;
  private disposed = false;
  private initialization: Promise<void> | null = null;
  private handshakeWaiters = new Map<string, HandshakeWaiter>();
  private nextSearchId = 0;
  private activeSearch: SearchRequest | null = null;
  private desiredSearch: SearchRequest | null = null;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  private stopCompletion: StopCompletion | null = null;

  constructor(options: StockfishClientOptions = {}) {
    this.options = {
      workerUrl: options.workerUrl,
      workerFactory: options.workerFactory,
      handshakeTimeoutMs: options.handshakeTimeoutMs ?? 15_000,
      stopTimeoutMs: options.stopTimeoutMs ?? 5_000,
    };
  }

  getSnapshot(): StockfishEvent {
    return {
      type: "state",
      phase: this.phase,
      analysis: this.analysis
        ? { ...this.analysis, pvUci: [...this.analysis.pvUci], pvSan: [...this.analysis.pvSan] }
        : null,
      error: this.error,
    };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  initialize(): Promise<void> {
    return this.beginInitialization("loading");
  }

  async analyze(fen: string): Promise<number> {
    this.assertUsable();
    const verifiedFen = validateFen(fen);

    if (this.activeSearch?.fen === verifiedFen && this.phase === "searching") return this.activeSearch.id;

    const request = { id: ++this.nextSearchId, fen: verifiedFen };
    this.desiredSearch = request;
    this.analysis = null;
    this.error = null;

    if (this.phase === "searching") {
      this.phase = "restarting";
      this.emit();
      this.requestWorkerStop();
      return request.id;
    }

    if (this.phase === "stopping" || this.phase === "restarting") {
      this.phase = "restarting";
      this.emit();
      return request.id;
    }

    if (!this.worker || this.phase === "uninitialized" || this.phase === "error" || this.phase === "loading") {
      await this.beginInitialization("loading");
    }

    this.startPendingSearch();
    return request.id;
  }

  stop(): Promise<void> {
    this.assertUsable();
    this.desiredSearch = null;

    if (this.phase === "loading") return Promise.resolve();
    if (this.phase === "restarting") {
      this.phase = "stopping";
      this.emit();
      return this.stopCompletion?.promise ?? Promise.resolve();
    }
    if (this.phase !== "searching") return Promise.resolve();

    this.phase = "stopping";
    this.emit();
    return this.requestWorkerStop();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.desiredSearch = null;
    this.activeSearch = null;
    this.clearStopTimer();
    this.completeStop();
    this.terminateWorker(new Error("Stockfish client was disposed."));
    this.analysis = null;
    this.error = null;
    this.phase = "disposed";
    this.emit();
    this.listeners.clear();
  }

  private assertUsable(): void {
    if (this.disposed) throw new Error("Stockfish client has been disposed.");
  }

  private emit(): void {
    const event = this.getSnapshot();
    for (const listener of this.listeners) listener(event);
  }

  private beginInitialization(displayPhase: "loading" | "restarting"): Promise<void> {
    this.assertUsable();
    if (this.initialization) return this.initialization;
    if (this.worker && ["ready", "searching", "stopping", "restarting"].includes(this.phase)) return Promise.resolve();

    const promise = this.performInitialization(displayPhase);
    this.initialization = promise;
    void promise.then(
      () => { if (this.initialization === promise) this.initialization = null; },
      () => { if (this.initialization === promise) this.initialization = null; },
    );
    return promise;
  }

  private async performInitialization(displayPhase: "loading" | "restarting"): Promise<void> {
    this.phase = displayPhase;
    this.error = null;
    this.emit();

    let generation = this.workerGeneration;
    try {
      const url = this.options.workerUrl ? String(this.options.workerUrl) : defaultWorkerUrl();
      const factory = this.options.workerFactory ?? defaultWorkerFactory;
      const worker = factory(url);
      generation = ++this.workerGeneration;
      this.worker = worker;
      this.workerMessageListener = (event) => {
        if (generation === this.workerGeneration && worker === this.worker) this.handleWorkerMessage(event);
      };
      this.workerErrorListener = (event) => {
        if (generation !== this.workerGeneration || worker !== this.worker) return;
        const detail = event.message || (event.error instanceof Error ? event.error.message : "The Stockfish worker failed to load or crashed.");
        this.fail(new Error(detail));
      };
      worker.addEventListener("message", this.workerMessageListener);
      worker.addEventListener("error", this.workerErrorListener);

      const uciOk = this.waitForToken("uciok", generation);
      worker.postMessage("uci");
      await uciOk;
      this.ensureGeneration(generation);

      worker.postMessage("setoption name MultiPV value 1");
      const readyOk = this.waitForToken("readyok", generation);
      worker.postMessage("isready");
      await readyOk;
      this.ensureGeneration(generation);

      this.phase = "ready";
      this.emit();
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(errorMessage(error));
      if (!this.disposed && generation === this.workerGeneration) this.fail(failure);
      throw failure;
    }
  }

  private ensureGeneration(generation: number): void {
    if (this.disposed || generation !== this.workerGeneration || !this.worker) {
      throw new Error("Stockfish initialization was superseded.");
    }
  }

  private waitForToken(token: string, generation: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.handshakeWaiters.delete(token);
        reject(new Error(`Stockfish did not respond with ${token} within ${this.options.handshakeTimeoutMs} ms.`));
      }, this.options.handshakeTimeoutMs);
      this.handshakeWaiters.set(token, { generation, resolve, reject, timer });
    });
  }

  private resolveToken(token: string): boolean {
    const waiter = this.handshakeWaiters.get(token);
    if (!waiter || waiter.generation !== this.workerGeneration) return false;
    clearTimeout(waiter.timer);
    this.handshakeWaiters.delete(token);
    waiter.resolve();
    return true;
  }

  private handleWorkerMessage(event: StockfishWorkerEvent): void {
    const payload = typeof event.data === "string" ? event.data : String(event.data ?? "");
    for (const rawLine of payload.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;
      if (line === "uciok" || line === "readyok") {
        this.resolveToken(line);
        continue;
      }
      if (line.startsWith("info ")) this.handleInfo(line);
      else if (line.startsWith("bestmove")) this.handleBestMove();
    }
  }

  private handleInfo(line: string): void {
    if (this.phase !== "searching" || !this.activeSearch) return;
    const parsed = parseInfoLine(line);
    if (!parsed || parsed.multiPv !== 1) return;

    const previous = this.analysis?.searchId === this.activeSearch.id ? this.analysis : null;
    const score = parsed.score
      ? normalizeScoreToWhite(parsed.score.kind, parsed.score.value, this.activeSearch.fen)
      : previous?.score ?? null;
    const requestedPv = parsed.pv.slice(0, MAX_PV_PLIES);
    const pvSan = parsed.pv.length ? uciMovesToSan(this.activeSearch.fen, requestedPv) : previous?.pvSan ?? [];
    const pvUci = parsed.pv.length ? requestedPv.slice(0, pvSan.length) : previous?.pvUci ?? [];
    this.analysis = {
      searchId: this.activeSearch.id,
      fen: this.activeSearch.fen,
      depth: parsed.depth ?? previous?.depth ?? null,
      score,
      pvUci,
      pvSan,
      formattedPv: formatPvSan(this.activeSearch.fen, pvSan),
    };
    this.emit();
  }

  private handleBestMove(): void {
    if (!this.activeSearch) return;
    this.activeSearch = null;
    this.clearStopTimer();
    this.completeStop();

    if (this.desiredSearch) {
      this.phase = "ready";
      this.startPendingSearch();
      return;
    }
    this.phase = "ready";
    this.emit();
  }

  private startPendingSearch(): void {
    if (!this.desiredSearch || !this.worker || this.phase !== "ready") return;
    const request = this.desiredSearch;
    this.desiredSearch = null;
    this.activeSearch = request;
    this.analysis = null;
    this.error = null;
    this.phase = "searching";
    try {
      this.worker.postMessage(`position fen ${request.fen}`);
      this.worker.postMessage("go infinite");
      this.emit();
    } catch (error) {
      this.fail(error instanceof Error ? error : new Error(errorMessage(error)));
    }
  }

  private requestWorkerStop(): Promise<void> {
    if (this.stopCompletion) return this.stopCompletion.promise;
    if (!this.worker || !this.activeSearch) return Promise.resolve();

    let resolveStop = () => {};
    const promise = new Promise<void>((resolve) => { resolveStop = resolve; });
    this.stopCompletion = { promise, resolve: resolveStop };
    try {
      this.worker.postMessage("stop");
      this.stopTimer = setTimeout(() => this.handleStopTimeout(), this.options.stopTimeoutMs);
    } catch (error) {
      this.fail(error instanceof Error ? error : new Error(errorMessage(error)));
    }
    return promise;
  }

  private handleStopTimeout(): void {
    this.clearStopTimer();
    this.activeSearch = null;
    this.completeStop();
    this.terminateWorker(new Error("Stockfish did not stop before the restart timeout."));

    if (!this.desiredSearch || this.disposed) {
      this.phase = "uninitialized";
      this.emit();
      return;
    }

    void this.beginInitialization("restarting")
      .then(() => this.startPendingSearch())
      .catch(() => { /* The client already emitted its error state. */ });
  }

  private clearStopTimer(): void {
    if (this.stopTimer) clearTimeout(this.stopTimer);
    this.stopTimer = null;
  }

  private completeStop(): void {
    const completion = this.stopCompletion;
    this.stopCompletion = null;
    completion?.resolve();
  }

  private fail(error: Error): void {
    if (this.disposed) return;
    this.clearStopTimer();
    this.completeStop();
    this.activeSearch = null;
    this.desiredSearch = null;
    this.terminateWorker(error);
    this.phase = "error";
    this.error = error.message;
    this.emit();
  }

  private terminateWorker(reason: Error): void {
    const worker = this.worker;
    if (worker && this.workerMessageListener) worker.removeEventListener("message", this.workerMessageListener);
    if (worker && this.workerErrorListener) worker.removeEventListener("error", this.workerErrorListener);
    worker?.terminate();
    this.worker = null;
    this.workerMessageListener = null;
    this.workerErrorListener = null;
    this.workerGeneration += 1;
    for (const waiter of this.handshakeWaiters.values()) {
      clearTimeout(waiter.timer);
      waiter.reject(reason);
    }
    this.handshakeWaiters.clear();
  }
}
