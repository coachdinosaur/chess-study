### Task: Fix Mobile Chessboard Positioning & Setup Usability Across All Tabs

#### Problem Description
In the mobile view (screens ≤ 768px / mobile devices), the chessboard and its associated controls suffer from layout and ordering issues across all tabs (Study, Setup, Analysis, Play, Puzzle, Position Sets):
1. **Board / Controls Disconnect**: The board and tab controls/buttons are separated or pushed out of view. In Setup mode, the piece palette (White/Black pieces, Eraser) and action buttons (Reset, Clear, Flip) are positioned far away from the board, forcing users to scroll up and down repeatedly. Setting up positions on mobile is currently unusable.
2. **Fragile Media Queries**: Mobile styles rely on `@media (max-width: 760px) and (orientation: portrait)`. When `orientation: portrait` fails to match (e.g., landscape, split screen, square aspect ratio, or browser address bar resizing), CSS grid reverts to a standard document flow where the board and controls misalign.
3. **Tab Navigation Misplacement**: Using `display: contents` on `.control-pane` causes `.tab-nav` (Study, Setup, Analysis, Play, Puzzle) to fall back to `order: 4` (the very bottom of the page), placing the tab switcher below the board, engine lines, and active tools.

---

#### Requirements

1. **Unified Mobile Layout Hierarchy (`max-width: 768px`)**:
   - Establish a predictable, vertical visual order for all mobile views regardless of orientation query quirks:
     - **Top**: Compact Sticky Header (`.lesson-header` or app bar) with essential actions.
     - **Second**: Tab navigation bar (`.tab-nav`), allowing easy switching between Study, Setup, Analysis, Play, Puzzle, and Position Sets without scrolling to the bottom.
     - **Third**: Chessboard (`.board-pane` / `.board-stage-card`) sized responsively to fit within the viewport alongside the active controls.
     - **Fourth**: Active tab panel content (`.workspace-tools` / `.lesson-notation`):
       - **Setup Tab**: Piece palette (White/Black switcher, piece icons, eraser) and action buttons (Reset, Clear, Flip) positioned immediately below the board in a compact, single-screen-friendly grid.
       - **Study / Analysis Tab**: Move navigation toolbar (`<< < > >>`) and notation panel below the board.
       - **Play Tab**: Clocks and play controls directly below the board.
       - **Puzzle Tab**: Puzzle instructions and retry/next buttons below the board.

2. **Setup Mode Mobile Optimization**:
   - Make the piece palette and action buttons compact and touch-friendly (`min-height: 40px–44px` touch targets).
   - Ensure the chessboard and piece palette fit together within the mobile viewport without vertical scrolling required to select a piece and place it on a square.
   - Suppress redundant metadata/cards (such as FEN stacks or stage footers) in mobile setup mode so the board and palette remain together.

3. **Responsive Sizing & CSS Adjustments (`styles.css` & `app.js`)**:
   - Apply mobile layout rules to all mobile widths (`@media (max-width: 768px)`), rather than strictly requiring `(orientation: portrait)`.
   - Update `MOBILE_PORTRAIT_VIEWPORT_MEDIA_QUERY` / resize calculation in `app.js` if necessary to ensure `--board-size` accounts for available vertical height and the compact controls.
   - Ensure desktop view (`> 1100px`) and tablet split view remain completely unchanged.

4. **Verification**:
   - Verify on mobile viewports (375px, 390px, 414px, 768px):
     - Selecting pieces in Setup tab and tapping board squares requires no scrolling.
     - Tab navigation (`.tab-nav`) is easily accessible near the top.
     - Study, Play, Analysis, and Puzzle tabs render the board first with their respective tools directly underneath.