# Reusable Play vs Stockfish Student Links

A coach can prepare a complete Play vs Stockfish game and copy one reusable link for a student.

## Coach workflow

1. Open **Setup** and arrange the chessboard, or select the position you want to use.
2. Open **Play**.
3. Choose the starting position, engine strength, student color, time control, and Stockfish thinking speed.
4. Click **Copy student game link**.
5. Save or send the copied link whenever the assignment is needed.

The link contains the resolved starting FEN and the Play settings. It does not require a student account or database record.

## Student workflow

1. Open the link.
2. The app opens the Play tab and loads the prepared position.
3. The engine strength, color, time control, thinking speed, and starting position are locked.
4. Click **Start Game**.

Opening a prepared link does not replace the student's existing browser draft. The same link can be opened again later to restart the same assignment.

## Link format

New prepared links use one compact `pc` value containing the position and settings. This keeps the URL much shorter than the first implementation while remaining completely reusable without a server-side database.

First-generation links using `playChallenge=1`, `playFen`, `playSkill`, `playSide`, `playTime`, and `playSpeed` remain supported.

Because the full chess position is stored inside the URL, prepared links will still be longer than an ordinary page address. A genuinely tiny link would require a server-side short code or an external URL-shortening service.

Invalid or incomplete prepared links show an error in the Play panel instead of silently starting with different settings.
