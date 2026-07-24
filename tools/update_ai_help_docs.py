from pathlib import Path


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, found {count}: {old[:80]!r}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")


def replace_section(path: Path, start: str, end: str, replacement: str) -> None:
    text = path.read_text(encoding="utf-8")
    start_index = text.find(start)
    if start_index < 0:
        raise SystemExit(f"{path}: start marker not found: {start!r}")
    end_index = text.find(end, start_index + len(start))
    if end_index < 0:
        raise SystemExit(f"{path}: end marker not found: {end!r}")
    path.write_text(
        text[:start_index] + replacement.rstrip() + "\n\n" + text[end_index:],
        encoding="utf-8",
    )


architecture = Path("ARCHITECTURE.md")
replace_once(
    architecture,
    """3. **AI chess-help UI**
   - `ai-help-chat.mjs`
   - `ai-help-chat.css`
   - `ai-help-config.mjs`
   - `ai-help-icon.mjs`

4. **Static lesson sites**""",
    """3. **AI chess-help subsystem**
   - Browser UI: `ai-help-chat.mjs`, `ai-help-chat.css`, `ai-help-config.mjs`, `ai-help-icon.mjs`
   - Cloudflare Worker proxy: `worker/ai-help-worker.js`, `worker/wrangler.jsonc`
   - Gemini Interactions API, reached only from the Worker

4. **Static lesson sites**""",
)
replace_once(
    architecture,
    """├── ai-help-icon.mjs
│
├── assets/""",
    """├── ai-help-icon.mjs
│
├── worker/
│   ├── ai-help-worker.js
│   └── wrangler.jsonc
│
├── assets/""",
)
replace_once(
    architecture,
    """ai-help-chat.mjs
├── ai-help-config.mjs
├── ai-help-icon.mjs
└── ai-help-chat.css
```""",
    """ai-help-chat.mjs
├── ai-help-config.mjs
├── ai-help-icon.mjs
├── ai-help-chat.css
└── HTTPS POST /chat
    └── Cloudflare Worker (`worker/ai-help-worker.js`)
        └── Gemini Interactions API (`/v1beta/interactions`)
```""",
)
replace_once(
    architecture,
    """| `ai-help-chat.mjs` | Dyno Bot launcher and panel, context collection, endpoint storage, transcript state, request lifecycle |
| `ai-help-chat.css` | Floating panel layout, themes, responsive hiding, Focus-mode placement |""",
    """| `ai-help-chat.mjs` | Dyno Bot launcher and panel, bounded context collection, endpoint storage, transcript state, timeout and request lifecycle |
| `ai-help-chat.css` | Floating panel layout, themes, responsive hiding, Focus-mode placement |
| `ai-help-config.mjs` | Public Worker base URL used by the browser client; never contains the Gemini API key |
| `worker/ai-help-worker.js` | CORS enforcement, request validation, rate limiting, Gemini proxying, response normalization, `/chat` and `/health` routes |
| `worker/wrangler.jsonc` | Cloudflare Worker name, entry point, Gemini model, allowed origins, and rate-limit binding |""",
)
replace_section(
    architecture,
    "## 16. AI chess-help subsystem",
    "## 17. Focus mode",
    """## 16. AI chess-help subsystem

AI Help is a two-tier feature. The static browser application collects bounded visible chess context, while a Cloudflare Worker protects the Gemini API key and performs the provider request.

```text
Browser at https://cddigital.top
  → ai-help-chat.mjs
  → HTTPS POST <Worker URL>/chat
  → Cloudflare Worker
  → Gemini Interactions API
  → normalized JSON { text }
  → Dyno Bot transcript
```

The browser must never call Gemini directly and must never contain `GEMINI_API_KEY`.

### 16.1 Browser client

`ai-help-chat.mjs` mounts the floating Dyno Bot interface unless the page is embedded or board-only. It collects a bounded snapshot containing the lesson title, FENs, opening, active tab, position label, side to move, and notation excerpt.

Notation and conversation history are capped before transmission. Requests abort after 45 seconds. The endpoint comes from `AI_HELP_ENDPOINT` in `ai-help-config.mjs`, with browser-local `chess-study-ai-endpoint-v1` retained as a testing fallback. A base Worker URL is normalized to end in `/chat`.

### 16.2 Cloudflare Worker

`worker/ai-help-worker.js` exposes:

| Route | Method | Purpose |
|---|---|---|
| `/chat` | `POST` | Validate, rate-limit, call Gemini, and return `{ text }` |
| `/health` | `GET` | Confirm Worker reachability from an allowed origin |
| `/chat` and `/health` | `OPTIONS` | CORS preflight handling |

The Worker:

- reads `GEMINI_API_KEY` from a Cloudflare secret;
- reads `GEMINI_MODEL` and `ALLOWED_ORIGINS` from Wrangler variables;
- accepts only exact allowed origins;
- limits request bytes, message count, message length, and context size;
- uses `https://generativelanguage.googleapis.com/v1beta/interactions`;
- removes an accidental `models/` prefix from a configured model ID;
- maps provider and network failures to bounded JSON errors.

Current production origins are `https://cddigital.top` and `https://www.cddigital.top`. The legacy GitHub Pages origin and localhost origins remain allowed.

### 16.3 CORS behavior

A missing production origin causes preflight to fail before browser JavaScript can read the Worker's JSON response. Firefox commonly reports this as:

```text
NetworkError when attempting to fetch resource.
```

When the production domain changes, update both `ALLOWED_ORIGINS` in `worker/wrangler.jsonc` and the fallback origin list in `worker/ai-help-worker.js`, then redeploy.

### 16.4 Deployment boundary

The static site and Worker are separate deployments. Merging Worker code into GitHub does not update the running Cloudflare Worker.

```powershell
cd worker
npx wrangler login
npx wrangler deploy
```

The existing secret normally remains attached. Set it only when missing:

```powershell
npx wrangler secret put GEMINI_API_KEY
npx wrangler deploy
```

Never commit the API key to configuration, JavaScript, Markdown, logs, or screenshots.

### 16.5 Validation and troubleshooting

After Worker changes:

1. Run `node --check worker/ai-help-worker.js`.
2. Verify the current production origins in `worker/wrangler.jsonc`.
3. Deploy the Worker.
4. Test `/health` from an allowed origin.
5. Send a short live AI Help request from `https://cddigital.top`.
6. Inspect browser Network details and Cloudflare logs on failure.

Failure categories:

- **Browser network/CORS error:** Worker URL, DNS/TLS, deployment, or origin allowlist.
- **HTTP 429/503:** rate limit, missing secret, provider outage, or temporary capacity.
- **HTTP 502:** provider rejected the model/request or returned unusable output.
- **Timeout:** the browser aborted after 45 seconds.

### 16.6 Visibility and placement

- Hidden in `embed` and `boardOnly` modes.
- Hidden at phone widths and short coarse-pointer landscape sizes.
- Normally fixed to the lower-right.
- In Focus mode, `.page-shell.is-focus-mode ~ .ai-help-chat` moves it to the lower-left.

The lower-right remains available for `.focus-mode-brand`.""",
)

agents = Path("AGENTS.md")
replace_once(
    agents,
    """- **Pawn Level** beginner curriculum (5 modules, 50+ static HTML pages)
- **Bishop Level** post-beginner curriculum (Module 1 published, 5 lesson pages)
- **Numbered endgame lessons** (7 chapter pages with embedded SPA iframe)""",
    """- **Pawn Level** beginner curriculum (5 modules)
- **Advanced Pawn Level** curriculum (12 modules)
- **Bishop Level** post-beginner/intermediate curriculum (15 modules, 19 lesson pages)
- **Numbered endgame lessons** (7 chapter pages with embedded SPA iframe)
- **AI Help** browser panel backed by a separately deployed Cloudflare Worker and Gemini""",
)
replace_once(
    agents,
    """When in doubt about module structure, read `lessons/pawn-index.html` or
  `lessons/bishop-index.html`.""",
    """When in doubt about module structure, read `lessons/pawn-index.html`,
  `lessons/advanced-pawn-index.html`, or `lessons/bishop-index.html`.""",
)
replace_once(
    agents,
    """| **Pawn lessons** | `lessons/pawn-*.html`, `lessons/pawn-m{2,3,4,5}-*.html`, `lessons/pawn-index.html` |
| **Bishop lessons** | `lessons/bishop-*.html`, `lessons/bishop_m1/` |""",
    """| **Pawn lessons** | `lessons/pawn-*.html`, `lessons/pawn-m{2,3,4,5}-*.html`, `lessons/pawn-index.html` |
| **Advanced Pawn lessons** | `lessons/advanced-pawn-m*-lesson-*.html`, `lessons/advanced-pawn-module-*-data.js`, `lessons/advanced-pawn-index.html` |
| **Bishop lessons** | `lessons/bishop-m*-lesson-*.html`, `lessons/bishop-index.html`, `lessons/bishop_m1/` |
| **AI Help client** | `ai-help-chat.mjs`, `ai-help-chat.css`, `ai-help-config.mjs`, `ai-help-icon.mjs` |
| **AI Help Worker** | `worker/ai-help-worker.js`, `worker/wrangler.jsonc` |""",
)
replace_section(
    agents,
    "## Bishop Lesson Conventions",
    "## Lesson Position Builder Conventions",
    """## Bishop Lesson Conventions

- **Table of contents:** `lessons/bishop-index.html`
- **Naming pattern:** `bishop-m{module}-lesson-{NN}-*.html`
- **Current curriculum:** 15 modules and 19 lesson pages. Verify totals in the index rather than trusting prose documentation.
- **Module 1 assets:** `lessons/bishop_m1/` with `intermediate-m1-` filenames.
- **Shared systems:** Bishop pages may use `endgame-lesson.css`, `endgame-lesson.js`, `lesson-header.css`, `lesson-presentation.js`, `lesson-presentation.css`, and Teacher Board helpers.
- **Legacy markup:** Module 1 differs from later generated and FEN-laboratory pages. Audit every Bishop page when changing shared headers or presentation collection.
- **Presentation mode:** collect intentional top-level sections and direct positions only. Nested candidate cards, student tasks, error notes, and transfer rules must not become standalone scenes.
- **Navigation:** preserve Back-to-Bishop-Index and sequential links; validate them after editing.

## AI Help Worker Conventions

- The browser sends bounded context to the Cloudflare Worker `/chat` route. It must never call Gemini directly.
- Keep `GEMINI_API_KEY` only as a Cloudflare Worker secret. Never commit or expose it.
- Production runs at `https://cddigital.top`; keep it and `https://www.cddigital.top` in `ALLOWED_ORIGINS` unless deployment changes.
- Preserve the legacy GitHub Pages and localhost origins used for fallback and local testing.
- Exact-origin CORS failures appear as generic browser fetch/network errors. Check the allowlist before blaming Gemini.
- Gemini uses `/v1beta/interactions` and a plain model ID; normalize away an optional `models/` prefix.
- Preserve request/history/context bounds, rate limiting, `/health`, and sanitized public errors.
- GitHub merges do not deploy Cloudflare. Worker changes require `cd worker` and `npx wrangler deploy`.
- Validate with `node --check worker/ai-help-worker.js`, check Wrangler variables, deploy, test `/health`, and send a live production request.

## Lesson Position Builder Conventions""",
)
replace_once(
    agents,
    """- [ ] All shared assets load (CSS, JS, SVGs, fonts)
- [ ] No accidental changes were made outside the requested scope""",
    """- [ ] All shared assets load (CSS, JS, SVGs, fonts)
- [ ] AI Help changes preserve secrets, allowed origins, CORS preflight, `/health`, rate limits, and deployment instructions
- [ ] No accidental changes were made outside the requested scope""",
)

readme = Path("README.md")
replace_section(
    readme,
    "## AI chess help",
    "## Lessons and files",
    """## AI chess help

`ai-help-chat.mjs` mounts an optional floating Dyno Bot panel outside embedded and board-only mode. It can explain the visible board, plans, candidate moves, tactical ideas, lesson concepts, and supported app controls.

The browser sends bounded context to a Cloudflare Worker:

- lesson title
- current FEN and setup FEN
- opening name/ECO display
- active tab
- side-to-move and position labels
- visible notation, capped before transmission

```text
Browser → Cloudflare Worker /chat → Gemini Interactions API
```

The Gemini API key is never stored in the static site. It exists only as the Worker's `GEMINI_API_KEY` secret. The browser endpoint comes from `ai-help-config.mjs` or the local testing key `chess-study-ai-endpoint-v1`.

The Worker lives in `worker/ai-help-worker.js`, with deployment configuration in `worker/wrangler.jsonc`. It provides `POST /chat`, `GET /health`, exact-origin CORS validation, request limits, rate limiting, and normalized public errors.

Current production origins are `https://cddigital.top` and `https://www.cddigital.top`. The old GitHub Pages origin and localhost origins remain available for fallback and development.

### Deploy or update the Worker

Merging Worker code does not update the running Cloudflare deployment.

```powershell
cd worker
npx wrangler login
npx wrangler deploy
```

The existing secret normally remains attached. Set it only if Cloudflare reports it missing:

```powershell
npx wrangler secret put GEMINI_API_KEY
npx wrangler deploy
```

Never commit the API key.

### AI Help troubleshooting

- **`NetworkError when attempting to fetch resource`**: check Worker deployment, endpoint URL, DNS/TLS, and `ALLOWED_ORIGINS`; this usually occurs before Gemini is contacted.
- **Busy or temporary error**: wait briefly; rate limiting or Gemini capacity may be involved.
- **Configuration error**: confirm the Worker secret and configured model.
- **Timeout**: the client aborts after 45 seconds.

The floating control is hidden on phone-width layouts and short coarse-pointer landscape screens so it does not cover board controls. In Focus mode it moves to the lower-left. It is disabled in `?embed=1` and board-only modes.""",
)
replace_once(
    readme,
    """| `ai-help-icon.mjs` | Embedded launcher icon data |
| `vendor/chess.js` | Chess rules, legal moves, FEN, PGN support |""",
    """| `ai-help-icon.mjs` | Embedded launcher icon data |
| `worker/ai-help-worker.js` | Cloudflare Worker CORS, validation, rate limiting, Gemini proxy, `/chat`, and `/health` |
| `worker/wrangler.jsonc` | Worker variables, production origins, model, and rate-limit binding |
| `vendor/chess.js` | Chess rules, legal moves, FEN, PGN support |""",
)
replace_once(
    readme,
    """node --check app.js
node --check ai-help-chat.mjs
node tools/test-puzzle-api.mjs""",
    """node --check app.js
node --check ai-help-chat.mjs
node --check worker/ai-help-worker.js
node tools/test-puzzle-api.mjs""",
)

guide = Path("USER_GUIDE.md")
replace_once(guide, "https://coachdinosaur.github.io/chess-study/", "https://cddigital.top/")
replace_section(
    guide,
    "## Explain the Current Position with AI Help",
    "## Add a Lesson Note",
    """## Explain the Current Position with AI Help

> **Where to go:** **AI Help** button at the bottom-right on supported desktop-sized layouts

The AI receives a bounded snapshot of the visible lesson title, current FEN, setup FEN, active tab, side to move, opening information, position label, and notation excerpt. It does not receive saved lesson files, unrelated browser data, or the Gemini API key.

Useful questions include:

- “Explain this position.”
- “What should White look for?”
- “What changed after the last move?”
- “Give me a small hint.”
- “How do I import a PGN?”

AI can make mistakes. Verify concrete tactics with Stockfish and app instructions against this guide.

### When the AI Help button is hidden

The floating control is intentionally hidden on phone-width screens, short landscape touch screens, and embedded or board-only pages. Use a wider desktop or tablet layout for AI Help.

### AI Help connection errors

If the panel cannot reach the AI service:

1. Confirm the main app is open at `https://cddigital.top/`.
2. Confirm the internet connection works.
3. Reload once and try a short message such as “hello.”
4. `NetworkError when attempting to fetch resource` usually means the Worker URL, deployment, DNS/TLS, or production-domain CORS allowlist failed before Gemini was contacted.
5. For busy or too-many-request messages, wait about a minute and retry.
6. For repeated timeouts, try later and report the exact message.

Do not paste an API key into the chat or browser console. The Gemini key belongs only in the private Cloudflare Worker secret. The Worker must be redeployed separately after its code or allowed-origin configuration changes.

---

## Add a Lesson Note""",
)

for path in (architecture, agents, readme, guide):
    text = path.read_text(encoding="utf-8")
    if not text.endswith("\n"):
        path.write_text(text + "\n", encoding="utf-8")
