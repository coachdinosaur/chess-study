### Task: Fix Mobile Chessboard Positioning & Setup Usability Across All Tabs

#### Problem Description & Root Cause
In mobile portrait view (screens ≤ 768px), the chessboard is pushed to the very bottom below the entire control pane, intro card, and notation.
**Root Cause**: In `site-home.css` (lines 872–884), the high-specificity selector `.workspace-view .control-pane` sets `overflow: visible` without `display: contents`. Because `site-home.css` loads after `styles.css`, it overrides `display: contents;` and keeps `.control-pane` as a block at `order: 0`, while `.board-pane` has `order: 2`. This places the entire control pane (Intro + Header + Tabs + Notation + Setup Tools) above the board, dumping the chessboard at the very bottom!

---

#### Requirements

1. **Fix `display: contents` Override in `site-home.css` & `styles.css`**:
   - In `site-home.css` under `@media (max-width: 768px)` (and `@media (max-width: 1100px)` where applicable):
     ```css
     @media (max-width: 768px) {
       .workspace-intro {
         display: none !important;
       }
       .workspace-view .control-pane,
       .workspace-view .control-pane-scroll,
       .control-pane,
       .control-pane-scroll {
         display: contents !important;
       }
     }
     ```
   - Hide `.workspace-intro` on mobile so it does not waste valuable screen space above the board.

2. **Unified Mobile Layout Hierarchy (`max-width: 768px` in `styles.css`)**:
   - **Order 0**: `.lesson-header` (sticky compact header with title, picker, actions).
   - **Order 1**: `.tab-nav` (Study, Setup, Analysis, Play, Puzzle tabs in a single horizontally scrollable row directly accessible at top).
   - **Order 2**: `.board-pane` (Chessboard, centered and sized responsively).
   - **Order 3**: `.mobile-engine-lines-slot`.
   - **Order 4**: `.workspace-tools` (Active tab tools: in Setup mode, piece palette and Reset/Clear/Flip buttons right below the board).
   - **Order 5**: `.lesson-notation` and `.lesson-position-builder-panel`.

3. **Setup Mode Mobile Optimization**:
   - In Setup mode, the piece palette (White/Black switcher, piece tool buttons, eraser) and action buttons (Reset, Clear, Flip) must be compact (`grid-template-columns: repeat(7, minmax(0, 1fr))`) and sit immediately below the board so setting up pieces requires zero scrolling.

4. **Verification**:
   - Open on mobile viewport (375px–420px):
     - The top has the header and tab chips.
     - The chessboard is in the middle / upper viewport (NOT at the bottom).
     - Active tab controls (e.g. piece palette in Setup) are right underneath the board.