# Task: Fix Chessboard Aspect Ratio Distortion & Landscape Tablet Sizing (1138x712, 1024x768)

## Problem Description & Symptoms
On landscape tablet screens and compact desktop viewports (e.g. Galaxy Tab S9 at **1138 x 712**, iPad Landscape at **1024 x 768**), the chessboard squares distort into **tall, vertically stretched rectangles** instead of maintaining a strict 1:1 square aspect ratio.

### Root Causes
1. **Sidebar Width Ignored in `app.js` (`syncBoardSize`)**:
   At widths > 1100px (like 1138px), the desktop sidebar (~220px) is visible. `syncBoardSize()` calculates available workspace width from `dom.pageShell.clientWidth` without subtracting `dom.appSidebar.offsetWidth`. It overestimates available width by ~220px and sets `--board-size` too large (e.g. ~580px instead of ~430px).
2. **Asymmetric Clamping in `styles.css` (`.board-frame`)**:
   `.board-frame` sets `width: min(100%, calc(var(--board-size) + ...))` (which shrinks to the 430px column width), while `height: calc(var(--board-size) + ...)` remains 580px with no clamp or aspect-ratio lock. This forces an 8x8 grid into a 430px x 580px rectangle.
3. **`site-home.css` Media Query Conflict**:
   `site-home.css` loads after `styles.css`. Its `@media (max-width: 1100px)` single-column rule can conflict with the desired 2-column landscape split on tablets (769px-1100px).

---

## Requirements & Code Changes

### 1. Enforce Strict 1:1 Aspect Ratio on Board Elements (`styles.css`)
Ensure the board frame, surface, and grid can **never** distort into rectangles regardless of container sizing:

- **`.board-frame`** (around line 755):
  - Add `--board-shell-size: calc(var(--board-size) + (var(--board-frame-padding) * 2) + 2px);`
  - Set `width: min(100%, var(--board-shell-size));` and `max-width: var(--board-shell-size);`
  - Enforce `aspect-ratio: 1 / 1;`
  - Set `height: auto; max-height: var(--board-shell-size);`
  - Set `box-sizing: border-box;`
- **`.board-surface`**:
  - Keep `aspect-ratio: 1 / 1; width: 100%; height: 100%; max-width: 100%; max-height: 100%;`
- **`.board-grid`**:
  - Keep `aspect-ratio: 1 / 1; grid-template-columns: repeat(8, 1fr); grid-template-rows: repeat(8, 1fr); width: 100%; height: 100%;`

---

### 2. Subtract Sidebar Width in Dynamic Sizing (`app.js` -> `syncBoardSize()`)
Around line 7233 in `app.js`, accurately measure main content width:

```javascript
  } else if (!isMobilePortrait && window.innerWidth > 1100) {
    // Check if sidebar is rendered and visible
    const sidebarWidth = (dom.appSidebar && dom.appSidebar.offsetParent !== null)
      ? dom.appSidebar.offsetWidth
      : 0;

    const mainContentWidth = dom.appMainContent?.clientWidth
      || Math.max(0, (dom.pageShell?.clientWidth || window.innerWidth) - sidebarWidth);

    const pageShellStyles = dom.pageShell ? window.getComputedStyle(dom.pageShell) : null;
    const pageShellPaddingX = pageShellStyles
      ? cssLengthToPx(pageShellStyles.paddingLeft, remToPx(0.75)) + cssLengthToPx(pageShellStyles.paddingRight, remToPx(0.75))
      : remToPx(1.5);

    const workspace = dom.boardColumn.closest('.workspace');
    const workspaceStyles = workspace ? window.getComputedStyle(workspace) : null;
    const gapPx = workspaceStyles ? (cssLengthToPx(workspaceStyles.getPropertyValue('column-gap'), null) || cssLengthToPx(workspaceStyles.getPropertyValue('gap'), remToPx(0.9))) : remToPx(0.9);

    const maxWorkspaceWidth = workspaceStyles ? cssLengthToPx(workspaceStyles.getPropertyValue('max-width'), remToPx(72)) : remToPx(72);
    const controlPane = workspace?.querySelector('.control-pane');
    const controlPaneWidth = controlPane?.clientWidth || remToPx(29);

    const availableWorkspaceWidth = Math.min(maxWorkspaceWidth, mainContentWidth - pageShellPaddingX);
    containerWidth = Math.max(0, availableWorkspaceWidth - controlPaneWidth - gapPx);
  }
```

---

### 3. Ensure Tablet Landscape 2-Column Split (`site-home.css`)
In `site-home.css`, add/update the tablet landscape block for `769px` to `1100px`:

```css
@media (max-width: 1100px) and (min-width: 769px) and (orientation: landscape) {
  html, body {
    overflow: hidden;
  }

  .page-shell {
    height: var(--app-height);
    max-height: var(--app-height);
    overflow: hidden;
    flex-direction: row;
  }

  .workspace {
    grid-template-columns: minmax(0, auto) minmax(18rem, 26rem) !important;
    gap: 0.75rem;
    height: 100%;
    overflow: hidden;
  }

  .board-stage-card {
    height: calc(var(--app-height) - 1.5rem);
  }

  .control-pane {
    height: calc(var(--app-height) - 1.5rem);
    max-height: calc(var(--app-height) - 1.5rem);
    display: flex !important;
    flex-direction: column;
  }

  .control-pane-scroll {
    overflow-y: auto;
    height: 100%;
  }
}
```

---

## Verification Criteria
1. **Galaxy Tab S9 (1138 x 712) in DevTools**:
   - [ ] Every chessboard square is perfectly square (1:1 ratio, equal width and height).
   - [ ] Board height does not exceed viewport height; no vertical clipping or overflow.
   - [ ] Sidebar on the left, board in the center, and control pane on the right fit comfortably.
2. **iPad Landscape (1024 x 768 & 1180 x 820)**:
   - [ ] Board remains 100% square.
   - [ ] 2-column split layout works with internal scrolling on the control pane.
