(function () {
  "use strict";

  if (window.__LESSON_PRESENTATION_V5__) return;
  window.__LESSON_PRESENTATION_V5__ = true;

  var VERSION = "20260725-presentation-click-pulse-v5";
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
  var iframePointerDocuments = new WeakSet();

  function assetUrl(filename) {
    return new URL(filename, scriptUrl).href;
  }

  function loadStylesheet() {
    if (document.querySelector('link[data-lesson-presentation-style]')) return;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = assetUrl("lesson-presentation.css?v=" + VERSION);
    link.setAttribute("data-lesson-presentation-style", VERSION);
    document.head.appendChild(link);
  }

  function isBishopLessonPage() {
    if (/(?:^|\/)bishop(?:-m\d+)?-[^/]+\.html$/i.test(window.location.pathname)) return true;
    var label = document.querySelector(".index-brand-label");
    return Boolean(label && /bishop level/i.test(label.textContent || ""));
  }

  function ensureUnifiedBishopHeader() {
    if (!bishopLesson) return;
    if (document.querySelector('link[href*="endgame-lesson.css"], link[href*="lesson-header.css"]')) return;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = assetUrl("lesson-header.css?v=20260724-unified-header-v2");
    link.setAttribute("data-unified-lesson-header", "v2");
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

  function directMatches(root, selectors) {
    if (!root) return [];
    var items = [];
    selectors.forEach(function (selector) {
      try {
        root.querySelectorAll(":scope " + selector).forEach(function (node) {
          items.push(node);
        });
      } catch (error) {
        root.querySelectorAll(selector.replace(/^>\s*/, "")).forEach(function (node) {
          if (node.parentElement === root) items.push(node);
        });
      }
    });
    return uniqueElements(items);
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
    return element && element.textContent
      ? element.textContent.trim().replace(/\s+/g, " ")
      : "";
  }

  function normalizedText(value) {
    return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function analysisClone(scene) {
    var clone = scene.cloneNode(true);
    clone.querySelectorAll(
      ".module-nav, .no-print, .source-note, .fen-box, .lesson-nav-row, " +
      ".teacher-board-panel, .teacher-board-toggle, [data-open-teacher-board], " +
      ".presentation-coach-only, script, style"
    ).forEach(function (node) {
      node.remove();
    });
    return clone;
  }

  function mediaSignature(scene) {
    var parts = [];
    scene.querySelectorAll("[data-fen]").forEach(function (node) {
      var fen = normalizedText(node.getAttribute("data-fen"));
      if (fen) parts.push("fen:" + fen);
    });
    scene.querySelectorAll("img[src]").forEach(function (image) {
      var src = normalizedText(image.getAttribute("src"));
      if (src) parts.push("img:" + src);
    });
    scene.querySelectorAll("svg[aria-label], canvas[aria-label], iframe[src]").forEach(function (node) {
      var value = normalizedText(node.getAttribute("aria-label") || node.getAttribute("src"));
      if (value) parts.push(node.tagName.toLowerCase() + ":" + value);
    });
    return parts.join("|");
  }

  function bodyText(scene) {
    var clone = analysisClone(scene);
    clone.querySelectorAll(
      "h1, h2, h3, .lesson-number, .number, .position-label, .position-meta, " +
      ".eyebrow, .kicker, .section-kicker"
    ).forEach(function (node) {
      node.remove();
    });
    return normalizedText(clone.textContent);
  }

  function fingerprint(scene) {
    var clone = analysisClone(scene);
    return normalizedText(clone.textContent) + "|" + mediaSignature(scene);
  }

  function meaningfulScene(scene) {
    if (!scene) return false;
    if (mediaSignature(scene)) return true;
    return bodyText(scene).length >= 24;
  }

  function finalizeScenes(items) {
    var seen = new Set();
    return uniqueElements(items)
      .filter(visibleScene)
      .filter(function (scene) {
        if (!meaningfulScene(scene)) return false;
        var key = fingerprint(scene);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function titlesEquivalent(first, second) {
    var a = normalizedText(first);
    var b = normalizedText(second);
    if (!a || !b) return false;
    if (a === b) return true;
    var shorter = a.length <= b.length ? a : b;
    var longer = a.length > b.length ? a : b;
    return shorter.length >= 12 && longer.indexOf(shorter) !== -1;
  }

  function sectionHeading(section) {
    return textFrom(
      section && section.querySelector(
        ":scope > .lesson-head h1, :scope > .lesson-head h2, :scope > .lesson-head h3, " +
        ":scope > .section-head h1, :scope > .section-head h2, :scope > .section-head h3, " +
        ":scope > h1, :scope > h2, :scope > h3"
      )
    );
  }

  function addPositionContext(card, parentTitle, cardTitle, index) {
    if (!parentTitle || titlesEquivalent(parentTitle, cardTitle)) return;
    if (card.querySelector(":scope > .presentation-generated-context")) return;
    var context = document.createElement("div");
    context.className = "presentation-generated-context";
    var heading = document.createElement("h2");
    heading.textContent = parentTitle;
    context.appendChild(heading);
    card.insertBefore(context, card.firstChild);
    card.dataset.presentationTitle = parentTitle + " · " + (cardTitle || "Position " + (index + 1));
  }

  function bishopPositionCards(section) {
    return directMatches(section, [
      "> .position",
      "> .exercise-grid > .position",
      "> .exercise-grid > .position-card",
      "> .position-grid > .position-card",
      "> .activity-grid > .position-card",
      "> .answer-grid > .answer-card"
    ]);
  }

  function bishopContentRoot() {
    var nested = document.querySelector(".page > .layout > main, .lesson-page > .layout > main");
    if (nested) return nested;
    return document.querySelector("main.lesson-page") || document.querySelector("main") || document.body;
  }

  function collectBishopScenes() {
    var result = [];
    var hero = document.querySelector(".hero");
    if (hero) result.push(hero);

    var root = bishopContentRoot();
    var candidates = directMatches(root, ["> section", "> article"]);

    if (root.matches("main.lesson-page")) {
      directMatches(root, [
        "> .weakness-grid",
        "> .question-grid",
        "> .process-grid",
        "> .concept-grid",
        "> .master-grid",
        "> .defense-grid",
        "> .principle-grid",
        "> .method-grid",
        "> .value-grid",
        "> .remember-list",
        "> .checklist"
      ]).forEach(function (grid) {
        if (grid !== hero) result.push(grid);
      });
    }

    candidates.forEach(function (section) {
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
        var cardTitle = textFrom(card.querySelector(":scope > .position-label, :scope > .position-head h3, :scope > h3"));
        card.dataset.presentationTitle = parentTitle
          ? parentTitle + (cardTitle && !titlesEquivalent(parentTitle, cardTitle)
            ? " · " + cardTitle
            : " · Position " + (index + 1))
          : cardTitle || "Position " + (index + 1);
        addPositionContext(card, parentTitle, cardTitle, index);
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
      var cards = directMatches(section, [
        "> .position-grid > .position-card",
        "> .activity-grid > .position-card",
        "> .answer-grid > .answer-card"
      ]);
      if (cards.length > 1) {
        cards.forEach(function (card) {
          result.push(card);
        });
      } else {
        result.push(section);
      }
    });

    if (!result.length) {
      document.querySelectorAll("main > section, main > article").forEach(function (section) {
        result.push(section);
      });
    }
    return finalizeScenes(result);
  }

  function collectScenes() {
    return bishopLesson ? collectBishopScenes() : collectStandardScenes();
  }

  function sceneTitle(scene, index) {
    if (scene.dataset.presentationTitle) return scene.dataset.presentationTitle;
    var heading = scene.querySelector("h1, h2, h3");
    if (heading && textFrom(heading)) return textFrom(heading);
    var positionLabel = scene.querySelector(".position-label, .position-meta");
    if (positionLabel && textFrom(positionLabel)) return textFrom(positionLabel);
    var ariaLabel = scene.getAttribute("aria-label");
    if (ariaLabel) return ariaLabel;
    if (scene.matches(".weakness-grid")) return "Core weakness questions";
    if (scene.matches(".question-grid")) return "Core calculation questions";
    if (scene.matches(".process-grid")) return "Calculation process overview";
    if (scene.matches(".defense-grid")) return "Fundamental defensive methods";
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
      directMatches(scene, ["> .diagram"]).length
    ) {
      scene.classList.add("presentation-compact-position-scene");
    }
    if (scene.matches(
      ".weakness-grid, .question-grid, .process-grid, .objective-grid, .principle-grid, " +
      ".method-grid, .concept-grid, .value-grid, .remember-list, .checklist, .defense-grid"
    )) {
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
      if (action === "reveal" && !revealNext()) showScene(activeIndex + 1);
      if (action === "reset") resetScene(scenes[activeIndex]);
      if (action === "exit") exitPresentation();
    });
  }

  function addLaunchButton() {
    var existing = document.querySelector(".lesson-present-launch");
    if (existing) {
      launchButton = existing;
      if (!launchButton.dataset.presentationBound) {
        launchButton.addEventListener("click", enterPresentation);
        launchButton.dataset.presentationBound = "true";
      }
      return;
    }
    launchButton = document.createElement("button");
    launchButton.type = "button";
    launchButton.className = "toolbar-link lesson-present-launch no-print";
    launchButton.textContent = "Present Lesson";
    launchButton.title = "Open the classroom presentation view";
    launchButton.dataset.presentationBound = "true";
    launchButton.addEventListener("click", enterPresentation);
    var actions = document.querySelector(".index-top-actions, .top-actions");
    if (actions) actions.appendChild(launchButton);
    else {
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
    var closedDetails = Array.prototype.slice.call(scene.querySelectorAll("details:not([open])"))
      .some(function (details) {
        return !details.closest(".presentation-coach-only");
      });
    if (closedDetails) return true;
    return Boolean(scene.querySelector('.presentation-reveal-target[data-presentation-revealed="false"]'));
  }

  function updateToolbar() {
    if (!toolbar || !scenes.length) return;
    sceneLabel.textContent = scenes[activeIndex].dataset.presentationTitle || "Lesson";
    counter.textContent = (activeIndex + 1) + " / " + scenes.length;
    if (progressFill) {
      progressFill.style.width = (((activeIndex + 1) / scenes.length) * 100).toFixed(2) + "%";
    }
    toolbar.querySelector('[data-presentation-action="previous"]').disabled = activeIndex <= 0;
    toolbar.querySelector('[data-presentation-action="next"]').disabled = activeIndex >= scenes.length - 1;
    toolbar.querySelector('[data-presentation-action="reveal"]').disabled = !sceneHasRevealableContent(scenes[activeIndex]);
  }

  function resetScene(scene) {
    if (!scene) return;
    scene.querySelectorAll("details[open]").forEach(function (details) {
      details.open = false;
    });
    scene.querySelectorAll(".presentation-reveal-target").forEach(function (target) {
      target.dataset.presentationRevealed = "false";
    });
    scene.querySelectorAll(".answer-btn.correct, .answer-btn.wrong").forEach(function (button) {
      button.classList.remove("correct", "wrong");
    });
    scene.querySelectorAll("#quizResult, .quiz-result").forEach(function (result) {
      result.textContent = "";
    });
    scene.scrollTop = 0;
    updateToolbar();
  }

  function revealNext() {
    var scene = scenes[activeIndex];
    if (!scene) return false;
    var closed = Array.prototype.slice.call(scene.querySelectorAll("details:not([open])"))
      .filter(function (details) {
        return !details.closest(".presentation-coach-only");
      });
    if (closed.length) {
      closed[0].open = true;
      closed[0].scrollIntoView({ behavior: "smooth", block: "center" });
      updateToolbar();
      return true;
    }
    var hidden = scene.querySelector('.presentation-reveal-target[data-presentation-revealed="false"]');
    if (hidden) {
      hidden.dataset.presentationRevealed = "true";
      hidden.scrollIntoView({ behavior: "smooth", block: "center" });
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
    window.setTimeout(function () {
      window.dispatchEvent(new Event("resize"));
    }, 180);
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

  function presentationIsActive() {
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

  function requestNativeFullscreen() {
    if (!document.documentElement.requestFullscreen || document.fullscreenElement) return;
    nativeFullscreenRequested = true;
    var request = document.documentElement.requestFullscreen();
    if (request && typeof request.catch === "function") {
      request.catch(function () {
        nativeFullscreenRequested = false;
      });
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
    document.querySelectorAll(".lesson-presentation-click-indicator").forEach(function (indicator) {
      indicator.remove();
    });
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
    ensureUnifiedBishopHeader();
    loadStylesheet();
    scenes = collectScenes();
    if (!scenes.length) return;
    scenes.forEach(prepareScene);
    createToolbar();
    addLaunchButton();
    document.addEventListener("pointerdown", onPresentationPointerDown, true);
    bindBoardFramePointerIndicators();
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("fullscreenchange", onFullscreenChange);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
