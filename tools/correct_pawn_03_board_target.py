from pathlib import Path

lesson_path = Path("lessons/pawn-03-files-ranks-diagonals.html")
text = lesson_path.read_text(encoding="utf-8")

wrong = '''  <style>
    /* Pawn 03: keep the floating interactive lesson board from covering the lesson. */
    .teacher-board-panel:not(.is-maximized):not(.is-minimized) {
      width: min(72vw, 520px);
      height: min(72vh, 560px);
    }

    @media (max-width: 720px) {
      .teacher-board-panel:not(.is-maximized):not(.is-minimized) {
        left: auto;
        right: .5rem;
        width: min(calc(100vw - 1rem), 440px);
        height: min(64vh, 500px);
      }
    }
  </style>
'''

correct = '''  <style>
    /* Pawn 03: keep the Accurate Board Map compact without affecting the floating board. */
    .coordinate-board.master {
      width: min(100%, 520px);
    }
  </style>
'''

if wrong not in text:
    raise SystemExit("Expected mistaken floating-board override was not found.")

lesson_path.write_text(text.replace(wrong, correct, 1), encoding="utf-8")
