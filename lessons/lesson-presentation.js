(function () {
  "use strict";

  if (window.__LESSON_PRESENTATION_PHASE_1A__) return;
  window.__LESSON_PRESENTATION_PHASE_1A__ = true;

  var VERSION = "20260723-phase1a";
  var scriptUrl = document.currentScript && document.currentScript.src
    ? document.currentScript.src
    : new URL("lesson-presentation.js", window.location.href).href;
  var scenes = [];
  var activeIndex = 0;
  var previousScrollY = 0;
  var toolbar = null;
  var counter = null;
  var sceneLabel = null;
  var launchButton = null;
  var nativeFullscreenRequested = false;

  function loadStylesheet() {
    if (document.querySelector('link[data-lesson-presentation-style]')) return;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = new URL("lesson-presentation.css?v=" + VERSION, scriptUrl).href;
    link.setAttribute("data-lesson-presentation-style", VERSION);
    document.head.appendChild(link);
  }

  function directChildrenMatching(root, selector) {
    try {
      return Array.prototype.slice.call(root.querySelectorAll(":scope " + selector));
    } catch (error) {
      return Array.prototype.slice.call(root.querySelectorAll(selector));
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

  function collectScenes() {
    var result = [];
    var hero = document.querySelector(".hero");
    if (hero && !hero.closest(".lesson-section")) result.push(hero);

    document.querySelectorAll(".lesson-section").forEach(function (section) {
      var cards = directChildrenMatching(section, ".position-grid > .position-card, .activity-grid > .position-card, .answer-grid > .answer-card");
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

    return uniqueElements(result).filter(function (scene) {
      return !scene.classList.contains("no-print") && scene.offsetParent !== null;
    });
  }

  function sceneTitle(scene, index) {
    var heading = scene.querySelector("h1, h2, h3");
    if (heading && heading.textContent.trim()) return heading.textContent.trim();
    return "Lesson section " + (index + 1);
  }

  function markCoachOnlyNotes(scene) {
    scene.querySelectorAll(".no-position, .accuracy-note, [data-coach-note]").forEach(function (note) {
      var text = (note.textContent || "").trim().toLowerCase();
      if (note.hasAttribute("data-coach-note") || text.indexOf("source note:") === 0 || text.indexOf("source correction:") === 0) {
        note.classList.add("presentation-coach-only");
      }
    });
  }

  function prepareScene(scene, index) {
    scene.classList.add("presentation-scene");
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
    status.appendChild(sceneLabel);
    status.appendChild(counter);

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
    launchButton = document.createElement("button");
    launchButton.type = "button";
    launchButton.className = "toolbar-link lesson-present-launch no-print";
    launchButton.textContent = "Present Lesson";
    launchButton.title = "Open the Zoom-friendly lesson presentation";
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

  function updateToolbar() {
    if (!toolbar || !scenes.length) return;
    sceneLabel.textContent = scenes[activeIndex].dataset.presentationTitle || "Lesson";
    counter.textContent = (activeIndex + 1) + " / " + scenes.length;
    var previous = toolbar.querySelector('[data-presentation-action="previous"]');
    var next = toolbar.querySelector('[data-presentation-action="next"]');
    previous.disabled = activeIndex <= 0;
    next.disabled = activeIndex >= scenes.length - 1;
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
  }

  function revealNext() {
    var scene = scenes[activeIndex];
    if (!scene) return false;

    var closedDetails = Array.prototype.slice.call(scene.querySelectorAll("details:not([open])"))
      .filter(function (details) { return !details.closest(".presentation-coach-only"); });
    if (closedDetails.length) {
      closedDetails[0].open = true;
      closedDetails[0].scrollIntoView({ behavior: "smooth", block: "center" });
      return true;
    }

    var hiddenTarget = Array.prototype.slice.call(scene.querySelectorAll('.presentation-reveal-target[data-presentation-revealed="false"]'))[0];
    if (hiddenTarget) {
      hiddenTarget.dataset.presentationRevealed = "true";
      hiddenTarget.scrollIntoView({ behavior: "smooth", block: "center" });
      return true;
    }
    return false;
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
    scenes[activeIndex].scrollTop = 0;
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
    if (launchButton) launchButton.focus({ preventScroll: true });
  }

  function onFullscreenChange() {
    if (nativeFullscreenRequested && !document.fullscreenElement && document.body.classList.contains("lesson-presentation-active")) {
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
