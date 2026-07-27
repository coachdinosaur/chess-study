(function loadLessonPresentationRuntime() {
  "use strict";

  var current = document.currentScript;
  var currentUrl = current && current.src
    ? current.src
    : new URL("lesson-presentation.js", window.location.href).href;
  var isEndgame = document.documentElement.getAttribute("data-lesson-series") === "endgame" ||
    /(?:^|\/)0[1-7]-[^/]+\.html$/i.test(window.location.pathname);
  var runtime = isEndgame
    ? "endgame-presentation.js?v=20260727-endgame-presentation-v1"
    : "lesson-presentation-legacy.js?v=20260725-presentation-click-pulse-v5";
  var marker = isEndgame ? "data-endgame-presentation-runtime" : "data-lesson-presentation-legacy";

  if (document.querySelector("script[" + marker + "]")) return;

  var script = document.createElement("script");
  script.src = new URL(runtime, currentUrl).href;
  script.async = false;
  script.setAttribute(marker, "");
  document.body.appendChild(script);
})();
