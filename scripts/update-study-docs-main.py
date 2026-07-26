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


# README.md
path = Path("README.md")
text = path.read_text(encoding="utf-8")
text = replace_once(
    text,
    "- Record a lesson as a branching move tree with main lines and variations.",
    "- Record a lesson as a recursive move tree: the first continuation becomes the main line, later moves remain variations, and any selected side line can be promoted explicitly with **Make main line**.",
    "README lesson-tree feature",
)
text = replace_once(
    text,
    "- Review CSV/XLSX position sets in the Lesson Position Builder.",
    "- Review CSV/XLSX position sets in the Position Set Builder and open or convert them into Study and Analysis lessons.",
    "README Position Set feature",
)
text = replace_once(
    text,
    "| Study | Board and notation with the tools panel collapsed |",
    "| Study | Lesson review, main-line selection, nested variations, comments, and practice with the tools panel collapsed |",
    "README Study workspace row",
)
text = replace_once(
    text,
    "| Lessons | CSV/XLSX Lesson Position Builder |",
    "| Position Sets | CSV/XLSX Position Set Builder and lesson-conversion workflow |",
    "README Position Sets workspace row",
)
study_section = """## Study main lines, variations, and comments

Study and Analysis use the same recursive lesson tree. Every position has at most one preferred continuation:

- the first recorded move becomes the main line from that position;
- later new moves from the same position are stored as variations;
- clicking, replaying, or navigating to a variation does not promote it;
- selecting a side variation exposes **Make main line**;
- promotion changes only that immediate branch point and preserves the former main continuation as a variation;
- the same behavior applies inside variations, so sub-variations can be nested to any practical depth.

The on-screen notation displays comments as styled prose and encloses variation groups in parentheses. Exported PGN preserves the standard distinction: `{comment}` is a comment and `(moves)` is a variation.

See [LESSON_VARIATIONS_AND_MAIN_LINES.md](LESSON_VARIATIONS_AND_MAIN_LINES.md) for the full workflow, persistence rules, PGN behavior, and validation checklist.

"""
text = insert_before_once(
    text,
    "## Board interaction\n",
    study_section,
    "## Study main lines, variations, and comments",
    "README Study section",
)
text = replace_once(
    text,
    "- move tree and selected branches",
    "- recursive move tree, nested variations, and the selected main-line continuation at each branch point",
    "README lesson JSON fields",
)
text = replace_once(
    text,
    "- main lines and nested variations",
    "- main lines, variations, and recursively nested sub-variations",
    "README PGN capabilities",
)
text = replace_once(
    text,
    "Use JSON when complete application state matters. Use PGN for chess notation interchange.",
    "Use JSON when complete application state matters. Use PGN for chess notation interchange. See [LESSON_DATA_ARCHITECTURE.md](LESSON_DATA_ARCHITECTURE.md) for the shared lesson model and [LESSON_POSITION_INTEROPERABILITY.md](LESSON_POSITION_INTEROPERABILITY.md) for Position Set conversion rules.",
    "README lesson documentation links",
)
text = replace_once(
    text,
    "Puzzle settings, queue, history, theme, AI endpoint, and Lesson Position Builder state use separate localStorage keys.",
    "Puzzle settings, queue, history, theme, AI endpoint, and Position Set Builder state use separate localStorage keys.",
    "README browser draft terminology",
)
path.write_text(text, encoding="utf-8")


# ARCHITECTURE.md
path = Path("ARCHITECTURE.md")
text = path.read_text(encoding="utf-8")
text = replace_once(
    text,
    "    - `lesson-position-builder.mjs`\n    - `text-normalization.mjs`",
    "    - `lesson-position-builder.mjs`\n    - `lesson-model.mjs`, `lesson-migrations.mjs`, and `lesson-position-adapter.mjs`\n    - `lesson-position-interoperability-core.mjs`, `lesson-position-interoperability-export-guard.mjs`, and `lesson-position-interoperability.mjs`\n    - `lesson-variation-tree.mjs`\n    - `text-normalization.mjs`",
    "Architecture supporting modules",
)
text = replace_once(
    text,
    "├── lesson-position-builder.mjs\n├── text-normalization.mjs",
    "├── lesson-position-builder.mjs\n├── lesson-model.mjs\n├── lesson-migrations.mjs\n├── lesson-position-adapter.mjs\n├── lesson-position-interoperability-core.mjs\n├── lesson-position-interoperability-export-guard.mjs\n├── lesson-position-interoperability.mjs\n├── lesson-variation-tree.mjs\n├── text-normalization.mjs",
    "Architecture repository map",
)
text = replace_once(
    text,
    "    ├── lesson-position-builder.mjs\n    └── text-normalization.mjs",
    "    ├── lesson-position-builder.mjs\n    ├── lesson-model.mjs / lesson-migrations.mjs\n    ├── lesson-position-adapter.mjs\n    ├── lesson-position-interoperability-core.mjs\n    ├── lesson-position-interoperability-export-guard.mjs\n    ├── lesson-position-interoperability.mjs\n    ├── lesson-variation-tree.mjs\n    └── text-normalization.mjs",
    "Architecture module graph",
)
text = replace_once(
    text,
    "| `lesson-position-builder.mjs` | CSV/XLSX import, field normalization, position-set CRUD, persistence, and builder UI |\n| `text-normalization.mjs` | Unicode repair, punctuation normalization, and editable-text cleanup |",
    "| `lesson-position-builder.mjs` | CSV/XLSX import, field normalization, position-set CRUD, persistence, and builder UI |\n| `lesson-model.mjs` / `lesson-migrations.mjs` | Versioned lesson contracts, normalization, stable IDs, compatibility detection, and non-destructive migration |\n| `lesson-position-adapter.mjs` | Converts rich lesson roots or selected nodes to flat positions and converts position sets into lesson documents/books |\n| `lesson-position-interoperability-core.mjs` / `lesson-position-interoperability.mjs` | Connect Position Sets to Study, Analysis, lesson-book persistence, optional spreadsheet metadata, and conversion actions |\n| `lesson-position-interoperability-export-guard.mjs` | Preserves validation before metadata-aware CSV/XLSX export |\n| `lesson-variation-tree.mjs` | Preferred-child lookup, first-child main-line insertion, non-promoting variation traversal, explicit promotion, and recursive variation-depth semantics |\n| `text-normalization.mjs` | Unicode repair, punctuation normalization, and editable-text cleanup |",
    "Architecture module responsibilities",
)
text = replace_once(
    text,
    "| Study | `TAB_STUDY` | Board and notation with tools collapsed |",
    "| Study | `TAB_STUDY` | Lesson review, explicit main-line selection, recursive variations, comments, and practice with tools collapsed |",
    "Architecture Study tab",
)
text = replace_once(
    text,
    "| Lessons | `TAB_LESSONS` | Lesson Position Builder |",
    "| Position Sets | `TAB_LESSONS` | CSV/XLSX Position Set Builder and rich-lesson conversion actions |",
    "Architecture Position Sets tab",
)
text = replace_once(
    text,
    "- Entering Lessons opens the builder controller.\n- Leaving Lessons closes the builder.",
    "- Entering Position Sets (`TAB_LESSONS`) opens the builder controller.\n- Leaving Position Sets closes the builder.",
    "Architecture tab transitions",
)
old_tree = """Important operations include:

- jumping to a node
- reconstructing the selected root-to-node path
- following `selectedChildId` for the displayed continuation
- adding a variation without flattening existing branches
- validating loaded trees for reachability, legality, FEN consistency, cycles, and parent/child integrity

`pgn.mjs` converts this structure to and from PGN variations and comments.
"""
new_tree = """Important operations include:

- jumping to a node without rewriting the saved preferred continuation;
- reconstructing the selected root-to-node path;
- following `selectedChildId` for forward navigation and selected-line practice;
- recording the first child of a position as its main line;
- adding later children as side variations without flattening or replacing existing branches;
- explicitly promoting a selected side move with **Make main line**;
- applying the same branch rule recursively inside variations and sub-variations;
- validating loaded trees for reachability, legality, FEN consistency, cycles, and parent/child integrity.

`lesson-variation-tree.mjs` owns preferred-continuation semantics. A valid `selectedChildId` is authoritative; otherwise the first valid child is the fallback. Ordinary Study/Analysis navigation does not mutate it. Explicit promotion updates only the selected move's immediate parent, so descendants and unrelated branch choices remain intact. Play mode keeps its separate active-game-line behavior.

`pgn.mjs` converts the tree to and from standards-compliant PGN. Comments use braces, variation sequences use parentheses, and recursive export suppresses the initial sibling scan inside a forced side line so a variation cannot rediscover its main-line sibling and recurse indefinitely.

See `LESSON_DATA_ARCHITECTURE.md`, `LESSON_POSITION_INTEROPERABILITY.md`, and `LESSON_VARIATIONS_AND_MAIN_LINES.md` for the versioned data contracts, Position Set bridge, and user-facing branch rules.
"""
text = replace_once(text, old_tree, new_tree, "Architecture lesson-tree behavior")
path.write_text(text, encoding="utf-8")
