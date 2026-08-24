# Task: Fix Stockfish Engine Analysis on Main Page and Opening Books for GitHub Pages Deployment (cddigital.top)

## 1. Problem Description & Root Cause Analysis

On the GitHub Pages deployment at `https://cddigital.top`, Stockfish engine analysis fails on both the **Main Page** (`index.html` + `app.js`) and the **Opening Courses** (`apps/opening-book/` and `apps/opening-book-sicilian/`).

### Root Causes
1. **Opening Courses Subpage Worker URL Resolution (`apps/opening-book/app/stockfish-client.ts`)**:
   - `defaultWorkerUrl()` currently resolves the worker URL using `document.baseURI` via `new URL(ENGINE_FILE, baseUrl)`.
   - When users navigate to chapter subpages (such as `https://cddigital.top/openings/chapters/1/index.html` or direct subroutes), `document.baseURI` contains the nested `/chapters/1/` path.
   - This causes the worker URL to resolve to `https://cddigital.top/openings/chapters/1/stockfish/stockfish-18-lite-single.js`, which returns **404 Not Found** and triggers an uncaught error in the worker client.
   - **Fix**: Use Vite's `import.meta.env.BASE_URL` with trailing slash normalization, matching the reliable pattern established in `apps/3d-chess-studio/app/stockfish-master.ts`.

2. **Main Page Worker Selection & Overhead (`app.js`)**:
   - GitHub Pages does not send COOP/COEP headers (`Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`), so `window.crossOriginIsolated` is always `false`.
   - The full 113 MB WASM binaries (`stockfish-18.wasm` / `stockfish-18-single.wasm`) are `.gitignored` to comply with GitHub’s 100 MB file limit and return **404 Not Found** on `cddigital.top`.
   - Only `stockfish-18-lite-single.js` and `stockfish-18-lite-single.wasm` (~7.29 MB) are tracked and deployed in `/vendor/stockfish/` and `/openings/stockfish/`.
   - In `app.js`, `resolveStockfishBundleCandidate()` iterates sequentially through candidates and issues `HEAD` requests for missing full bundles before falling back to `lite-single`.
   - If `window.crossOriginIsolated` is `false`, multi-threaded candidates should be skipped immediately without issuing `HEAD` requests, and `lite-single` should be selected smoothly with sufficient timeout allowance for downloading the ~7.3 MB WASM file.

---

## 2. Requirements & Code Changes

### Step 1: Fix Opening Book Worker Resolution
Modify both **`apps/opening-book/app/stockfish-client.ts`** and **`apps/opening-book-sicilian/app/stockfish-client.ts`**:

- Locate `resolveWorkerUrl` and `defaultWorkerUrl` (around lines 202–211).
- Replace with base-aware resolution:

```typescript
const ENGINE_FILE = "stockfish/stockfish-18-lite-single.js";

export function resolveWorkerUrl(baseUrl?: string | URL): string {
  if (baseUrl) {
    return new URL(ENGINE_FILE, baseUrl).href;
  }
  const base = (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL) || "/openings/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  return `${normalizedBase}${ENGINE_FILE}`;
}

function defaultWorkerUrl(): string {
  return resolveWorkerUrl();
}
```

- In **`apps/opening-book-sicilian/app/SicilianApp.tsx`** (line ~111):
  - Ensure the client initialization resolves `/openings/stockfish/stockfish-18-lite-single.js` cleanly in both local dev (via Vite proxy) and production deployment.

---

### Step 2: Streamline Main Page Bundle Candidate Selection (`app.js`)
In **`app.js`**:

- Locate `resolveStockfishBundleCandidate()` (around lines 5498–5530).
- Update the candidate evaluation logic:
  1. Immediately skip candidates requiring cross-origin isolation if `!window.crossOriginIsolated` (preventing redundant 404 HEAD network requests).
  2. Ensure `lite-single` (`./vendor/stockfish/stockfish-18-lite-single.js` / `.wasm`) is selected cleanly without throwing false bundle errors.
  3. Ensure `ENGINE_READY_TIMEOUT_MS` (around line 52) provides sufficient allowance (e.g. 20000ms) for downloading and initializing the 7.29 MB WASM on slower connections while displaying accurate loading progress in `state.engine.summary`.

---

## 3. Local Verification Commands

Run the full integration and unit test suite across all sub-apps before pushing to git:

```powershell
# 1. Test Opening Books
npm --prefix apps/opening-book test
npm --prefix apps/opening-book-sicilian test

# 2. Test 3D Chess Studio
npm --prefix apps/3d-chess-studio test

# 3. Run Site-Wide Integration Tests
node --test tests/opening-book-integration.test.mjs
node --test tests/endgame-trainer-integration.test.mjs
node --test tests/3d-chess-studio-integration.test.mjs
```

---

## 4. Deliverables Checklist
- [ ] No 404 errors when initializing Stockfish from `/openings/` or any `/openings/chapters/*/` route.
- [ ] No 404 errors when clicking **Analyze** on the main SPA page (`index.html`).
- [ ] All automated tests pass cleanly (`node --test tests/*.test.mjs`).
- [ ] Review `git diff` to ensure no unintended changes outside the engine resolution scope.
