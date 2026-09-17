# proof/ — historical validation snapshots

Files in this directory are **point-in-time records**, not current-claims
documentation. Each describes the repository state on the date it was written:

- `lichess-{100…50000}-*` — the Position Study dataset expansion chain; only
  `lichess-50000-*` matches the current production dataset (50,000 positions,
  2,000×25 shards).
- `lesson-stage-*-validation.md` — lesson-system validation records for their
  development branches.
- `lichess-trainer-visual-redesign.md`, `position-training-desktop-fit.md` —
  UI redesign check records.
- `teacher-puzzle-assignments-summary.md` — written when the installed puzzle
  dataset was 500 positions.
- `lichess-100-puzzles/`, `logs/` — supporting data for the snapshots above.

Do not cite dataset sizes or branch states from these files as current facts;
verify against the live code and `assets/puzzles/lichess-position-training/manifest.json`.
