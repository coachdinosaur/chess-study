# Play vs Stockfish Starting Position

## Summary
Add a `Starting Position` selector to Play vs Stockfish so a new game can start from the current board, the setup/root position, or the normal initial chess position. Default it to `Current board`.

## Key Changes
- Add internal play state: `state.play.startPosition = 'current'`.
- Add Play panel select with options:
  - `Current board`: use `state.analysis.currentFen`.
  - `Setup position`: use `state.setupFen`.
  - `Initial position`: use `DEFAULT_POSITION`.
- Add `set-play-start-position` change handling, matching the existing Play settings pattern.
- Update `startPlayGame()` to resolve the selected FEN, create a fresh `Chess(startFen)`, and rebuild the play move tree with that FEN as the root.
- Keep lesson/setup data unchanged when starting from current or initial position.
- Disable the selector while a game is active, like color/time/speed.
- If the selected start FEN is already game-over, do not start Stockfish; show a board message instead.

## Interfaces
- No external API changes.
- New internal UI/action contract:
  - `data-action="set-play-start-position"`
  - values: `current`, `setup`, `initial`.

## Test Plan
- From Analysis, play a few moves, select `Current board`, start Play, and confirm the game begins from that visible position.
- Select `Setup position` after moving in Analysis and confirm Play resets to the setup/root FEN.
- Select `Initial position` from any custom position and confirm Play starts from the standard initial board.
- Confirm human color still works correctly when the selected FEN has either side to move.
- Confirm resign/stop, clocks, engine move generation, and navigation locking still behave as before.
- Run a syntax check such as `node --check app.js`, then verify manually in the browser through the local server.

## Assumptions
- `Current board` should be the default because it matches the user’s likely expectation when switching from Analysis to Play.
- Starting a Stockfish game should create a fresh game line rooted at the chosen FEN, not append directly into the existing lesson line.
- No separate reset button is needed because `Setup position` and `Initial position` provide explicit reset targets before starting.
