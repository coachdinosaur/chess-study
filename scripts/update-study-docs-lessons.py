from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count == 0 and new in text:
        return text
    if count != 1:
        raise SystemExit(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


def insert_before_once(text, anchor, insertion, marker, label):
    if marker in text:
        return text
    count = text.count(anchor)
    if count != 1:
        raise SystemExit(f"{label}: expected one anchor, found {count}")
    return text.replace(anchor, insertion + anchor, 1)


# LESSON_DATA_ARCHITECTURE.md
path = Path("LESSON_DATA_ARCHITECTURE.md")
text = path.read_text(encoding="utf-8")
stage3 = """### Stage 3: main-line and recursive variation controls

Stage 3 makes preferred-continuation changes explicit. New moves no longer replace an existing main line, navigation no longer mutates branch preference, **Make main line** promotes only the selected local branch, and the same rules apply recursively to sub-variations.

See [LESSON_VARIATIONS_AND_MAIN_LINES.md](LESSON_VARIATIONS_AND_MAIN_LINES.md) for the user workflow, PGN punctuation rules, persistence contract, and validation checklist.

"""
text = insert_before_once(
    text,
    "## Product boundary\n",
    stage3,
    "### Stage 3: main-line and recursive variation controls",
    "Lesson architecture Stage 3 status",
)
text = replace_once(
    text,
    "- `lesson-position-export-validation.mjs` and `lesson-position-interoperability-export-guard.mjs` preserve the established export validation behavior.\n\n## File-format policy",
    "- `lesson-position-export-validation.mjs` and `lesson-position-interoperability-export-guard.mjs` preserve the established export validation behavior.\n\n### `lesson-variation-tree.mjs`\n\nProvides:\n\n- preferred-child lookup with first-valid-child fallback;\n- first-child insertion as the local main line;\n- later-child insertion as a variation;\n- non-promoting traversal of recorded branches;\n- explicit local promotion through **Make main line**;\n- recursive variation-depth calculation for nested branches.\n\nThe module mutates only the affected parent node and never removes siblings or descendants.\n\n## File-format policy",
    "Lesson architecture variation module",
)
text = replace_once(
    text,
    "5. Add optional CSV/XLSX metadata and validated enhanced export.\n\nRemaining recommended work:",
    "5. Add optional CSV/XLSX metadata and validated enhanced export.\n6. Preserve existing main lines when adding new moves.\n7. Add explicit **Make main line** promotion.\n8. Support recursively nested sub-variations and standards-compliant PGN export.\n\nRemaining recommended work:",
    "Lesson architecture completed sequence",
)
text = replace_once(
    text,
    "node --test tests/lesson-position-interoperability.test.mjs\n```",
    "node --test tests/lesson-position-interoperability.test.mjs\nnode --test tests/lesson-variation-tree.test.mjs\n```",
    "Lesson architecture test commands",
)
text = replace_once(
    text,
    "- enhanced export validation.\n\n\n## Main-line and recursive variation behavior",
    "- enhanced export validation;\n- first-child main-line selection;\n- non-promoting variation traversal;\n- explicit local promotion;\n- recursive sub-variation behavior;\n- PGN comment/variation punctuation and round-trip structure.\n\n## Main-line and recursive variation behavior",
    "Lesson architecture test coverage",
)
path.write_text(text, encoding="utf-8")


# USER_GUIDE.md
path = Path("USER_GUIDE.md")
text = path.read_text(encoding="utf-8")
text = replace_once(
    text,
    "4. The former main continuation remains saved as a side variation.\n\nClicking or replaying a variation only navigates to it.",
    "4. The former main continuation remains saved as a side variation.\n\nThe **Make main line** button appears only when the selected move has siblings and is not already the preferred continuation.\n\nClicking or replaying a variation only navigates to it.",
    "User guide main-line button visibility",
)
path.write_text(text, encoding="utf-8")


# LESSON_VARIATIONS_AND_MAIN_LINES.md
path = Path("LESSON_VARIATIONS_AND_MAIN_LINES.md")
text = path.read_text(encoding="utf-8")
quick_example = """## Quick example

1. Record `1.e4` from the starting position. It becomes the main line.
2. Return to the starting position and record `1.d4`. It remains a variation.
3. Click `1.d4`. Merely opening it does not change the saved main line.
4. Click **Make main line** only when `1.d4` should become preferred. The former `1.e4` line remains stored as a variation.
5. Enter either branch and record a different continuation later in the line to create a sub-variation.

"""
text = insert_before_once(
    text,
    "## Make main line\n",
    quick_example,
    "## Quick example",
    "Variation guide quick example",
)
text = replace_once(
    text,
    "When the selected move has siblings and is not currently preferred, the notation area shows **Make main line**.",
    "When the selected move has siblings and is not currently preferred, the notation area shows **Make main line**. Main-line moves display a status badge instead of a promotion button.",
    "Variation guide button states",
)
path.write_text(text, encoding="utf-8")
