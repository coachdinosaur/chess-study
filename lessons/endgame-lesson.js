/* ========================================================================== 
   endgame-lesson.js
   Vanilla FEN -> board renderer for chess lesson pages.
   ========================================================================== */

(function () {
  "use strict";

  var EMBED_CACHE_BUSTER = "20260721-bishop-captured-layout-complete";
  var PIECE_FILES = {
    K: "wK.svg", Q: "wQ.svg", R: "wR.svg", B: "wB.svg", N: "wN.svg", P: "wP.svg",
    k: "bK.svg", q: "bQ.svg", r: "bR.svg", b: "bB.svg", n: "bN.svg", p: "bP.svg"
  };
  var FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

  function resolvePieceBase() {
    var base = document.documentElement.getAttribute("data-piece-base");
    if (!base) return "../assets/pieces/mpchess/";
    return base.endsWith("/") ? base : base + "/";
  }

  function parseFenPlacement(fen) {
    var placement = String(fen || "").split(/\s+/)[0] || "";
    if (!placement || !/^[KQRBNPkqrbnp1-8\/]+$/.test(placement)) return null;
    var ranks = placement.split("/");
    if (ranks.length !== 8) return null;

    var grid = [];
    for (var r = 0; r < 8; r++) {
      var row = [];
      for (var c = 0; c < ranks[r].length; c++) {
        var ch = ranks[r][c];
        if (/[1-8]/.test(ch)) {
          for (var n = 0; n < parseInt(ch, 10); n++) row.push("");
        } else if (PIECE_FILES[ch]) {
          row.push(ch);
        } else {
          return null;
        }
      }
      if (row.length !== 8) return null;
      grid.push(row);
    }
    return grid;
  }

  function parseMarks(value) {
    if (!value) return null;
    var set = new Set();
    String(value).trim().split(/\s+/).forEach(function (square) {
      if (/^[a-h][1-8]$/.test(square)) set.add(square);
    });
    return set.size ? set : null;
  }

  function buildSquare(row, col, piece, base, showFile, showRank, isLight, markSet) {
    var square = FILES[col] + (8 - row);
    var cls = "board-square " + (isLight ? "light" : "dark");
    var marked = markSet && markSet.has(square);
    if (marked) cls += " is-marked";

    var html = '<div class="' + cls + '" data-square="' + square + '">';
    if (marked) html += '<span class="board-mark" aria-hidden="true"></span>';
    if (showRank) {
      html += '<span class="coord-rank ' + (isLight ? "coord-light" : "coord-dark") + '">' + (8 - row) + "</span>";
    }
    if (showFile) {
      html += '<span class="coord-file ' + (isLight ? "coord-light" : "coord-dark") + '">' + FILES[col] + "</span>";
    }
    if (piece) {
      html += '<div class="board-piece-shell"><img class="board-piece" src="' + base + PIECE_FILES[piece] + '" alt="' + piece + '" loading="lazy"></div>';
    }
    return html + "</div>";
  }

  function buildStaticGrid(grid, base, orientation, markSet) {
    var html = '<div class="board-grid">';
    for (var displayRow = 0; displayRow < 8; displayRow++) {
      for (var displayCol = 0; displayCol < 8; displayCol++) {
        var row = orientation === "black" ? displayRow : 7 - displayRow;
        var col = orientation === "black" ? 7 - displayCol : displayCol;
        html += buildSquare(
          row,
          col,
          grid[row][col],
          base,
          displayRow === 7,
          displayCol === 0,
          (row + col) % 2 === 0,
          markSet
        );
      }
    }
    return html + "</div>";
  }

  function appPath() {
    return document.documentElement.getAttribute("data-app-path") || "../index.html";
  }

  function isCompactBishopLesson() {
    return /(?:^|\/)bishop-m(?:10|[2-9])-lesson-[^/]+\.html$/i.test(window.location.pathname);
  }

  function applyCompactCapturedPieceLayout(iframe) {
    if (!isCompactBishopLesson()) return;

    try {
      var doc = iframe.contentDocument;
      if (!doc || !doc.head || doc.querySelector("style[data-bishop-captured-layout]")) return;

      var style = doc.createElement("style");
      style.setAttribute("data-bishop-captured-layout", "complete");
      style.textContent = [
        "/* Bishop lesson embeds intentionally use half-size captured-piece UI. */",
        ".board-column {",
        "  --captured-cell-min: 0.775rem !important;",
        "  --captured-cell-divisor: 20 !important;",
        "  --captured-cell-max: 1.075rem !important;",
        "  --captured-row-extra-height: 0.375rem !important;",
        "  --captured-count-extra-width: 0.725rem !important;",
        "  --captured-row-gap: clamp(0.12rem, calc(var(--board-size, 42rem) / 280), 0.2rem) !important;",
        "  --captured-cell-size: clamp(var(--captured-cell-min), calc(var(--board-size, 42rem) / var(--captured-cell-divisor)), var(--captured-cell-max)) !important;",
        "  --captured-row-height: calc(var(--captured-cell-size) + var(--captured-row-extra-height) + 2px) !important;",
        "}",
        ".captured-row {",
        "  padding: 0.12rem 0.25rem !important;",
        "}",
        ".captured-pieces {",
        "  width: 100% !important;",
        "  min-width: 0 !important;",
        "  max-width: 100% !important;",
        "  gap: 0.09rem !important;",
        "}",
        ".captured-piece-shell {",
        "  width: var(--captured-cell-size) !important;",
        "  height: var(--captured-cell-size) !important;",
        "  border-radius: 0.11rem !important;",
        "}",
        ".captured-piece-shell.has-count {",
        "  width: auto !important;",
        "  min-width: calc(var(--captured-cell-size) + var(--captured-count-extra-width)) !important;",
        "  padding: 0 0.06rem 0 0.02rem !important;",
        "  gap: 0.04rem !important;",
        "}",
        ".captured-piece-placeholder,",
        ".captured-piece {",
        "  width: 100% !important;",
        "  height: 100% !important;",
        "}",
        ".captured-piece-shell.has-count .captured-piece {",
        "  flex: 0 0 var(--captured-cell-size) !important;",
        "  width: var(--captured-cell-size) !important;",
        "  height: 100% !important;",
        "}",
        ".captured-piece-count {",
        "  min-width: 0.625rem !important;",
        "  height: 0.625rem !important;",
        "  padding: 0 0.09rem !important;",
        "  font-size: 0.39rem !important;",
        "  line-height: 1 !important;",
        "  box-shadow: none !important;",
        "}"
      ].join("\n");
      doc.head.appendChild(style);
    } catch (e) {
      /* Same-origin lesson embeds are expected; retain the normal board if access fails. */
    }
  }

  function buildIframe(fen, orientation, marks) {
    var src = appPath() + "?fen=" + encodeURIComponent(fen) + "&embed=1&_b=" + EMBED_CACHE_BUSTER;
    var iframe = document.createElement("iframe");
    iframe.className = "board-iframe";
    iframe.setAttribute("src", src);
    iframe.setAttribute("title", "Interactive chess board: " + fen);
    iframe.setAttribute("loading", "lazy");
    iframe.setAttribute("scrolling", "no");
    iframe.setAttribute("frameborder", "0");
    iframe.dataset.orientation = orientation;

    var markList = marks ? Array.from(marks) : [];
    iframe.addEventListener("load", function () {
      try {
        iframe.contentWindow.postMessage({ type: "setOrientation", orientation: orientation }, "*");
        if (markList.length) {
          iframe.contentWindow.postMessage({ type: "setAnnotations", mark: markList }, "*");
        }
      } catch (e) {}
    });
    return iframe;
  }

  function initializeInteractiveBoard(el, screen, print, fen, orientation, markSet) {
    if (el.dataset.boardInteractiveState === "initialized") return;
    el.dataset.boardInteractiveState = "initialized";

    var iframe = buildIframe(fen, orientation, markSet);
    iframe.style.visibility = "hidden";
    iframe.addEventListener("load", function () {
      applyCompactCapturedPieceLayout(iframe);
      screen.removeAttribute("role");
      screen.removeAttribute("aria-label");
      print.style.display = "none";
      iframe.style.visibility = "visible";
    });
    screen.appendChild(iframe);
  }

  function renderBoard(el, base) {
    var fen = el.getAttribute("data-fen") || "";
    var orientation = (
      el.getAttribute("data-orientation") ||
      document.documentElement.getAttribute("data-orientation") ||
      "white"
    ).toLowerCase() === "black" ? "black" : "white";
    var markSet = parseMarks(el.getAttribute("data-mark"));

    el.innerHTML = "";
    if (!fen || fen.toLowerCase() === "missing") {
      var missing = document.createElement("div");
      missing.className = "fen-missing";
      missing.textContent = "FEN missing — rebuild from source diagram.";
      el.appendChild(missing);
      return null;
    }

    var grid = parseFenPlacement(fen);
    if (!grid) {
      var error = document.createElement("div");
      error.className = "board-static board-error";
      error.textContent = "Invalid FEN: " + fen;
      el.appendChild(error);
      return null;
    }

    var print = document.createElement("div");
    print.className = "board-static";
    print.innerHTML = buildStaticGrid(grid, base, orientation, markSet);
    print.style.display = "block";
    print.setAttribute("aria-hidden", "true");
    el.appendChild(print);

    var screen = document.createElement("div");
    screen.className = "board-screen";
    screen.setAttribute("role", "img");
    screen.setAttribute("aria-label", "Interactive chess board: " + fen);
    el.appendChild(screen);

    el.dataset.boardInteractiveState = "pending";
    return function () {
      initializeInteractiveBoard(el, screen, print, fen, orientation, markSet);
    };
  }

  function initInteractiveBoards(items) {
    if (!items.length) return;
    if (!("IntersectionObserver" in window)) {
      items.forEach(function (item) { item.initialize(); });
      return;
    }

    var initializers = new WeakMap();
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var initialize = initializers.get(entry.target);
        if (initialize) initialize();
        initializers.delete(entry.target);
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "500px 0px" });

    items.forEach(function (item) {
      initializers.set(item.el, item.initialize);
      observer.observe(item.el);
    });
  }

  function init() {
    var base = resolvePieceBase();
    var items = [];
    document.querySelectorAll(".board[data-fen]").forEach(function (board) {
      var initialize = renderBoard(board, base);
      if (initialize) items.push({ el: board, initialize: initialize });
    });
    initInteractiveBoards(items);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

/* Image lightbox for .lesson-zoomable images. */
(function () {
  "use strict";

  function openLightbox(img) {
    var overlay = document.createElement("div");
    overlay.className = "lesson-lightbox";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Enlarged lesson image");

    var closeButton = document.createElement("button");
    closeButton.className = "lesson-lightbox__close";
    closeButton.setAttribute("aria-label", "Close enlarged image");
    closeButton.textContent = "\u00d7";

    var enlarged = document.createElement("img");
    enlarged.className = "lesson-lightbox__image";
    enlarged.src = img.src;
    enlarged.alt = img.alt || "";

    overlay.appendChild(closeButton);
    overlay.appendChild(enlarged);
    document.body.appendChild(overlay);

    function close() {
      overlay.remove();
      document.removeEventListener("keydown", onKeyDown);
    }
    function onKeyDown(event) {
      if (event.key === "Escape") close();
    }

    closeButton.addEventListener("click", close);
    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) close();
    });
    document.addEventListener("keydown", onKeyDown);
    closeButton.focus();
  }

  function init() {
    document.querySelectorAll(".lesson-zoomable").forEach(function (img) {
      img.addEventListener("click", function () { openLightbox(img); });
      img.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openLightbox(img);
        }
      });
      img.setAttribute("tabindex", "0");
      img.setAttribute("role", "button");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

(function loadLessonPresentation() {
  if (document.querySelector('script[data-lesson-presentation]')) return;
  var script = document.createElement('script');
  script.src = 'lesson-presentation.js?v=20260725-presentation-click-pulse-v5';
  script.defer = true;
  script.setAttribute('data-lesson-presentation', '');
  document.body.appendChild(script);
})();
