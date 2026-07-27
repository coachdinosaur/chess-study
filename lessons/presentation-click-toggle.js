(function initPresentationClickAnimationToggle() {
  "use strict";

  if (window.__PRESENTATION_CLICK_TOGGLE_V1__) return;
  window.__PRESENTATION_CLICK_TOGGLE_V1__ = true;

  var STORAGE_KEY = "lesson-presentation-click-animation-v1";
  var DISABLED_CLASS = "presentation-click-animation-disabled";
  var BUTTON_SELECTOR = "[data-presentation-click-animation-toggle]";
  var TOOLBAR_CONFIGS = [
    {
      toolbar: ".lesson-presentation-toolbar",
      controls: ".lesson-presentation-controls",
      buttonClass: "lesson-presentation-control"
    },
    {
      toolbar: ".endgame-presentation-toolbar",
      controls: ".endgame-presentation-controls",
      buttonClass: "endgame-presentation-control"
    }
  ];

  function storedEnabled() {
    try {
      return window.localStorage.getItem(STORAGE_KEY) !== "off";
    } catch (error) {
      return true;
    }
  }

  var enabled = storedEnabled();

  function removeVisibleIndicators() {
    document.querySelectorAll(
      ".lesson-presentation-click-indicator, .endgame-presentation-click-indicator"
    ).forEach(function (indicator) {
      indicator.remove();
    });
  }

  function applyState() {
    document.documentElement.classList.toggle(DISABLED_CLASS, !enabled);
    if (!enabled) removeVisibleIndicators();

    document.querySelectorAll(BUTTON_SELECTOR).forEach(function (button) {
      button.textContent = "Click animation: " + (enabled ? "On" : "Off");
      button.setAttribute("aria-pressed", enabled ? "true" : "false");
      button.title = enabled
        ? "Turn off the presentation click animation"
        : "Turn on the presentation click animation";
    });
  }

  function saveState() {
    try {
      window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
    } catch (error) {
      // The toggle still works for this page when storage is unavailable.
    }
  }

  function toggleState() {
    enabled = !enabled;
    saveState();
    applyState();
  }

  function addToggle(config) {
    var toolbar = document.querySelector(config.toolbar);
    if (!toolbar || toolbar.querySelector(BUTTON_SELECTOR)) return;

    var controls = toolbar.querySelector(config.controls);
    if (!controls) return;

    var button = document.createElement("button");
    button.type = "button";
    button.className = config.buttonClass;
    button.setAttribute("data-presentation-click-animation-toggle", "");
    button.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      toggleState();
    });
    controls.insertBefore(button, controls.lastElementChild || null);
    applyState();
  }

  function installToggles() {
    TOOLBAR_CONFIGS.forEach(addToggle);
  }

  var style = document.createElement("style");
  style.setAttribute("data-presentation-click-animation-toggle-style", "");
  style.textContent =
    "html." + DISABLED_CLASS + " .lesson-presentation-click-indicator," +
    "html." + DISABLED_CLASS + " .endgame-presentation-click-indicator{" +
    "display:none!important;animation:none!important}";
  document.head.appendChild(style);

  applyState();
  installToggles();

  var observer = new MutationObserver(installToggles);
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
