# Teacher Puzzle Assignments

## Implemented

- Approved teachers create fixed Lichess puzzle assignments from the existing 500-position dataset.
- Teachers choose a student level, rating range, theme, puzzle count, hint policy, retry policy, passing score, due date, and existing managed students.
- Every generated position can be previewed on a board and replaced before publication.
- Published assignments freeze exact puzzle snapshots and create one private bearer link per student.
- Students do not need accounts. Progress and attempts persist in Supabase and resume across devices through the same private link.
- Teacher results show status, current puzzle, and score. Missing local link tokens can be securely reissued.
- Desktop Lichess training and assignment boards size from viewport width and height to stay fully visible beside their control panels.

## Validation

- Node syntax checks for all new modules.
- Node unit tests for presets, settings normalization, puzzle filtering, uniqueness, and frozen snapshots.
- Existing Lichess position-training core and learning tests.
- Static checks for teacher-only wiring, assignment page references, migration presence, and desktop sizing markers.
- Supabase schema applied and verified separately with RLS inspection and a rollback-only token RPC transaction test.
