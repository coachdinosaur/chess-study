# Lesson Data Architecture

This document defines the shared lesson-data foundation used to make the main app's rich lesson workflow and flat CSV/XLSX position-set workflow interoperable.

## Scope of Stage 1

Stage 1 adds reusable data modules and tests. It does **not** yet rename tabs, change visible workflows, migrate browser storage, or wire conversion buttons into Study, Analysis, or the Position Set Builder.

The foundation consists of:

- `lesson-model.mjs`
- `lesson-migrations.mjs`
- `lesson-position-adapter.mjs`
- `tests/lesson-data-foundation.test.mjs`

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

`lessonState` remains the full-fidelity app state. Stage 1 deliberately treats it as an owned rich object rather than flattening it.

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

Stage 1 must preserve:

- raw current lesson state;
- current `{ id, lessonState }` lesson-book entries;
- existing CSV field names;
- snake_case spreadsheet aliases;
- comments, branches, annotations, and unknown rich lesson-state fields;
- order of position-set conversion;
- predictable duplicate-ID suffixes.

## Integration sequence

Later stages should consume these modules rather than reproduce conversion logic in `app.js`.

Recommended order:

1. Wire the Position Set Builder to `LessonPosition`.
2. Add explicit **Open in Study**, **Open in Analysis**, and **Create Lesson** actions.
3. Add **Add current position/tree node to Position Set**.
4. Improve Study into non-destructive Review and Teach modes.
5. Extract file I/O and storage behind separate modules.
6. Add IndexedDB only after the model and UI integrations are stable.

## Testing

Run:

```bash
node --test tests/lesson-data-foundation.test.mjs
```

The suite covers:

- CSV-style aliases;
- FEN validation;
- stable ID allocation;
- legacy single-lesson migration;
- current lesson-book migration;
- browser-draft migration;
- idempotent version-2 migration;
- position/lesson round trips;
- selected-node export;
- ordered set/book conversion;
- spreadsheet-row projection.
