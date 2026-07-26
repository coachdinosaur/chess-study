# Lesson data foundation Stage 1 validation

## Scope

This validation covers the new foundation modules only. The current Study, Analysis, lesson save/open, Position Set Builder, browser-storage, Play, and Puzzle user interfaces are intentionally unchanged.

## Files

- `lesson-model.mjs`
- `lesson-migrations.mjs`
- `lesson-position-adapter.mjs`
- `tests/lesson-data-foundation.test.mjs`
- `LESSON_DATA_ARCHITECTURE.md`

## Commands

```bash
node --check lesson-model.mjs
node --check lesson-migrations.mjs
node --check lesson-position-adapter.mjs
node --test tests/lesson-data-foundation.test.mjs
```

## Result

- Syntax checks: passed
- Tests: 11
- Passed: 11
- Failed: 0
- Cancelled: 0
- Skipped: 0

## Covered behavior

- CSV/XLSX-style field aliases normalize into one shared `LessonPosition` shape.
- Basic FEN structure is checked, with an optional callback for full chess-legality validation.
- Stable IDs receive predictable collision suffixes.
- Raw legacy lesson states migrate without mutation.
- Current `{ id, lessonState }` lesson-book entries migrate into versioned documents.
- Browser drafts containing `lessonBook` migrate into a versioned lesson book.
- Version-2 lesson migration is idempotent.
- Position → lesson → position round trips preserve title, FEN, orientation, notes, prompts, tags, and source IDs.
- Selected tree-node export uses the selected node's FEN and comment rather than flattening to the root.
- Position-set order, duplicate-ID resolution, and the chosen default position survive lesson-book conversion.
- Spreadsheet projections preserve existing columns and include optional interoperability metadata.
