# WTHarvey Puzzle Download Workflow

This folder contains a dependency-free downloader for WTHarvey chess puzzle pages.
It improves on the original guide by:

- using only the Python standard library;
- collecting all same-site `.html` puzzle pages linked from the WTHarvey homepage;
- preserving the original WTHarvey FEN in `raw_fen`;
- creating an app-friendly `fen` field where fullmove number `0` is normalized to `1`;
- extracting source URL, page title, title/game label, task text, motif hints, side to move, and hidden solution text;
- writing both a raw archive CSV and a CSV shaped like this app's middlegame input file.

## License Note

WTHarvey pages are publicly viewable, but the site does not advertise an open-data redistribution license. Use the downloaded data for personal study, local testing, private lesson preparation, or internal analysis unless you get permission or publish only a curated attributed subset.

## Run

From the repo root:

```powershell
python tools\wtharvey\download_wtharvey.py
```

Default outputs:

```text
Endgame/wtharvey_puzzles_raw.csv
Endgame/wtharvey_tactics_input.csv
Endgame/wtharvey_download_errors.csv
```

The crawler uses a one-second delay between page requests by default.

## Quick Test

To test the first 10 linked pages:

```powershell
python tools\wtharvey\download_wtharvey.py --limit 10 --raw-out Endgame\wtharvey_test_raw.csv --app-out Endgame\wtharvey_test_tactics.csv
```

## Output Columns

Raw CSV:

```text
id,source_name,source_url,page_title,title,task,motif,raw_fen,fen,fen_normalization,side_to_move,solution
```

App-style CSV:

```text
title,fen,player_color,plan,goal_type,level_tier,status
```

The app-style CSV marks every row as `unchecked`; WTHarvey solutions are useful, but you should still verify imported lessons before treating them as curated training material.

## Check and Retier the App CSV

After downloading, run:

```powershell
node tools\wtharvey\check_wtharvey_tactics.mjs
```

This checks `Endgame/wtharvey_tactics_input.csv` row by row against the raw WTHarvey metadata in `Endgame/wtharvey_puzzles_raw.csv`.

It performs these checks and edits:

- validates every FEN with the local `vendor/chess.js` library;
- normalizes a few known malformed WTHarvey FEN rows where the intended board is recoverable;
- checks whether the first solution move is legal from the FEN;
- sets `status` to `checked` or `needs_review`;
- adds/updates `endgame_like` as `yes` when both sides have 4 or fewer pieces, counting kings;
- retiers `level_tier` as `beginner`, `intermediate`, `advanced`, or `expert` using WTHarvey ratings, mate depth, and solution length.

It also writes:

```text
Endgame/wtharvey_tactics_check_report.csv
```
