/* ==========================================================================
   endgame-lesson.js
   Vanilla FEN -> board renderer for chess endgame lesson pages.
   Reused by every chapter HTML in /lessons. No dependencies.

   Usage in HTML:
     <html data-piece-base="../assets/pieces/mpchess/" data-orientation="white">
     ...
     <div class="board" data-fen="6k1/8/8/8/8/8/P7/7K w - - 0 1"></div>

   The script reads data-fen from each .board element and builds an 8x8 grid
   mirroring the SPA's markup (.board-grid > .board-square.light/.dark +
   .board-piece-shell > img.board-piece) so diagrams visually match the app.
   ========================================================================== */

(function () {
  "use strict";

  /* Cache-buster for embedded app iframes. Bump this when the app (index.html /
     app.js / styles.css) changes so browsers fetch fresh copies instead of
     serving stale cached HTML inside lesson-page iframes. */
  var EMBED_CACHE_BUSTER = "20260707";

  var PIECE_FILES = {
    K: "wK.svg", Q: "wQ.svg", R: "wR.svg", B: "wB.svg", N: "wN.svg", P: "wP.svg",
    k: "bK.svg", q: "bQ.svg", r: "bR.svg", b: "bB.svg", n: "bN.svg", p: "bP.svg"
  };

  var FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

  function resolvePieceBase() {
    var html = document.documentElement;
    var base = html.getAttribute("data-piece-base");
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
      var empty = 0;
      for (var c = 0; c < ranks[r].length; c++) {
        var ch = ranks[r][c];
        if (/[1-8]/.test(ch)) {
          empty += parseInt(ch, 10);
        } else if (PIECE_FILES[ch]) {
          for (var k = 0; k < empty; k++) row.push("");
          empty = 0;
          row.push(ch);
        } else {
          return null;
        }
      }
      for (var m = 0; m < empty; m++) row.push("");
      if (row.length !== 8) return null;
      grid.push(row);
    }
    return grid;
  }

  function buildSquare(row, col, piece, base, showFile, showRank, isLight, markSet) {
    var square = FILES[col] + (8 - row);
    var cls = "board-square " + (isLight ? "light" : "dark");
    var marked = markSet && markSet.has(square);
    if (marked) { cls += " is-marked"; }
    var html = '<div class="' + cls + '" data-square="' + square + '">';
    if (marked) {
      html += '<span class="board-mark" aria-hidden="true"></span>';
    }
    if (showRank) {
      html += '<span class="coord-rank ' + (isLight ? "coord-light" : "coord-dark") + '">' +
              (8 - row) + '</span>';
    }
    if (showFile) {
      html += '<span class="coord-file ' + (isLight ? "coord-light" : "coord-dark") + '">' +
              FILES[col] + '</span>';
    }
    if (piece) {
      html += '<div class="board-piece-shell">' +
              '<img class="board-piece" src="' + base + PIECE_FILES[piece] + '" alt="' +
              piece + '" loading="lazy">' +
              '</div>';
    }
    html += '</div>';
    return html;
  }

  function buildStaticGrid(grid, base, orientation, markSet) {
    var html = '<div class="board-grid">';
    for (var displayRow = 0; displayRow < 8; displayRow++) {
      for (var displayCol = 0; displayCol < 8; displayCol++) {
        var row, col;
        if (orientation === "black") {
          row = displayRow;
          col = 7 - displayCol;
        } else {
          row = 7 - displayRow;
          col = displayCol;
        }
        var piece = grid[row][col];
        var isLight = (row + col) % 2 === 0;
        var showRank = displayCol === 0;
        var showFile = displayRow === 7;
        html += buildSquare(row, col, piece, base, showFile, showRank, isLight, markSet);
      }
    }
    html += '</div>';
    return html;
  }

  function parseMarks(value) {
    if (!value) { return null; }
    var parts = String(value).trim().split(/\s+/);
    var set = new Set();
    for (var i = 0; i < parts.length; i++) {
      if (/^[a-h][1-8]$/.test(parts[i])) {
        set.add(parts[i]);
      }
    }
    return set.size ? set : null;
  }

  function appPath() {
    var html = document.documentElement;
    var p = html.getAttribute("data-app-path");
    if (!p) return "../index.html";
    return p;
  }

  function buildIframe(fen, orientation, marks) {
    /* Cache-bust: append a version hash so browsers always fetch the latest
       app HTML instead of serving a stale cached version inside iframes. */
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
        iframe.contentWindow.postMessage({
          type: "setOrientation",
          orientation: orientation
        }, "*");
        if (markList.length) {
          iframe.contentWindow.postMessage({
            type: "setAnnotations",
            mark: markList
          }, "*");
        }
      } catch (e) {}
    });
    return iframe;
  }

  function renderBoard(el, base) {
    var fen = el.getAttribute("data-fen") || "";
    var orientation = (el.getAttribute("data-orientation") ||
                       document.documentElement.getAttribute("data-orientation") ||
                       "white").toLowerCase() === "black" ? "black" : "white";
    var markSet = parseMarks(el.getAttribute("data-mark"));

    el.innerHTML = "";

    /* FEN missing placeholder */
    if (!fen || fen.toLowerCase() === "missing") {
      var missing = document.createElement("div");
      missing.className = "fen-missing";
      missing.textContent = "FEN missing — rebuild from source diagram.";
      el.appendChild(missing);
      return;
    }

    var grid = parseFenPlacement(fen);

    if (!grid) {
      var err = document.createElement("div");
      err.className = "board-static board-error";
      err.textContent = "Invalid FEN: " + fen;
      el.appendChild(err);
      return;
    }

    var screen = document.createElement("div");
    screen.className = "board-screen";
    screen.appendChild(buildIframe(fen, orientation, markSet));
    el.appendChild(screen);

    var print = document.createElement("div");
    print.className = "board-static";
    print.innerHTML = buildStaticGrid(grid, base, orientation, markSet);
    el.appendChild(print);
  }

  function init() {
    var base = resolvePieceBase();
    var boards = document.querySelectorAll(".board[data-fen]");
    for (var i = 0; i < boards.length; i++) {
      renderBoard(boards[i], base);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

/* ==========================================================================
   Image lightbox — opens .lesson-zoomable images in a same-page overlay.
   ========================================================================== */
(function () {
  "use strict";

  function openLightbox(img) {
    var overlay = document.createElement("div");
    overlay.className = "lesson-lightbox";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Enlarged lesson image");

    var closeBtn = document.createElement("button");
    closeBtn.className = "lesson-lightbox__close";
    closeBtn.setAttribute("aria-label", "Close enlarged image");
    closeBtn.textContent = "\u00d7";

    var enlarged = document.createElement("img");
    enlarged.className = "lesson-lightbox__image";
    enlarged.src = img.src;
    enlarged.alt = img.alt || "";

    overlay.appendChild(closeBtn);
    overlay.appendChild(enlarged);
    document.body.appendChild(overlay);

    function close() {
      overlay.remove();
    }

    closeBtn.addEventListener("click", close);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) close();
    });

    function escHandler(e) {
      if (e.key === "Escape") {
        close();
        document.removeEventListener("keydown", escHandler);
      }
    }
    document.addEventListener("keydown", escHandler);

    closeBtn.focus();
  }

  function init() {
    var imgs = document.querySelectorAll(".lesson-zoomable");
    for (var i = 0; i < imgs.length; i++) {
      imgs[i].addEventListener("click", function () {
        openLightbox(this);
      });
      imgs[i].setAttribute("tabindex", "0");
      imgs[i].setAttribute("role", "button");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
