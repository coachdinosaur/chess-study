# Documentation Audit — Code vs. Documentation

- **Scope:** all Markdown documentation repo-wide (root docs, app docs, tool docs,
  `management/`, `docs/`, `proof/`, both opening-book chapter sets, agent rules),
  plus documentation-adjacent artifact files.
- **Method:** every backticked path, count, symbol (functions, state keys, storage
  keys, URL params, message actions, CSS classes, Supabase tables/RPCs), constant,
  workflow step, and chess FEN/move claim was re-derived from the filesystem and
  source of truth. Chess content was validated with the vendored `vendor/chess.js`
  (FEN parsing + move replay) and each app's own chapter tooling.
- **Confidence tags:** `[verified]` = confirmed against source with file/line
  evidence; `[inferred]` = high confidence but not fully reproducible;
  `[unverifiable]` = cannot be checked from this repo alone.

---

## 1. Executive summary

The documentation is broadly accurate on architecture, feature behavior, and
current dataset constants — the major "what the product does" claims check out.
The drift is concentrated in four places:

1. **Stale file/directory inventories.** Both `AGENTS.md` and `ARCHITECTURE.md`
   list directories that no longer exist (`lesson_source*/`, `mpchess-pieces/`,
   `optimization-review/`), while many real areas (`management/`, `apps/` source
   dirs, `supabase/`, `tests/`, `proof/`, `docs/`, most Live Board modules) are
   absent from the repository map.
2. **Stale duplicate and historical docs.** `docs/lichess-position-training.md`
   is a superseded early-design copy whose regeneration command would produce a
   different shard layout than production; several `proof/` files describe
   intermediate dataset sizes that are historical, not current.
3. **Database/schema tracking gap.** Three Live Board message RPCs are called by
   shipped code but have no migration in `supabase/migrations/`, and
   `management/README.md` lists 13 of the 17 migration files.
4. **Content cross-references.** The Sicilian book ships 8 chapters but its text
   references "Chapter 9" and "Chapter 19" (source-book references that don't
   exist in the shipped set).

No invalid FENs were found in any chapter file (3,801 checked). Spot-checked
nested-variation move lines replay legally in context; the unresolved cases from
mechanical replay are book-format variation restarts, not content errors.

---

## 2. Confirmed current claims

These documentation claims were re-verified and are **accurate**:

| Claim | Evidence |
|---|---|
| 50,000 Lichess positions, 2,000 shards, 25/shard, `shard-0000`–`shard-1999` | `assets/puzzles/lichess-position-training/manifest.json` (`count: 50000`, `shardSize: 25`, `shards: 2000`); physical shards present |
| Product UI name is **Position Study** (internal name Lichess Position Training) | `lichess-position-training.mjs:190,798,802` |
| `MAX_REVIEW_ITEMS = 120`; storage keys `lichess-position-training-learning-v1`, `-cache-v1` | `lichess-position-training-learning.mjs`, `-data.mjs` |
| Tablebase: `tablebase.lichess.org/standard`, ≤7 total pieces, ≤4 per side, castling disqualifies | `app.js` `tablebaseEligibilityForFen` / `isTablebaseEligibleFen` |
| Play watchdog exists; 8 s timeout, single retry, session-id guard | `app.js` `startPlayEngineWatchdog` / `clearPlayEngineWatchdog` |
| 3D Master bot: `UCI_LimitStrength`, `UCI_Elo 2300`, `Skill Level 16`, depth-12 search in a Web Worker | `apps/3d-chess-studio/app/stockfish-master.ts` |
| SPA tabs: Study, Setup, Analysis, Play, Puzzle, Position Sets | `app.js` `TAB_*` constants |
| Position Set columns `order,id,title,fen,orientation,teacher_note,is_default` + aliases | `lesson-position-builder.mjs` |
| Export requires ≥1 position and a resolved default | `lesson-position-builder.mjs:475-492` |
| Play challenge params: `pc` compact + legacy `playChallenge/playFen/playSkill/playSide/playTime/playSpeed` | `play-challenge-integration.mjs` |
| Sidebar/menu labels in USER_GUIDE (`Analyze a Position`, `Explore Lessons`, `Open 3D Board`, `Teacher Management`, `Show tools`, `Focus mode`, `Ctrl+B`/`Alt+B` collapse) | `index.html`, `app.js`, `app-navigation.js:40` |
| 17 SQL migrations; tables and SECURITY DEFINER RPC inventory | `supabase/migrations/` (see §5 for the two gaps) |
| Lesson presentation: `lesson-presentation.js` selects `endgame-presentation.js` vs `lesson-presentation-legacy.js`; click-pulse loaded separately | `lessons/lesson-presentation.js` |
| Lesson counts: Pawn 54, Advanced Pawn 12 modules/119 pages, Bishop 15 modules/19 pages, endgame 7 | filesystem inventory + index catalogs |
| Deployment mounts `/openings/`, `/openings-sicilian/`, `/3d/`; Node 22; `npm ci && npm test` per app; three `node --test` integration suites | `.github/workflows/pages.yml` |
| Six Top Players categories | `assets/top-players.json` (6 keys — but 20 entries each, see F-12) |

---

## 3. Errors — documentation contradicts the repository

### E-1. Documented directories that do not exist `[verified]`

`AGENTS.md` "Repository Areas" lists:

- `lesson_source/` (Module 1), `lesson_source2/` (Module 2), `lesson_source3/` (Module 3)
- `mpchess-pieces/` (font sources)

`ARCHITECTURE.md` §2 tree also lists `mpchess-pieces/` and `optimization-review/`.
**None of these paths exist.** Either remove them from the maps or annotate them
as external/not-committed source material.

### E-2. `docs/lichess-position-training.md` is a stale early-design duplicate `[verified]`

`docs/lichess-position-training.md` predates the production dataset and
contradicts the current doc (`LICHESS_POSITION_TRAINING.md`):

- Line 40: regeneration command uses `--shard-size 2000`, which would produce
  ~25 large shards — incompatible with the deployed 2,000×25 layout and with
  `LICHESS_POSITION_TRAINING.md`'s own "keep every shard at 25 records" rule.
- Line 56: "A tiny bundled seed shard exists only so the UI can be smoke-tested
  before the full dataset is generated" — stale; production ships the full
  50,000-position library.
- It describes "Building the large puzzle set" as future work.

Recommend deleting the file or marking it superseded with a pointer to the root
doc.

### E-3. `ARCHITECTURE.md` claims the Pages workflow runs `chess-clock.test.mjs` `[verified]`

`ARCHITECTURE.md` §28.1 step 4 lists `node --test tests/chess-clock.test.mjs` as
part of `.github/workflows/pages.yml`. The workflow does **not** run it — it runs
only the three integration suites (`opening-book`, `endgame-trainer`,
`3d-chess-studio`). The clock test exists (`tests/chess-clock.test.mjs`) but is
not wired into `pages.yml`.

### E-4. `README.md` workflow row omits the Sicilian build `[verified]`

`README.md` file-table row for `.github/workflows/pages.yml` says the workflow
"builds Catalan Atelier and 3D Studio, mounts their outputs at `/openings/` and
`/3d/`" — omitting `/openings-sicilian/`. This contradicts the README's own
"Deployment pipeline" section (which lists Sicilian) and `pages.yml` (which
builds it).

### E-5. `management/README.md` migration list is incomplete `[verified]`

Lists 13 migrations; the directory has 17. Missing from the list:

- `004_management_v1_advisor_hardening.sql`
- `20260728124500_student_workspace_live_board_sessions.sql`
- `20260811062832_admin_teacher_deletion.sql`
- `20260811074100_paginate_management_audit_events.sql`

Also flag the **duplicate `004_` prefix** — both
`004_management_v1_advisor_hardening.sql` and `004_teacher_managed_students.sql`
exist, which makes "run in order" ambiguous.

### E-6. Live Board message RPCs are not tracked in migrations `[verified]`

`live-board-messages-v2.js` calls three RPCs:

- `get_live_board_messages` (line 173)
- `post_live_board_message` (line 262)
- `clear_live_board_messages` (line 287)

None are defined anywhere under `supabase/migrations/` — so the schema the docs
describe as "versioned across 17 structured SQL migrations"
(`ARCHITECTURE.md` §27.3) is incomplete: either these functions were applied to
the production project manually (untracked schema drift), or the calls fail in
production. Either way the migrations no longer fully describe the DB, and the
docs should note the gap or the SQL should be committed.

### E-7. `endgame-trainer/README.md` omits the delete-account page `[verified]`

`endgame-trainer/delete-account/index.html` exists (canonical
`https://cddigital.top/endgame-trainer/delete-account/`) but is missing from the
README's "Files" list and public-routes list, and from `ARCHITECTURE.md` §23/§28.2.

### E-8. Sicilian chapter cross-references point to chapters that don't ship `[verified]`

The shipped book has 8 chapters, but the text references source-book chapters:

- `chapter-1-sicilian.md:33` — "see Chapters 5 to 9" and "variation A of Chapter
  19 on page 343"
- `chapter-8-sicilian.md:75` — "The main line 9.Qe2 is the topic of Chapter 9"

These are source-book references left in the converted text. They should be
rewritten, annotated as referring to the source book, or removed.

---

## 4. Incomplete / imprecise documentation

### I-1. `ARCHITECTURE.md` repository tree is materially out of date `[verified]`

- **Typo:** `live-board.click-toggle.js` should be `live-board-click-toggle.js`.
- **Live Board:** tree lists 8 entries; the directory has 19 files. Undocumented:
  `live-board-3d.js` (dynamically imported by `live-board.js:715`),
  `live-board-lesson-ux.js`, `live-board-display-fixes.{js,css}`,
  `live-board-channel-normalizer.js`, `live-board-compact-link.js`,
  `live-board-short-access.js`, `live-board-copy-link-fix.js`,
  `live-board-student-tablet.css`, `live-board-messages.js`,
  `live-board-messages-v3.js`.
- **Advanced Pawn:** no `advanced-pawn-*` patterns (module data files, index,
  stylesheet) appear in the lessons subtree.
- **Omitted top-level areas:** `management/`, `apps/`, `supabase/`, `tests/`,
  `.github/`, `docs/`, `proof/`, `prototypes/`, `pawn_m5/`, `assets/Inter/`,
  `assets/Manrope/`, `assets/models/` (used by `live-board-3d.js:345`).
- **Stale entries:** `mpchess-pieces/`, `optimization-review/` (don't exist).
- The note under the tree says the buildable sources are `apps/opening-book/`
  and `apps/3d-chess-studio/` — omitting `apps/opening-book-sicilian/`.

### I-2. `USER_GUIDE.md` uses the old "Lichess Position Training" UI name `[verified]`

The guide's navigation path reads "Tools → Puzzle → Lichess Position Training"
and its section header is "Lichess Position Training". The shipped launcher and
modal are labeled **"Position Study"** / "Open position study"
(`lichess-position-training.mjs:798,802`). Users following the guide won't find
the label the docs name.

### I-3. Two pagination conventions in the Catalan book; only one is audit-clean `[verified]`

- Chapters 1–8 keep **continuous source-book page numbers** (`## Page 7`,
  `## Page 24`, … up to `## Page 112`).
- Chapters 9–16 restart at `## Page 1`.

`apps/opening-book/scripts/chapter-audit.ts:118` hard-errors when the first
boundary isn't `## Page 1`, so `chapters:audit` only runs cleanly on 9–16. The
docs never explain the two conventions or that the strict audit intentionally
excludes the continuous-pagination chapters. (Sicilian README does document
"contiguous `## Page N` boundaries" — the Catalan side needs the same note plus
the exception.)

### I-4. "FIDE Top 10" wording vs. actual data `[verified]`

`ARCHITECTURE.md:32` and the `top-players.mjs:3` code comment say "FIDE Top 10
leaderboards across 6 categories". `assets/top-players.json` contains **20
entries per category**, and only three of the six categories are FIDE world
lists (the others are Philippines/Singapore national lists). Minor imprecision
in both docs and the code comment.

### I-5. Stockfish bundle list is ambiguous about what's vendored `[verified]`

`README.md` lists four preferred bundles; only `stockfish-18-lite-single.{js,wasm}`
is actually vendored under `vendor/stockfish/` (the others are optional drops the
loader probes for). The doc's "prefers the strongest usable installed bundle"
wording is defensible, but it should say explicitly which bundle ships.
Separately, `apps/3d-chess-studio/public/stockfish/` vendors its own
lite-single pair — worth noting they're independent.

### I-6. `chapters:check` is line-ending sensitive `[verified]`

`apps/opening-book` `npm run chapters:check` fails on this Windows checkout with
"Chapter catalog is stale" even though the catalog content is identical after
CRLF normalization: the committed `chapter-catalog.generated.ts` blob is LF,
the local file is CRLF (`core.autocrlf=true`, no `.gitattributes` eol rule), and
the check is a byte comparison. Consequence: `npm test` (and the doc's own
validation instructions) fails on Windows+autocrlf checkouts but passes on the
Linux runner. Document the requirement or normalize line endings in the script.

### I-7. Five workflows are undocumented `[verified]`

Only `pages.yml` is mentioned anywhere in the docs. Undocumented:

- `lesson-interoperability-tests.yml`
- `position-training-smoke.yml`
- `prove-lichess-100.yml`
- `sicilian-opening-book-ci.yml`
- `validate-student-puzzle-assignment-updates.yml`

`README.md` / `ARCHITECTURE.md` should at least enumerate them.

### I-8. Minor table/section gaps in `README.md` `[verified]`

- "Main files" omits all `live-board-*` modules except three, all
  `management/` files, `live-board-3d.js`, and `position-study-single-hint-patch.mjs`
  (it is in the ARCHITECTURE tree, not the README table — inconsistent coverage).
- `endgame-trainer/` row omits `delete-account/` (same gap as E-7).
- `apps/opening-book/` row omits `apps/opening-book-sicilian/` — no row covers it.

---

## 5. Chess-content findings

### C-1. FEN validity: clean `[verified]`

3,801 FENs across all 24 shipped chapter files + `apps/Chapter_1_Rare_Options.md`
were validated with `vendor/chess.js` `validateFen`. **Zero invalid FENs.**

### C-2. Move replay: no confirmed illegal moves; heuristic limits documented `[verified]`

~11,465 SAN tokens were replayed from each chapter's FEN anchors. 710 tokens were
unresolved by the mechanical pass — all traceable to **book-format variation
restarts** (labeled lines like `B2) 8...e5 …` that continue from a parent
variation's position, not the previous line's). Spot-checking these in full
context (e.g., Catalan ch.10 `B2)` line, Sicilian ch.7 `9.Nxe5?`) confirms they
replay legally. The repo's own strict per-chapter audit reports no unresolved
analysis tokens. No content action needed; noted so future audits don't mistake
restart artifacts for errors.

### C-3. `apps/Chapter_1_Rare_Options.md` is a loose draft `[verified]`

A 639-line unconverted source variant of `chapter-1-sicilian.md` (844 lines),
plus `apps/01_Rare_Options.pdf`, sit loose in `apps/` — not part of either app's
`content/chapters`. They're source artifacts; flag, don't delete without
confirmation.

### C-4. `chapters:check` status output `[verified]`

`npm run chapters:status` in `apps/opening-book` reports "16 Markdown chapters…
next expected Chapter 17" — consistent with the shipped 16. The `chapters:check`
staleness failure on this machine is the CRLF issue in I-6, not real drift.

---

## 6. `proof/` file classification

All `proof/*.md` files are **historical snapshots**, not current-claims docs.
The lichess-* files form a consistent expansion chain and are individually
accurate for their dates:

| File | Snapshot | Status |
|---|---|---|
| `lichess-100-{proof,validation}.md` | 100 / 4 shards | historical, consistent |
| `lichess-200-*`, `lichess-300-*`, `lichess-500-*` | 200 / 300 / 500 | historical chain ✓ |
| `lichess-1000-*`, `lichess-2000-*` | 1,000 / 2,000 | historical chain ✓ |
| `lichess-5000-*`, `lichess-10000-*`, `lichess-30000-*` | 5k / 10k / 30k | historical chain ✓ |
| `lichess-50000-*` | 50,000 / 2,000 | **matches current production** |
| `lichess-trainer-visual-redesign.md`, `position-training-desktop-fit.md` | UI redesign checks | historical, consistent |
| `lesson-stage-1-validation.md` | foundation modules | historical, consistent |
| `lesson-stage-2-validation.md` | branch `agent/lesson-interoperability-stage-2`, PR #91 | historical dev metadata — not current state |
| `teacher-puzzle-assignments-summary.md` | "existing **500-position** dataset" | **stale vs current 50,000** — true at write time, misleading today |
| `docs/lichess-100-app-installation.md` | 100-position install record | historical, internally consistent; `proof/lichess-100-puzzles/` data exists ✓ |

Recommendation: add a one-line banner to `proof/README` (or the folder docs)
stating these are dated snapshots, and specifically annotate
`teacher-puzzle-assignments-summary.md`'s dataset size as historical.

---

## 7. Cross-document consistency matrix

| Subject | README | ARCHITECTURE | USER_GUIDE | LICHESS_POSITION_TRAINING | docs/lichess-position-training | Verdict |
|---|---|---|---|---|---|---|
| Puzzle dataset size | 50k ✓ | 50k ✓ | 50k ✓ | 50k ✓ | "seed shard" (stale) | docs/ copy out of sync |
| Shard layout | — | 2000×25 ✓ | — | 2000×25 ✓ | `--shard-size 2000` (wrong) | docs/ copy contradicts |
| Product name | Position Study-ish | Position Study ✓ | "Lichess Position Training" (stale label) | — | Lichess Position Training | USER_GUIDE stale |
| Deploy mounts | partial (missing Sicilian in workflow row) | all three ✓ | all three ✓ | — | — | README row stale |
| CI test list | partial | lists chess-clock.test (not in pages.yml) | — | — | — | ARCHITECTURE overstates |
| Migration count | — | 17 ✓ | — | — | — | mgmt README lists 13 ✗ |

---

## 8. Artifact-only flags (not documentation errors — review for cleanup)

Confirmed present, undocumented, and likely stray:

- `prompt.md`, `prompt1.md`–`prompt4.md`, `prompt6.md` (no `prompt5.md`) — leftover prompt artifacts
- `PLAN.md` — completed feature plan for `state.play.startPosition` (implemented)
- `MINI_SOFT_LAUNCH.md` — 50k launch checklist; content is accurate but is a point-in-time artifact
- `test_lesson.csv` — 2-line scratch CSV
- `♝` — zero-byte file
- `tools/build_curriculum_pdf.py.bak` — only `.bak` file
- `social-preview-backup.png` in `assets/`
- `apps/01_Rare_Options.pdf`, `apps/Chapter_1_Rare_Options.md` — loose source artifacts
- `prototypes/painting-intro.html` — orphan prototype, referenced nowhere
- `live-board-messages.js`, `live-board-messages-v3.js` — superseded message modules; `live-board.html` loads only `-v2`

---

## 9. Recommended documentation edits (priority order)

1. **`docs/lichess-position-training.md`** — mark superseded or delete; it
   actively contradicts the shard layout.
2. **`AGENTS.md` + `ARCHITECTURE.md` trees** — remove `lesson_source*/`,
   `mpchess-pieces/`, `optimization-review/`; fix the `live-board.click-toggle.js`
   typo; add the missing areas (`management/`, `apps/*`, `supabase/`, `tests/`,
   `docs/`, `proof/`, full Live Board module list, `advanced-pawn-*`,
   `endgame-trainer/delete-account/`).
3. **`management/README.md`** — add the 4 missing migrations; resolve the `004_`
   numbering collision note.
4. **Supabase docs** — reconcile the 3 untracked Live Board message RPCs (commit
   a migration or document them as manual DB objects).
5. **`ARCHITECTURE.md` §28.1** — remove `chess-clock.test.mjs` from the pages.yml
   step list (or wire it into the workflow and keep the doc).
6. **`README.md`** — fix the workflow row (add Sicilian); fill the "main files"
   gaps; add the other 5 workflows; note which Stockfish bundle actually ships.
7. **`USER_GUIDE.md`** — rename the "Lichess Position Training" section/path to
   "Position Study" to match the UI.
8. **`endgame-trainer/README.md`** — add `delete-account/` to Files + routes.
9. **Sicilian chapters** — fix or annotate the "Chapter 9"/"Chapter 19"/"Chapters
   5 to 9" source-book references.
10. **`ARCHITECTURE.md` Catalan section** — document the two `## Page N`
    conventions and that `chapters:audit` applies cleanly only to chapters 9–16.
11. **`proof/`** — add a dated-snapshot banner; annotate the 500-position claim
    in `teacher-puzzle-assignments-summary.md`.
12. **`ARCHITECTURE.md`/`top-players.mjs`** — correct "Top 10" to reflect 20
    entries/category and mixed FIDE/national lists.
13. **Validation docs** — note the `chapters:check` CRLF sensitivity (or fix the
    script to normalize line endings).

---

## 10. Red-team self-check notes

Applied per `.agents/rules/red-team-audit.md`:

- **Path-scan false positives** filtered: prose like `Three.js`, `Node.js`, FEN
  fragments, and relative app paths (`public/models/staunton.glb` in the 3D app's
  `THIRD_PARTY_ASSETS.md`) resolve correctly relative to the doc's own directory —
  they are **not** missing.
- **SQL parser correction:** initial scan mis-parsed schema-qualified names; the
  actual object list was re-derived. Real gap stands for the 3 message RPCs.
- **Move-replay false positives:** unresolved SAN tokens are nested-variation
  restarts, verified legal in context — reported as heuristic limits, not errors.
- **Historical vs current:** `proof/` sizes are dated snapshots, not
  contradictions; flagged only where a snapshot could be misread as current
  (500-position assignment doc).
- **Fallback vs installed:** the 4 Stockfish bundles are a preference list; only
  lite-single ships — reported as ambiguity, not a runtime bug.
- **`chapters:check` failure** is CRLF/checkout-related, not content drift —
  reported as a portability/doc note, not a content bug.

## 11. Verification commands used

```powershell
# Filesystem
ls supabase/migrations; ls live-board*; ls proof; ls tests
# Counts / constants
node -e "console.log(require('./assets/puzzles/lichess-position-training/manifest.json'))"
# Chess content
node %TEMP%/audit-chess2.mjs          # FEN validation + SAN replay, vendor/chess.js
npm --prefix apps/opening-book run chapters:check
npm --prefix apps/opening-book run chapters:status
# Symbols
grep -rn "rpc(" live-board*.js
grep -rn "create or replace function" supabase/migrations
# Deployment
cat .github/workflows/pages.yml
```

---

## 12. Post-audit resolutions (2026-09-18)

Status of the findings above as of the documentation refresh:

| Finding | Status |
|---|---|
| E-1 stale directory entries | Resolved — `AGENTS.md`/`ARCHITECTURE.md` trees updated |
| E-2 stale `docs/lichess-position-training.md` | Resolved — superseded banner added pointing to the root doc |
| E-3 `chess-clock.test.mjs` in pages.yml | Resolved — workflow now runs it (§28.1 accurate) |
| E-4 README workflow row | Resolved — row covers all three builds and mounts |
| E-5 migration list | Resolved — `management/README.md` lists all 18 |
| E-6 untracked Live Board RPCs | Resolved — `20260917120000_live_board_v2_and_messages.sql` |
| E-7 delete-account | Resolved — `endgame-trainer/README.md` + docs updated |
| E-8 source-book chapter references | **Open** — still present in shipped chapter text (application input files, not documentation; rewriting them is a content decision) |
| I-1 repository tree | Resolved — tree covers all current areas |
| I-2 "Lichess Position Training" label | Resolved — `USER_GUIDE.md` uses "Position Study" |
| I-3 Catalan pagination conventions | Resolved — both app READMEs + `ARCHITECTURE.md` §21 |
| I-4 Top-players wording | Resolved — 20 entries/category, mixed lists documented |
| I-5 vendored Stockfish bundle | Resolved — README states lite-single is the shipped bundle |
| I-6 CRLF sensitivity | Resolved — documented in `apps/opening-book/README.md` |
| I-7 undocumented workflows | Resolved — README enumerates all workflows |
| I-8 README table gaps | Resolved — `apps/opening-book-sicilian/` row present |
| C-3 loose chapter-1 draft | Resolved — documented as source artifact in the Sicilian README |

Opening-course documentation refreshed in the same pass: Sicilian README now
reflects all 8 shipped chapters (was written for 3), `AUTHORING.md` documents
the `SOURCE ERRATUM`/`NON-NAVIGATION` directives, `ARCHITECTURE.md` §21 covers
both courses and the shared-asset contract, and `USER_GUIDE.md` gained an
Opening Courses section. Chapter Markdown files under
`apps/*/app/content/chapters/` are classified as **application inputs, not
documentation** across the docs.

---

## 13. Second-pass audit (2026-09-18)

A fresh verification sweep across all documentation after the opening-course
refresh. Findings fixed in this pass:

| Finding | Resolution |
|---|---|
| `ARCHITECTURE.md` §27.1 cited non-existent table `teacher_managed_students` | Corrected to `managed_students` (migration filename differs from table name) |
| §27.1 cited non-existent table `student_puzzle_assignments` | Corrected to `puzzle_assignment_students`; added missing `puzzle_assignment_puzzles` |
| §27.1 cited non-existent RPCs `get_student_workspace_by_token_hash` and `verify_assignment_token` | Corrected to `get_student_workspace_by_token`, `get_puzzle_assignment_by_token`, `save_workspace_puzzle_assignment_attempt` |
| §27.1/README/AGENTS described client-side token hashing — inaccurate: student clients send the bearer token to `SECURITY DEFINER` RPCs, which compute the SHA-256 digest **server-side** and compare it to `access_token_hash` | Reworded in all three files; coach-side writes still hash client-side via `sha256Hex`. Invariant that holds: plaintext is never *persisted*, not "never reaches the database" |
| §27.1 cited column `token_hash` | Corrected to `access_token_hash` (also `student_short_token_hash`, `teacher_token_hash`, `student_token_hash` for Live Board) |
| AGENTS.md Teacher-RLS rule cited table `students` | Corrected to `managed_students` — no `students` table exists |
| `about/` (linked "About the App" page) missing from repo map and AGENTS.md areas | Added to both |
| `sw.js` unexplained in repo map | Annotated: it is a service-worker retirement stub (unregisters legacy workers, purges caches); `index.html` also unregisters defensively |

Claims re-verified as accurate (no change needed): 18 migrations and the
`management/README.md` migration list; 50,000 puzzles / 2,000×25 shards;
118 lesson files with zero dead links; top-players 6×20 (3 world + 3
national); `LOCAL_DEPLOYMENT.md` port 8000→8001 fallback; `PLAN.md`
`set-play-start-position` and `PLAY_CHALLENGE_LINKS.md` "Copy student game
link" features; Position Study loading chain
(`index.html` → `focus-analysis-popup.mjs` → `lichess-position-training.mjs`,
launcher injected into `#puzzlePanel`); SPA nav categories
(Workspace/Explore/Tools/Coaching/Info); management plaintext-token
localStorage contract.

Environmental note (not repo drift): `chapters:check` in both opening apps
fails on a CRLF checkout because it compares generated catalog text
literally. `chapters:sync` rewrites the catalog LF; git then reports the
file content-identical to HEAD. This affects Windows working copies only.
