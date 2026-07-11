# AGENTS.md — Guidance for Coding Agents

## Repository Purpose

This repository is a **chess teaching platform** at https://github.com/coachdinosaur/chess-study.
It contains:

- An **Interactive Study SPA** (vanilla JS, no framework) for analysis, Play-vs-Engine,
  puzzles, lesson management, and position building
- **Pawn Level** beginner curriculum (5 modules, 50+ static HTML pages)
- **Bishop Level** post-beginner curriculum (Module 1 published, 5 lesson pages)
- **Numbered endgame lessons** (7 chapter pages with embedded SPA iframe)
- **Piece asset pipeline** (MetaPost/LuaLaTeX font → 12 SVG pieces)
- **Local servers** for HTTP hosting (`local_server.py`) and board scanning (`scanner_server.py`)

## Source-of-Truth Rules

- Always inspect actual files before editing. Do not trust outdated session summaries
  or stale documentation.
- The current source code and filenames are the ground truth.
- When in doubt about module structure, read `lessons/pawn-index.html` or
  `lessons/bishop-index.html`.

## Repository Areas

| Area | Key files |
|---|---|
| **SPA** | `index.html`, `app.js`, `styles.css`, `pgn.mjs`, `puzzle-api.mjs`, `lesson-position-builder.mjs`, `text-normalization.mjs` |
| **Pawn lessons** | `lessons/pawn-*.html`, `lessons/pawn-m{2,3,4,5}-*.html`, `lessons/pawn-index.html` |
| **Bishop lessons** | `lessons/bishop-*.html`, `lessons/bishop_m1/` |
| **Numbered endgame lessons** | `lessons/01-*.html` … `lessons/07-*.html`, `lessons/endgame-lesson.js`, `lessons/endgame-lesson.css` |
| **Shared lesson helpers** | `lessons/pawn-teacher-board.js`, `lessons/pawn-teacher-board.css` |
| **Lesson source manuscripts** | `lesson_source/` (Module 1), `lesson_source2/` (Module 2), `lesson_source3/` (Module 3) |
| **Piece assets** | `assets/pieces/mpchess/` (12 SVGs), `mpchess-pieces/` (font sources) |
| **Local servers** | `local_server.py`, `scanner_server.py`, `scanner_predict.py`, `start-local.ps1` |
| **Vendored dependencies** | `vendor/chess.js`, `vendor/stockfish/`, `vendor/xlsx.full.min.js` |
| **Tools** | `tools/test-puzzle-api.mjs`, `tools/fetch_openings.js`, `tools/generate_openings.mjs`, `tools/endgame_kb/`, `tools/wtharvey/` |
| **Endgame KB** | `Endgame/` — PDFs, CSVs, PGN files |
| **Module 5 images** | `pawn_m5/` — Pawn Module 5 lesson image assets |

## Editing Rules

### Architecture
- Preserve existing architecture unless the task explicitly requests a refactor.
- Do not replace working SVG/FEN boards with unrelated image systems.
- Keep board orientation correct (White perspective, rank 8 top, rank 1 bottom,
  a8 and h1 light).
- Preserve chess legality and FEN accuracy.
- Preserve responsive layouts (mobile/desktop).
- Keep Q&A sections collapsible (`<details class="quiz">`) where that is the
  established lesson convention.
- Preserve Back-to-Index navigation and sequential lesson navigation.
- Do not break theme persistence (`localStorage` keys vary per context).
- Avoid altering sibling lesson modules unnecessarily.
- Avoid broad search-and-replace without validating every affected file.
- When modifying generated or repeated lesson pages, test representative files
  and then audit all matching files.
- When you add, remove, or rename a major subsystem, curriculum module, shared
  lesson helper, or top-level file, update `ARCHITECTURE.md` in the same change.
- Do not change `ARCHITECTURE.md` or `AGENTS.md` unless the task explicitly
  requires it.

### Board and Diagram Conventions

- **Orientation:** White at bottom, rank 8 top, rank 1 bottom, a-file left,
  h-file right.
- **Square color:** a8 and h1 are light (#eee3cb). Square parity:
  `isLight = (fileNum + rankNum) % 2 === 1`.
- **Piece assets:** Always use `assets/pieces/mpchess/` SVGs (wK.svg, bQ.svg, etc.).
  Relative path from `lessons/` is `../assets/pieces/mpchess/`.
- **SVG pieces:** Centered by `image` x/y based on square size. Do not stretch
  boards or pieces.
- **Arrows:** `userSpaceOnUse` 14px filled-triangle marker, `stroke-width="5"`,
  endpoints shortened so heads are never hidden under pieces, arrows drawn after
  pieces.
- **Stars:** Absolute `translate(-50%,-50%)` centering; use
  `.neutral`/`.red`/`.blue`/`.yellow` classes.
- **Annotations (SPA):** Green default, Ctrl→orange, Shift→blue.
- Distinguish static instructional SVG diagrams (inline in lesson HTML) from
  JS-rendered FEN boards (`data-fen` attribute + `endgame-lesson.js`).
- Arrows, highlights, stars, overlays, and labels must remain aligned with
  the board squares.

## Pawn Lesson Conventions

- **Table of contents:** `lessons/pawn-index.html`
- **Naming pattern:** `pawn-{NN}-*.html` (Module 1, 11 lessons),
  `pawn-m2-lesson-{NN}-*.html` (Module 2, 13 lessons + 13b Protecting Points),
  `pawn-m3-lesson-{NN}-*.html` (Module 3, 12 lessons),
  `pawn-m4-lesson-{NN}-*.html` (Module 4, 10 lessons),
  `pawn-m5-lesson-{NN}-*.html` (Module 5, 8 lessons)
- **Shared CSS/JS:** `endgame-lesson.css`, `endgame-lesson.js`,
  `pawn-teacher-board.css`, `pawn-teacher-board.js`
- **Teacher Board:** Floating board overlay via `pawn-teacher-board.js`.
  Supports minimize/maximize/annotate/clear modes. Activated by data attributes
  on the `<html>` element.
- **Navigation:** Each lesson has Back to Pawn Index link and sequential
  Back/Next lesson links (wraparound).
- **Image assets:** Module 1 images inline (base64 or SVG), Module 2–5 images
  in `lessons/` assets or `pawn_m5/` root directory.
- **Page shell:** Sticky topbar (brand, back link, theme toggle, print),
  hero section, two-column layout (TOC aside + main), collapsible Q&A sections.

## Bishop Lesson Conventions

- **Table of contents:** `lessons/bishop-index.html`
- **Naming pattern:** `bishop-m1-lesson-{NN}-*.html`
- **Published Module 1 (**5 lessons):**
  1. `bishop-m1-lesson-01-building-a-strong-foundation.html`
  2. `bishop-m1-lesson-02-components-of-a-chess-foundation.html`
  3. `bishop-m1-lesson-03-opening-principles-and-the-goal-of-chess.html`
  4. `bishop-m1-lesson-04-the-point-system.html`
  5. `bishop-m1-lesson-05-the-five-core-thinking-principles.html`
- **Image assets:** `lessons/bishop_m1/` — PNG files with `intermediate-m1-` prefix
- **Styling:** Same shared helpers as Pawn Level (`endgame-lesson.css`/`.js`)
- **Navigation:** Back to Bishop Index, sequential lesson links

## Lesson Position Builder Conventions

- **File:** `lesson-position-builder.mjs`
- **Purpose:** Create, edit, import, export, and manage named FEN position sets
- **State key:** `state.lessonPositionBuilder` (`{ active: bool }`)
- **Persistence prefix:** `lesson-position-builder-v1:*` in localStorage
- **Canonical import/export columns (CSV/XLSX):**
  `order`, `id`, `title`, `fen`, `orientation`, `teacher_note`, `is_default`
- **Field aliases:** Flexible matching: `name`/`position_title` → `title`,
  `note`/`instruction` → `teacher_note`, `default`/`initial` → `is_default`, etc.
- **Legacy columns** (ignored with warning): `difficulty`, `level_tier`,
  `goal_type`, `lesson_text`, `mode`, `endgame_position`, `status`
- **Supported file types:** `.csv` (with quoted-field support), `.xlsx`/`.xls`
  (via `vendor/xlsx.full.min.js`)
- **Export:** CSV or XLSX. Requires ≥1 position and exactly one default.
- **Orientation:** Stored per-position. FEN loaded via `loadFenToBoard(fen)`,
  orientation applied separately via `setBoardOrientation()`. No `chess.js`
  import in the builder module.
- **Navigation responsibility:** The `set-tab` handler owns navigation — switching
  to Lessons opens the builder, switching away closes it. The builder's
  `setLessonPositionBuilderActive` does NOT change tabs.
- **Opening Lessons** restores builder state but does NOT load the board.

## Verification Checklist

Before completing a task, verify:

- [ ] No broken internal links (Back to Index, sequential lesson links, navigation)
- [ ] No missing images (check `<img src>` paths against actual file locations)
- [ ] No invalid paths for shared assets (CSS, JS, SVGs)
- [ ] JavaScript console shows no errors
- [ ] HTML is valid (no unclosed tags, no malformed attributes)
- [ ] FEN strings in boards are valid positions
- [ ] Board square parity is correct (a8 and h1 light)
- [ ] Mobile rendering is usable (test at 375px and 768px widths)
- [ ] Desktop rendering is correct
- [ ] Theme switching works (light/dark)
- [ ] Back/Next navigation works (when modifying lesson series)
- [ ] All shared assets load (CSS, JS, SVGs, fonts)
- [ ] No accidental changes were made outside the requested scope

## Git Rules

- Do not commit or push unless the user explicitly asks.
- Do not rewrite unrelated files.
- Before finishing, show `git diff` for the changed files and describe what was
  changed.
- If verification reveals issues, fix them before presenting the result.
