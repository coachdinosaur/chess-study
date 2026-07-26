from __future__ import annotations

import base64
import hashlib
import io
import zipfile
from pathlib import Path

ROOT = Path.cwd().resolve()
PAYLOAD_FILES = [
    ROOT / f"scripts/current-teacher-puzzle-payload-{index}.txt"
    for index in range(1, 5)
]
EXPECTED_SHA256 = "9139f59380ba81ab7644bbdb28dc82b9a2b98f5e30a67103fd5e77215ad994aa"


def replace_once(path: str, old: str, new: str) -> None:
    target = ROOT / path
    text = target.read_text(encoding="utf-8")
    if new in text:
        return
    if old not in text:
        raise SystemExit(f"Marker not found in {path}: {old[:80]!r}")
    target.write_text(text.replace(old, new, 1), encoding="utf-8")


encoded = "".join(path.read_text(encoding="utf-8").strip() for path in PAYLOAD_FILES)
payload = base64.b64decode(encoded, validate=True)
actual_sha256 = hashlib.sha256(payload).hexdigest()
if actual_sha256 != EXPECTED_SHA256:
    raise SystemExit(f"Payload checksum mismatch: {actual_sha256}")

with zipfile.ZipFile(io.BytesIO(payload)) as archive:
    for member in archive.infolist():
        destination = (ROOT / member.filename).resolve()
        if destination != ROOT and ROOT not in destination.parents:
            raise SystemExit(f"Unsafe archive member: {member.filename}")
    archive.extractall(ROOT)

replace_once(
    "management/teacher.html",
    '  <link rel="stylesheet" href="./hardening.css?v=20260723-hardening1">\n',
    '  <link rel="stylesheet" href="./hardening.css?v=20260723-hardening1">\n'
    '  <link rel="stylesheet" href="./puzzle-assignments.css?v=20260726-puzzle-assignments1">\n',
)
replace_once(
    "management/teacher.html",
    '  <script type="module" src="./js/teacher-shell.mjs?v=20260723-hardening1"></script>\n',
    '  <script type="module" src="./js/teacher-shell.mjs?v=20260723-hardening1"></script>\n'
    '  <script type="module" src="./js/puzzle-assignment-dashboard.mjs?v=20260726-puzzle-assignments1"></script>\n',
)
replace_once(
    "management/js/supabase-client.mjs",
    "then apply management migrations 001 through 009.",
    "then apply management migrations 001 through 010.",
)
replace_once(
    "lichess-position-training.mjs",
    "const STYLE_URL = './lichess-position-training.css?v=20260726-learning1';",
    "const STYLE_URL = './lichess-position-training.css?v=20260726-assignment-sizing1';",
)

css_path = ROOT / "lichess-position-training.css"
css = css_path.read_text(encoding="utf-8")
marker = "/* Desktop board sizing aligned with the main chessboard. */"
if marker not in css:
    css += """

/* Desktop board sizing aligned with the main chessboard. */
@media (min-width: 861px) {
  .position-training-dialog {
    width: min(1280px, calc(100vw - 2rem));
    max-height: calc(100dvh - 2rem);
    overflow: hidden;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
  }

  .position-training-content {
    grid-template-columns: minmax(0, 1fr) minmax(280px, 320px);
    min-height: 0;
    overflow: hidden;
    align-items: start;
  }

  .position-training-main,
  .position-training-sidebar {
    max-height: calc(100dvh - 8.5rem);
    overflow: auto;
    scrollbar-gutter: stable;
  }

  .position-training-main {
    display: grid;
    align-content: start;
    padding-right: 0.15rem;
  }

  .position-training-sidebar {
    padding-right: 0.2rem;
  }

  .position-training-board-wrap {
    width: min(760px, calc(100vw - 390px), calc(100dvh - 11rem));
    max-width: 100%;
  }
}

@media (min-width: 861px) and (max-height: 760px) {
  .position-training-header {
    padding-block: 0.75rem;
  }

  .position-training-content {
    gap: 0.9rem;
    padding: 0.9rem;
  }

  .position-training-main,
  .position-training-sidebar {
    max-height: calc(100dvh - 7rem);
  }

  .position-training-board-wrap {
    width: min(680px, calc(100vw - 380px), calc(100dvh - 8.5rem));
  }
}
"""
    css_path.write_text(css, encoding="utf-8")

summary = ROOT / "proof/teacher-puzzle-assignments-summary.md"
summary.parent.mkdir(parents=True, exist_ok=True)
summary.write_text(
    """# Teacher Puzzle Assignments

## Implemented

- Approved teachers create fixed Lichess puzzle assignments from the existing 500-position dataset.
- Teachers choose a student level, rating range, theme, puzzle count, hint policy, retry policy, passing score, due date, and existing managed students.
- Every generated position can be previewed on a board and replaced before publication.
- Published assignments freeze exact puzzle snapshots and create one private bearer link per student.
- Students do not need accounts. Progress and attempts persist in Supabase and resume across devices through the same private link.
- Teacher results show status, current puzzle, and score. Missing local link tokens can be securely reissued.
- Desktop Lichess training and assignment boards size from viewport width and height to stay fully visible beside their control panels.

## Validation

- Node syntax checks for all new modules.
- Node unit tests for presets, settings normalization, puzzle filtering, uniqueness, and frozen snapshots.
- Existing Lichess position-training core and learning tests.
- Static checks for teacher-only wiring, assignment page references, migration presence, and desktop sizing markers.
- Supabase schema applied and verified separately with RLS inspection and a rollback-only token RPC transaction test.
""",
    encoding="utf-8",
)

required = [
    "management/js/puzzle-assignment-core.mjs",
    "management/js/puzzle-assignment-dashboard.mjs",
    "management/js/puzzle-assignment-student.mjs",
    "management/puzzle-assignments.css",
    "management/assignment.html",
    "supabase/migrations/010_teacher_puzzle_assignments.sql",
    "tests/puzzle-assignment-core.test.mjs",
]
missing = [path for path in required if not (ROOT / path).is_file()]
if missing:
    raise SystemExit("Missing extracted files: " + ", ".join(missing))
