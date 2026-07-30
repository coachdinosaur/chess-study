import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { Chess } from "chess.js";

const root = new URL("../", import.meta.url);

async function loadClientModule() {
  const source = await readFile(new URL("app/stockfish-client.ts", root), "utf8");
  let output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  output = output.replace(/from ["']chess\.js["']/, `from ${JSON.stringify(import.meta.resolve("chess.js"))}`);
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

class FakeWorker {
  constructor(url) {
    this.url = url;
    this.commands = [];
    this.terminated = false;
    this.listeners = new Map();
  }

  postMessage(command) {
    if (this.terminated) throw new Error("worker already terminated");
    this.commands.push(command);
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  terminate() {
    this.terminated = true;
  }

  emit(data) {
    for (const listener of this.listeners.get("message") ?? []) listener({ data });
  }

  fail(message = "worker asset missing") {
    for (const listener of this.listeners.get("error") ?? []) listener({ message });
  }
}

const START_FEN = new Chess().fen();
const boardAfter = (...moves) => {
  const game = new Chess();
  for (const move of moves) game.move(move);
  return game.fen();
};
const E4_FEN = boardAfter("e4");
const E4_E5_FEN = boardAfter("e4", "e5");
const nextTask = () => new Promise((resolve) => setImmediate(resolve));
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(predicate, message, timeoutMs = 250) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) assert.fail(message);
    await delay(2);
  }
}

async function finishHandshake(worker) {
  worker.emit("id name Stockfish 18\nuciok");
  await nextTask();
  assert.deepEqual(worker.commands.slice(0, 3), ["uci", "setoption name MultiPV value 1", "isready"]);
  worker.emit("readyok");
  await nextTask();
}

test("resolves the Stockfish worker relative to the static app document", async () => {
  const { resolveWorkerUrl } = await loadClientModule();
  assert.equal(
    resolveWorkerUrl("https://example.test/opening_book/index.html#/chapters/2"),
    "https://example.test/opening_book/stockfish/stockfish-18-lite-single.js",
  );
});

function harness(StockfishClient, overrides = {}) {
  const workers = [];
  const client = new StockfishClient({
    workerUrl: "https://example.test/course/stockfish/stockfish-18-lite-single.js",
    workerFactory: (url) => {
      const worker = new FakeWorker(url);
      workers.push(worker);
      return worker;
    },
    handshakeTimeoutMs: 100,
    stopTimeoutMs: 100,
    ...overrides,
  });
  return { client, workers };
}

test("parses primary UCI info and normalizes scores to White", async () => {
  const { parseInfoLine, normalizeScoreToWhite, formatEngineScore, scoreToWhiteFraction } = await loadClientModule();
  assert.deepEqual(parseInfoLine("info depth 18 multipv 1 score cp 42 lowerbound nodes 10 pv e2e4 e7e5"), {
    depth: 18,
    multiPv: 1,
    score: { kind: "cp", value: 42 },
    pv: ["e2e4", "e7e5"],
  });
  assert.equal(parseInfoLine("bestmove e2e4"), null);
  assert.deepEqual(normalizeScoreToWhite("cp", 42, START_FEN), { kind: "cp", whiteValue: 42, label: "+0.42" });
  assert.deepEqual(normalizeScoreToWhite("cp", 130, E4_FEN), { kind: "cp", whiteValue: -130, label: "\u22121.30" });
  assert.equal(formatEngineScore("mate", 3), "M3");
  assert.equal(formatEngineScore("mate", -2), "\u2212M2");
  assert.equal(scoreToWhiteFraction({ kind: "cp", whiteValue: 600, label: "+6.00" }), 0.94);
  assert.equal(scoreToWhiteFraction({ kind: "mate", whiteValue: -1, label: "\u2212M1" }), 0.02);
  assert.equal(scoreToWhiteFraction(null), null);
});

test("converts legal UCI moves to numbered SAN, including promotion, and truncates invalid PV", async () => {
  const { uciMovesToSan, formatPvSan } = await loadClientModule();
  const san = uciMovesToSan(START_FEN, ["e2e4", "e7e5", "g1f3", "not-a-move", "b8c6"]);
  assert.deepEqual(san, ["e4", "e5", "Nf3"]);
  assert.equal(formatPvSan(START_FEN, san), "1. e4 e5 2. Nf3");
  assert.deepEqual(uciMovesToSan("8/P7/8/8/8/8/7k/K7 w - - 0 1", ["a7a8q"]), ["a8=Q"]);
  assert.equal(formatPvSan(E4_FEN, ["e5", "Nf3"]), "1... e5 2. Nf3");
});

test("uses the strict lazy classic-worker handshake before starting analysis", async () => {
  const { StockfishClient } = await loadClientModule();
  const { client, workers } = harness(StockfishClient);
  const events = [];
  client.subscribe((event) => events.push(event));

  assert.equal(workers.length, 0, "construction must be lazy");
  const analyzing = client.analyze(START_FEN);
  assert.equal(workers.length, 1);
  assert.equal(workers[0].url, "https://example.test/course/stockfish/stockfish-18-lite-single.js");
  assert.deepEqual(workers[0].commands, ["uci"]);
  await finishHandshake(workers[0]);
  const searchId = await analyzing;
  assert.equal(searchId, 1);
  assert.deepEqual(workers[0].commands, [
    "uci",
    "setoption name MultiPV value 1",
    "isready",
    `position fen ${START_FEN}`,
    "go infinite",
  ]);
  assert.equal(events.at(-1).phase, "searching");
  client.dispose();
});

test("emits only MultiPV 1 updates with search id, FEN, normalized score, and SAN", async () => {
  const { StockfishClient } = await loadClientModule();
  const { client, workers } = harness(StockfishClient);
  const analyzing = client.analyze(E4_FEN);
  await finishHandshake(workers[0]);
  const searchId = await analyzing;

  workers[0].emit("info depth 11 multipv 2 score cp 999 pv e7e5");
  assert.equal(client.getSnapshot().analysis, null);
  workers[0].emit("info depth 20 multipv 1 score cp 130 nodes 999 pv e7e5 g1f3 b8c6");
  assert.deepEqual(client.getSnapshot().analysis, {
    searchId,
    fen: E4_FEN,
    depth: 20,
    score: { kind: "cp", whiteValue: -130, label: "\u22121.30" },
    pvUci: ["e7e5", "g1f3", "b8c6"],
    pvSan: ["e5", "Nf3", "Nc6"],
    formattedPv: "1... e5 2. Nf3 Nc6",
  });
  client.dispose();
});

test("serializes replacement searches and coalesces rapid navigation to the latest FEN", async () => {
  const { StockfishClient } = await loadClientModule();
  const { client, workers } = harness(StockfishClient);
  const first = client.analyze(START_FEN);
  await finishHandshake(workers[0]);
  await first;
  workers[0].emit("info depth 8 score cp 20 pv e2e4");

  const secondId = await client.analyze(E4_FEN);
  const thirdId = await client.analyze(E4_E5_FEN);
  assert.equal(secondId, 2);
  assert.equal(thirdId, 3);
  assert.equal(client.getSnapshot().phase, "restarting");
  assert.equal(client.getSnapshot().analysis, null);
  assert.equal(workers[0].commands.filter((command) => command === "stop").length, 1);

  workers[0].emit("info depth 99 score cp 900 pv d2d4");
  assert.equal(client.getSnapshot().analysis, null, "old info must be ignored while stopping");
  workers[0].emit("bestmove e2e4");
  assert.deepEqual(workers[0].commands.slice(-2), [`position fen ${E4_E5_FEN}`, "go infinite"]);
  workers[0].emit("info depth 6 score cp 25 pv g1f3");
  assert.equal(client.getSnapshot().analysis.searchId, thirdId);
  assert.equal(client.getSnapshot().analysis.fen, E4_E5_FEN);
  client.dispose();
});

test("Stop preserves the last evaluation and a spontaneous bestmove does not restart", async () => {
  const { StockfishClient } = await loadClientModule();
  const { client, workers } = harness(StockfishClient);
  const first = client.analyze(START_FEN);
  await finishHandshake(workers[0]);
  await first;
  workers[0].emit("info depth 12 score mate 3 pv e2e4");
  const retained = client.getSnapshot().analysis;
  const stopping = client.stop();
  assert.equal(client.getSnapshot().phase, "stopping");
  workers[0].emit("bestmove e2e4");
  await stopping;
  assert.equal(client.getSnapshot().phase, "ready");
  assert.deepEqual(client.getSnapshot().analysis, retained);
  const commandCount = workers[0].commands.length;

  await client.analyze(E4_FEN);
  workers[0].emit("bestmove (none)");
  assert.equal(client.getSnapshot().phase, "ready");
  assert.equal(workers[0].commands.length, commandCount + 2, "terminal bestmove must not loop");
  client.dispose();
});

test("recreates a stuck worker after the stop timeout and analyzes only the latest FEN", async () => {
  const { StockfishClient } = await loadClientModule();
  const { client, workers } = harness(StockfishClient, { stopTimeoutMs: 20 });
  const first = client.analyze(START_FEN);
  await finishHandshake(workers[0]);
  await first;
  await client.analyze(E4_FEN);

  await waitFor(() => workers.length === 2, "replacement worker was not created");
  assert.equal(workers[0].terminated, true);
  assert.deepEqual(workers[1].commands, ["uci"]);
  await finishHandshake(workers[1]);
  await waitFor(() => workers[1].commands.includes(`position fen ${E4_FEN}`), "pending position was not restarted");
  assert.deepEqual(workers[1].commands.slice(-2), [`position fen ${E4_FEN}`, "go infinite"]);
  assert.equal(client.getSnapshot().phase, "searching");
  client.dispose();
});

test("reports handshake timeouts and worker load errors", async () => {
  const { StockfishClient } = await loadClientModule();
  const timeoutHarness = harness(StockfishClient, { handshakeTimeoutMs: 15 });
  await assert.rejects(timeoutHarness.client.initialize(), /uciok/);
  assert.equal(timeoutHarness.client.getSnapshot().phase, "error");
  assert.equal(timeoutHarness.workers[0].terminated, true);
  timeoutHarness.client.dispose();

  const failureHarness = harness(StockfishClient);
  const initialization = failureHarness.client.initialize();
  failureHarness.workers[0].fail("404: stockfish worker not found");
  await assert.rejects(initialization, /404/);
  assert.equal(failureHarness.client.getSnapshot().phase, "error");
  assert.match(failureHarness.client.getSnapshot().error, /404/);
  failureHarness.client.dispose();
});

test("rejects malformed FENs before worker creation and removes callbacks on disposal", async () => {
  const { StockfishClient } = await loadClientModule();
  const { client, workers } = harness(StockfishClient);
  await assert.rejects(client.analyze(`${START_FEN}\nsetoption name Hash value 999`), /single-line/);
  await assert.rejects(client.analyze("not a fen"), /invalid FEN/);
  assert.equal(workers.length, 0);

  const initialization = client.initialize();
  const worker = workers[0];
  client.dispose();
  await assert.rejects(initialization, /disposed/);
  assert.equal(worker.terminated, true);
  assert.equal(client.getSnapshot().phase, "disposed");
  worker.emit("uciok\nreadyok\ninfo depth 99 score cp 999 pv e2e4");
  assert.equal(client.getSnapshot().phase, "disposed");
  assert.throws(() => client.stop(), /disposed/);
});
