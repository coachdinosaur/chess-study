# Lesson Data Architecture

This document defines the shared lesson-data foundation used to make the main app's rich lesson workflow and flat CSV/XLSX position-set workflow interoperable.

## Stage status

### Stage 1: shared foundation

Stage 1 added reusable data modules and tests without changing visible workflows or browser storage:

- `lesson-model.mjs`
- `lesson-migrations.mjs`
- `lesson-position-adapter.mjs`
- `tests/lesson-data-foundation.test.mjs`

### Stage 2: Position Set interoperability

Stage 2 connects the foundation to the existing main-app workflow. It adds the visible Position Sets terminology, explicit Study/Analysis and lesson-conversion actions, optional CSV/XLSX metadata, collision-safe lesson-book append, and export validation.

See [LESSON_POSITION_INTEROPERABILITY.md](LESSON_POSITION_INTEROPERABILITY.md) for the implemented Stage 2 behavior, storage keys, conversion mapping, limitations, and validation commands.

### Stage 3: main-line and recursive variation controls

Stage 3 makes preferred-continuation changes explicit. New moves no longer replace an existing main line, navigation no longer mutates branch preference, **Make main line** promotes only the selected local branch, and the same rules apply recursively to sub-variations.

See [LESSON_VARIATIONS_AND_MAIN_LINES.md](LESSON_VARIATIONS_AND_MAIN_LINES.md) for the user workflow, PGN punctuation rules, persistence contract, and validation checklist.

## Product boundary

The app has two related but different types of teaching material:

1. **Rich lessons**
   - setup FEN;
   - branching move tree;
   - selected continuations;
   - position comments;
   - lesson note;
   - annotations;
   - orientation and display preferences.

2. **Position sets**
   - ordered standalone FENs;
   - ID and title;
   - orientation;
   - teacher note;
   - default-position marker;
   - CSV/XLSX interchange.

A position set is not a substitute for a branching lesson. The shared `LessonPosition` object is a bridge between them.

## Versioned formats

### Lesson document

```json
{
  "format": "coach-dinosaur-lesson",
  "version": 2,
  "id": "weak-back-rank",
  "title": "Weak Back Rank",
  "metadata": {
    "tags": ["tactics"],
    "level": "intermediate",
    "description": "",
    "teacherNote": "",
    "studentPrompt": "",
    "createdAt": null,
    "updatedAt": null
  },
  "lessonState": {}
}
```

`lessonState` remains the full-fidelity app state. The shared foundation deliberately treats it as an owned rich object rather than flattening it.

### Lesson book

```json
{
  "format": "coach-dinosaur-lesson-book",
  "version": 2,
  "id": "lesson-book",
  "title": "Lesson book",
  "activeLessonId": "lesson-1",
  "lessons": []
}
```

Every entry in `lessons` is a normalized lesson document.

The current main app still persists its established flattened version-2 lesson-book payload. Stage 2 converts positions into that established runtime shape so existing hydration and save/open behavior remain authoritative.

### Shared lesson position

```json
{
  "version": 1,
  "id": "position-001",
  "title": "Weak back rank",
  "fen": "...",
  "orientation": "white",
  "teacherNote": "",
  "studentPrompt": "",
  "tags": [],
  "sourceLessonId": null,
  "sourceNodeId": null,
  "isDefault": false
}
```

This object is intentionally flat so it can move through CSV/XLSX, the Position Set Builder, Study, Analysis, and Live Board without pretending to contain a complete variation tree.

## Module responsibilities

### `lesson-model.mjs`

Provides:

- format and schema-version constants;
- stable ID normalization and collision handling;
- FEN text normalization and basic structural validation;
- tag and orientation normalization;
- `LessonPosition`, lesson-document, and lesson-book normalization;
- validation helpers;
- creation of a minimal root lesson tree;
- deep cloning without mutating caller-owned values.

The model accepts common camelCase and snake_case field aliases so current CSV/XLSX records remain compatible.

### `lesson-migrations.mjs`

Recognizes and migrates:

- versioned lesson documents;
- versioned lesson books;
- raw legacy lesson-state objects;
- wrappers containing `lessonState` or `lesson`;
- current lesson-book entries shaped as `{ id, lessonState }`;
- browser drafts containing `lessonBook`.

Migrations are pure: the source payload is cloned and is never modified. Newer unsupported schema versions are rejected instead of guessed at.

### `lesson-position-adapter.mjs`

Converts:

- shared position → lesson document;
- shared position array → lesson book;
- lesson root/current node → shared position;
- selected tree node → shared position;
- lesson book → ordered shared positions;
- shared positions → spreadsheet-ready rows.

A node export uses that node's exact FEN and comment. It records `sourceLessonId` and `sourceNodeId` so later UI stages can trace where the position came from.

### Stage 2 runtime modules

- `lesson-position-interoperability-core.mjs` converts flat positions into app-compatible lesson entries and appends them without replacing current lessons.
- `lesson-position-interoperability.mjs` connects the existing builder, tabs, menus, import/export, and browser storage.
- `lesson-position-export-validation.mjs` and `lesson-position-interoperability-export-guard.mjs` preserve the established export validation behavior.

### `lesson-variation-tree.mjs`

Provides:

- preferred-child lookup with first-valid-child fallback;
- first-child insertion as the local main line;
- later-child insertion as a variation;
- non-promoting traversal of recorded branches;
- explicit local promotion through **Make main line**;
- recursive variation-depth calculation for nested branches.

The module mutates only the affected parent node and never removes siblings or descendants.

## File-format policy

| Format | Responsibility |
|---|---|
| `.lesson.json` | Complete, full-fidelity single lesson |
| `.lesson-book.json` | Complete lesson collection |
| `.pgn` | Portable moves, branches, and chess comments |
| `.csv` | Flat position-set interchange |
| `.xlsx` | Editable position sets, with richer workbook support possible later |
| Browser storage | Working drafts and local library state |

CSV/XLSX remain flat. They must not serialize an entire move tree into one spreadsheet cell.

The shared row projection supports the existing columns and optional interoperability metadata:

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

Existing files that omit the optional columns remain valid.

## Compatibility rules

The interoperability system must preserve:

- raw current lesson state;
- current `{ id, lessonState }` lesson-book entries;
- the main app's flattened version-2 draft and lesson-book payload;
- existing CSV field names;
- snake_case spreadsheet aliases;
- comments, branches, annotations, and unknown rich lesson-state fields;
- order of position-set conversion;
- predictable duplicate-ID suffixes;
- existing lessons when new lessons are created from positions;
- Play, Puzzle, engine, tablebase, Live Board, embed, and board-only behavior.

## Integration sequence

Completed:

1. Define the shared `LessonPosition` contract.
2. Add versioned normalization and migrations.
3. Add explicit **Open in Study**, **Open in Analysis**, and **Create New Lesson** actions.
4. Add **Create Lessons from Set** and **Add current position to Position Set**.
5. Add optional CSV/XLSX metadata and validated enhanced export.
6. Preserve existing main lines when adding new moves.
7. Add explicit **Make main line** promotion.
8. Support recursively nested sub-variations and standards-compliant PGN export.

Remaining recommended work:

1. Add durable lesson-level prompt and tag fields as part of Study/Teach integration.
2. Add explicit selected-tree-node export from Analysis.
3. Improve Study into non-destructive Review and Teach modes.
4. Extract file I/O and storage behind separate modules.
5. Add IndexedDB only after the model and UI integrations are stable.

## Testing

Run:

```bash
node --test tests/lesson-data-foundation.test.mjs
node --test tests/lesson-position-interoperability.test.mjs
node --test tests/lesson-variation-tree.test.mjs
```

The combined suites cover:

- CSV-style aliases and optional metadata;
- FEN validation;
- stable ID allocation;
- legacy single-lesson migration;
- current lesson-book migration;
- browser-draft migration;
- idempotent version-2 migration;
- position/lesson round trips;
- selected-node export;
- ordered set/book conversion;
- spreadsheet-row projection;
- app-compatible lesson entry creation;
- existing-lesson preservation;
- duplicate lesson IDs and default activation;
- enhanced export validation;
- first-child main-line selection;
- non-promoting variation traversal;
- explicit local promotion;
- recursive sub-variation behavior;
- PGN comment/variation punctuation and round-trip structure.

## Main-line and recursive variation behavior

The runtime uses `lesson-variation-tree.mjs` for preferred-continuation semantics:

- the first valid child of a position becomes its main line;
- later children remain variations until explicitly promoted;
- navigation does not rewrite `selectedChildId`;
- **Make main line** updates only the selected move's immediate parent;
- the same rules apply recursively inside variations and sub-variations;
- comments remain comment data, while parentheses remain variation notation in PGN.

See `LESSON_VARIATIONS_AND_MAIN_LINES.md` for the user workflow, PGN rules, persistence contract, and validation checklist.
