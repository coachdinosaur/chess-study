from pathlib import Path
import re

VERSION = "20260724-bishop-presentation-v3"
LESSONS = Path("lessons")


def normalize_bishop_page_scripts() -> None:
    pages = sorted(LESSONS.glob("bishop-m*-lesson-*.html"))
    if len(pages) != 19:
        raise RuntimeError(f"Expected 19 Bishop lesson pages, found {len(pages)}")

    script_pattern = re.compile(
        r"\s*<script\s+[^>]*src=[\"'](?:\./)?lesson-presentation\.js(?:\?v=[^\"']*)?[\"'][^>]*></script>",
        re.I,
    )
    normalized = f'  <script src="lesson-presentation.js?v={VERSION}" defer></script>'

    added = 0
    updated = 0
    duplicates = 0

    for page in pages:
        text = page.read_text(encoding="utf-8")
        matches = list(script_pattern.finditer(text))
        if matches:
            first = matches[0]
            text = text[: first.start()] + "\n" + normalized + text[first.end() :]
            later = list(script_pattern.finditer(text))[1:]
            for match in reversed(later):
                text = text[: match.start()] + text[match.end() :]
                duplicates += 1
            updated += 1
        else:
            if "</body>" not in text:
                raise RuntimeError(f"Missing closing body tag in {page}")
            text = text.replace("</body>", normalized + "\n</body>", 1)
            added += 1
        page.write_text(text, encoding="utf-8")

    print(f"Normalized {len(pages)} Bishop pages: {added} added, {updated} updated, {duplicates} duplicate tags removed")


def patch_presenter() -> None:
    path = LESSONS / "lesson-presentation.js"
    text = path.read_text(encoding="utf-8")

    old_version = 'var VERSION = "20260724-bishop-presentation-v2";'
    if old_version not in text:
        raise RuntimeError("Presentation version marker not found")
    text = text.replace(old_version, f'var VERSION = "{VERSION}";', 1)

    helper_anchor = '''function textFrom(element) {
return element && element.textContent ? element.textContent.trim().replace(/\\s+/g, " ") : "";
}
'''
    if helper_anchor not in text:
        raise RuntimeError("textFrom helper anchor not found")

    helper_block = '''function textFrom(element) {
return element && element.textContent ? element.textContent.trim().replace(/\\s+/g, " ") : "";
}
function normalizedSceneText(value) {
return String(value || "").trim().toLowerCase().replace(/\\s+/g, " ");
}
function sceneAnalysisClone(scene) {
var clone = scene.cloneNode(true);
clone.querySelectorAll(
".module-nav, .no-print, .source-note, .fen-box, .lesson-nav-row, .teacher-board-panel, .teacher-board-toggle, [data-open-teacher-board], .presentation-coach-only, script, style"
).forEach(function (node) { node.remove(); });
return clone;
}
function sceneMediaSignature(scene) {
var parts = [];
scene.querySelectorAll("[data-fen]").forEach(function (node) {
var fen = normalizedSceneText(node.getAttribute("data-fen"));
if (fen) parts.push("fen:" + fen);
});
scene.querySelectorAll("img[src]").forEach(function (image) {
var src = normalizedSceneText(image.getAttribute("src"));
if (src) parts.push("img:" + src);
});
scene.querySelectorAll("svg[aria-label], canvas[aria-label], iframe[src]").forEach(function (node) {
var label = normalizedSceneText(node.getAttribute("aria-label") || node.getAttribute("src"));
if (label) parts.push(node.tagName.toLowerCase() + ":" + label);
});
return parts.join("|");
}
function sceneBodyText(scene) {
var clone = sceneAnalysisClone(scene);
clone.querySelectorAll(
"h1, h2, h3, .lesson-number, .number, .position-label, .position-meta, .eyebrow, .kicker, .section-kicker"
).forEach(function (node) { node.remove(); });
return normalizedSceneText(clone.textContent);
}
function sceneFingerprint(scene) {
var clone = sceneAnalysisClone(scene);
return normalizedSceneText(clone.textContent) + "|" + sceneMediaSignature(scene);
}
function meaningfulScene(scene) {
if (!scene) return false;
if (sceneMediaSignature(scene)) return true;
return sceneBodyText(scene).length >= 24;
}
function finalizeScenes(items) {
var seen = new Set();
return uniqueElements(items).filter(visibleScene).filter(function (scene) {
if (!meaningfulScene(scene)) return false;
var fingerprint = sceneFingerprint(scene);
if (!fingerprint || seen.has(fingerprint)) return false;
seen.add(fingerprint);
return true;
});
}
function titlesEquivalent(first, second) {
var a = normalizedSceneText(first);
var b = normalizedSceneText(second);
if (!a || !b) return false;
if (a === b) return true;
var shorter = a.length <= b.length ? a : b;
var longer = a.length > b.length ? a : b;
return shorter.length >= 12 && longer.indexOf(shorter) !== -1;
}
function addBishopCardContext(card, parentTitle, cardTitle) {
if (!parentTitle || titlesEquivalent(parentTitle, cardTitle)) return;
if (card.querySelector(":scope > .presentation-generated-context")) return;
var context = document.createElement("div");
context.className = "presentation-generated-context";
var contextTitle = document.createElement("h2");
contextTitle.textContent = parentTitle;
context.appendChild(contextTitle);
card.insertBefore(context, card.firstChild);
}
'''
    text = text.replace(helper_anchor, helper_block, 1)

    collector_pattern = re.compile(
        r"function collectBishopScenes\(\) \{.*?\n\}\nfunction collectStandardScenes\(\)",
        re.S,
    )
    collector_block = '''function bishopPositionCards(section) {
return scopedQuery(
section,
"> .position, > .exercise-grid > .position, > .exercise-grid > .position-card, > .position-grid > .position-card, > .activity-grid > .position-card, > .answer-grid > .answer-card"
);
}
function collectBishopScenes() {
var result = [];
var main = document.querySelector("main.lesson-page") || document.querySelector("main") || document.body;
var hero = document.querySelector(".hero");
if (hero) result.push(hero);
scopedQuery(main, "> section, > article").forEach(function (section) {
if (section === hero || section.matches(".module-nav, .no-print")) return;
var sectionLike = section.classList.contains("lesson") || section.classList.contains("lesson-section");
if (!sectionLike) {
result.push(section);
return;
}
var cards = bishopPositionCards(section);
if (cards.length <= 1) {
result.push(section);
return;
}
var parentTitle = sectionHeading(section);
cards.forEach(function (card, index) {
var cardTitle = textFrom(card.querySelector(".position-label, .position-head h3, h3"));
card.dataset.presentationTitle = parentTitle
? parentTitle + (cardTitle && !titlesEquivalent(parentTitle, cardTitle) ? " · " + cardTitle : " · Position " + (index + 1))
: cardTitle || "Position " + (index + 1);
addBishopCardContext(card, parentTitle, cardTitle);
result.push(card);
});
});
return finalizeScenes(result);
}
function collectStandardScenes()'''
    text, count = collector_pattern.subn(collector_block, text, count=1)
    if count != 1:
        raise RuntimeError(f"Expected one Bishop collector block, replaced {count}")

    old_collect = '''function collectScenes() {
if (bishopLesson && document.querySelector(".lesson")) return collectBishopScenes();
return collectStandardScenes();
}
'''
    new_collect = '''function collectScenes() {
if (bishopLesson) return collectBishopScenes();
return collectStandardScenes();
}
'''
    if old_collect not in text:
        raise RuntimeError("collectScenes block not found")
    text = text.replace(old_collect, new_collect, 1)

    old_grid = 'if (scene.matches(".weakness-grid, .question-grid, .process-grid, .objective-grid, .checklist")) {'
    new_grid = 'if (scene.matches(".weakness-grid, .question-grid, .process-grid, .objective-grid, .principle-grid, .method-grid, .concept-grid, .value-grid, .remember-list, .checklist")) {'
    if old_grid not in text:
        raise RuntimeError("Grid-scene selector not found")
    text = text.replace(old_grid, new_grid, 1)

    old_launch = '''function addLaunchButton() {
launchButton = document.createElement("button");
'''
    new_launch = '''function addLaunchButton() {
var existingLaunch = document.querySelector(".lesson-present-launch");
if (existingLaunch) {
launchButton = existingLaunch;
return;
}
launchButton = document.createElement("button");
'''
    if old_launch not in text:
        raise RuntimeError("addLaunchButton block not found")
    text = text.replace(old_launch, new_launch, 1)

    path.write_text(text, encoding="utf-8")


def validate() -> None:
    pages = sorted(LESSONS.glob("bishop-m*-lesson-*.html"))
    tag_pattern = re.compile(
        r'<script\s+[^>]*src=["\'](?:\./)?lesson-presentation\.js\?v='
        + re.escape(VERSION)
        + r'["\'][^>]*></script>',
        re.I,
    )
    for page in pages:
        text = page.read_text(encoding="utf-8")
        matches = tag_pattern.findall(text)
        if len(matches) != 1:
            raise RuntimeError(f"{page}: expected one v3 presentation script, found {len(matches)}")

    presenter = (LESSONS / "lesson-presentation.js").read_text(encoding="utf-8")
    required = [
        f'var VERSION = "{VERSION}";',
        "if (bishopLesson) return collectBishopScenes();",
        "if (cards.length <= 1)",
        "return finalizeScenes(result);",
        "function meaningfulScene(scene)",
        "function sceneFingerprint(scene)",
        "function titlesEquivalent(first, second)",
    ]
    for marker in required:
        if marker not in presenter:
            raise RuntimeError(f"Missing presenter marker: {marker}")

    print("Validated presenter and all 19 Bishop lesson loader tags")


if __name__ == "__main__":
    normalize_bishop_page_scripts()
    patch_presenter()
    validate()
