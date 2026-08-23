# Task: Fix Mobile Landscape, Tablet Landscape, and Tablet Portrait Responsive Views

## Problem Description & Objectives
1. **Mobile Landscape View (Phones/small screens in landscape orientation, viewport height <= 500px)**:
   - **Top Header Obstruction**: The `.mobile-app-bar` takes up critical vertical height on phones in landscape mode (~360px-420px total height), pushing the chessboard down and leaving little visible space.
   - **Broken Stacking**: The board and controls stack vertically in one column. Because vertical space is very limited, the user must constantly scroll up and down.
   - **Requirement**: The top header should disappear (hide branding, title, and actions), leaving **only the burger menu button** (`#mobileMenuToggle`) as a compact floating/corner control. The layout must switch to a **2-column split** with the **chess board on the left side** and the **workspace content/controls on the right side** (with independent scroll).

2. **Tablet Landscape View (769px - 1100px in landscape, e.g. iPads & Android tablets in landscape)**:
   - **Desktop Parity**: The layout should be similar to the desktop experience with a clean 2-column split (board stage on left/center, scrollable control pane on right).
   - **Viewport Locking**: Lock the page shell (`height: var(--app-height); overflow: hidden;`) to prevent awkward double-scrollbars, allowing only the right `.control-pane-scroll` to scroll internally.

3. **Tablet Portrait View (601px - 1024px in portrait, e.g. iPads & tablets in portrait)**:
   - **Proportional Layout**: Maintain the single-column vertical flow (Sticky header -> Tab navigation bar -> Chess board -> Engine lines / PV -> Workspace tools / Notation) with proportional board scaling that does not push key controls off the initial screen fold.
   - **Clean Top App Bar**: Display the `.mobile-app-bar` with the burger menu, branding, active screen badge, and theme toggle.

---

## Detailed Requirements & Implementation Plan

### 1. Mobile Landscape View (`@media (max-width: 930px) and (orientation: landscape)`, `@media (max-height: 500px) and (orientation: landscape)`)

#### A. Header / Top Bar (`site-home.css` & `styles.css`)
- Hide the top app bar container background, title (`.mobile-brand`), and actions (`.mobile-app-bar-actions`).
- Keep **only the hamburger button** (`#mobileMenuToggle`):
  - Position it as a compact floating action button (e.g. `position: fixed; top: 0.4rem; left: 0.4rem; z-index: 100;`) or minimal non-intrusive icon.
  - Retain full functionality to open the navigation drawer (`#mobileNavDrawer`).

#### B. 2-Column Split Layout (`.workspace` on Mobile Landscape)
- Change `.workspace` from single-column (`grid-template-columns: 1fr`) to a **2-column layout**:
  - `grid-template-columns: minmax(0, auto) minmax(0, 1fr);` (or `grid-template-columns: calc(var(--board-size) + var(--eval-rail-width, 1rem)) 1fr;`).
  - Left column: `.board-pane` (Chess board, captured pieces, eval rail, puzzle banner).
  - Right column: `.control-pane` (Header/Title, Tab navigation, Tool panels, Notation).
- **Override `display: contents`**:
  - In portrait mobile, `.control-pane` uses `display: contents !important`.
  - In mobile landscape, `.control-pane` and `.control-pane-scroll` must be restored to `display: flex !important; flex-direction: column; overflow-y: auto; height: 100%;` so controls stay cleanly contained on the right side and scroll independently.

#### C. Board Dynamic Sizing (`app.js` `syncBoardSize()`)
- Update `syncBoardSize()` logic to detect mobile landscape:
  - Vertical budget for the board: `heightBudget = viewportHeight - pagePadding - capturedRowsHeight`.
  - Horizontal budget: constrained to the left column width (`containerWidth` or `availableWidth * 0.55`).
  - `--board-size` will be `Math.min(widthBudget, heightBudget)` so the board fits 100% within the viewport height without causing page-level vertical scrolling.

---

### 2. Tablet Landscape View (`@media (min-width: 769px) and (max-width: 1100px) and (orientation: landscape)`)

- **2-Column Workspace**:
  - Left column: Sticky board stage card (`.board-stage-card`) sized dynamically to fit the viewport height.
  - Right column: Independent scrollable control pane (`.control-pane-scroll`) with stable scrollbar gutter.
- **Window Locking**:
  - Set `html, body { overflow: hidden; }` and `.page-shell { height: var(--app-height); overflow: hidden; }`.
- **Navigation & Brand**:
  - Either show persistent compact sidebar (`.app-sidebar`) or streamlined top bar with full tab navigation and tools visible without cramped wrapping.

---

### 3. Tablet Portrait View (`@media (min-width: 601px) and (max-width: 1024px) and (orientation: portrait)`)

- **Single-Column Vertical Hierarchy**:
  1. Top: `.mobile-app-bar` (Burger menu, Brand title, Active screen badge, Theme toggle).
  2. Subheader: `.lesson-header` (Lesson title input, Lesson picker dropdown, Analyze/Practice buttons).
  3. Navigation: `.tab-nav` (Study, Setup, Analysis, Play, Puzzle tabs in a horizontal row).
  4. Center: `.board-pane` (Chessboard sized responsively to tablet width with max-height constraint).
  5. Analysis: `.mobile-engine-lines-slot` (Stockfish live evaluation lines & best move PV).
  6. Bottom: `.workspace-tools` and `.lesson-notation` (Setup piece palette, moves list, analysis tools).
- **Touch Targets**:
  - Ensure all interactive elements (tab chips, notation toolbar buttons, piece palette tools) have at least 44px touch targets.

---

## Technical Files to Modify

| File | Responsibilities |
|---|---|
| `styles.css` | 2-column workspace layout for mobile landscape, board stage height rules, notation/tool styling for tablet & landscape mobile. |
| `site-home.css` | Header minimization in mobile landscape (hide brand/actions, float burger menu), `.control-pane` display rules (flex in landscape vs contents in portrait), modal dialog adjustments. |
| `app.js` | Update `syncBoardSize()` and viewport query helper (`mobilePortraitLayoutActive()` / `mobileLandscapeLayoutActive()`) to budget board size correctly in landscape vs portrait. |

---

## Verification & Test Plan

1. **Mobile Landscape (Test at 667x375, 844x390, 896x414, 915x412)**:
   - [ ] Top bar disappears; only the burger menu button remains in the top corner.
   - [ ] Board sits on the left side, occupying full available height without clipping.
   - [ ] Lesson header, tabs, notation, and tool panels sit on the right side.
   - [ ] Right column scrolls smoothly and independently without causing the entire page to scroll.
   - [ ] Setup mode piece palette and actions fit cleanly on the right side.

2. **Tablet Landscape (Test at 1024x768, 1180x820, 1366x1024)**:
   - [ ] Layout matches desktop split view (board left, controls right).
   - [ ] No double scrollbar on the main window.
   - [ ] Board scales cleanly to available height.

3. **Tablet Portrait (Test at 768x1024, 810x1080, 820x1180)**:
   - [ ] Full top app bar is visible with burger menu and brand.
   - [ ] Clean vertical stacking: Top bar -> Title/Picker -> Tabs -> Board -> Engine lines -> Tools/Notation.
   - [ ] Board is centered and sized proportionally.
