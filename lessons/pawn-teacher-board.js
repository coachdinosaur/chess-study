(function () {
  "use strict";

  var DEFAULT_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  var PIECES = ["K", "Q", "R", "B", "N", "P"];
  var PIECE_LABELS = {
    K: "King",
    Q: "Queen",
    R: "Rook",
    B: "Bishop",
    N: "Knight",
    P: "Pawn"
  };
  var panel;
  var iframe;
  var setupOpen = false;
  var annotateOpen = false;
  var selectedPiece = "";
  var setupColor = "w";
  var boardMenuOpen = false;

  function teacherFen() {
    var explicit = document.documentElement.getAttribute("data-teacher-fen") ||
      document.body.getAttribute("data-teacher-fen") ||
      "";
    explicit = explicit.trim();
    return explicit || DEFAULT_FEN;
  }

  function pieceAsset(piece) {
    var color = piece === piece.toLowerCase() ? "b" : "w";
    return "../assets/pieces/mpchess/" + color + piece.toUpperCase() + ".svg";
  }

  function boardUrl() {
    var url = new URL("../index.html", window.location.href);
    url.searchParams.set("embed", "1");
    url.searchParams.set("boardOnly", "1");
    url.searchParams.set("setupPanel", "hidden");
    url.searchParams.set("fen", teacherFen());
    url.searchParams.set("_teacher", "20260709-teacher-setup6");
    return url.href;
  }

  function post(action, extra) {
    if (!iframe || !iframe.contentWindow) {
      return;
    }
    iframe.contentWindow.postMessage(Object.assign({
      type: "teacherBoardAction",
      action: action
    }, extra || {}), "*");
  }

  function setButtonState(button, active) {
    if (!button) {
      return;
    }
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  }

  function setupPieceButton(piece) {
    var colorLabel = piece === piece.toLowerCase() ? "Black" : "White";
    var pieceLabel = PIECE_LABELS[piece.toUpperCase()];
    var pieceColor = piece === piece.toLowerCase() ? "black" : "white";
    return [
      '<button type="button" class="teacher-piece-button" data-teacher-piece="' + piece + '" data-piece-color="' + pieceColor + '" aria-pressed="false" title="' + colorLabel + " " + pieceLabel + '">',
      '  <img src="' + pieceAsset(piece) + '" alt="">',
      '</button>'
    ].join("");
  }

  function setupColorToggle() {
    return [
      '<button type="button" class="teacher-color-toggle" data-teacher-action="toggle-color" aria-pressed="' + (setupColor === "b" ? "true" : "false") + '" title="Switch piece color">',
      setupColor === "w" ? "White" : "Black",
      '</button>'
    ].join("");
  }

  function setupPieceRow() {
    return [
      '<div class="teacher-piece-row" aria-label="' + (setupColor === "w" ? "White" : "Black") + ' pieces">',
      PIECES.map(function (piece) {
        return setupPieceButton(setupColor === "w" ? piece : piece.toLowerCase());
      }).join(""),
      '</div>'
    ].join("");
  }

  function setupBoardMenu() {
    return [
      '<div class="teacher-board-menu-wrap">',
      '  <button type="button" class="teacher-board-tool teacher-board-menu-button" data-teacher-action="toggle-board-menu" aria-expanded="' + (boardMenuOpen ? "true" : "false") + '">Board</button>',
      '  <div class="teacher-board-menu" ' + (boardMenuOpen ? "" : "hidden") + '>',
      '    <button type="button" data-teacher-action="empty-board">Empty</button>',
      '    <button type="button" data-teacher-action="start-board">Start</button>',
      '    <button type="button" data-teacher-action="lesson-board">Lesson</button>',
      '  </div>',
      '</div>'
    ].join("");
  }

  function createPanel() {
    panel = document.createElement("section");
    panel.className = "teacher-board-panel";
    panel.hidden = true;
    panel.setAttribute("aria-label", "Teacher board");
    panel.innerHTML = [
      '<div class="teacher-board-head">',
      '  <div class="teacher-board-title">Teacher Board</div>',
      '  <button type="button" class="teacher-board-icon-button" data-teacher-action="minimize" aria-label="Minimize teacher board" title="Minimize">_</button>',
      '  <button type="button" class="teacher-board-icon-button" data-teacher-action="close" aria-label="Close teacher board" title="Close">x</button>',
      '</div>',
      '<div class="teacher-board-body">',
      '  <iframe class="teacher-board-frame" title="Interactive teacher chessboard" loading="lazy"></iframe>',
      '</div>',
      '<div class="teacher-board-setup-tray" hidden>',
      '  <div class="teacher-piece-tray">',
      setupBoardMenu(),
      setupColorToggle(),
      setupPieceRow(),
      '    <button type="button" class="teacher-piece-button teacher-piece-eraser" data-teacher-piece="eraser" aria-pressed="false" title="Erase pieces">Erase</button>',
      '  </div>',
      '  <button type="button" class="teacher-board-tool teacher-setup-done" data-teacher-action="done-setup">Done</button>',
      '</div>',
      '<div class="teacher-board-tools" aria-label="Teacher board tools">',
      '  <button type="button" class="teacher-board-tool" data-teacher-action="setup" aria-pressed="false" title="Open the quick piece setup tray">Setup</button>',
      '  <button type="button" class="teacher-board-tool" data-teacher-action="annotate" aria-pressed="false" title="Right-click marks squares. Alt+right-drag draws arrows. Ctrl+right-click stars.">Annotate</button>',
      '  <button type="button" class="teacher-board-tool" data-teacher-action="clear-marks">Clear marks</button>',
      '  <button type="button" class="teacher-board-tool" data-teacher-action="flip">Flip</button>',
      '  <button type="button" class="teacher-board-tool" data-teacher-action="reset">Reset</button>',
      '</div>'
    ].join("");

    iframe = panel.querySelector(".teacher-board-frame");
    panel.addEventListener("click", handlePanelClick);
    document.body.appendChild(panel);
  }

  function ensurePanel() {
    if (!panel) {
      createPanel();
    }
    if (iframe && !iframe.getAttribute("src")) {
      iframe.setAttribute("src", boardUrl());
    }
  }

  function syncSelectedPieceButtons() {
    if (!panel) {
      return;
    }
    var colorToggle = panel.querySelector('[data-teacher-action="toggle-color"]');
    if (colorToggle) {
      colorToggle.textContent = setupColor === "w" ? "White" : "Black";
      setButtonState(colorToggle, setupColor === "b");
    }
    var boardMenuButton = panel.querySelector('[data-teacher-action="toggle-board-menu"]');
    var boardMenu = panel.querySelector(".teacher-board-menu");
    if (boardMenuButton) {
      boardMenuButton.setAttribute("aria-expanded", boardMenuOpen ? "true" : "false");
      boardMenuButton.classList.toggle("is-active", boardMenuOpen);
    }
    if (boardMenu) {
      boardMenu.hidden = !boardMenuOpen;
    }
    panel.querySelectorAll("[data-teacher-piece]").forEach(function (button) {
      var active = button.getAttribute("data-teacher-piece") === selectedPiece;
      setButtonState(button, active);
    });
  }

  function renderSetupTrayPieces() {
    if (!panel) {
      return;
    }
    var tray = panel.querySelector(".teacher-piece-tray");
    if (!tray) {
      return;
    }
    tray.innerHTML = [
      setupBoardMenu(),
      setupColorToggle(),
      setupPieceRow(),
      '<button type="button" class="teacher-piece-button teacher-piece-eraser" data-teacher-piece="eraser" aria-pressed="false" title="Erase pieces">Erase</button>'
    ].join("");
    syncSelectedPieceButtons();
  }

  function setSetupOpen(open) {
    setupOpen = Boolean(open);
    selectedPiece = setupOpen ? selectedPiece : "";
    boardMenuOpen = false;
    if (!panel) {
      return;
    }
    var tray = panel.querySelector(".teacher-board-setup-tray");
    if (tray) {
      tray.hidden = !setupOpen;
    }
    setButtonState(panel.querySelector('[data-teacher-action="setup"]'), setupOpen);
    syncSelectedPieceButtons();
    post(setupOpen ? "enterTeacherSetup" : "exitTeacherSetup");
  }

  function openPanel() {
    ensurePanel();
    panel.hidden = false;
    panel.classList.remove("is-minimized");
  }

  function closePanel() {
    if (!panel) {
      return;
    }
    panel.hidden = true;
    panel.classList.remove("is-minimized");
    setupOpen = false;
    annotateOpen = false;
    selectedPiece = "";
    boardMenuOpen = false;
    setButtonState(panel.querySelector('[data-teacher-action="setup"]'), false);
    setButtonState(panel.querySelector('[data-teacher-action="annotate"]'), false);
    syncSelectedPieceButtons();
    post("exitTeacherSetup");
  }

  function toggleMinimize() {
    if (!panel) {
      return;
    }
    panel.classList.toggle("is-minimized");
  }

  function handlePieceSelect(piece) {
    if (!setupOpen) {
      setSetupOpen(true);
    }
    selectedPiece = selectedPiece === piece ? "" : piece;
    syncSelectedPieceButtons();
    post("selectTeacherPiece", { piece: selectedPiece });
  }

  function handlePanelClick(event) {
    var pieceButton = event.target.closest("[data-teacher-piece]");
    if (pieceButton) {
      boardMenuOpen = false;
      handlePieceSelect(pieceButton.getAttribute("data-teacher-piece") || "");
      return;
    }

    var button = event.target.closest("[data-teacher-action]");
    if (!button) {
      boardMenuOpen = false;
      syncSelectedPieceButtons();
      return;
    }
    var action = button.getAttribute("data-teacher-action");
    if (action === "toggle-color") {
      setupColor = setupColor === "w" ? "b" : "w";
      if (selectedPiece && selectedPiece !== "eraser") {
        selectedPiece = setupColor === "w" ? selectedPiece.toUpperCase() : selectedPiece.toLowerCase();
        post("selectTeacherPiece", { piece: selectedPiece });
      }
      boardMenuOpen = false;
      renderSetupTrayPieces();
      return;
    }
    if (action === "close") {
      closePanel();
      return;
    }
    if (action === "minimize") {
      toggleMinimize();
      return;
    }
    if (action === "setup") {
      if (!setupOpen && annotateOpen) {
        annotateOpen = false;
        setButtonState(panel.querySelector('[data-teacher-action="annotate"]'), false);
        post("toggleAnnotate");
      }
      setSetupOpen(!setupOpen);
      return;
    }
    if (action === "toggle-board-menu") {
      boardMenuOpen = !boardMenuOpen;
      syncSelectedPieceButtons();
      return;
    }
    if (action === "done-setup") {
      setSetupOpen(false);
      return;
    }
    if (action === "empty-board") {
      selectedPiece = "";
      boardMenuOpen = false;
      syncSelectedPieceButtons();
      post("emptyTeacherBoard");
      return;
    }
    if (action === "start-board") {
      selectedPiece = "";
      boardMenuOpen = false;
      syncSelectedPieceButtons();
      post("startTeacherBoard");
      return;
    }
    if (action === "lesson-board") {
      selectedPiece = "";
      boardMenuOpen = false;
      syncSelectedPieceButtons();
      post("lessonTeacherBoard");
      return;
    }
    if (action === "annotate") {
      annotateOpen = !annotateOpen;
      if (annotateOpen && setupOpen) {
        setSetupOpen(false);
      }
      setButtonState(button, annotateOpen);
      post("toggleAnnotate");
      return;
    }
    if (action === "clear-marks") {
      annotateOpen = false;
      setButtonState(panel.querySelector('[data-teacher-action="annotate"]'), false);
      post("clearAnnotations");
      return;
    }
    if (action === "flip") {
      post("flip");
      return;
    }
    if (action === "reset") {
      selectedPiece = "";
      syncSelectedPieceButtons();
      post("reset");
    }
  }

  function injectButton() {
    if (document.querySelector("[data-open-teacher-board]")) {
      return;
    }
    var actions = document.querySelector(".index-top-actions") || document.querySelector(".top-actions");
    if (!actions) {
      return;
    }
    var button = document.createElement("button");
    button.type = "button";
    button.className = actions.classList.contains("index-top-actions")
      ? "toolbar-link teacher-board-button"
      : "btn teacher-board-button";
    button.setAttribute("data-open-teacher-board", "");
    button.textContent = "Teacher Board";
    button.addEventListener("click", openPanel);
    actions.insertBefore(button, actions.firstElementChild ? actions.firstElementChild.nextSibling : null);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectButton);
  } else {
    injectButton();
  }
})();
