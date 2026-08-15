# AGENTS.md — Guidance for Coding Agents

## Repository Purpose

This repository is a **chess teaching platform** at https://github.com/coachdinosaur/chess-study.
It contains:

- An **Interactive Study SPA** (vanilla JS, no framework) for analysis, Play-vs-Engine,
  puzzles, lesson management, and position building
- **Pawn Level** beginner curriculum (5 modules)
- **Advanced Pawn Level** curriculum (12 modules)
- **Bishop Level** post-beginner/intermediate curriculum (15 modules, 19 lesson pages)
- **Numbered endgame lessons** (7 chapter pages with embedded SPA iframe)
- **Shared lesson presentation and Teacher Board systems** used across course levels
- **Live Board** secure teacher/student synchronized rooms backed by Supabase
- **3D Chess Position Studio** interactive Three.js board and Web Worker Stockfish bots
- **Piece asset pipeline** (MetaPost/LuaLaTeX font → 12 SVG pieces)
- **Local servers** for HTTP hosting (`local_server.py`) and board scanning (`scanner_server.py`)

## Source-of-Truth Rules

- Always inspect actual files before editing. Do not trust outdated session summaries
  or stale documentation.
- The current source code and filenames are the ground truth.
- When in doubt about module structure, read `lessons/pawn-index.html`,
  `lessons/advanced-pawn-index.html`, or `lessons/bishop-index.html`.

## Repository Areas

| Area | Key files |
|---|---|
| **SPA** | `index.html`, `app.js`, `styles.css`, `pgn.mjs`, `puzzle-api.mjs`, `lesson-position-builder.mjs`, `text-normalization.mjs` |
| **Pawn lessons** | `lessons/pawn-*.html`, `lessons/pawn-m{2,3,4,5}-*.html`, `lessons/pawn-index.html` |
| **Advanced Pawn lessons** | `lessons/advanced-pawn-m*-lesson-*.html`, `lessons/advanced-pawn-module-*-data.js`, `lessons/advanced-pawn-index.html` |
| **Bishop lessons** | `lessons/bishop-m*-lesson-*.html`, `lessons/bishop-index.html`, `lessons/bishop_m1/` |
| **Numbered endgame lessons** | `lessons/01-*.html` … `lessons/07-*.html`, `lessons/endgame-lesson.js`, `lessons/endgame-lesson.css` |
| **Shared lesson header/presentation** | `lessons/lesson-header.css`, `lessons/lesson-presentation.js`, `lessons/lesson-presentation.css` |
| **Shared Teacher Board** | `lessons/pawn-teacher-board.js`, `lessons/pawn-teacher-board.css`, `lessons/teacher-board-illegal-moves.mjs` |
| **Live Board** | `live-board.html`, `live-board.js`, `live-board-realtime.js`, `live-board-room-bootstrap.js`, `live-board-messages-v2.js`, `live-board-drag.js`, `live-board-click-toggle.js` |
| **3D Chess Position Studio** | `apps/3d-chess-studio/`, `tests/3d-chess-studio-integration.test.mjs` |
| **Opening books** | `apps/opening-book/`, `apps/opening-book-sicilian/` |
| **Endgame Trainer site** | `endgame-trainer/index.html`, `endgame-trainer/privacy-policy/index.html` |
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
- Shared lesson CSS/JS changes require a repository-wide audit of every cache-versioned
  consumer; stale query versions can leave only some lesson families repaired.
- In embedded/Teacher Board code, treat `window.postMessage()` listener order and
  propagation as a public contract. A helper may observe an action, but must not swallow
  an action owned by the main board handler.
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
- **Arrows:** For inline SVG instructional arrows, preserve established marker
  geometry (`userSpaceOnUse` 14px filled-triangle marker, `stroke-width="5"`,
  endpoint shortening, layering after pieces). Do not introduce arrows into a
  lesson that does not already have them.
- **Stars:** For existing star overlays, preserve absolute
  `translate(-50%,-50%)` centering and color classes
  (`.neutral`/`.red`/`.blue`/`.yellow`). Do not add stars where none exist.
- **Annotations (SPA):** Green default, Ctrl→orange, Shift→blue.
- Distinguish static instructional SVG diagrams (inline in lesson HTML) from
  JS-rendered FEN boards (`data-fen` attribute + `endgame-lesson.js`).
- Arrows, highlights, stars, overlays, and labels must remain aligned with
  the board squares.
- Do not introduce arrows, stars, FEN boards, or quizzes into a lesson that
  does not already require them.

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
  Supports minimize/maximize, prepared-position CSV import, setup piece placement,
  Board presets (**Empty**, **Start**, **Page**), independent piece-palette color and
  **Side to move**, erasing, Done, annotate, take back, clear marks, flip, reset, and
  checkmate/stalemate status. **Page** restores `data-teacher-fen`; Empty and Start
  preserve/use the selected side. `teacher-board-illegal-moves.mjs` may reset its own
  history for setup actions but must not stop those messages before `app.js` handles them.
- **Navigation:** Each lesson has Back to Pawn Index link and sequential
  Back/Next lesson links; the last lesson of Module 3 links to Module 4 (the
  series spans modules). Validate all navigation links after editing.
- **Image assets:** Module 1 images inline (base64 or SVG), Module 2–4 images
  stored inside `lessons/`, Module 5 images in the repository root `pawn_m5/`
  directory (referenced from lesson HTML as `../pawn_m5/...`).
- **Page shell:** Sticky topbar (brand, back link, theme toggle, print),
  hero section, two-column layout (TOC aside + main), collapsible Q&A sections.

## Bishop Lesson Conventions

- **Table of contents:** `lessons/bishop-index.html`
- **Naming pattern:** `bishop-m{module}-lesson-{NN}-*.html`
- **Current curriculum:** 15 modules and 19 lesson pages. Verify totals in the index rather than trusting prose documentation.
- **Module 1 assets:** `lessons/bishop_m1/` with `intermediate-m1-` filenames.
- **Shared systems:** Bishop pages may use `endgame-lesson.css`, `endgame-lesson.js`, `lesson-header.css`, `lesson-presentation.js`, `lesson-presentation.css`, and Teacher Board helpers.
- **Legacy markup:** Module 1 differs from later generated and FEN-laboratory pages. Audit every Bishop page when changing shared headers or presentation collection.
- **Presentation mode:** collect intentional top-level sections and direct positions only. Nested candidate cards, student tasks, error notes, and transfer rules must not become standalone scenes.
- **Navigation:** preserve Back-to-Bishop-Index and sequential links; validate them after editing.

## Shared Lesson Header and Presentation Conventions

- `lessons/lesson-header.css` is the shared Pawn-inspired header contract for Pawn,
  Advanced Pawn, and Bishop pages. Preserve `.index-header`, `.index-header-inner`,
  `.index-brand`, `.index-brand-icon`, `.index-brand-label`, `.index-brand-title`, and
  `.index-top-actions` markup when adding or repairing lessons.
- `endgame-lesson.css` and `advanced-pawn-lesson.css` import the shared header. Avoid
  reintroducing level-specific header rules that override it without a deliberate reason.
- Mobile headers wrap into two action columns and then one column; verify long titles,
  action wrapping, reading-progress placement, and print hiding.
- `lesson-presentation.js` collects intentional top-level scenes and direct position cards.
  Do not let nested candidate cards, student tasks, source notes, coach-only notes, or
  duplicate content become standalone scenes.
- Presentation controls are Previous, Reveal, Reset, Next, and Exit, with keyboard and
  fullscreen behavior. The click pulse must ignore presentation controls and Teacher Board
  controls, while still working over same-origin board iframes.
- When changing presentation or Teacher Board assets, update every consumer's cache version
  and run a stale-reference audit.

## Live Board Conventions

- `live-board.html` is separate from both the SPA and the floating lesson Teacher Board.
- Teachers create a room and share only the generated student link. Never expose, log, or
  document the teacher access token.
- Preserve role-specific credentials in the URL/session lifecycle and the
  `live-board-session-ready` event dispatched after teacher room creation.
- `live-board-messages-v2.js` must initialize only once per room/role/token session key,
  retry when credentials or Supabase are not ready, respond to hash/history changes, and
  clean up timers/subscriptions on unload.
- Preserve teacher move locking: a locked student board remains synchronized but view-only.
- Prepared lessons support CSV/XLSX; FEN loading and orientation/side-to-move must remain
  synchronized for both roles.
- Test Live Board changes with separate teacher and student pages or browser contexts.
  Verify initial board state, click/tap and drag input, undo/reset, lock/unlock, copied link,
  prepared-position loading, and messages created immediately after a room is created.

## Supabase and Management Security Conventions

- **Never expose `service_role` key**: Public browser code and workflows must use only the public/anon Supabase key.
- **Zero-login student token protection**: Student workspace and assignment links use high-entropy bearer tokens. Plaintext tokens must never be written to Supabase; the client computes and sends SHA-256 hashes (`token_hash`).
- **RPC security**: Student operations must use `SECURITY DEFINER` Postgres functions with explicit validation, ensuring students can only access work explicitly provisioned by their coach.
- **Teacher RLS**: Teacher-facing tables (`students`, `coaching_sessions`, `puzzle_assignments`) must remain guarded by Row Level Security linked to `auth.uid()`.

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

## 3D Chess Position Studio Conventions

- **Source location:** `apps/3d-chess-studio/` (React 19, Three.js, `chess.js`).
- **Mount path:** Compiled with `VITE_BASE_PATH=/3d/` and published at `/3d/`.
- **Operating modes:** Setup Mode (palette piece placement, presets, FEN import/export, 180° flip) and Play Mode (Local 2P & Bot Play).
- **Bot Engine architecture:** Move searches run in background Web Workers (`bot.worker.ts` and `stockfish-master.ts`) without stalling the main UI thread. Tiers: Casual (~1000 Elo), Club (~1600 Elo), and Master (~2300 Elo Stockfish 18 Lite WASM).
- **Piece geometry:** Staunton 3D models (`staunton.glb`) for K, Q, R, N, P; procedural geometry for Bishop with an open diagonal mitre.
- **Validation:** Run `$env:VITE_BASE_PATH='/3d/'; npm --prefix apps/3d-chess-studio test` and `node --test tests/3d-chess-studio-integration.test.mjs`.

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
- [ ] Shared lesson-header, presentation, and Teacher Board cache versions are current across all lesson consumers
- [ ] Teacher Board Empty, Start, Page, side-to-move, piece placement, and post-setup play work
- [ ] Live Board teacher/student state, lock, copied student link, prepared positions, and messages work in separate contexts
- [ ] 3D Chess Studio builds cleanly and passes static and integration tests (`npm --prefix apps/3d-chess-studio test` and `node --test tests/3d-chess-studio-integration.test.mjs`)
- [ ] No accidental changes were made outside the requested scope

## Git Rules

- Do not commit or push unless the user explicitly asks.
- Do not rewrite unrelated files.
- Before finishing, show `git diff` for the changed files and describe what was
  changed.
- If verification reveals issues, fix them before presenting the result.
