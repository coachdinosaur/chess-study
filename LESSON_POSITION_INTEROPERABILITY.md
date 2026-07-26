# Lesson and Position Set Interoperability

Stage 2 connects the main app's rich lesson workflow to its flat CSV/XLSX position-set workflow without replacing either data model.

## Terminology

The main navigation now presents the former **Lessons** tab as **Position Sets**. The underlying route value remains `lessons` for compatibility with saved drafts and existing tab logic.

- **Rich lesson:** a starting position plus a branching move tree, comments, notes, annotations, orientation, and display state.
- **Position Set:** an ordered collection of standalone FEN positions intended for preparation, CSV/XLSX exchange, and quick loading.

The full lesson JSON remains the authoritative format for branching instructional material. CSV and Excel remain flat position interchange formats.

## Available actions

### Position Sets tab

For a selected position:

- **Open in Study** loads the position on the board and switches to Study without adding a new lesson.
- **Open in Analysis** loads the position on the board and switches to Analysis without adding a new lesson.
- **Create New Lesson** converts the selected position into a new lesson-book entry, preserves existing lessons, makes the new lesson active, and reloads the app so the ordinary lesson hydrator opens it.

For the complete set:

- **Create Lessons from Set** converts every position into a separate lesson-book entry in set order.
- The set's default position becomes the active converted lesson. If none is explicitly marked, the first converted position becomes active.
- Duplicate IDs are resolved with stable numeric suffixes such as `position-2`.

### Study, Setup, and Analysis

The File & Lesson menu includes **Add current position to Position Set**. It opens Position Sets and uses the existing Add Current Board path, so the current board remains the authoritative FEN and orientation source.

## CSV and Excel columns

Existing files remain valid. Stage 2 exports these columns:

```text
order
id
title
fen
orientation
teacher_note
student_prompt
tags
is_default
source_lesson_id
source_node_id
```

The established fields keep their existing meaning. The additional fields are optional:

| Column | Meaning |
|---|---|
| `student_prompt` | Student-facing question or task for the position |
| `tags` | Comma- or semicolon-separated labels |
| `source_lesson_id` | Original lesson identifier when the row came from a lesson |
| `source_node_id` | Original move-tree node identifier |

CSV and XLSX imports continue through the existing Position Set Builder. The interoperability layer reads the optional metadata columns after the established importer has loaded and validated the positions.

Enhanced CSV/XLSX export retains the builder's validation gate. Export is blocked when:

- the set is empty;
- an ID is duplicated;
- a position FEN is malformed or illegal;
- no default position is selected;
- more than one default position is selected.

## Storage

The existing Position Set Builder continues to own its current storage keys:

```text
lesson-position-builder-v1:last-set
lesson-position-builder-v1:<set-name>
```

Optional Stage 2 metadata is stored separately under:

```text
lesson-position-interoperability-v1
```

This avoids rewriting existing saved sets. Metadata is keyed by the builder's saved-set key and position ID.

Converted lessons are appended to the existing app draft key:

```text
setup-analysis-draft-v1
```

Before conversion, Stage 2 dispatches the app's existing synchronous `beforeunload` persistence path. It then appends version-1 lesson entries inside the existing version-2 lesson-book draft, preserving current lessons and lesson-book preferences.

## Conversion mapping

| Position field | Converted lesson destination |
|---|---|
| `id` | Lesson-book entry ID, with collision-safe suffixing |
| `title` | Lesson title |
| `fen` | Setup FEN and root-node FEN |
| `orientation` | Board orientation |
| `teacher_note` | Lesson note and root-node comment |
| `is_default` | Selects the active converted lesson |

`student_prompt`, `tags`, and source references remain attached to the Position Set and its CSV/XLSX representation. The current app lesson serializer does not yet have durable fields for these values, so Stage 2 does not claim that they survive subsequent rich-lesson saves. A later Study/Teach integration can add explicit lesson-level prompt and tag fields.

## Compatibility rules

- Existing `.lesson.json`, `.lesson-book.json`, PGN, CSV, and XLSX files remain supported.
- Existing Position Set localStorage payloads are not rewritten.
- Existing lessons are preserved when selected positions or complete sets are converted.
- Position loading uses the established builder callbacks and FEN validation.
- Play, Endgame Puzzles, Lichess Position Training, Stockfish, tablebase, and Live Board state are not modified.
- The interoperability UI is disabled in embed and board-only modes.

## Implementation files

| File | Responsibility |
|---|---|
| `lesson-position-interoperability-core.mjs` | Pure metadata normalization, spreadsheet projection, app-compatible lesson conversion, draft append, and CSV metadata parsing |
| `lesson-position-export-validation.mjs` | Pure set-level export validation for empty sets, IDs, FENs, and default selection |
| `lesson-position-interoperability-export-guard.mjs` | Browser export gate using the app's bundled chess legality validator |
| `lesson-position-interoperability.mjs` | Runtime labels, fields, buttons, builder integration, import/export interception, browser storage, and lesson-book activation |
| `lesson-model.mjs` / `lesson-position-adapter.mjs` | Stage 1 contracts reused by Stage 2 |
| `focus-analysis-popup.mjs` | Loads the export guard and Stage 2 runtime after the main app initializes |
| `tests/lesson-position-interoperability.test.mjs` | Pure Stage 2 conversion, metadata, compatibility, and export-validation tests |
| `.github/workflows/lesson-interoperability-tests.yml` | Targeted syntax and Node test checks for Stage 1 and Stage 2 |

## Validation

```powershell
node --check lesson-model.mjs
node --check lesson-migrations.mjs
node --check lesson-position-adapter.mjs
node --check lesson-position-export-validation.mjs
node --check lesson-position-interoperability-core.mjs
node --check lesson-position-interoperability-export-guard.mjs
node --check lesson-position-interoperability.mjs
node --check focus-analysis-popup.mjs
node --test tests/lesson-data-foundation.test.mjs
node --test tests/lesson-position-interoperability.test.mjs
```

Manual browser checks should cover:

1. Existing CSV import without optional columns.
2. CSV and XLSX import with prompts, tags, and source IDs.
3. Enhanced CSV/XLSX export and each validation failure.
4. Open selected position in Study and Analysis.
5. Create one lesson while preserving existing lessons.
6. Convert a full set while preserving order and selecting its default position.
7. Add the current board to a Position Set.
8. Reload and reopen the converted lesson.
