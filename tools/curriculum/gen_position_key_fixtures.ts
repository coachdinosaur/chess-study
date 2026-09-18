import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalPositionKey } from "./position_key.js";

/**
 * Generates fixtures/position_key_fixtures.json — the shared parity suite
 * verified by both the TS toolchain and Dart `PositionKey.fromFen`.
 *
 * Run: npx tsx tools/curriculum/gen_position_key_fixtures.ts
 * (from the chess-study repo root, with apps/opening-book deps installed)
 */

interface Fixture {
  name: string;
  fen: string;
  key: string;
}

const fens: Array<{ name: string; fen: string }> = [
  {
    name: "startpos",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  },
  {
    name: "ep-after-1e4-not-legal",
    // Dart chess records e3 here; no black pawn can capture e.p.
    fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
  },
  {
    name: "ep-legal-french-advance",
    // 1.e4 d5 2.e5 f5 — white pawn e5 can capture f6 e.p.
    fen: "rnbqkbnr/ppp1pppp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3",
  },
  {
    name: "ep-pinned-capture-illegal",
    // Classic pinned e.p.: ...exd3 would expose the black king on a4
    // to Qh4 along the fourth rank — capture is illegal, so no ep field.
    fen: "8/8/8/8/k2Pp2Q/8/8/4K3 b - d3 0 1",
  },
  {
    name: "ep-black-to-move-legal",
    // 1.d4 Nf6 2.c4 e6 3.Nc3 Bb4 4.e4 d5 5.e5 Ne4? …; instead direct:
    // white pawn d5 vs black pawn e5 after ...e7e5 — dxe6 e.p. legal.
    fen: "r1bqkb1r/pppp1ppp/2n2n2/3Pp3/8/8/PPP1PPPP/RNBQKBNR w KQkq e6 0 4",
  },
  {
    name: "ep-present-but-no-pawn-adjacent",
    // FEN claims a6 but no white pawn on b5 — not legal, normalize to -.
    fen: "rnbqkbnr/1ppppppp/8/p7/8/8/PPPPPPPP/RNBQKBNR w KQkq a6 0 2",
  },
  {
    name: "castling-full",
    fen: "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1",
  },
  {
    name: "castling-white-only",
    fen: "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQq - 0 1",
  },
  {
    name: "castling-none",
    fen: "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w - - 0 1",
  },
  {
    name: "castling-black-only",
    fen: "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R b kq - 0 1",
  },
  {
    name: "counters-ignored",
    // Same four identity fields as 'catalan-root' but different counters.
    fen: "rnbqkb1r/pppp1ppp/4pn2/3p4/2PP4/5NP1/PP2PP1P/RNBQKB1R b KQkq - 7 4",
  },
  {
    name: "catalan-root",
    // 1.d4 Nf6 2.c4 e6 3.g3 d5 4.Nf3 — book root position.
    fen: "rnbqkb1r/pppp1ppp/4pn2/3p4/2PP4/5NP1/PP2PP1P/RNBQKB1R b KQkq - 2 4",
  },
  {
    name: "catalan-transposed-nf3-first",
    // 1.d4 Nf6 2.c4 e6 3.g3 d5 4.Nf3 Be7 5.Bg2
    fen: "rnbq1rk1/ppppbppp/4pn2/3p4/2PP4/5NP1/PP2PPBP/RNBQK2R b KQ - 3 5",
  },
  {
    name: "catalan-transposed-bg2-first",
    // 1.d4 Nf6 2.c4 e6 3.g3 d5 4.Bg2 Be7 5.Nf3 — must equal previous key.
    fen: "rnbq1rk1/ppppbppp/4pn2/3p4/2PP4/5NP1/PP2PPBP/RNBQK2R b KQ - 5 5",
  },
  {
    name: "catalan-open-dxc4",
    // 4...dxc4 5.Bg2 — Open Catalan.
    fen: "rnbqkb1r/pppp1ppp/4pn2/8/2pP4/5NP1/PP2PPBP/RNBQK2R b KQ - 0 5",
  },
  {
    name: "catalan-closed-be7-o-o",
    // Closed main line anchor from chapter 15.
    fen: "rnbq1rk1/ppp1bppp/4pn2/3p4/2PP4/5NP1/PP2PPBP/RNBQK2R w KQ - 4 6",
  },
  {
    name: "missing-ep-field",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq",
  },
  {
    name: "missing-counters-and-ep",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -",
  },
  {
    name: "checkmate-position",
    fen: "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3",
  },
  {
    name: "promotion-available",
    fen: "8/P7/8/8/8/8/8/k6K w - - 0 1",
  },
];

const fixtures: Fixture[] = fens.map(({ name, fen }) => ({
  name,
  fen,
  key: canonicalPositionKey(fen),
}));

// Transposition invariant: these two keys must be identical.
const t1 = fixtures.find((f) => f.name === "catalan-transposed-nf3-first")!;
const t2 = fixtures.find((f) => f.name === "catalan-transposed-bg2-first")!;
if (t1.key !== t2.key) {
  throw new Error(
    `transposition keys differ: ${t1.key} vs ${t2.key}`,
  );
}
// Counter insensitivity: 'counters-ignored' vs 'catalan-root'.
const c1 = fixtures.find((f) => f.name === "counters-ignored")!;
const c2 = fixtures.find((f) => f.name === "catalan-root")!;
if (c1.key !== c2.key) {
  throw new Error(`counter-insensitive keys differ: ${c1.key} vs ${c2.key}`);
}
// Ep normalization expectations (X-FEN rule).
const expectNoEp = [
  "ep-after-1e4-not-legal",
  "ep-pinned-capture-illegal",
  "ep-present-but-no-pawn-adjacent",
];
for (const name of expectNoEp) {
  const f = fixtures.find((x) => x.name === name)!;
  if (!f.key.endsWith(" -")) {
    throw new Error(`${name}: expected '-' ep field, got ${f.key}`);
  }
}
const expectEp = ["ep-legal-french-advance", "ep-black-to-move-legal"];
for (const name of expectEp) {
  const f = fixtures.find((x) => x.name === name)!;
  if (f.key.endsWith(" -")) {
    throw new Error(`${name}: expected ep field, got ${f.key}`);
  }
}

const out = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "position_key_fixtures.json",
);
writeFileSync(out, JSON.stringify(fixtures, null, 2) + "\n");
console.log(`wrote ${fixtures.length} fixtures to ${out}`);
for (const f of fixtures) console.log(`  ${f.name}: ${f.key}`);
