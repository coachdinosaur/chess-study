# AI Help Chat Setup

The Chess Study app now includes an optional floating AI chess tutor. The frontend is static and remains compatible with GitHub Pages. A small Cloudflare Worker keeps the Gemini API key off the public website.

## Files

- `ai-help-chat.mjs` — chat UI, board-context collection, conversation handling
- `ai-help-chat.css` — responsive light/dark styling
- `ai-help-config.mjs` — public Worker endpoint configuration
- `worker/ai-help-worker.js` — secure Gemini proxy
- `worker/wrangler.jsonc` — Worker configuration and request rate limiting

The chat does not appear inside embedded or board-only iframes.

## 1. Create a Gemini API key

Create a Gemini API key in Google AI Studio. Do not paste the key into any file in this repository. The key belongs only in the Cloudflare Worker secret.

The Worker defaults to `gemini-3.5-flash`. You can change `GEMINI_MODEL` in `worker/wrangler.jsonc` later.

## 2. Deploy the Cloudflare Worker

Install Node.js, then from the repository root run:

```powershell
cd worker
npx wrangler login
npx wrangler secret put GEMINI_API_KEY
npx wrangler deploy
```

Paste the Gemini API key only when Wrangler asks for the secret value.

Wrangler prints a URL similar to:

```text
https://chess-study-ai.YOUR-SUBDOMAIN.workers.dev
```

### Allowed sites

`ALLOWED_ORIGINS` currently permits:

- `https://coachdinosaur.github.io`
- `http://127.0.0.1:8000`
- `http://localhost:8000`

Add another exact origin to `worker/wrangler.jsonc` only when the app is hosted elsewhere. Do not use `*` for this API.

### Rate limit

The included Worker binding allows 20 chat requests per minute for each approximate client key. This is abuse protection, not billing-grade accounting. Change the `namespace_id` if `1001` is already used by another rate limiter in the same Cloudflare account.

## 3. Connect the GitHub Pages app

Open `ai-help-config.mjs` and set the Worker base URL:

```js
export const AI_HELP_ENDPOINT = 'https://chess-study-ai.YOUR-SUBDOMAIN.workers.dev';
```

Do not add `/chat`; the frontend adds it automatically.

For temporary testing, open the chat and paste the Worker URL into its setup field. That stores the URL only in the current browser. The config file is required for all users to receive the deployed endpoint.

## 4. Test locally

From the repository root:

```powershell
python -m http.server 8000
```

Open:

```text
http://127.0.0.1:8000/
```

Test these cases:

1. Open **AI Help** and ask “Explain this position.”
2. Play or navigate to another move, then ask what changed.
3. Confirm the AI receives the current FEN and visible notation.
4. Press Enter to send and Shift+Enter for a new line.
5. Press Escape to close the panel.
6. Test light theme, dark theme, and a narrow mobile viewport.
7. Open an `?embed=1` or `?boardOnly=1` URL and confirm the chat is hidden.
8. Temporarily use a disallowed origin and confirm the Worker returns HTTP 403.

## Security notes

- Never put `GEMINI_API_KEY` in `ai-help-config.mjs`, `ai-help-chat.mjs`, HTML, or any committed file.
- Browser origin checks reduce casual cross-site use but are not authentication. Keep the rate limiter enabled and monitor Worker and Gemini usage.
- Conversation messages and visible board context are sent to Gemini when the user presses Send. The frontend does not persist chat history.
- The UI renders model output as plain text, not HTML, to avoid script injection.
