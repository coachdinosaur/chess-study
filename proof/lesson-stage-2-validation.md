# Lesson Interoperability Stage 2 Validation

Date: 2026-07-26

Branch: `agent/lesson-interoperability-stage-2`

Pull request: #91

## Implemented scope

- Visible **Lessons** terminology changed to **Position Sets** at runtime while preserving the internal `lessons` route.
- Added **Open in Study**, **Open in Analysis**, **Create New Lesson**, and **Create Lessons from Set** actions.
- Added **Add current position to Position Set** to the File & Lesson menu.
- Added optional `student_prompt`, `tags`, `source_lesson_id`, and `source_node_id` CSV/XLSX metadata.
- Preserved existing Position Set payloads by storing optional metadata separately.
- Added conversion into the current version-1 lesson / version-2 lesson-book runtime shape.
- Preserved existing lessons, conversion order, lesson-book preferences, and default-position activation.
- Added collision-safe lesson IDs.
- Restored export validation before enhanced CSV/XLSX export.
- Added targeted permanent GitHub Actions validation.

## Automated validation

Workflow: `Lesson interoperability tests`

Run: `30197007458`

Conclusion: **success**

### Syntax checks

The workflow passed `node --check` for:

- `lesson-model.mjs`
- `lesson-migrations.mjs`
- `lesson-position-adapter.mjs`
- `lesson-position-export-validation.mjs`
- `lesson-position-interoperability-core.mjs`
- `lesson-position-interoperability-export-guard.mjs`
- `lesson-position-interoperability.mjs`
- `focus-analysis-popup.mjs`

### Test suites

- Stage 1 foundation tests: 11 passed
- Stage 2 interoperability tests: 11 passed
- Combined: **22 passed, 0 failed**

Stage 2 tests cover:

- optional metadata enrichment;
- enhanced spreadsheet columns;
- app-compatible lesson entries;
- preservation of existing lessons and preferences;
- duplicate-ID resolution;
- default-position activation;
- legacy nested browser-draft normalization;
- optional CSV/XLSX metadata extraction;
- valid export acceptance;
- empty/missing-default rejection;
- duplicate-ID and illegal-FEN rejection;
- multiple-default rejection.

## Compatibility audit

The app's current serializer and hydrator were checked against the generated entries:

- app lesson version: 1;
- lesson-book version: 2;
- generated fields match the current flattened lesson payload;
- existing draft hydration remains authoritative;
- converted title, setup FEN, orientation, root/current node, root comment, annotations, and note are accepted by the existing lesson normalizer.

## Intentional boundary

The current rich-lesson serializer has no durable lesson-level fields for `student_prompt`, `tags`, `source_lesson_id`, or `source_node_id`. Stage 2 therefore keeps these values authoritative in Position Set storage and CSV/XLSX files. It does not falsely promise they will survive a later rich-lesson save.

## Unchanged systems

- Play
- Endgame Puzzles
- Lichess Position Training
- Stockfish
- tablebase
- Live Board
- embed mode
- board-only mode
- existing lesson JSON, lesson-book JSON, PGN, CSV, and XLSX compatibility
