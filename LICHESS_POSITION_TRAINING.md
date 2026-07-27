# Position Study

This document is the product and implementation reference for the separate Position Study mode and its teacher-managed student assignments. Existing internal module filenames, asset paths, storage keys, and IndexedDB names retain the `lichess-position-training` identifier for compatibility.

## Product boundary

Position Study is not the legacy Endgame Puzzle system. It keeps separate UI, objective rules, history, statistics, learning state, data loading, and assignment behavior. The two modes share only reusable chess infrastructure such as `chess.js`, MPChess pieces, Stockfish, tablebase access, and legal-move interaction.

## Current production library

The production manifest is `assets/puzzles/lichess-position-training/manifest.json`.

| Property | Current value |
|---|---:|
| Puzzles | 30,000 |
| Shards | 1,200 |
| Records per shard | 25 |
| First shard | `shard-0000.json` |
| Last shard | `shard-1199.json` |
| Exact stored line required | No |
| Excluded source theme | `veryLong` |

The trainer displays the total dynamically from `manifest.count`, with a fallback that sums shard descriptors. Documentation records the current release total; the UI remains manifest-driven.

## Record format

Each production record contains:

- `id`: Lichess puzzle ID;
- `sourceFen`: database FEN before the repair move;
- `repairMove`: the first database move in UCI notation;
- `startFen`: reconstructed solver position after that move;
- `losingMoverColor`: side that played the repair move;
- `solverColor`: side to move in `startFen`;
- `rating`, `popularity`, and `plays`;
- `themes`;
- `gameUrl`;
- `openingTags`.

Fields such as `solution`, `moves`, `continuation`, and `exactLine` are forbidden. The database move reconstructs the position; it does not dictate a single accepted continuation.

## Generation and validation invariants

Dataset expansions must:

1. Preserve every existing production shard byte-for-byte.
2. Reject duplicate puzzle IDs.
3. Reject repeated reconstructed `startFen` values.
4. Apply every `repairMove` legally with the bundled chess rules.
5. Verify solver and losing-mover colors.
6. Exclude `veryLong` records.
7. Keep every shard at 25 records.
8. Keep manifest count, descriptor count, and physical shard count consistent.
9. Reject exact-continuation fields.
10. Run trainer, terminal-state, layout, adaptive-learning, and assignment-selection tests.

Validation evidence for the current release is stored under `proof/lichess-30000-*.md` and `proof/logs/lichess-30000-*.txt`.

## Runtime data loading

`LichessPositionTrainingDataSource` loads the manifest and shuffles shard indexes. It fetches one shard at a time, shuffles records inside the shard, applies rating/theme filters, and avoids recently used IDs.

Network JSON uses `cache: no-cache`. Successful responses are stored in IndexedDB database `lichess-position-training-cache-v1`, store `shards`. When a fetch fails, the loader can use the cached manifest or shard.

Only a small active shard is loaded into memory. Expanding the library therefore increases static data size without requiring all 30,000 records to be downloaded at trainer startup.

## Objective and move grading

`prepareLichessTrainingPuzzle()` applies the repair move and derives a solver-relative objective. Typical goals include converting an advantage, preserving a draw, or completing a checkmating attack.

The app grades position outcomes rather than comparing a student's move to one stored line:

1. Apply the legal student move.
2. Resolve terminal checkmate or draw immediately.
3. Use tablebase when eligible.
4. Otherwise evaluate with the dedicated Stockfish evaluator.
5. Convert the result to the solver's perspective.
6. Accept the move when it preserves the required result.
7. Continue with dynamic defence until solved or failed.

This ordering prevents a delivered checkmate from being misread through a terminal engine score such as `mate 0`. Alternative winning or drawing moves remain valid even when they differ from the engine's first candidate.

## Learning system

Browser-local learning is stored under `lichess-position-training-learning-v1`.

- Adaptive rating starts at 1400 and is clamped from 400 to 3000.
- Adaptive mode selects roughly ±250 rating around the current rating.
- Theme statistics track attempts, solves, mistakes, and hints.
- `weakest` theme mode selects the lowest-performing instructional motif.
- Mistakes reduce adaptive rating and add the puzzle to Mistake Review.
- The review queue stores at most 120 portable puzzle snapshots.
- Two independent clean review solves retire a position.

Each position offers one optional hint. It highlights only the piece that should move, based on the current engine candidate. It does not reveal the destination square, SAN/UCI notation, an arrow, the motif, or the complete move. After use, the button reads **Hint used** and remains disabled for that position; Reset does not restore it. If no reliable engine candidate is available, the current feedback remains unchanged and the hint is not marked as used.

Generic generated success and mistake explanations, including the former **Why the solution worked** panel, are suppressed. Position Study retains concise move-validity and objective feedback from the evaluator.

General trainer statistics, preferences, and history use their own localStorage keys and do not share state with Endgame Puzzles.

## Interface and layout guarantees

The desktop board is square, flush, and stable before and after feedback appears. Evaluator feedback uses the reserved response track, so its visibility does not resize the board. The legacy explanation container is kept hidden and cleared by the active Position Study patch. Long feedback text scrolls inside the response area. All main-column content is pinned to one explicit CSS grid column to prevent an implicit-column collapse after answering.

The action row remains horizontal on desktop, and board file/rank coordinates use the reduced label size. Tablet and mobile use normal document flow and responsive board sizing.

## Teacher-managed assignments

Approved teachers manage assignments from `management/teacher.html`. The selection engine reads the installed manifest and freezes unique snapshots matching the selected rating, theme, level, and assignment-size settings.

The lifecycle is:

```text
generate frozen puzzle set
  → preview and optionally replace positions
  → publish to selected students
  → create private per-student links
  → monitor progress, scores, and completion
  → edit safe metadata, duplicate, archive, restore, or delete
```

After students begin, the frozen puzzle set remains unchanged. Safe metadata can still be edited; changing the actual puzzle sequence requires a duplicated/new assignment.

### Student access and security

Students open `management/assignment.html` using a private bearer token in the link. They do not create a management account. The browser token is hashed with SHA-256; only the hash is stored in Supabase.

Database access is split between:

- approved-teacher, owner-scoped policies for assignment management;
- token-scoped RPCs for student loading and attempt submission;
- cascading relationships for permanent cleanup.

Archiving disables student access while retaining results. Restoring republishes access. Permanent deletion requires typed `DELETE`, invalidates all links, removes local teacher tokens, and cascades through snapshots, student assignments, attempts, progress, and results.

## Main implementation files

| File | Responsibility |
|---|---|
| `lichess-position-training.mjs` | Internal Position Study controller and user interface |
| `lichess-position-training-core.mjs` | Position reconstruction, objectives, move classification |
| `lichess-position-training-data.mjs` | Manifest/shard loading and IndexedDB cache |
| `lichess-position-training-engine.mjs` | Tablebase/Stockfish evaluation and terminal outcomes |
| `lichess-position-training-learning.mjs` | Adaptive rating, hint accounting, theme metrics, and review state |
| `position-study-single-hint-patch.mjs` | Active one-use source-piece hint, `Hint used` state, launcher copy, and generic-explanation suppression |
| `lichess-position-training-interactions.mjs` | Board interaction behavior |
| `lichess-position-training-grid-layout.mjs` | Explicit desktop grid rows |
| `lichess-position-training-post-answer-fix.css` | Stable single-column post-answer layout |
| `management/js/puzzle-assignment-core.mjs` | Presets, selection, frozen snapshots |
| `management/js/puzzle-assignment-dashboard.mjs` | Teacher builder and progress display |
| `management/js/puzzle-assignment-lifecycle.mjs` | Edit, duplicate, archive, restore, delete |
| `management/js/puzzle-assignment-student.mjs` | Token-scoped student runtime |
| `supabase/migrations/010_teacher_puzzle_assignments.sql` | Assignment schema, RLS, RPCs, cleanup |

## Manual validation

After runtime, layout, dataset, or assignment changes, test at minimum:

- count badge matches the manifest;
- fixed and adaptive filters load matching positions;
- a valid alternative move is accepted;
- throwing away a win or draw is rejected;
- delivered checkmate succeeds without starting Stockfish;
- terminal draw returns the correct solver-relative result;
- board dimensions do not change after feedback appears;
- Hint highlights only the source piece, can be used once per position, changes to **Hint used**, and is not restored by Reset;
- no destination, notation, arrow, motif, full move, or generic explanation panel is revealed;
- Reset and Next remain usable on desktop and mobile;
- Mistake Review adds, schedules, and retires positions correctly;
- assignment generation freezes unique matching snapshots;
- published student links load without a management login;
- archive, restore, duplicate, and permanent deletion behave as documented.
