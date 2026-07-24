(function () {
"use strict";
if (window.__LESSON_PRESENTATION_PHASE_1A__) return;
window.__LESSON_PRESENTATION_PHASE_1A__ = true;
window.__LESSON_PRESENTATION_PHASE_2__ = true;
var VERSION = "20260724-bishop-presentation-v3";
var scriptUrl = document.currentScript && document.currentScript.src
? document.currentScript.src
: new URL("lesson-presentation.js", window.location.href).href;
var scenes = [];
var activeIndex = 0;
var previousScrollY = 0;
var toolbar = null;
var counter = null;
var sceneLabel = null;
var progressFill = null;
var launchButton = null;
var nativeFullscreenRequested = false;
var bishopLesson = false;
function loadStylesheet() {
if (document.querySelector('link[data-lesson-presentation-style]')) return;
var link = document.createElement("link");
link.rel = "stylesheet";
link.href = new URL("lesson-presentation.css?v=" + VERSION, scriptUrl).href;
link.setAttribute("data-lesson-presentation-style", VERSION);
document.head.appendChild(link);
}
function fixPawn10ChessmenOverview() {
if (!/(?:^|\/)pawn-10-the-chessmen\.html$/i.test(window.location.pathname)) return;
var svg = document.querySelector('#all-chessmen .board-shell svg[aria-label="All 32 chessmen in a game of chess"]');
if (!svg || svg.dataset.chessmenLayoutFixed === "true") return;
var images = Array.prototype.slice.call(svg.querySelectorAll("image"));
if (images.length < 32) return;
[
{ start: 0, end: 8, y: 91 },
{ start: 8, end: 16, y: 126 },
{ start: 16, end: 24, y: 207 },
{ start: 24, end: 32, y: 242 }
].forEach(function (row) {
for (var index = row.start; index < row.end; index += 1) {
images[index].setAttribute("y", String(row.y));
images[index].setAttribute("width", "28");
images[index].setAttribute("height", "28");
}
});
svg.querySelectorAll("text").forEach(function (text) {
var label = (text.textContent || "").trim();
if (label === "Black has 16") text.setAttribute("y", "82");
if (label === "White has 16") text.setAttribute("y", "198");
});
svg.dataset.chessmenLayoutFixed = "true";
}
function isBishopLessonPage() {
if (/(?:^|\/)bishop(?:-m\d+)?-[^/]+\.html$/i.test(window.location.pathname)) return true;
var label = document.querySelector(".index-brand-label");
return Boolean(label && /bishop level/i.test(label.textContent || ""));
}
function scopedQuery(root, selector) {
if (!root) return [];
try {
return Array.prototype.slice.call(root.querySelectorAll(":scope " + selector));
} catch (error) {
return Array.prototype.slice.call(root.querySelectorAll(selector.replace(/(^|,)\s*>\s*/g, "$1 ")));
}
}
function uniqueElements(items) {
var seen = new Set();
return items.filter(function (item) {
if (!item || seen.has(item)) return false;
seen.add(item);
return true;
});
}
function visibleScene(scene) {
return Boolean(
scene &&
!scene.classList.contains("no-print") &&
!scene.matches(".module-nav, .teacher-board-panel, .lesson-presentation-toolbar") &&
scene.offsetParent !== null
);
}
function textFrom(element) {
return element && element.textContent ? element.textContent.trim().replace(/\s+/g, " ") : "";
}
function normalizedSceneText(value) {
return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
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
function sectionHeading(section) {
return textFrom(section && section.querySelector(".lesson-head h1, .lesson-head h2, .lesson-head h3, h1, h2, h3"));
}
function bishopPositionCards(section) {
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
function collectStandardScenes() {
var result = [];
var hero = document.querySelector(".hero");
if (hero && !hero.closest(".lesson-section")) result.push(hero);
document.querySelectorAll(".lesson-section").forEach(function (section) {
var cards = scopedQuery(section, "> .position-grid > .position-card, > .activity-grid > .position-card, > .answer-grid > .answer-card");
if (cards.length > 1) {
cards.forEach(function (card) { result.push(card); });
} else {
result.push(section);
}
});
if (!result.length) {
document.querySelectorAll("main > section, main > article").forEach(function (section) {
result.push(section);
});
}
return uniqueElements(result).filter(visibleScene);
}
function collectScenes() {
if (bishopLesson) return collectBishopScenes();
return collectStandardScenes();
}
function sceneTitle(scene, index) {
var preset = scene.dataset.presentationTitle;
if (preset) return preset;
var heading = scene.querySelector("h1, h2, h3");
if (heading && textFrom(heading)) return textFrom(heading);
var positionLabel = scene.querySelector(".position-label, .position-meta");
if (positionLabel && textFrom(positionLabel)) return textFrom(positionLabel);
var ariaLabel = scene.getAttribute("aria-label");
if (ariaLabel) return ariaLabel;
if (scene.matches(".weakness-grid")) return "Core weakness questions";
if (scene.matches(".question-grid")) return "Core calculation questions";
if (scene.matches(".process-grid")) return "Calculation process overview";
if (scene.matches(".checklist")) return "Lesson checklist";
return "Lesson section " + (index + 1);
}
function markCoachOnlyNotes(scene) {
scene.querySelectorAll(".no-position, .accuracy-note, [data-coach-note]").forEach(function (note) {
var text = (note.textContent || "").trim().toLowerCase();
if (
note.hasAttribute("data-coach-note") ||
text.indexOf("source note:") === 0 ||
text.indexOf("source correction:") === 0
) {
note.classList.add("presentation-coach-only");
}
});
}
function prepareScene(scene, index) {
scene.classList.add("presentation-scene");
if (bishopLesson) scene.classList.add("presentation-bishop-scene");
if (
scene.matches(".position, .position-card, .answer-card") ||
scene.querySelector(".position-body, .board-and-notes")
) {
scene.classList.add("presentation-position-scene");
}
if (scene.querySelector(".board, .chessboard, .board-grid, .board-iframe")) {
scene.classList.add("presentation-board-scene");
}
if (
bishopLesson &&
scene.matches(".position") &&
!scene.querySelector(".position-body") &&
scopedQuery(scene, "> .diagram").length
) {
scene.classList.add("presentation-compact-position-scene");
}
if (scene.matches(".weakness-grid, .question-grid, .process-grid, .objective-grid, .principle-grid, .method-grid, .concept-grid, .value-grid, .remember-list, .checklist")) {
scene.classList.add("presentation-grid-scene");
}
scene.dataset.presentationIndex = String(index);
scene.dataset.presentationTitle = sceneTitle(scene, index);
scene.setAttribute("aria-hidden", "false");
scene.setAttribute("tabindex", "-1");
markCoachOnlyNotes(scene);
scene.querySelectorAll("[data-presentation-reveal], .presentation-reveal").forEach(function (target) {
target.classList.add("presentation-reveal-target");
target.dataset.presentationRevealed = "false";
});
}
function createButton(label, action, shortcut) {
var button = document.createElement("button");
button.type = "button";
button.className = "lesson-presentation-control";
button.dataset.presentationAction = action;
button.textContent = label;
if (shortcut) button.title = label + " (" + shortcut + ")";
return button;
}
function createToolbar() {
toolbar = document.createElement("div");
toolbar.className = "lesson-presentation-toolbar no-print";
toolbar.setAttribute("role", "toolbar");
toolbar.setAttribute("aria-label", "Lesson presentation controls");
var status = document.createElement("div");
status.className = "lesson-presentation-status";
sceneLabel = document.createElement("strong");
sceneLabel.className = "lesson-presentation-scene-label";
counter = document.createElement("span");
counter.className = "lesson-presentation-counter";
var progress = document.createElement("span");
progress.className = "lesson-presentation-progress";
progress.setAttribute("aria-hidden", "true");
progressFill = document.createElement("span");
progressFill.className = "lesson-presentation-progress-fill";
progress.appendChild(progressFill);
status.appendChild(sceneLabel);
status.appendChild(counter);
status.appendChild(progress);
var controls = document.createElement("div");
controls.className = "lesson-presentation-controls";
controls.appendChild(createButton("← Previous", "previous", "←"));
controls.appendChild(createButton("Reveal", "reveal", "Space"));
controls.appendChild(createButton("Reset", "reset", "R"));
controls.appendChild(createButton("Next →", "next", "→"));
controls.appendChild(createButton("Exit", "exit", "Esc"));
toolbar.appendChild(status);
toolbar.appendChild(controls);
document.body.appendChild(toolbar);
toolbar.addEventListener("click", function (event) {
var button = event.target.closest("[data-presentation-action]");
if (!button) return;
var action = button.dataset.presentationAction;
if (action === "previous") showScene(activeIndex - 1);
if (action === "next") showScene(activeIndex + 1);
if (action === "reveal") {
if (!revealNext()) showScene(activeIndex + 1);
}
if (action === "reset") resetScene(scenes[activeIndex]);
if (action === "exit") exitPresentation();
});
}
function addLaunchButton() {
var existingLaunch = document.querySelector(".lesson-present-launch");
if (existingLaunch) {
launchButton = existingLaunch;
return;
}
launchButton = document.createElement("button");
launchButton.type = "button";
launchButton.className = "toolbar-link lesson-present-launch no-print";
launchButton.textContent = "Present Lesson";
launchButton.title = "Open the classroom presentation view";
launchButton.addEventListener("click", enterPresentation);
var actions = document.querySelector(".index-top-actions, .top-actions");
if (actions) {
actions.appendChild(launchButton);
} else {
launchButton.classList.add("lesson-present-launch-floating");
document.body.appendChild(launchButton);
}
}
function nearestSceneIndex() {
var bestIndex = 0;
var bestDistance = Infinity;
scenes.forEach(function (scene, index) {
var distance = Math.abs(scene.getBoundingClientRect().top - 96);
if (distance < bestDistance) {
bestDistance = distance;
bestIndex = index;
}
});
return bestIndex;
}
function sceneHasRevealableContent(scene) {
if (!scene) return false;
var hasClosedDetails = Array.prototype.slice.call(scene.querySelectorAll("details:not([open])"))
.some(function (details) { return !details.closest(".presentation-coach-only"); });
if (hasClosedDetails) return true;
return Boolean(scene.querySelector('.presentation-reveal-target[data-presentation-revealed="false"]'));
}
function updateToolbar() {
if (!toolbar || !scenes.length) return;
sceneLabel.textContent = scenes[activeIndex].dataset.presentationTitle || "Lesson";
counter.textContent = (activeIndex + 1) + " / " + scenes.length;
if (progressFill) progressFill.style.width = (((activeIndex + 1) / scenes.length) * 100).toFixed(2) + "%";
var previous = toolbar.querySelector('[data-presentation-action="previous"]');
var next = toolbar.querySelector('[data-presentation-action="next"]');
var reveal = toolbar.querySelector('[data-presentation-action="reveal"]');
previous.disabled = activeIndex <= 0;
next.disabled = activeIndex >= scenes.length - 1;
reveal.disabled = !sceneHasRevealableContent(scenes[activeIndex]);
}
function resetScene(scene) {
if (!scene) return;
scene.querySelectorAll("details[open]").forEach(function (details) { details.open = false; });
scene.querySelectorAll(".presentation-reveal-target").forEach(function (target) {
target.dataset.presentationRevealed = "false";
});
scene.querySelectorAll(".answer-btn.correct, .answer-btn.wrong").forEach(function (button) {
button.classList.remove("correct", "wrong");
});
scene.querySelectorAll("#quizResult, .quiz-result").forEach(function (result) { result.textContent = ""; });
scene.scrollTop = 0;
updateToolbar();
}
function revealNext() {
var scene = scenes[activeIndex];
if (!scene) return false;
var closedDetails = Array.prototype.slice.call(scene.querySelectorAll("details:not([open])"))
.filter(function (details) { return !details.closest(".presentation-coach-only"); });
if (closedDetails.length) {
closedDetails[0].open = true;
closedDetails[0].scrollIntoView({ behavior: "smooth", block: "center" });
updateToolbar();
return true;
}
var hiddenTarget = Array.prototype.slice.call(
scene.querySelectorAll('.presentation-reveal-target[data-presentation-revealed="false"]')
)[0];
if (hiddenTarget) {
hiddenTarget.dataset.presentationRevealed = "true";
hiddenTarget.scrollIntoView({ behavior: "smooth", block: "center" });
updateToolbar();
return true;
}
updateToolbar();
return false;
}
function refreshActiveScene(scene) {
if (!scene) return;
scene.scrollTop = 0;
window.requestAnimationFrame(function () {
window.dispatchEvent(new Event("resize"));
scene.querySelectorAll(".board-iframe").forEach(function (frame) {
frame.style.visibility = frame.style.visibility || "visible";
});
});
window.setTimeout(function () { window.dispatchEvent(new Event("resize")); }, 180);
}
function showScene(index) {
if (!scenes.length) return;
var nextIndex = Math.max(0, Math.min(scenes.length - 1, index));
scenes.forEach(function (scene, sceneIndex) {
var current = sceneIndex === nextIndex;
scene.classList.toggle("presentation-current", current);
scene.setAttribute("aria-hidden", current ? "false" : "true");
});
activeIndex = nextIndex;
updateToolbar();
refreshActiveScene(scenes[activeIndex]);
window.setTimeout(function () {
scenes[activeIndex].focus({ preventScroll: true });
}, 0);
}
function requestNativeFullscreen() {
if (!document.documentElement.requestFullscreen || document.fullscreenElement) return;
nativeFullscreenRequested = true;
var request = document.documentElement.requestFullscreen();
if (request && typeof request.catch === "function") {
request.catch(function () { nativeFullscreenRequested = false; });
}
}
function enterPresentation() {
if (!scenes.length || document.body.classList.contains("lesson-presentation-active")) return;
previousScrollY = window.scrollY;
activeIndex = nearestSceneIndex();
document.body.classList.add("lesson-presentation-active");
document.documentElement.classList.add("lesson-presentation-root-active");
showScene(activeIndex);
requestNativeFullscreen();
}
function exitPresentation() {
if (!document.body.classList.contains("lesson-presentation-active")) return;
document.body.classList.remove("lesson-presentation-active");
document.documentElement.classList.remove("lesson-presentation-root-active");
scenes.forEach(function (scene) {
scene.classList.remove("presentation-current");
scene.setAttribute("aria-hidden", "false");
});
if (nativeFullscreenRequested && document.fullscreenElement && document.exitFullscreen) {
var exit = document.exitFullscreen();
if (exit && typeof exit.catch === "function") exit.catch(function () {});
}
nativeFullscreenRequested = false;
window.scrollTo({ top: previousScrollY, behavior: "auto" });
window.dispatchEvent(new Event("resize"));
if (launchButton) launchButton.focus({ preventScroll: true });
}
function onFullscreenChange() {
if (
nativeFullscreenRequested &&
!document.fullscreenElement &&
document.body.classList.contains("lesson-presentation-active")
) {
nativeFullscreenRequested = false;
exitPresentation();
}
}
function isTypingTarget(target) {
if (!target) return false;
var tag = target.tagName;
return target.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}
function onKeyDown(event) {
if (!document.body.classList.contains("lesson-presentation-active")) return;
if (event.key === "Escape") {
event.preventDefault();
exitPresentation();
return;
}
if (isTypingTarget(event.target)) return;
if (event.target && event.target.closest && event.target.closest("button, a, summary")) return;
if (event.key === "ArrowRight" || event.key === "PageDown") {
event.preventDefault();
showScene(activeIndex + 1);
} else if (event.key === "ArrowLeft" || event.key === "PageUp") {
event.preventDefault();
showScene(activeIndex - 1);
} else if (event.key === " " || event.key === "Enter") {
event.preventDefault();
if (!revealNext()) showScene(activeIndex + 1);
} else if (event.key === "Home") {
event.preventDefault();
showScene(0);
} else if (event.key === "End") {
event.preventDefault();
showScene(scenes.length - 1);
} else if (event.key.toLowerCase() === "r") {
event.preventDefault();
resetScene(scenes[activeIndex]);
}
}
function init() {
if (!document.body || document.body.classList.contains("lesson-index-page")) return;
fixPawn10ChessmenOverview();
bishopLesson = isBishopLessonPage();
if (bishopLesson) document.body.classList.add("lesson-presentation-bishop-page");
loadStylesheet();
scenes = collectScenes();
if (!scenes.length) return;
scenes.forEach(prepareScene);
createToolbar();
addLaunchButton();
document.addEventListener("keydown", onKeyDown);
document.addEventListener("fullscreenchange", onFullscreenChange);
}
if (document.readyState === "loading") {
document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
init();
}
})();
