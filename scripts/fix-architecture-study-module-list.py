from pathlib import Path
import re

path = Path("ARCHITECTURE.md")
text = path.read_text(encoding="utf-8")
marker = "    - `lesson-variation-tree.mjs`\n"
if marker not in text.split("3. **AI chess-help subsystem**", 1)[0]:
    pattern = re.compile(
        r"(?m)^(?P<indent>\s*)- `lesson-position-builder\.mjs`\r?\n(?P=indent)- `text-normalization\.mjs`$"
    )
    replacement = (
        "\\g<indent>- `lesson-position-builder.mjs`\n"
        "\\g<indent>- `lesson-model.mjs`, `lesson-migrations.mjs`, and `lesson-position-adapter.mjs`\n"
        "\\g<indent>- `lesson-position-interoperability-core.mjs`, `lesson-position-interoperability-export-guard.mjs`, and `lesson-position-interoperability.mjs`\n"
        "\\g<indent>- `lesson-variation-tree.mjs`\n"
        "\\g<indent>- `text-normalization.mjs`"
    )
    text, count = pattern.subn(replacement, text, count=1)
    if count != 1:
        raise SystemExit(f"Supporting module list: expected one match, found {count}")
path.write_text(text, encoding="utf-8")
