# Task: Fix Mobile Chessboard Positioning, Tab Navigation, and Top Players Modal

## 1. Mobile View Chessboard Positioning & Setup Mode (styles.css)
- On screens <= 768px (regardless of portrait/landscape orientation quirks), ensure the chessboard and its primary controls stay in a clean, usable vertical flow:
  1. Top: Sticky compact header (.lesson-header).
  2. Second: Tab navigation bar (.tab-nav) so switching tabs does not require scrolling to the bottom.
  3. Third: Chessboard (.board-pane), sized responsively.
  4. Fourth: Active tab panel content (.workspace-tools / .lesson-notation):
     - In Setup Tab: Position the piece palette (White/Black switcher, piece tool buttons, eraser) and board actions (Reset, Clear, Flip) directly underneath the board in a compact layout so users do not have to scroll between the board and piece palette.
     - In Study / Analysis Tab: Move toolbar (<< < > >>) and notation below the board.
     - In Play / Puzzle Tab: Clocks, move list, and puzzle instructions directly below the board.

## 2. Top Players Modal Fixes (site-home.css)
- Fix Z-Index & Header Overlap: Increase .top-players-modal to z-index: 1500 so it renders above the sticky .mobile-app-bar (z-index: 100) and mobile navigation drawer. Ensure modal dialog top margin/padding leaves the header and close button visible.
- Streamline Columns on Mobile (@media (max-width: 640px)):
  - Hide secondary columns on mobile: Country (.th-fed, .td-fed), Birth Year (.th-year, .td-year), and Profile Card (.th-action, .td-action).
  - Keep only Rank (#), Player (Title + Name), and Rating visible on mobile.
  - Expand .player-name to fill available width with clean spacing.
