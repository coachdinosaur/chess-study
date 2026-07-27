# Mini Soft Launch: 50,000 Lichess Puzzles

The 50,000-puzzle release is the mini soft-launch baseline for Lichess Position Training and teacher-managed puzzle assignments.

## Launch scope

This is a limited release for a manageable group of real teachers and students, not broad public promotion. It includes:

- 50,000 validated Lichess-derived positions;
- 2,000 immutable shards with 25 positions each;
- manifest-driven counts and on-demand loading;
- fixed and adaptive modes, progressive hints, and Mistake Review;
- terminal checkmate and draw grading before engine evaluation;
- stable desktop, tablet, and mobile layouts;
- frozen teacher assignments, secure student links, progress tracking, archive and restore, duplication, and deletion.

## Readiness checks

1. Confirm `main` reports 50,000 puzzles and 2,000 shards.
2. Confirm the deployed trainer displays “50,000 Lichess puzzles available.”
3. Sample low, medium, and high ratings across several themes.
4. Verify delivered checkmate succeeds without an engine request.
5. Verify feedback does not resize or collapse the board.
6. Generate, preview, publish, and complete a test assignment.
7. Verify teacher progress and scores update.
8. Verify archive, restore, duplicate, replacement-link, and permanent deletion.
9. Test Firefox, Chromium, and at least one phone or tablet.
10. Confirm migration 010, Row Level Security, backups, and production configuration.

## Monitor during launch

Track puzzle IDs reported as incorrectly graded, engine or tablebase failures, empty filters, layout defects, assignment-link or progress-sync failures, IndexedDB or browser-storage failures, and confusion about objectives or hints. Record the puzzle ID, browser, device, move, and screenshot.

## Boundaries

- Free-trainer learning is browser-local, not account-synchronized.
- Assignment progress is stored in Supabase and requires the private link.
- Library growth does not alter frozen published assignments.
- Merging does not prove the public deployment has completed.
- This is a limited operational test, not completion of every legal, commercial, support, monitoring, and recovery requirement.
