from __future__ import annotations

import re
from pathlib import Path


BRANCH_VERSION = "20260724-bishop-presentation-v4"
HEADER_VERSION = "20260724-unified-header-v2"


def patch_presentation_script() -> None:
    path = Path("lessons/lesson-presentation.js")
    text = path.read_text(encoding="utf-8")
    text = text.replace(
        'var VERSION = "20260724-bishop-presentation-v3";',
        f'var VERSION = "{BRANCH_VERSION}";',
    )

    old = """function scopedQuery(root, selector) {
if (!root) return [];
try {
return Array.prototype.slice.call(root.querySelectorAll(\":scope \" + selector));
} catch (error) {
return Array.prototype.slice.call(root.querySelectorAll(selector.replace(/(^|,)\\s*>\\s*/g, \"$1 \")));
}
}
"""
    new = """function scopedQuery(root, selector) {
if (!root) return [];
var selectors = String(selector || \"\")
.split(\",\")
.map(function (part) { return part.trim(); })
.filter(Boolean);
if (!selectors.length) return [];
var scopedSelector = selectors.map(function (part) {
return part.indexOf(\":scope\") === 0 ? part : \":scope \" + part;
}).join(\", \" );
try {
return Array.prototype.slice.call(root.querySelectorAll(scopedSelector));
} catch (error) {
var attribute = \"data-presentation-scope-token\";
var previous = root.getAttribute(attribute);
var token = \"scope\" + Math.random().toString(36).slice(2);
root.setAttribute(attribute, token);
try {
var fallbackSelector = selectors.map(function (part) {
return \"[\" + attribute + '=\\\"' + token + '\\\"] \" + part;
}).join(\", \" );
return Array.prototype.slice.call(document.querySelectorAll(fallbackSelector));
} finally {
if (previous === null) root.removeAttribute(attribute);
else root.setAttribute(attribute, previous);
}
}
}
"""
    if old not in text:
        raise RuntimeError("Expected scopedQuery implementation was not found")
    path.write_text(text.replace(old, new), encoding="utf-8")


def bishop_filenames() -> list[str]:
    text = Path("lessons/bishop-index.html").read_text(encoding="utf-8")
    return sorted(
        set(
            re.findall(
                r'''["'](bishop-(?:m\d+-)?lesson-[^"']+\.html)["']''',
                text,
            )
        )
    )


def patch_bishop_pages() -> list[str]:
    files = bishop_filenames()
    if len(files) != 19:
        raise RuntimeError(f"Expected 19 Bishop lessons, found {len(files)}")

    for filename in files:
        path = Path("lessons") / filename
        html = path.read_text(encoding="utf-8")
        html = re.sub(
            r'''lesson-presentation\.js\?v=[^"']+''',
            f"lesson-presentation.js?v={BRANCH_VERSION}",
            html,
        )
        if "endgame-lesson.css" not in html and "lesson-header.css" not in html:
            link = f'<link rel="stylesheet" href="lesson-header.css?v={HEADER_VERSION}">'
            marker = '<link rel="stylesheet" href="pawn-teacher-board.css'
            if marker in html:
                html = html.replace(marker, link + "\n  " + marker, 1)
            else:
                html = html.replace("</head>", "  " + link + "\n</head>", 1)
        path.write_text(html, encoding="utf-8")
    return files


def patch_header_cache_keys() -> None:
    for filename in ("lessons/endgame-lesson.css", "lessons/advanced-pawn-lesson.css"):
        path = Path(filename)
        text = path.read_text(encoding="utf-8")
        text = text.replace(
            "lesson-header.css?v=20260724-unified-header-v1",
            f"lesson-header.css?v={HEADER_VERSION}",
        )
        path.write_text(text, encoding="utf-8")


def patch_audit_definition() -> None:
    path = Path(".github/scripts/audit_bishop_presentation.py")
    text = path.read_text(encoding="utf-8")
    text = text.replace(
        '"module1_without_endgame_css": [',
        '"module1_without_unified_header": [',
    )
    text = text.replace(
        'and not any("endgame-lesson.css" in (href or "") for href in item["header"]["stylesheets"])',
        'and not any(("endgame-lesson.css" in (href or "") or "lesson-header.css" in (href or "")) for href in item["header"]["stylesheets"])',
    )
    path.write_text(text, encoding="utf-8")


def main() -> None:
    patch_presentation_script()
    files = patch_bishop_pages()
    patch_header_cache_keys()
    patch_audit_definition()
    print(f"Patched {len(files)} Bishop lesson pages and the shared presenter.")


if __name__ == "__main__":
    main()
