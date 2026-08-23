### Task: Fix Top Players Modal Header Overlap & Streamline Mobile Columns

#### Problem Description
1. **Modal Header Hidden Behind Top Bar**: In mobile view (screens ≤ 768px), the top part of the "Top Chess Players" dialog card (modal title, category chips, and close button) is covered/hidden behind the sticky `.mobile-app-bar`. This occurs because `.mobile-app-bar` has `z-index: 100`, while `.top-players-modal` has `z-index: 50`.
2. **Crowded Leaderboard Columns**: The Top Players table displays 6 columns: `#` (Rank), `Player`, `Country`, `Rating`, `B-Year`, and `Profile` (FIDE card link). On mobile screens, this causes excessive horizontal squeezing and awkward wrapping.

---

#### Requirements

1. **Fix Modal Stacking Context & Z-Index (`site-home.css`)**:
   - Elevate `.top-players-modal` and generic `.promotion-modal` to `z-index: 1500` (or at least `> 200`) so the modal dialog and backdrop render above the sticky `.mobile-app-bar` (`z-index: 100`) and the mobile drawer.
   - Ensure the modal dialog card has appropriate top margin / safe-area padding on mobile so the header and close button (`×`) are fully visible and clickable without being clipped.

2. **Streamline Mobile Table Columns (`site-home.css` / `@media (max-width: 640px)`)**:
   - In mobile view (`max-width: 640px` and `max-width: 768px`), hide the secondary columns:
     - **Country** (`.th-fed`, `.td-fed`)
     - **Birth Year** (`.th-year`, `.td-year`)
     - **Profile Card** (`.th-action`, `.td-action`)
   - Keep only the essential columns visible on mobile:
     - **Rank** (`.th-rank`, `.td-rank`)
     - **Player Name & Title** (`.th-player`, `.td-player`)
     - **Rating** (`.th-rating`, `.td-rating`)
   - Expand `.player-name` width to `100%` or remove `max-width` restrictions so player names display without truncation.

3. **Responsive Modal Layout**:
   - Ensure the category filter chips (`.top-players-nav`) scroll smoothly horizontally on touch devices without vertical overflow.
   - Maintain the full 6-column layout on desktop and tablet screens (> 640px).

4. **Verification**:
   - Open Top Players on a mobile viewport (375px–420px):
     - Modal title, close button (`×`), and category chips are 100% visible and accessible.
     - Table shows only Rank, Player (with title), and Rating with clean spacing and no clipping.
   - Open Top Players on desktop:
     - All 6 columns (Rank, Player, Country, Rating, B-Year, Profile) display normally.