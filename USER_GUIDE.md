# Coach Dinosaur Chess Study User Guide

Coach Dinosaur Chess Study is a browser-based chess notebook for building positions, recording lesson lines, studying with Stockfish, adding explanations, practicing saved variations, presenting published course lessons, and running synchronized teacher/student boards.

Live app:

```text
https://cddigital.top/
```

You do not need to install anything to use the deployed app.

---

## Start Here: The Three Places You Will Use Most

### 1. Lesson controls at the top

Use these controls to manage lessons:

- **Lesson picker**: switch between lessons.
- **Actions**: create, duplicate, or delete a lesson.
- **Analyze / Stop**: start or stop Stockfish analysis.
- **Three-dot menu**: open, save, import, export, show or hide panels, change theme, and access other display options.

### 2. The chessboard

Use the board to:

- set up a position in **Setup**;
- play legal moves in **Analysis**;
- review recorded moves in **Study**;
- play against Stockfish in **Play**;
- solve endgame puzzles or train on Lichess-derived positions in **Puzzle**.

### 3. The tools panel

The tools panel contains the main working tabs:

- **Study**: review the board and recorded notation with the tools collapsed.
- **Setup**: create or change the starting position.
- **Analysis**: play moves, use Stockfish, practice, and annotate.
- **Play**: play a complete game against Stockfish.
- **Puzzle**: choose the legacy Endgame Puzzle mode or the separate Lichess Position Training mode.
- **Lessons**: create, edit, import, export, and load prepared FEN position sets.

If the tools panel is missing:

> **Where to go:** Three-dot menu → **Show tools**

---

## Quick Navigation Map

Use these exact paths when you know what you want to do.

- Create a blank lesson: **Actions → New**
- Copy the current lesson: **Actions → Duplicate**
- Delete the current lesson: **Actions → Delete**
- Show the tools panel: **Three-dot menu → Show tools**
- Hide the tools panel: **Three-dot menu → Hide tools**
- Save the current lesson: **Three-dot menu → Save lesson**
- Open a saved lesson: **Three-dot menu → Open lesson**
- Import a PGN: **Three-dot menu → Import PGN**
- Export a PGN: **Three-dot menu → Export PGN**
- Show the lesson note: **Three-dot menu → Show note**
- Show engine lines: **Three-dot menu → Show PV lines**
- Change the starting position: **Tools → Setup**
- Play and record moves: **Tools → Analysis**
- Review the lesson tree: use the notation panel or **Tools → Study**
- Open the Lesson Position Builder: **Tools → Lessons**
- Browse published course lessons: open the **Lesson index** from the app/site navigation
- Open a floating board while reading a supported lesson: click **Teacher Board** in the lesson header
- Start a synchronized teacher/student room: open **Live Board** (`live-board.html`)
- Open Lichess Position Training: **Tools → Puzzle → Lichess Position Training**
- Open a teacher puzzle assignment: use the private assignment link sent by the teacher
- Start engine analysis: click **Analyze** beside the three-dot menu
- Stop engine analysis: click **Stop** in the same place
- Flip the board: use **Flip board** in the current tools tab
- Enter Focus mode: **Three-dot menu → Focus mode**

---

# Common Tasks

## Create a New Lesson

> **Where to go:** **Actions → New**

1. Click **Actions** near the lesson picker.
2. Choose **New**.
3. Click the lesson title field and type a name.
4. Open the three-dot menu and choose **Show tools** if the tools are hidden.
5. Leave the normal starting position, or use **Setup** to create a custom position.
6. Switch to **Analysis**.
7. Play moves on the board.
8. Save the lesson when finished.

The move list grows automatically as you play.

## Rename the Current Lesson

> **Where to go:** lesson title field at the top of the lesson area

1. Click the lesson title.
2. Replace the existing text.
3. Click outside the field or continue working.

The title is stored in the browser draft and included when you save the lesson.

## Duplicate a Lesson

> **Where to go:** **Actions → Duplicate**

Use Duplicate when you want to experiment without changing the original lesson.

The copied lesson keeps the setup position, move tree, comments, annotations, and note.

## Delete a Lesson

> **Where to go:** **Actions → Delete**

1. Switch to the lesson you want to remove.
2. Click **Actions**.
3. Choose **Delete**.
4. Confirm the deletion.

The app always keeps at least one lesson.

---

## Build a Lesson from the Normal Starting Position

> **Where to go:** **Tools → Analysis**

1. Create a new lesson or select an existing one.
2. Give the lesson a title.
3. Make sure the board shows the normal starting position.
4. Open **Analysis**.
5. Play the main line on the board.
6. Navigate back to an earlier move and play a different move to create a variation.
7. Add comments, notes, or annotations as needed.
8. Choose **Three-dot menu → Save lesson**.

## Build a Lesson from a Custom Position

> **Where to go:** **Tools → Setup**

1. Open **Setup**.
2. Build the position using the piece palette, drag-and-drop, or a FEN string.
3. Set side to move, castling rights, and en passant details when needed.
4. Check that the app reports the position as legal.
5. Switch to **Analysis**.
6. Play and record the lesson moves.
7. Save the lesson.

Changing the setup resets the existing analysis tree because the lesson now begins from a different position.

---

## Make Moves and Build Variations

> **Where to go:** **Tools → Analysis**

To make a move:

1. Click a piece belonging to the side to move.
2. Legal destination squares appear.
3. Click a legal destination square.

The app automatically records the move and stores the resulting position.

To create a side variation:

1. Click an earlier move in the notation tree, or use the navigation controls.
2. Confirm that the board shows the position where the branch should begin.
3. Play a different legal move.
4. The new move appears as a variation from that position.

If the move already exists, the app follows the existing branch instead of creating a duplicate.

## Navigate the Move Tree

> **Where to go:** notation tree and navigation buttons on the right

You can:

- click any move to jump directly to that position;
- go to the start;
- go back one move;
- go forward one move in the current branch;
- go to the end of the current branch.

Keyboard shortcuts:

- **Left Arrow**: previous move
- **Right Arrow**: next move
- **Escape**: close menus and dialogs

Arrow-key navigation does not run while you are typing in a field or choosing a promotion piece.

---

## Analyze a Position with Stockfish

> **Where to go:** click **Analyze** beside the three-dot menu

1. Open a legal position in **Analysis** or **Study**.
2. Click **Analyze**.
3. Wait for the evaluation, depth, and candidate lines to appear.
4. Click **Stop** when you want to end the search.

The engine area can show:

- evaluation;
- search depth;
- searched nodes;
- engine status;
- up to three principal variation lines.

To show or hide the candidate lines:

> **Where to go:** Three-dot menu → **Show PV lines** or **Hide PV lines**

For legal endgames with up to seven pieces and no castling rights, the app may use the Lichess tablebase instead of Stockfish. If tablebase access fails, the app falls back to Stockfish.

## Explain the Current Position with AI Help

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

## Add a Lesson Note

> **Where to go:** Three-dot menu → **Show note**

The lesson note is one free-form text area for the whole lesson.

Use it for:

- lesson goals;
- teaching reminders;
- homework instructions;
- a summary of the position.

Use **Hide note** when you want more screen space. The note remains saved even when hidden.

## Add a PGN Comment to a Position

> **Where to go:** select a position in the move tree, then use the PGN comment editor in the tools area

1. Click the move or starting position you want to explain.
2. Find the PGN comment editor for the selected position.
3. Enter the explanation.
4. Select another move to edit that position’s comment.

PGN comments are attached to individual positions. They are different from the lesson note, which belongs to the whole lesson.

PGN comments are included in exported PGN files.

## Draw Arrows, Circles, Stars, and Highlights

> **Where to go:** **Tools → Analysis** or **Tools → Study**

Use the **Annotate** control when you want to draw without accidentally playing moves.

Mouse controls:

- Right-click a square: add or remove a circle.
- **Ctrl + right-click** a square: add or remove a star.
- Right-drag across squares: paint highlighted squares.
- **Alt + right-drag** from one square to another: draw an arrow.
- Left-click while annotations exist: clear all annotations.

Annotations are saved in lesson files and the browser draft.

---

## Practice a Recorded Lesson

> **Where to go:** **Tools → Analysis** or **Tools → Study**

1. Build or open a lesson with recorded moves.
2. Choose **Selected line** or **Branch drill**.
3. Click **Start practice**.
4. Play the expected move on the board.

Practice types:

- **Selected line** follows the currently displayed lesson line from the starting position.
- **Branch drill** starts from the current position and accepts any recorded child move.

During practice:

- future moves are hidden;
- Stockfish output is hidden;
- wrong guesses do not create lesson moves;
- **Hint** highlights the correct piece;
- **Reveal move** shows the next move;
- **Restart** begins the drill again;
- **Stop practice** returns to normal study mode.

---

# Course Lessons, Presentation, and Teacher Board

## Open a Published Course Lesson

> **Where to go:** open the lesson index, then choose Pawn, Advanced Pawn, Bishop, or a numbered endgame lesson

Published lessons are static reading pages rather than saved `.lesson.json` files. Their shared header normally includes:

- the course level and lesson title;
- a link back to the correct level index;
- theme switching;
- Print / Save PDF;
- **Present Lesson** on supported pages;
- **Teacher Board** on supported pages.

On phones, the header actions wrap below the title. In print/PDF output, the lesson header and presentation controls are hidden.

## Present a Lesson to a Class

> **Where to go:** supported lesson header → **Present Lesson**

Presentation mode shows one meaningful lesson section or position at a time.

Controls:

- **Previous** or Left Arrow: return to the previous scene;
- **Reveal** or Space: open the next hidden answer/detail; when nothing remains to reveal, advance;
- **Reset** or `R`: close revealed details and reset the current scene;
- **Next** or Right Arrow: advance;
- **Exit** or Escape: leave presentation mode.

The browser attempts fullscreen when allowed. A short pulse appears where the teacher clicks, including on same-origin embedded chessboards, so students can follow the pointer on a projected display. Clicking the presentation toolbar or Teacher Board controls does not create the pulse.

## Use the Floating Teacher Board

> **Where to go:** supported lesson header → **Teacher Board**

The Teacher Board opens over the lesson without leaving the page. Use **Max** for a larger board, **_** to minimize it, and **x** to close it.

### Load or build a position

1. Click **Setup**.
2. Use **Board** to choose:
   - **Empty**: remove all pieces;
   - **Start**: load the standard starting position;
   - **Page**: restore the exact position assigned to the current lesson page.
3. Choose the palette color (**White** or **Black**) and then a piece.
4. Click squares on the board to place pieces, or select **Erase** to remove them.
5. Use the separate **Side to move** White/Black buttons. Changing this does not remove the pieces you placed.
6. Click **Done** to leave setup and return to normal board movement.

Empty preserves the selected side to move. Start loads all 32 pieces with the selected side to move. Page restores the lesson FEN and updates the side-to-move buttons to match it.

### Other Teacher Board controls

- **Lesson**: import a prepared-position CSV, choose a position, and view its teacher note.
- **Annotate**: keep marks while interacting; right-click marks squares and Alt + right-drag draws arrows.
- **Take Back**: undo the last legal or teacher-demonstration move.
- **Clear marks**: remove annotations.
- **Flip**: change viewing orientation.
- **Reset**: return to the current Teacher Board baseline.

The board reports checkmate or stalemate in a compact status overlay. Teacher-demonstration moves may be intentionally illegal or out of turn; the board marks them instead of pretending they were legal game moves.

# Live Board for Teacher and Student

> **Where to go:** open `live-board.html` from the deployed site

Live Board is different from the floating Teacher Board. It creates a synchronized room that a teacher and student can open on different devices.

## Teacher workflow

1. Click **Create teacher room**.
2. Wait until the room and connection status appear.
3. Click **Copy student link**.
4. Send that generated link to the student. Do not send your teacher URL.
5. Move pieces by click/tap or drag. The student board updates automatically.
6. Use **Lock student moves** while demonstrating. Unlock it when the student should move.

Teacher controls include Undo, Reset, Flip board, Theme, FEN loading/copying, CSV/XLSX prepared-position import, and short session messages or Lichess links.

## Student workflow

1. Open the secure link supplied by the teacher.
2. Wait for the board and connection status.
3. Move pieces when student moves are unlocked.
4. When locked, watch the synchronized demonstration; the board remains view-only.
5. Use the Session messages panel to read or send short messages and links.

A room code by itself is not a substitute for the secure generated link. The access details in that link determine whether the page is the teacher or student role.

---

# Setup Position Guide

## Reset to the Normal Starting Position

> **Where to go:** **Tools → Setup → Reset setup**

This restores the standard chess starting position.

## Clear the Board

> **Where to go:** **Tools → Setup → Clear board**

Use Clear board when building a position from scratch. Add one king for each side before attempting analysis.

## Add or Move Pieces

> **Where to go:** **Tools → Setup**

You can:

- choose White or Black in the palette;
- click a palette piece and then click a square;
- drag a palette piece onto the board;
- drag an existing board piece to another square;
- right-click a square to remove its piece.

## Load a FEN

> **Where to go:** **Tools → Setup → FEN field**

1. Paste a complete six-part FEN.
2. Click **Apply FEN** if it does not apply automatically.
3. Check the validity message.
4. Switch to **Analysis** when the position is ready.

Use **Reset draft** to discard unsaved text in the FEN field and restore the current setup FEN.

## Change Side to Move, Castling, or En Passant

> **Where to go:** **Tools → Setup → Advanced position details**

The app limits choices to details that make sense for the pieces on the board. For example, castling rights require the king and rook on their home squares.

## Fix an Invalid Position

> **Where to go:** **Tools → Setup**

Common causes include:

- missing or extra kings;
- impossible king placement;
- illegal side to move;
- castling rights without the required pieces;
- invalid en passant square;
- a position where the side not moving is illegally left in check.

Analysis remains disabled until the setup is legal.

---

# Saving and Sharing

## Save the Current Lesson

> **Where to go:** Three-dot menu → **Save lesson**

1. Choose **Save lesson**.
2. Your browser downloads a `.lesson.json` file.
3. Store that file somewhere safe.

A lesson file keeps app-specific details, including:

- title;
- setup FEN;
- board orientation;
- move tree and current position;
- annotations;
- lesson note;
- PGN comments;
- selected display settings.

## Open a Saved Lesson

> **Where to go:** Three-dot menu → **Open lesson**

1. Choose **Open lesson**.
2. Select a `.lesson.json` or compatible `.json` file.
3. The app validates and loads the lesson.

If the file is broken or unsupported, the app shows an error instead of loading it.

## Export a PGN

> **Where to go:** Three-dot menu → **Export PGN**

PGN export includes:

- the starting position when needed;
- main line and variations;
- PGN comments;
- lesson title as PGN event information.

PGN does not preserve app-only details such as annotations, lesson note, board orientation, or panel visibility.

## Import a PGN

> **Where to go:** Three-dot menu → **Import PGN**

1. Choose **Import PGN**.
2. Select a `.pgn` file.
3. If the file contains multiple games, choose the game to load.
4. The app rebuilds the move tree, variations, and PGN comments.

## Share a Lesson

Send the downloaded `.lesson.json` or `.pgn` file through email, chat, cloud storage, or another file-sharing method.

This is file sharing, not live collaboration. Changes do not synchronize automatically between users.

## Understand Browser Draft Saving

The app automatically stores a working draft in the current browser profile.

The draft can restore your work after closing and reopening the page, but it is not an account-based cloud backup.

Important limits:

- another browser or device does not receive the draft;
- multiple tabs can overwrite the same draft;
- clearing browser storage can remove it;
- important work should be saved as a lesson file.

---

# Play Against Stockfish

> **Where to go:** **Tools → Play**

1. Choose your side: White, Black, or Random.
2. Choose a time control.
3. Choose the engine strength.
4. Choose the starting position.
5. Choose the engine reply speed.
6. Click **Start Game**.

Available starting positions can include:

- current board;
- setup position;
- normal initial position.

During a game, the panel shows clocks and provides controls such as Resign and Offer Draw.

---

# Puzzle Training

The Puzzle tab contains two separate modes. Progress and solving rules from one mode do not overwrite the other.

## Endgame Puzzles

> **Where to go:** **Tools → Puzzle → Endgame Puzzles**

1. Choose an objective or select a random objective.
2. Choose the difficulty.
3. Set Stockfish defense strength and reply speed.
4. Start or load a puzzle.
5. Play your solution on the board.

Possible objectives include checkmate, gaining a piece, and holding a draw. The panel tracks solved puzzles, failed puzzles, current streak, and best streak.

The free-plan daily limit and premium activation apply to this legacy endgame mode.

## Lichess Position Training

> **Where to go:** **Tools → Puzzle → Lichess Position Training**

The current production library contains **10,000 Lichess-derived positions**. The total shown in the launcher and trainer header comes from the live manifest, so it updates with future dataset expansions.

1. Choose **Adaptive** difficulty or a **Fixed range**.
2. Choose any theme, a specific motif, or the weakest recorded theme.
3. Play a move that preserves the displayed objective.
4. Continue against dynamic defence until the objective is completed or lost.
5. Use **Next position** to continue, or **Review mistakes** to revisit due positions.

Important behavior:

- The stored Lichess continuation is not the required answer. Other moves are accepted when they preserve the required result.
- Checkmate and terminal draws are recognized immediately before an engine request.
- Rating and theme filters select positions from the installed shard library.
- Hints progress from concept, to source piece, to target square, to the engine's leading candidate.
- A mistake lowers the adaptive rating and places the position in Mistake Review.
- Two independent clean review solves retire a mastered position.
- Progress is saved in the current browser profile, not in an account cloud save.

For deeper details, see [LICHESS_POSITION_TRAINING.md](LICHESS_POSITION_TRAINING.md).

## Complete a Teacher Puzzle Assignment

A teacher can send a private student assignment link. Students do not need a management-dashboard account.

- Open only the complete link provided by the teacher; its private token identifies the assignment.
- The assigned puzzle snapshots remain frozen even if the main library later expands.
- Progress and results are saved to the assignment record.
- An archived or permanently deleted assignment link stops working.
- Do not post the private assignment link publicly.

---

# Focus Mode and Display Controls

## Enter Focus Mode

> **Where to go:** Three-dot menu → **Focus mode**

Focus mode hides most panels and emphasizes the board.

Exit by:

- pressing **Escape**;
- clicking the close button in the Focus mode controls.

## Change Theme

> **Where to go:** Three-dot menu → **Light** or **Dark** theme

The app remembers the theme in the current browser.

## Flip the Board

> **Where to go:** use **Flip board** in Setup, Analysis, or Study

Flipping changes the viewing direction but does not change the position.

---

# Troubleshooting

## I Cannot See the Tools Panel

> **Fix:** Three-dot menu → **Show tools**

## I Cannot Move a Piece

Check that:

1. You are in **Analysis**, not Setup.
2. It is that piece’s turn.
3. The move is legal.
4. Practice mode is not expecting a different recorded move.
5. Annotate mode is not intercepting board clicks.
6. The setup position is valid.

## Analyze Does Nothing

Check that:

1. The board position is legal.
2. You are not in Setup.
3. The page and Stockfish files finished loading.
4. You clicked **Analyze**, not an unrelated panel control.
5. You waited briefly for the first engine result.

## I Cannot See Engine Lines

1. Click **Analyze**.
2. Open the three-dot menu.
3. Choose **Show PV lines**.
4. Wait for Stockfish or the tablebase to return results.

## The Position Is Invalid

> **Where to go:** **Tools → Setup**

Review the kings, side to move, castling rights, and en passant square.

## My Work Disappeared

Check whether:

- you are using the same browser profile;
- another tab replaced the browser draft;
- browser storage was cleared;
- you saved a `.lesson.json` file that can be reopened.

## A Lesson File Will Not Open

Possible reasons:

- the file is not valid JSON;
- it is not a supported lesson format;
- the lesson tree is damaged;
- the file was only partially downloaded.

Try another saved copy when available.

## The Board Looks Upside Down

> **Fix:** click **Flip board** in the current tools tab.

## Teacher Board Empty, Start, or Page Appears Unresponsive

1. Reload the lesson once so the current cache-versioned Teacher Board files are used.
2. Open **Teacher Board → Setup → Board** and retry the command.
3. Confirm **Page** is expected to look different from **Start**; Page restores the lesson's assigned FEN.
4. After **Empty**, select a piece and place it on the board before clicking Done.
5. Use the separate **Side to move** control rather than the piece-palette color button.

## Live Board Messages or Synchronization Do Not Start

1. Confirm both people opened the current generated links for the same room.
2. The student should reopen the copied student link rather than typing only the room code.
3. Wait for the connection status before sending a message or moving.
4. Reload once if the room was created while scripts were still loading; the page restores teacher credentials for the browser session.
5. If the board remains disconnected, check internet access and whether Supabase is reachable.

## AI Help Gives an Unclear App Instruction

1. Ask it to name the exact menu, button, or tab first.
2. Compare its answer with the Quick Navigation Map in this guide.
3. Treat this guide as authoritative when the AI and guide disagree.

---

# Short Vocabulary Guide

- **Setup**: choose the starting position.
- **Analysis**: play moves and use the engine.
- **Study**: review the board and recorded move tree with tools collapsed.
- **Lessons**: manage prepared FEN position sets.
- **Teacher Board**: a floating demonstration board inside a published lesson page.
- **Live Board**: a synchronized teacher/student room on a separate page.
- **FEN**: text describing a chess position.
- **PGN**: portable chess game notation containing moves, variations, and comments.
- **Variation**: a side line branching from another position.
- **Annotation**: an arrow, circle, star, or highlighted square.
- **PV line**: an engine’s suggested continuation.
- **Lesson note**: one note for the whole lesson.
- **PGN comment**: a comment attached to a specific position.

---

# Important Things to Remember

- Use **Actions → New** to create a blank lesson.
- Use the three-dot menu for opening, saving, importing, exporting, and display controls.
- Use **Setup** to change the starting position.
- Use **Analysis** to play and record moves.
- Use **Study** to review the board and recorded notation with fewer controls visible.
- Use **Lessons** for prepared FEN position sets.
- Use **Present Lesson** and **Teacher Board** while teaching from supported published lessons.
- Use the generated secure student link when starting a Live Board room.
- Return to an earlier move and play a different move to create a variation.
- Click **Analyze** beside the three-dot menu to start Stockfish.
- Use **Save lesson** for a complete app lesson file.
- Use **Export PGN** for a portable chess file.
- The browser draft is convenient, but a downloaded lesson file is safer.
