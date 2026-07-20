from pathlib import Path

lesson_path = Path("lessons/pawn-03-files-ranks-diagonals.html")
text = lesson_path.read_text(encoding="utf-8")

marker = '  <link rel="stylesheet" href="pawn-teacher-board.css?v=20260710-teacher-lesson-csv1">\n'
override = '''  <style>
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

if "Pawn 03: keep the floating interactive lesson board" in text:
    raise SystemExit("Pawn 03 lesson board override already exists.")

if marker not in text:
    raise SystemExit("Expected lesson-board stylesheet link was not found.")

lesson_path.write_text(text.replace(marker, marker + override, 1), encoding="utf-8")
