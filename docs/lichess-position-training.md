# Lichess Position Training

This is a separate puzzle mode launched from the existing Puzzle tab. It does not change the existing **Endgame vs Stockfish** trainer or reuse that trainer's queue, settings, history, or statistics.

## Training model

The Lichess database is used as a source of positions, ratings, themes, and the first move that created the tactical opportunity.

1. Load the database FEN.
2. Apply only the first database move. That move belongs to the side whose mistake creates the training position.
3. Derive the solver color from the resulting side to move. Never assume White is the solver.
4. Evaluate the resulting position from the solver's perspective.
5. Skip the record when the solver is still losing.
6. Accept any legal student move that preserves the required win or draw.
7. Let tablebases or Stockfish judge the objective and let Stockfish choose dynamic defensive replies.
8. Never require the remaining database move sequence.

The original continuation is deliberately not stored in generated shards. This prevents the UI from quietly becoming an exact-line memorization trainer later.

## Separate browser state

The mode uses its own storage keys:

- `lichess-position-training-prefs-v1`
- `lichess-position-training-stats-v1`
- `lichess-position-training-history-v1`
- IndexedDB database `lichess-position-training-cache-v1`

The existing `endgame-puzzle-*` keys remain untouched.

## Building the large puzzle set

Download the official Lichess puzzle database and run:

```bash
node tools/build-lichess-position-training.mjs \
  --input lichess_db_puzzle.csv.zst \
  --output assets/puzzles/lichess-position-training \
  --limit 250000 \
  --shard-size 2000 \
  --min-rating 700 \
  --max-rating 2600 \
  --min-popularity 80 \
  --min-plays 50
```

The script:

- streams the CSV instead of loading it into memory;
- validates and applies the first UCI move;
- records both the losing mover and resulting solver color;
- drops the remaining database line;
- excludes `veryLong` puzzles by default;
- writes small JSON shards plus a manifest for on-demand loading.

A tiny bundled seed shard exists only so the UI can be smoke-tested before the full dataset is generated. It is not intended to replace the official database.

## Move judgment

For positions with seven pieces or fewer, the trainer first requests Lichess tablebase data. Outcomes are converted from side-to-move perspective to solver perspective.

For other positions, browser Stockfish evaluates the position. Scores are also converted to solver perspective, so a positive White score is not accidentally treated as good for a Black solver.

Move grades are objective-based:

- **Excellent / good:** preserves the win or draw.
- **Inaccuracy:** still preserves the objective but makes conversion harder.
- **Mistake:** loses the required win or draw; the move is undone and the student retries.

## Manual checks

1. Open the normal Puzzle tab and confirm the existing trainer behaves exactly as before.
2. Open **Lichess Position Training** from its separate launcher.
3. Verify both White-to-move and Black-to-move records orient the board correctly.
4. Verify a non-reference winning move is accepted.
5. Verify a move that throws away a win is undone.
6. Verify the opponent replies dynamically.
7. Reload and confirm the new mode's settings and statistics persist separately.
8. Run the core tests:

```bash
node --test tests/lichess-position-training-core.test.mjs
```
