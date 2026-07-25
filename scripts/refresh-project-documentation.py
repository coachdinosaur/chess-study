from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one anchor, found {count}")
    return text.replace(old, new, 1)


def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text, encoding="utf-8")


# ---------------------------------------------------------------------------
# README.md
# ---------------------------------------------------------------------------
path = ROOT / "README.md"
text = path.read_text(encoding="utf-8")
text = replace_once(
    text,
    "A framework-free, browser-based chess teaching and study application. It combines a position editor, lesson-tree authoring, Stockfish analysis, tablebase support, practice drills, Play vs Stockfish, endgame puzzles, static lesson pages, and an optional AI chess-help panel.",
    "A framework-free, browser-based chess teaching and study application. It combines a position editor, lesson-tree authoring, Stockfish analysis, tablebase support, practice drills, Play vs Stockfish, endgame puzzles, static course lessons with classroom presentation and Teacher Board tools, a synchronized teacher/student Live Board, and an optional AI chess-help panel.",
    "README overview",
)
text = replace_once(
    text,
    "- Use static Pawn, Bishop, and numbered endgame lesson pages in `lessons/`.\n- Ask the optional Dyno Bot panel about the visible position and notation on supported desktop-sized layouts.\n",
    "- Use static Pawn, Advanced Pawn, Bishop, and numbered endgame lesson pages in `lessons/`.\n- Present supported lessons scene by scene with Previous, Reveal, Reset, Next, Exit, keyboard shortcuts, fullscreen support, and a visible click pulse for classroom projection.\n- Open the floating Teacher Board from supported lesson pages to load Page, Start, Empty, or prepared CSV positions; set the side to move; place pieces; annotate; take back; flip; and reset.\n- Create a secure synchronized Live Board room for a teacher and student, including student-move locking, FEN and lesson-position loading, move history, and session messages.\n- Ask the optional Dyno Bot panel about the visible position and notation on supported desktop-sized layouts.\n",
    "README feature bullets",
)
text = replace_once(
    text,
    "## Mobile behavior\n",
    """## Static course lessons and Teacher Board

Static lessons live in `lessons/` and remain printable, self-contained teaching pages. Pawn, Advanced Pawn, and Bishop lesson families share the Pawn-inspired sticky header through `lesson-header.css`, including consistent branding, navigation, theme/print controls, responsive wrapping, and print hiding.

Supported lesson pages add **Present Lesson** through `lesson-presentation.js` and `lesson-presentation.css`. Presentation mode:

- collects meaningful top-level lesson scenes and intentional position cards;
- avoids duplicate scenes and coach-only/source notes;
- provides Previous, Reveal, Reset, Next, and Exit controls;
- supports Left/Right arrows, Space, `R`, and Escape;
- requests browser fullscreen when available;
- shows a short click pulse on the lesson or same-origin embedded board so students can follow the teacher's pointer.

The floating **Teacher Board** is separate from the full SPA Setup tab. Its setup tray provides:

- **Board → Empty**: remove every piece while preserving the selected side to move;
- **Board → Start**: load all 32 starting pieces with White or Black selected to move;
- **Board → Page**: restore the exact lesson-page FEN;
- independent piece-palette color and **Side to move** controls;
- piece placement and erasing, followed by **Done** to return to normal board play;
- prepared-position CSV import, annotation, take back, mark clearing, flip, reset, and checkmate/stalemate status.

`Page` and imported positions resynchronize the side-to-move selector from their FEN. The setup commands are delivered through the embedded-board `postMessage()` protocol, while `teacher-board-illegal-moves.mjs` keeps demonstration history without swallowing those commands.

## Live Board

`live-board.html` is a separate synchronized teaching surface for one teacher and one student.

Teacher workflow:

1. Open `live-board.html` and choose **Create teacher room**.
2. Copy the generated secure student link.
3. Send that link to the student; do not send the teacher URL or teacher access token.
4. Move pieces by click/tap or drag, load a FEN, or import CSV/XLSX prepared positions.
5. Use **Lock student moves** when demonstrating, and use Undo, Reset, Flip board, Theme, or session messages as needed.

The student opens the secure link and receives the synchronized position, move list, lock state, and messages. Supabase supplies room state, realtime updates, and message storage. The message module waits for valid room credentials and the `live-board-session-ready` event instead of assuming credentials already exist at `DOMContentLoaded`.

## Mobile behavior
""",
    "README lesson/live-board sections",
)
text = replace_once(
    text,
    "The floating Teacher Board also evaluates the embedded FEN after moves and position loads. It shows a compact, screen-reader-announced **Checkmate** or **Stalemate** overlay inside the board area, without changing the board size, until the position changes.\n",
    "The floating Teacher Board also evaluates the embedded FEN after moves and position loads. It shows a compact, screen-reader-announced **Checkmate** or **Stalemate** overlay inside the board area, without changing the board size, until the position changes. Setup actions include independent piece color and side-to-move state, Empty/Start/Page loading, prepared-position loading, and normal play after leaving setup.\n",
    "README embed teacher paragraph",
)
text = replace_once(
    text,
    "| `worker/wrangler.jsonc` | Worker variables, production origins, model, and rate-limit binding |\n| `vendor/chess.js` | Chess rules, legal moves, FEN, PGN support |\n",
    "| `worker/wrangler.jsonc` | Worker variables, production origins, model, and rate-limit binding |\n| `live-board.html` | Teacher/student room shell, synchronized board, lesson/FEN controls, messages |\n| `live-board.js` | Live Board position state, legal interaction, move list, lesson/FEN loading |\n| `live-board-realtime.js` | Secure room bootstrap, credentials, Supabase state synchronization |\n| `live-board-messages-v2.js` | Session message lifecycle, realtime subscription, polling fallback |\n| `lessons/lesson-header.css` | Shared Pawn-inspired header across lesson families |\n| `lessons/lesson-presentation.js` / `.css` | Classroom scene mode, reveals, navigation, fullscreen, click pulse |\n| `lessons/pawn-teacher-board.js` / `.css` | Floating lesson Teacher Board UI and parent-side protocol |\n| `lessons/teacher-board-illegal-moves.mjs` | Demonstration moves and Teacher Board history inside the embedded SPA |\n| `vendor/chess.js` | Chess rules, legal moves, FEN, PGN support |\n",
    "README main files",
)
text = replace_once(
    text,
    "node --check worker/ai-help-worker.js\nnode tools/test-puzzle-api.mjs\ngit diff --check\n",
    "node --check worker/ai-help-worker.js\nnode --check lessons/pawn-teacher-board.js\nnode --check lessons/teacher-board-illegal-moves.mjs\nnode --check lessons/lesson-presentation.js\nnode --check live-board-realtime.js\nnode --check live-board-messages-v2.js\nnode tools/test-puzzle-api.mjs\ngit diff --check\n",
    "README validation commands",
)
text = replace_once(
    text,
    "- embedded board mode\n- mobile AI-help hiding\n- lesson JSON and PGN round trips\n",
    "- embedded board mode\n- lesson presentation scene navigation, reveal/reset, and click pulse\n- Teacher Board Empty, Start, Page, side-to-move, piece placement, and normal play after setup\n- Live Board teacher/student synchronization, lock state, prepared positions, and delayed message initialization\n- mobile AI-help hiding\n- lesson JSON and PGN round trips\n",
    "README validation matrix",
)
write("README.md", text)


# ---------------------------------------------------------------------------
# ARCHITECTURE.md
# ---------------------------------------------------------------------------
path = ROOT / "ARCHITECTURE.md"
text = path.read_text(encoding="utf-8")
text = replace_once(
    text,
    "Chess Lesson Study Board is a framework-free chess teaching platform served as static files. The repository combines an interactive single-page application, browser Stockfish, Lichess tablebase requests, static lesson sites, an optional AI-help panel, and optional local Python helpers.",
    "Chess Lesson Study Board is a framework-free chess teaching platform served as static files. The repository combines an interactive single-page application, browser Stockfish, Lichess tablebase requests, static lesson sites with classroom presentation and a floating Teacher Board, a synchronized teacher/student Live Board, an optional AI-help panel, and optional local Python helpers.",
    "architecture overview",
)
text = replace_once(
    text,
    """4. **Static lesson sites**
   - Pawn-level lessons
   - Bishop-level lessons
   - Numbered endgame lessons
   - Shared static-board and teacher-board helpers

5. **Vendored browser dependencies and data**
   - `vendor/chess.js`
   - `vendor/stockfish/`
   - `vendor/xlsx.full.min.js`
   - `assets/openings.tsv`
   - MPChess SVG pieces

6. **Optional local services**
   - `local_server.py`
   - `scanner_server.py`
   - `scanner_predict.py`
""",
    """4. **Static lesson sites**
   - Pawn, Advanced Pawn, and Bishop curricula
   - Numbered endgame lessons
   - Unified lesson header
   - Classroom presentation mode
   - Floating Teacher Board and embedded-board protocol

5. **Live Board collaboration**
   - `live-board.html` and Live Board interaction modules
   - Supabase-backed teacher/student rooms
   - Secure student links, move locking, prepared positions, and session messages

6. **Vendored browser dependencies and data**
   - `vendor/chess.js`
   - `vendor/stockfish/`
   - `vendor/xlsx.full.min.js`
   - `assets/openings.tsv`
   - MPChess SVG pieces

7. **Optional local services**
   - `local_server.py`
   - `scanner_server.py`
   - `scanner_predict.py`
""",
    "architecture subsystem list",
)
text = replace_once(
    text,
    """├── text-normalization.mjs
│
├── ai-help-chat.mjs
""",
    """├── text-normalization.mjs
│
├── live-board.html
├── live-board.css
├── live-board.js
├── live-board-realtime.js
├── live-board-messages-v2.js
├── live-board-room-bootstrap.js
├── live-board-drag.js
├── live-board-click-toggle.js
│
├── ai-help-chat.mjs
""",
    "architecture root map",
)
text = replace_once(
    text,
    """│   ├── pawn-teacher-board.js
│   ├── pawn-teacher-board.css
│   ├── endgame-lesson.js
│   └── endgame-lesson.css
""",
    """│   ├── lesson-header.css
│   ├── lesson-presentation.js
│   ├── lesson-presentation.css
│   ├── pawn-teacher-board.js
│   ├── pawn-teacher-board.css
│   ├── teacher-board-illegal-moves.mjs
│   ├── endgame-lesson.js
│   └── endgame-lesson.css
""",
    "architecture lesson map",
)
text = replace_once(
    text,
    """ai-help-chat.mjs
├── ai-help-config.mjs
├── ai-help-icon.mjs
├── ai-help-chat.css
└── HTTPS POST /chat
    └── Cloudflare Worker (`worker/ai-help-worker.js`)
        └── Gemini Interactions API (`/v1beta/interactions`)
```
""",
    """ai-help-chat.mjs
├── ai-help-config.mjs
├── ai-help-icon.mjs
├── ai-help-chat.css
└── HTTPS POST /chat
    └── Cloudflare Worker (`worker/ai-help-worker.js`)
        └── Gemini Interactions API (`/v1beta/interactions`)

static lesson HTML
├── endgame-lesson.css / advanced-pawn-lesson.css
│   └── lesson-header.css
├── endgame-lesson.js
├── lesson-presentation.js
│   └── lesson-presentation.css
└── pawn-teacher-board.js
    ├── pawn-teacher-board.css
    └── embedded `index.html?embed=1&boardOnly=1`
        └── teacher-board-illegal-moves.mjs

live-board.html
├── live-board.js
├── live-board-click-toggle.js
├── live-board-drag.js
├── live-board-display-fixes.js
├── live-board-realtime.js
├── live-board-room-bootstrap.js
├── live-board-lesson-ux.js
└── live-board-messages-v2.js
    └── Supabase room state, realtime updates, and messages
```
""",
    "architecture module graph",
)
text = replace_once(
    text,
    """| `worker/wrangler.jsonc` | Cloudflare Worker name, entry point, Gemini model, allowed origins, and rate-limit binding |
| `vendor/chess.js` | Legal moves, FEN, PGN, game termination, attack queries |
""",
    """| `worker/wrangler.jsonc` | Cloudflare Worker name, entry point, Gemini model, allowed origins, and rate-limit binding |
| `live-board.html` | Teacher/student room shell, board, FEN/lesson controls, move list, and messages |
| `live-board.js` | Live Board position state, legal moves, imported positions, undo/reset behavior |
| `live-board-realtime.js` | Room creation/joining, credentials, secure links, Supabase state synchronization |
| `live-board-messages-v2.js` | Credential-aware message initialization, realtime subscription, refresh/poll lifecycle |
| `lessons/lesson-header.css` | Shared sticky header contract for Pawn, Advanced Pawn, and Bishop lesson families |
| `lessons/lesson-presentation.js` / `.css` | Scene collection, reveal/reset/navigation, fullscreen, and click-pulse presentation UI |
| `lessons/pawn-teacher-board.js` / `.css` | Parent lesson overlay, setup tray, lesson CSV menu, and embedded-board commands |
| `lessons/teacher-board-illegal-moves.mjs` | Illegal/out-of-turn demonstrations and Teacher Board take-back history in board-only mode |
| `vendor/chess.js` | Legal moves, FEN, PGN, game termination, attack queries |
""",
    "architecture responsibilities",
)
text = replace_once(
    text,
    """| `teacherBoardAction` / `boardOnlyAction` | Enter/exit setup, choose a piece, clear, flip, reset, annotate |

The teacher-board wrapper dynamically imports `vendor/chess.js`, observes changes to the embedded board's `#currentFenCode`, and evaluates each settled FEN. A compact absolutely positioned `aria-live="assertive"` overlay reports checkmate with the winning side or stalemate as a draw without adding a layout row or resizing the board. The overlay clears automatically when take-back, reset, setup, or another position produces a non-terminal FEN.

Same-origin checks protect request/response operations that include request IDs.

---

## 19. Persistence
""",
    """| `teacherBoardAction` / `boardOnlyAction` | Enter/exit setup, choose a piece, load setup presets, set side to move, flip, reset, annotate |

Important Teacher Board actions include:

| Action | Payload / behavior |
|---|---|
| `enterTeacherSetup` / `exitTeacherSetup` | Switch the embedded board between setup placement and normal play |
| `selectTeacherPiece` | Arm a white/black piece or eraser; piece-palette color is independent of side to move |
| `emptyTeacherBoard` | Clear all pieces and preserve the requested `side` |
| `startTeacherBoard` | Load the standard 32-piece position with the requested `side` |
| `setSideToMove` | Rewrite the active-color FEN field without removing placed pieces |
| `lessonTeacherBoard` | Restore the embedded initial/page position |
| `loadFen` | Load Page or prepared-position FEN; request IDs receive `teacherBoardLoadResult` |
| `takeBack` | Restore Teacher Board history across legal and demonstration moves |

The parent wrapper keeps `setupColor` and `setupSideToMove` as separate state. **Page** resolves the lesson's `data-teacher-fen` from `<html>` or `<body>` and falls back to the normal starting position only when no lesson FEN exists. Successful Page or prepared-position loads resynchronize the side-to-move buttons from the loaded FEN.

`teacher-board-illegal-moves.mjs` installs before the main embedded-board message listener. It may reset its own history for setup actions, but it must not call `stopImmediatePropagation()` for Empty, Start, Page/lesson load, or side-to-move commands; otherwise the main board handler never performs the requested action. It still owns Teacher Board take-back/reset interception where required.

The wrapper dynamically imports `vendor/chess.js`, observes changes to the embedded board's `#currentFenCode`, and evaluates each settled FEN. A compact absolutely positioned `aria-live="assertive"` overlay reports checkmate with the winning side or stalemate as a draw without adding a layout row or resizing the board. The overlay clears automatically when take-back, reset, setup, or another position produces a non-terminal FEN.

Same-origin checks protect readiness and request/response operations that include request IDs.

---

## 19. Live Board collaboration

The Live Board is a separate page and state machine from the lesson Teacher Board.

### Room and credential lifecycle

```text
teacher opens live-board.html
  → live-board-realtime.js creates a Supabase room
  → teacher credentials are stored for the browser session
  → URL hash receives room, role, and access data
  → `live-board-session-ready` is dispatched
  → state and message modules initialize for that exact session key
  → teacher copies the generated student-only link
```

Students should open the generated link rather than manually reusing the teacher URL. Teacher and student access tokens are role-specific and must not be logged, documented, or exposed in screenshots.

`live-board-messages-v2.js` cannot assume credentials exist at `DOMContentLoaded`. It:

- reads room/role/access details from the current URL and teacher session storage;
- accepts details from `live-board-session-ready`;
- builds a stable room/role/token session key;
- prevents duplicate initialization;
- retries while credentials or Supabase are not ready;
- reacts to hash/history changes;
- cleans up timers and realtime subscriptions on unload.

### Interaction and synchronization

- `live-board.js` owns the board position, side to move, move list, FEN loading, lesson-position selection, undo, and reset.
- `live-board-click-toggle.js` and `live-board-drag.js` keep tap/click and drag input compatible across desktop and touch devices.
- `live-board-realtime.js` synchronizes room state and the teacher-controlled student lock.
- `live-board-lesson-ux.js` handles CSV/XLSX prepared-position import and loading feedback.
- `live-board-messages-v2.js` synchronizes short messages and Lichess links, using realtime updates with refresh/poll support.
- The teacher may move, load FENs, import prepared positions, undo/reset/flip, and lock student moves. A locked student board remains view-only while continuing to receive synchronized state.

The Live Board must be tested with two pages or browser contexts because a single-page test cannot validate role separation, secure-link state, or teacher/student synchronization.

---

## 20. Persistence
""",
    "architecture teacher/live section",
)
# Renumber sections after inserting Live Board.
for old, new, title in [
    (20, 21, "Opening book"),
    (21, 22, "Static lesson architecture"),
    (22, 23, "Optional local services"),
    (23, 24, "Event bindings"),
    (24, 25, "Validation and testing"),
    (25, 26, "Architectural constraints"),
]:
    text = replace_once(text, f"## {old}. {title}", f"## {new}. {title}", f"architecture renumber {title}")
text = replace_once(
    text,
    """### Pawn and Bishop levels

These are primarily self-contained teaching pages using shared styles/scripts and static diagrams or teacher-board helpers.

### Numbered endgame lessons

The numbered endgame chapters use `endgame-lesson.js` for static FEN diagrams and can embed the SPA for interactive exploration.

Static pages are printable and can use paged-media styling without requiring the SPA runtime for the written lesson content.
""",
    """### Shared lesson header

Pawn and Bishop pages that load `endgame-lesson.css`, and Advanced Pawn pages that load `advanced-pawn-lesson.css`, import `lesson-header.css`. The shared stylesheet standardizes the sticky translucent header, brand icon/label/title, pill-shaped actions, responsive wrapping, focus styles, and print hiding. Header markup remains the shared `.index-header` / `.index-header-inner` / `.index-brand` / `.index-top-actions` contract.

### Classroom presentation

Supported lesson pages load `lesson-presentation.js`, which injects `lesson-presentation.css` and a **Present Lesson** action. Scene collection differs slightly for Bishop's mixed legacy/generated markup, but both paths:

- collect meaningful top-level sections and intentional direct position cards;
- reject hidden, duplicate, source-only, and coach-only material;
- expose Previous, Reveal, Reset, Next, and Exit controls;
- support keyboard navigation and best-effort native fullscreen;
- preserve same-origin embedded boards and show a projected click pulse for pointer-down events on the lesson or embedded board.

The Teacher Board overlay is deliberately excluded from presentation scenes and click-pulse capture.

### Teacher Board

`pawn-teacher-board.js` is shared by supported Pawn, Advanced Pawn, and Bishop lesson pages. It creates the floating overlay and its lesson/setup controls, while the embedded SPA owns board state and legal interaction. `pawn-teacher-board.css` styles the overlay; `teacher-board-illegal-moves.mjs` extends board-only mode with demonstrations and history.

### Numbered endgame lessons

The numbered endgame chapters use `endgame-lesson.js` for static FEN diagrams and can embed the SPA for interactive exploration.

Static pages are printable and can use paged-media styling without requiring the SPA runtime for the written lesson content.
""",
    "architecture static lesson section",
)
text = replace_once(
    text,
    "node --check ai-help-chat.mjs\nnode tools/test-puzzle-api.mjs\ngit diff --check\n",
    "node --check ai-help-chat.mjs\nnode --check lessons/pawn-teacher-board.js\nnode --check lessons/teacher-board-illegal-moves.mjs\nnode --check lessons/lesson-presentation.js\nnode --check live-board-realtime.js\nnode --check live-board-messages-v2.js\nnode tools/test-puzzle-api.mjs\ngit diff --check\n",
    "architecture validation commands",
)
text = replace_once(
    text,
    "- embed and board-only message actions\n- lesson JSON and PGN round trips\n",
    "- embed and board-only message actions\n- lesson presentation scene collection, reveal/reset/navigation, fullscreen fallback, and click pulse\n- Teacher Board Empty/Start/Page, independent side to move, piece placement, take-back, and normal play after setup\n- Live Board teacher/student synchronization, secure student link, lock state, prepared positions, and delayed message initialization\n- lesson JSON and PGN round trips\n",
    "architecture validation matrix",
)
text = replace_once(
    text,
    """- Cache-version strings must be updated when dynamically loaded assets change.
- Worker messages must be guarded against stale sessions.
""",
    """- Cache-version strings must be updated when dynamically loaded assets change, including every lesson page that consumes shared Teacher Board or presentation assets.
- Teacher Board message-listener propagation order is part of the runtime contract; helper listeners must not swallow setup actions owned by the main embedded-board listener.
- Live Board room credentials may arrive after DOM readiness, so credential-dependent modules must initialize from the session-ready lifecycle and remain idempotent.
- Worker messages must be guarded against stale sessions.
""",
    "architecture constraints",
)
write("ARCHITECTURE.md", text)


# ---------------------------------------------------------------------------
# AGENTS.md
# ---------------------------------------------------------------------------
path = ROOT / "AGENTS.md"
text = path.read_text(encoding="utf-8")
text = replace_once(
    text,
    "- **Numbered endgame lessons** (7 chapter pages with embedded SPA iframe)\n- **AI Help** browser panel backed by a separately deployed Cloudflare Worker and Gemini\n",
    "- **Numbered endgame lessons** (7 chapter pages with embedded SPA iframe)\n- **Shared lesson presentation and Teacher Board systems** used across course levels\n- **Live Board** secure teacher/student synchronized rooms backed by Supabase\n- **AI Help** browser panel backed by a separately deployed Cloudflare Worker and Gemini\n",
    "agents purpose",
)
text = replace_once(
    text,
    """| **Shared lesson helpers** | `lessons/pawn-teacher-board.js`, `lessons/pawn-teacher-board.css` |
| **Lesson source manuscripts** | `lesson_source/` (Module 1), `lesson_source2/` (Module 2), `lesson_source3/` (Module 3) |
""",
    """| **Shared lesson header/presentation** | `lessons/lesson-header.css`, `lessons/lesson-presentation.js`, `lessons/lesson-presentation.css` |
| **Shared Teacher Board** | `lessons/pawn-teacher-board.js`, `lessons/pawn-teacher-board.css`, `lessons/teacher-board-illegal-moves.mjs` |
| **Live Board** | `live-board.html`, `live-board.js`, `live-board-realtime.js`, `live-board-room-bootstrap.js`, `live-board-messages-v2.js`, `live-board-drag.js`, `live-board-click-toggle.js` |
| **Lesson source manuscripts** | `lesson_source/` (Module 1), `lesson_source2/` (Module 2), `lesson_source3/` (Module 3) |
""",
    "agents repository areas",
)
text = replace_once(
    text,
    """- When modifying generated or repeated lesson pages, test representative files
  and then audit all matching files.
- When you add, remove, or rename a major subsystem, curriculum module, shared
""",
    """- When modifying generated or repeated lesson pages, test representative files
  and then audit all matching files.
- Shared lesson CSS/JS changes require a repository-wide audit of every cache-versioned
  consumer; stale query versions can leave only some lesson families repaired.
- In embedded/Teacher Board code, treat `window.postMessage()` listener order and
  propagation as a public contract. A helper may observe an action, but must not swallow
  an action owned by the main board handler.
- When you add, remove, or rename a major subsystem, curriculum module, shared
""",
    "agents editing rules",
)
text = replace_once(
    text,
    """- **Teacher Board:** Floating board overlay via `pawn-teacher-board.js`.
  Supports minimize/maximize/annotate/clear modes. Activated by data attributes
  on the `<html>` element.
""",
    """- **Teacher Board:** Floating board overlay via `pawn-teacher-board.js`.
  Supports minimize/maximize, prepared-position CSV import, setup piece placement,
  Board presets (**Empty**, **Start**, **Page**), independent piece-palette color and
  **Side to move**, erasing, Done, annotate, take back, clear marks, flip, reset, and
  checkmate/stalemate status. **Page** restores `data-teacher-fen`; Empty and Start
  preserve/use the selected side. `teacher-board-illegal-moves.mjs` may reset its own
  history for setup actions but must not stop those messages before `app.js` handles them.
""",
    "agents teacher board convention",
)
text = replace_once(
    text,
    """## AI Help Worker Conventions
""",
    """## Shared Lesson Header and Presentation Conventions

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

## AI Help Worker Conventions
""",
    "agents new conventions",
)
text = replace_once(
    text,
    """- [ ] All shared assets load (CSS, JS, SVGs, fonts)
- [ ] AI Help changes preserve secrets, allowed origins, CORS preflight, `/health`, rate limits, and deployment instructions
""",
    """- [ ] All shared assets load (CSS, JS, SVGs, fonts)
- [ ] Shared lesson-header, presentation, and Teacher Board cache versions are current across all lesson consumers
- [ ] Teacher Board Empty, Start, Page, side-to-move, piece placement, and post-setup play work
- [ ] Live Board teacher/student state, lock, copied student link, prepared positions, and messages work in separate contexts
- [ ] AI Help changes preserve secrets, allowed origins, CORS preflight, `/health`, rate limits, and deployment instructions
""",
    "agents verification checklist",
)
write("AGENTS.md", text)


# ---------------------------------------------------------------------------
# USER_GUIDE.md
# ---------------------------------------------------------------------------
path = ROOT / "USER_GUIDE.md"
text = path.read_text(encoding="utf-8")
text = replace_once(
    text,
    "Coach Dinosaur Chess Study is a browser-based chess notebook for building positions, recording lesson lines, studying with Stockfish, adding explanations, and practicing saved variations.",
    "Coach Dinosaur Chess Study is a browser-based chess notebook for building positions, recording lesson lines, studying with Stockfish, adding explanations, practicing saved variations, presenting published course lessons, and running synchronized teacher/student boards.",
    "guide overview",
)
text = replace_once(text, "- review recorded moves in **Line**;", "- review recorded moves in **Study**;", "guide board study")
text = replace_once(
    text,
    """- **Setup**: create or change the starting position.
- **Analysis**: play moves, use Stockfish, practice, and annotate.
- **Line**: review the recorded lesson tree.
- **Play**: play a complete game against Stockfish.
- **Puzzle**: solve endgame puzzles.
""",
    """- **Study**: review the board and recorded notation with the tools collapsed.
- **Setup**: create or change the starting position.
- **Analysis**: play moves, use Stockfish, practice, and annotate.
- **Play**: play a complete game against Stockfish.
- **Puzzle**: solve endgame puzzles.
- **Lessons**: create, edit, import, export, and load prepared FEN position sets.
""",
    "guide tools tabs",
)
text = replace_once(
    text,
    """- Review the lesson tree: **Tools → Line**
- Start engine analysis: click **Analyze** beside the three-dot menu
""",
    """- Review the lesson tree: use the notation panel or **Tools → Study**
- Open the Lesson Position Builder: **Tools → Lessons**
- Browse published course lessons: open the **Lesson index** from the app/site navigation
- Open a floating board while reading a supported lesson: click **Teacher Board** in the lesson header
- Start a synchronized teacher/student room: open **Live Board** (`live-board.html`)
- Start engine analysis: click **Analyze** beside the three-dot menu
""",
    "guide quick navigation",
)
text = text.replace("1. Open a legal position in **Analysis** or **Line**.", "1. Open a legal position in **Analysis** or **Study**.")
text = text.replace("> **Where to go:** **Tools → Analysis** or **Tools → Line**", "> **Where to go:** **Tools → Analysis** or **Tools → Study**")
text = text.replace("> **Where to go:** use **Flip board** in Setup, Analysis, or Line", "> **Where to go:** use **Flip board** in Setup, Analysis, or Study")
text = text.replace("- **Line**: review the recorded move tree.", "- **Study**: review the board and recorded move tree with tools collapsed.")
text = replace_once(
    text,
    """---

# Setup Position Guide
""",
    """---

# Course Lessons, Presentation, and Teacher Board

## Open a Published Course Lesson

> **Where to go:** open the lesson index, then choose Pawn, Advanced Pawn, Bishop, or a numbered endgame lesson

Published lessons are static reading pages rather than saved `.lesson.json` files. Their shared header normally includes:

- the course level and lesson title;
- a link back to the correct level index;
- theme switching;
- Print / Save PDF;
- **Present Lesson** on supported pages;
- **Teacher Board** on supported pages.

On phones, the header actions wrap below the title. In print/PDF output, the lesson header and presentation controls are hidden.

## Present a Lesson to a Class

> **Where to go:** supported lesson header → **Present Lesson**

Presentation mode shows one meaningful lesson section or position at a time.

Controls:

- **Previous** or Left Arrow: return to the previous scene;
- **Reveal** or Space: open the next hidden answer/detail; when nothing remains to reveal, advance;
- **Reset** or `R`: close revealed details and reset the current scene;
- **Next** or Right Arrow: advance;
- **Exit** or Escape: leave presentation mode.

The browser attempts fullscreen when allowed. A short pulse appears where the teacher clicks, including on same-origin embedded chessboards, so students can follow the pointer on a projected display. Clicking the presentation toolbar or Teacher Board controls does not create the pulse.

## Use the Floating Teacher Board

> **Where to go:** supported lesson header → **Teacher Board**

The Teacher Board opens over the lesson without leaving the page. Use **Max** for a larger board, **_** to minimize it, and **x** to close it.

### Load or build a position

1. Click **Setup**.
2. Use **Board** to choose:
   - **Empty**: remove all pieces;
   - **Start**: load the standard starting position;
   - **Page**: restore the exact position assigned to the current lesson page.
3. Choose the palette color (**White** or **Black**) and then a piece.
4. Click squares on the board to place pieces, or select **Erase** to remove them.
5. Use the separate **Side to move** White/Black buttons. Changing this does not remove the pieces you placed.
6. Click **Done** to leave setup and return to normal board movement.

Empty preserves the selected side to move. Start loads all 32 pieces with the selected side to move. Page restores the lesson FEN and updates the side-to-move buttons to match it.

### Other Teacher Board controls

- **Lesson**: import a prepared-position CSV, choose a position, and view its teacher note.
- **Annotate**: keep marks while interacting; right-click marks squares and Alt + right-drag draws arrows.
- **Take Back**: undo the last legal or teacher-demonstration move.
- **Clear marks**: remove annotations.
- **Flip**: change viewing orientation.
- **Reset**: return to the current Teacher Board baseline.

The board reports checkmate or stalemate in a compact status overlay. Teacher-demonstration moves may be intentionally illegal or out of turn; the board marks them instead of pretending they were legal game moves.

# Live Board for Teacher and Student

> **Where to go:** open `live-board.html` from the deployed site

Live Board is different from the floating Teacher Board. It creates a synchronized room that a teacher and student can open on different devices.

## Teacher workflow

1. Click **Create teacher room**.
2. Wait until the room and connection status appear.
3. Click **Copy student link**.
4. Send that generated link to the student. Do not send your teacher URL.
5. Move pieces by click/tap or drag. The student board updates automatically.
6. Use **Lock student moves** while demonstrating. Unlock it when the student should move.

Teacher controls include Undo, Reset, Flip board, Theme, FEN loading/copying, CSV/XLSX prepared-position import, and short session messages or Lichess links.

## Student workflow

1. Open the secure link supplied by the teacher.
2. Wait for the board and connection status.
3. Move pieces when student moves are unlocked.
4. When locked, watch the synchronized demonstration; the board remains view-only.
5. Use the Session messages panel to read or send short messages and links.

A room code by itself is not a substitute for the secure generated link. The access details in that link determine whether the page is the teacher or student role.

---

# Setup Position Guide
""",
    "guide course/live sections",
)
text = replace_once(
    text,
    """## The Board Looks Upside Down

> **Fix:** click **Flip board** in the current tools tab.

## AI Help Gives an Unclear App Instruction
""",
    """## The Board Looks Upside Down

> **Fix:** click **Flip board** in the current tools tab.

## Teacher Board Empty, Start, or Page Appears Unresponsive

1. Reload the lesson once so the current cache-versioned Teacher Board files are used.
2. Open **Teacher Board → Setup → Board** and retry the command.
3. Confirm **Page** is expected to look different from **Start**; Page restores the lesson's assigned FEN.
4. After **Empty**, select a piece and place it on the board before clicking Done.
5. Use the separate **Side to move** control rather than the piece-palette color button.

## Live Board Messages or Synchronization Do Not Start

1. Confirm both people opened the current generated links for the same room.
2. The student should reopen the copied student link rather than typing only the room code.
3. Wait for the connection status before sending a message or moving.
4. Reload once if the room was created while scripts were still loading; the page restores teacher credentials for the browser session.
5. If the board remains disconnected, check internet access and whether Supabase is reachable.

## AI Help Gives an Unclear App Instruction
""",
    "guide troubleshooting",
)
text = replace_once(
    text,
    """- **Analysis**: play moves and use the engine.
- **Study**: review the board and recorded move tree with tools collapsed.
""",
    """- **Analysis**: play moves and use the engine.
- **Study**: review the board and recorded move tree with tools collapsed.
- **Lessons**: manage prepared FEN position sets.
- **Teacher Board**: a floating demonstration board inside a published lesson page.
- **Live Board**: a synchronized teacher/student room on a separate page.
""",
    "guide vocabulary",
)
text = replace_once(
    text,
    """- Use **Analysis** to play and record moves.
- Return to an earlier move and play a different move to create a variation.
""",
    """- Use **Analysis** to play and record moves.
- Use **Study** to review the board and recorded notation with fewer controls visible.
- Use **Lessons** for prepared FEN position sets.
- Use **Present Lesson** and **Teacher Board** while teaching from supported published lessons.
- Use the generated secure student link when starting a Live Board room.
- Return to an earlier move and play a different move to create a variation.
""",
    "guide reminders",
)
# Guard against the old tab name surviving in UI directions.
if "Tools → Line" in text or "**Line**: review" in text or "Analysis** or **Line" in text:
    raise RuntimeError("USER_GUIDE still contains outdated Line-tab directions")
write("USER_GUIDE.md", text)

print("Refreshed README.md, ARCHITECTURE.md, AGENTS.md, and USER_GUIDE.md")
