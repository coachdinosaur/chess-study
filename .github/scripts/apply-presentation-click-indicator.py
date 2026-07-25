from pathlib import Path
import re

VERSION = "20260725-presentation-click-pulse-v5"
JS_PATH = Path("lessons/lesson-presentation.js")
CSS_PATH = Path("lessons/lesson-presentation.css")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"Missing patch marker: {label}")
    return text.replace(old, new, 1)


js = JS_PATH.read_text(encoding="utf-8")
js = replace_once(
    js,
    '  if (window.__LESSON_PRESENTATION_V4__) return;\n'
    '  window.__LESSON_PRESENTATION_V4__ = true;\n\n'
    '  var VERSION = "20260724-bishop-presentation-v4";',
    '  if (window.__LESSON_PRESENTATION_V5__) return;\n'
    '  window.__LESSON_PRESENTATION_V5__ = true;\n\n'
    f'  var VERSION = "{VERSION}";',
    "presentation version",
)
js = replace_once(
    js,
    "  var bishopLesson = false;\n",
    "  var bishopLesson = false;\n  var iframePointerDocuments = new WeakSet();\n",
    "presentation variables",
)

click_functions = '''  function presentationIsActive() {
    return Boolean(document.body && document.body.classList.contains("lesson-presentation-active"));
  }

  function shouldIgnorePresentationPointer(target) {
    return Boolean(
      target &&
      target.closest &&
      target.closest(
        ".lesson-presentation-toolbar, .lesson-present-launch, " +
        ".teacher-board-panel, .teacher-board-toggle, [data-open-teacher-board]"
      )
    );
  }

  function showPresentationClickIndicator(clientX, clientY) {
    if (!presentationIsActive()) return;
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return;

    var indicators = document.querySelectorAll(".lesson-presentation-click-indicator");
    if (indicators.length >= 12 && indicators[0]) indicators[0].remove();

    var indicator = document.createElement("span");
    indicator.className = "lesson-presentation-click-indicator";
    indicator.setAttribute("aria-hidden", "true");
    indicator.style.left = clientX + "px";
    indicator.style.top = clientY + "px";
    document.body.appendChild(indicator);

    var removeIndicator = function () {
      if (indicator.parentNode) indicator.remove();
    };
    indicator.addEventListener("animationend", removeIndicator, { once: true });
    window.setTimeout(removeIndicator, 1100);
  }

  function validPresentationPointer(event) {
    if (!event || event.isPrimary === false) return false;
    return typeof event.button !== "number" || event.button === 0;
  }

  function onPresentationPointerDown(event) {
    if (!presentationIsActive() || !validPresentationPointer(event)) return;
    if (shouldIgnorePresentationPointer(event.target)) return;
    showPresentationClickIndicator(event.clientX, event.clientY);
  }

  function bindFramePointerIndicator(frame) {
    if (!frame || frame.dataset.presentationClickIndicatorBound === "true") return;
    frame.dataset.presentationClickIndicatorBound = "true";

    var bindDocument = function () {
      try {
        var frameDocument = frame.contentDocument;
        if (!frameDocument || iframePointerDocuments.has(frameDocument)) return;
        iframePointerDocuments.add(frameDocument);
        frameDocument.addEventListener("pointerdown", function (event) {
          if (!presentationIsActive() || !validPresentationPointer(event)) return;
          var rect = frame.getBoundingClientRect();
          var frameWindow = frame.contentWindow;
          var viewportWidth = frameWindow && frameWindow.innerWidth
            ? frameWindow.innerWidth
            : frame.clientWidth || rect.width;
          var viewportHeight = frameWindow && frameWindow.innerHeight
            ? frameWindow.innerHeight
            : frame.clientHeight || rect.height;
          var scaleX = viewportWidth ? rect.width / viewportWidth : 1;
          var scaleY = viewportHeight ? rect.height / viewportHeight : 1;
          showPresentationClickIndicator(
            rect.left + event.clientX * scaleX,
            rect.top + event.clientY * scaleY
          );
        }, true);
      } catch (error) {
        // Cross-origin frames cannot expose pointer events to the lesson page.
      }
    };

    frame.addEventListener("load", bindDocument);
    bindDocument();
  }

  function bindBoardFramePointerIndicators() {
    document.querySelectorAll("iframe").forEach(bindFramePointerIndicator);
  }

'''
js = replace_once(
    js,
    "  function requestNativeFullscreen() {\n",
    click_functions + "  function requestNativeFullscreen() {\n",
    "fullscreen function",
)
js = replace_once(
    js,
    '  function exitPresentation() {\n'
    '    if (!document.body.classList.contains("lesson-presentation-active")) return;\n'
    '    document.body.classList.remove("lesson-presentation-active");',
    '  function exitPresentation() {\n'
    '    if (!document.body.classList.contains("lesson-presentation-active")) return;\n'
    '    document.querySelectorAll(".lesson-presentation-click-indicator").forEach(function (indicator) {\n'
    '      indicator.remove();\n'
    '    });\n'
    '    document.body.classList.remove("lesson-presentation-active");',
    "exit presentation",
)
js = replace_once(
    js,
    '    createToolbar();\n'
    '    addLaunchButton();\n'
    '    document.addEventListener("keydown", onKeyDown);',
    '    createToolbar();\n'
    '    addLaunchButton();\n'
    '    document.addEventListener("pointerdown", onPresentationPointerDown, true);\n'
    '    bindBoardFramePointerIndicators();\n'
    '    document.addEventListener("keydown", onKeyDown);',
    "presentation init",
)
JS_PATH.write_text(js, encoding="utf-8")

css = CSS_PATH.read_text(encoding="utf-8")
css_marker = ".lesson-presentation-toolbar{\n  display:none;\n}\n"
click_css = '''.lesson-presentation-click-indicator{
  position:fixed;
  left:0;
  top:0;
  z-index:10019;
  width:3.7rem;
  height:3.7rem;
  pointer-events:none;
  border:.26rem solid #ffd166;
  border-radius:50%;
  opacity:0;
  transform:translate(-50%,-50%) scale(.18);
  box-shadow:0 0 0 .14rem rgba(4,8,10,.86),0 0 1.35rem rgba(255,209,102,.9);
  animation:lesson-presentation-click-pulse .72s cubic-bezier(.16,.84,.38,1) forwards;
}
.lesson-presentation-click-indicator::before{
  content:"";
  position:absolute;
  left:50%;
  top:50%;
  width:.66rem;
  height:.66rem;
  border:.13rem solid rgba(4,8,10,.88);
  border-radius:50%;
  background:#fff7d6;
  transform:translate(-50%,-50%);
  box-shadow:0 0 .45rem rgba(255,255,255,.95);
}
.lesson-presentation-click-indicator::after{
  content:"";
  position:absolute;
  inset:-.72rem;
  border:.12rem solid rgba(255,209,102,.68);
  border-radius:50%;
}
@keyframes lesson-presentation-click-pulse{
  0%{opacity:1;transform:translate(-50%,-50%) scale(.18)}
  38%{opacity:1;transform:translate(-50%,-50%) scale(.72)}
  100%{opacity:0;transform:translate(-50%,-50%) scale(1.28)}
}
@keyframes lesson-presentation-click-fade{
  0%,68%{opacity:1;transform:translate(-50%,-50%) scale(.82)}
  100%{opacity:0;transform:translate(-50%,-50%) scale(.9)}
}
@media (prefers-reduced-motion:reduce){
  .lesson-presentation-click-indicator{
    animation:lesson-presentation-click-fade .42s linear forwards;
  }
  .lesson-presentation-click-indicator::after{
    display:none;
  }
}
'''
css = replace_once(css, css_marker, css_marker + click_css, "presentation CSS")
css = replace_once(
    css,
    ".lesson-present-launch,.lesson-presentation-toolbar{\n    display:none !important;\n  }",
    ".lesson-present-launch,.lesson-presentation-toolbar,.lesson-presentation-click-indicator{\n    display:none !important;\n  }",
    "print styles",
)
CSS_PATH.write_text(css, encoding="utf-8")

js_pattern = re.compile(r"lesson-presentation\.js(?:\?v=[^\"']*)?")
css_pattern = re.compile(r"lesson-presentation\.css(?:\?v=[^\"']*)?")
changed_pages = 0
for page in sorted(Path("lessons").glob("*.html")):
    text = page.read_text(encoding="utf-8")
    if "lesson-presentation.js" not in text and "lesson-presentation.css" not in text:
        continue
    updated = js_pattern.sub(f"lesson-presentation.js?v={VERSION}", text)
    updated = css_pattern.sub(f"lesson-presentation.css?v={VERSION}", updated)
    if updated != text:
        page.write_text(updated, encoding="utf-8")
        changed_pages += 1

if changed_pages == 0:
    raise SystemExit("No lesson presentation asset references were updated")
print(f"Updated presentation asset versions in {changed_pages} lesson pages")
