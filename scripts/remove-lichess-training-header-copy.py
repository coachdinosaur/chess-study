from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text(encoding="utf-8")
    count = text.count(old)
    if count == 0 and new in text:
        return
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, found {count}")
    file_path.write_text(text.replace(old, new, 1), encoding="utf-8")


replace_once(
    "lichess-position-training.mjs",
    '            <p>Play the position, preserve the objective, and face dynamic defence. No stored continuation is treated as the only correct line.</p>\n',
    "",
)

replace_once(
    "focus-analysis-popup.mjs",
    "import './lichess-position-training.mjs?v=20260726-terminal-state1';",
    "import './lichess-position-training.mjs?v=20260726-header-copy2';",
)

replace_once(
    "index.html",
    '<script type="module" src="./focus-analysis-popup.mjs?v=20260726-learning1"></script>',
    '<script type="module" src="./focus-analysis-popup.mjs?v=20260726-training-copy1"></script>',
)
