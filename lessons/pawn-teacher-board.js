(function () {
  "use strict";

  var DEFAULT_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  var STORAGE_PREFIX = "teacher-board-lesson-csv-v1:";
  var STORAGE_VERSION = 1;
  var GAME_STATUS_STORAGE_KEY = "teacher-board-game-status-enabled-v1";
  var TEACHER_CACHE_VERSION = "20260731-teacher-board-game-status1";
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
  var setupSideToMove = fenSideToMove(teacherFen());
  var boardMenuOpen = false;
  var maximized = false;
  var teacherGameStatusObserver = null;
  var teacherGameStatusTimer = null;
  var teacherGameStatusKey = "";
  var teacherGameStatusEnabled = true;
  var chessModulePromise = import("../vendor/chess.js").catch(function (error) {
    console.warn("Teacher board game-status detection is unavailable.", error);
    return null;
  });

  var lessonMenuOpen = false;
  var lessonFileInput = null;
  var lessonPositions = [];
  var activeLessonPositionId = "";
  var restoredLessonPositionId = "";
  var lessonCsvFileName = "";
  var lessonImportMessage = "";
  var lessonImportMessageKind = "";
  var iframeReady = false;
  var pendingLessonPosition = null;
  var lessonLoadRequestCounter = 0;
  var lessonLoadGeneration = 0;
  var pendingLessonLoads = Object.create(null);

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
    url.searchParams.set("_teacher", TEACHER_CACHE_VERSION);
    return url.href;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/\r?\n/g, "&#10;");
  }

  function normalizeCsvHeader(value) {
    return String(value == null ? "" : value)
      .replace(/^\ufeff/, "")
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");
  }

  function isBlankCsvRow(row) {
    return !row || row.every(function (cell) {
      return String(cell == null ? "" : cell).trim() === "";
    });
  }

  function parseCsvRows(text) {
    var input = String(text == null ? "" : text).replace(/^\ufeff/, "");
    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;
    var quoteClosed = false;
    var fieldStarted = false;
    var index = 0;

    function finishField() {
      row.push(field);
      field = "";
      quoteClosed = false;
      fieldStarted = false;
    }

    function finishRow() {
      finishField();
      rows.push(row);
      row = [];
    }

    while (index < input.length) {
      var character = input[index];

      if (inQuotes) {
        if (character === '"') {
          if (input[index + 1] === '"') {
            field += '"';
            index += 2;
            continue;
          }
          inQuotes = false;
          quoteClosed = true;
          index += 1;
          continue;
        }
        field += character;
        index += 1;
        continue;
      }

      if (quoteClosed) {
        if (character === ",") {
          finishField();
          index += 1;
          continue;
        }
        if (character === "\r" || character === "\n") {
          finishRow();
          index += character === "\r" && input[index + 1] === "\n" ? 2 : 1;
          continue;
        }
        if (character === " " || character === "\t") {
          index += 1;
          continue;
        }
        throw new Error("CSV has an unexpected character after a closing quote.");
      }

      if (character === '"') {
        if (fieldStarted || field !== "") {
          throw new Error("CSV has an unexpected quote inside an unquoted field.");
        }
        inQuotes = true;
        fieldStarted = true;
        index += 1;
        continue;
      }
      if (character === ",") {
        finishField();
        index += 1;
        continue;
      }
      if (character === "\r" || character === "\n") {
        finishRow();
        index += character === "\r" && input[index + 1] === "\n" ? 2 : 1;
        continue;
      }

      field += character;
      fieldStarted = true;
      index += 1;
    }

    if (inQuotes) {
      throw new Error("CSV has an unterminated quoted field.");
    }
    if (quoteClosed || field !== "" || row.length || (input && !/[\r\n]$/.test(input))) {
      finishRow();
    }
    return rows;
  }

  function slugifyLessonId(value) {
    return String(value == null ? "" : value)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  }

  function uniqueLessonId(usedIds, baseId) {
    var candidate = baseId || "position";
    var counter = 2;
    while (usedIds[candidate]) {
      candidate = (baseId || "position") + "-" + counter;
      counter += 1;
    }
    usedIds[candidate] = true;
    return candidate;
  }

  function normalizeLessonOrientation(value) {
    return String(value == null ? "" : value).trim().toLowerCase() === "black" ? "black" : "white";
  }

  function normalizeLessonDefault(value) {
    var normalized = String(value == null ? "" : value).trim().toLowerCase();
    return normalized === "yes" || normalized === "true" || normalized === "1" || normalized === "default";
  }

  function normalizeFenText(value) {
    return String(value == null ? "" : value).trim().replace(/\s+/g, " ");
  }

  function fenSideToMove(value) {
    var parts = normalizeFenText(value).split(" ");
    return parts[1] === "b" ? "b" : "w";
  }

  function currentTeacherBoardFen() {
    try {
      var fenElement = iframe && iframe.contentDocument
        ? iframe.contentDocument.getElementById("currentFenCode")
        : null;
      var current = normalizeFenText(fenElement ? fenElement.textContent : "");
      return current || teacherFen();
    } catch (error) {
      return teacherFen();
    }
  }

  function syncSetupSideToMoveFromFen(value) {
    setupSideToMove = fenSideToMove(value || currentTeacherBoardFen());
    syncSelectedPieceButtons();
  }

  function clearTeacherGameStatus() {
    teacherGameStatusKey = "";
    if (!panel) {
      return;
    }
    var status = panel.querySelector(".teacher-board-game-status");
    if (!status) {
      return;
    }
    status.hidden = true;
    status.className = "teacher-board-game-status";
    status.textContent = "";
  }

  function syncTeacherGameStatusControl() {
    if (!panel) {
      return;
    }
    var button = panel.querySelector('[data-teacher-action="toggle-game-status"]');
    if (!button) {
      return;
    }
    var actionLabel = teacherGameStatusEnabled
      ? "Turn off checkmate and stalemate messages"
      : "Turn on checkmate and stalemate messages";
    button.textContent = "Result: " + (teacherGameStatusEnabled ? "On" : "Off");
    button.classList.toggle("is-active", teacherGameStatusEnabled);
    button.setAttribute("aria-pressed", teacherGameStatusEnabled ? "true" : "false");
    button.setAttribute("aria-label", actionLabel);
    button.setAttribute("title", actionLabel);
  }

  function renderTeacherGameStatus(kind, message, fen) {
    if (!teacherGameStatusEnabled || !panel) {
      clearTeacherGameStatus();
      return;
    }
    var nextKey = kind + "|" + fen;
    if (teacherGameStatusKey === nextKey) {
      return;
    }
    var status = panel.querySelector(".teacher-board-game-status");
    if (!status) {
      return;
    }
    teacherGameStatusKey = nextKey;
    status.className = "teacher-board-game-status is-" + kind;
    status.textContent = message;
    status.hidden = false;
  }

  async function evaluateTeacherGameStatus() {
    if (!teacherGameStatusEnabled || !iframe || !iframe.contentDocument) {
      clearTeacherGameStatus();
      return;
    }
    var fenElement = iframe.contentDocument.getElementById("currentFenCode");
    var fen = normalizeFenText(fenElement ? fenElement.textContent : "");
    if (!fen) {
      clearTeacherGameStatus();
      return;
    }

    var chessModule = await chessModulePromise;
    if (!teacherGameStatusEnabled || !chessModule || typeof chessModule.Chess !== "function") {
      clearTeacherGameStatus();
      return;
    }

    var currentFenElement = iframe && iframe.contentDocument
      ? iframe.contentDocument.getElementById("currentFenCode")
      : null;
    if (normalizeFenText(currentFenElement ? currentFenElement.textContent : "") !== fen) {
      return;
    }

    try {
      var game = new chessModule.Chess(fen);
      var checkmate = typeof game.isCheckmate === "function"
        ? game.isCheckmate()
        : typeof game.in_checkmate === "function" && game.in_checkmate();
      var stalemate = typeof game.isStalemate === "function"
        ? game.isStalemate()
        : typeof game.in_stalemate === "function" && game.in_stalemate();

      if (checkmate) {
        var winner = game.turn() === "w" ? "Black" : "White";
        renderTeacherGameStatus("checkmate", "Checkmate. " + winner + " wins.", fen);
        return;
      }
      if (stalemate) {
        renderTeacherGameStatus("stalemate", "Stalemate. Draw.", fen);
        return;
      }
      clearTeacherGameStatus();
    } catch (error) {
      clearTeacherGameStatus();
    }
  }

  function scheduleTeacherGameStatusCheck() {
    if (!teacherGameStatusEnabled) {
      clearTeacherGameStatus();
      return;
    }
    if (teacherGameStatusTimer) {
      window.clearTimeout(teacherGameStatusTimer);
    }
    teacherGameStatusTimer = window.setTimeout(function () {
      teacherGameStatusTimer = null;
      evaluateTeacherGameStatus();
    }, 60);
  }

  function disconnectTeacherGameStatusObserver() {
    if (teacherGameStatusObserver) {
      teacherGameStatusObserver.disconnect();
      teacherGameStatusObserver = null;
    }
    if (teacherGameStatusTimer) {
      window.clearTimeout(teacherGameStatusTimer);
      teacherGameStatusTimer = null;
    }
  }

  function observeTeacherGameStatus() {
    disconnectTeacherGameStatusObserver();
    if (!teacherGameStatusEnabled) {
      clearTeacherGameStatus();
      return;
    }
    if (!iframe || !iframe.contentDocument || !iframe.contentDocument.documentElement) {
      return;
    }
    teacherGameStatusObserver = new MutationObserver(scheduleTeacherGameStatusCheck);
    teacherGameStatusObserver.observe(iframe.contentDocument.documentElement, {
      childList: true,
      characterData: true,
      subtree: true
    });
    scheduleTeacherGameStatusCheck();
  }

  function resolveLessonDefaults(positions) {
    var foundDefault = false;
    var multipleDefaults = false;
    positions.forEach(function (position) {
      if (!position.isDefault) {
        return;
      }
      if (foundDefault) {
        position.isDefault = false;
        multipleDefaults = true;
      } else {
        foundDefault = true;
      }
    });
    if (!foundDefault && positions.length) {
      positions[0].isDefault = true;
    }
    return {
      defaultAdded: !foundDefault && positions.length > 0,
      multipleDefaults: multipleDefaults
    };
  }

  function normalizeLessonCsvPositions(rawRows) {
    var rows = rawRows.map(function (row, index) {
      return { row: row, sourceRow: index + 1 };
    }).filter(function (entry) {
      return !isBlankCsvRow(entry.row);
    });

    if (!rows.length) {
      throw new Error("The CSV does not contain a header row.");
    }

    var headers = rows[0].row.map(normalizeCsvHeader);
    var columnMap = Object.create(null);
    headers.forEach(function (header, index) {
      if (header && columnMap[header] == null) {
        columnMap[header] = index;
      }
    });

    if (columnMap.title == null || columnMap.fen == null) {
      throw new Error("The CSV must include title and fen columns.");
    }

    var dataRows = rows.slice(1);
    if (!dataRows.length) {
      throw new Error("The CSV does not contain any position rows.");
    }

    var positions = [];
    var usedIds = Object.create(null);
    var generatedIdCount = 0;
    var duplicateIdCount = 0;
    var hasValidOrder = false;

    dataRows.forEach(function (entry, sourceIndex) {
      function getColumn(name) {
        var columnIndex = columnMap[name];
        return columnIndex == null ? "" : String(entry.row[columnIndex] == null ? "" : entry.row[columnIndex]);
      }

      var title = getColumn("title").trim();
      var fen = normalizeFenText(getColumn("fen"));
      if (!title) {
        throw new Error("CSV row " + entry.sourceRow + " requires a title.");
      }
      if (!fen) {
        throw new Error("CSV row " + entry.sourceRow + " requires a FEN.");
      }

      var rawId = getColumn("id").trim();
      var baseId = rawId || slugifyLessonId(title) || "position-" + (sourceIndex + 1);
      var id = uniqueLessonId(usedIds, baseId);
      if (!rawId) {
        generatedIdCount += 1;
      } else if (id !== rawId) {
        duplicateIdCount += 1;
      }

      var rawOrder = getColumn("order").trim();
      var numericOrder = rawOrder === "" ? NaN : Number(rawOrder);
      var orderIsValid = Number.isFinite(numericOrder);
      if (orderIsValid) {
        hasValidOrder = true;
      }

      positions.push({
        order: orderIsValid ? numericOrder : sourceIndex + 1,
        id: id,
        title: title,
        fen: fen,
        orientation: normalizeLessonOrientation(getColumn("orientation")),
        teacherNote: getColumn("teacher_note").replace(/\r\n/g, "\n").trim(),
        isDefault: normalizeLessonDefault(getColumn("is_default")),
        loadError: "",
        _hasValidOrder: orderIsValid,
        _sourceIndex: sourceIndex
      });
    });

    if (hasValidOrder) {
      positions.sort(function (left, right) {
        if (left._hasValidOrder && right._hasValidOrder) {
          return left.order - right.order || left._sourceIndex - right._sourceIndex;
        }
        if (left._hasValidOrder !== right._hasValidOrder) {
          return left._hasValidOrder ? -1 : 1;
        }
        return left._sourceIndex - right._sourceIndex;
      });
    }

    positions.forEach(function (position, index) {
      if (!position._hasValidOrder) {
        position.order = index + 1;
      }
      delete position._hasValidOrder;
      delete position._sourceIndex;
    });

    var defaultResult = resolveLessonDefaults(positions);
    return {
      positions: positions,
      generatedIdCount: generatedIdCount,
      duplicateIdCount: duplicateIdCount,
      defaultAdded: defaultResult.defaultAdded,
      multipleDefaults: defaultResult.multipleDefaults
    };
  }

  function parseLessonCsv(text) {
    return normalizeLessonCsvPositions(parseCsvRows(text));
  }

  function normalizeStoredLessonPositions(items) {
    if (!Array.isArray(items) || !items.length) {
      throw new Error("Stored positions are missing.");
    }
    var usedIds = Object.create(null);
    var positions = items.map(function (item, index) {
      if (!item || typeof item !== "object") {
        throw new Error("Stored position is invalid.");
      }
      var title = String(item.title == null ? "" : item.title).trim();
      var fen = normalizeFenText(item.fen);
      if (!title || !fen) {
        throw new Error("Stored position is incomplete.");
      }
      var rawId = String(item.id == null ? "" : item.id).trim();
      var id = uniqueLessonId(usedIds, rawId || slugifyLessonId(title) || "position-" + (index + 1));
      var numericOrder = Number(item.order);
      return {
        order: Number.isFinite(numericOrder) ? numericOrder : index + 1,
        id: id,
        title: title,
        fen: fen,
        orientation: normalizeLessonOrientation(item.orientation),
        teacherNote: String(item.teacherNote == null ? "" : item.teacherNote).replace(/\r\n/g, "\n").trim(),
        isDefault: Boolean(item.isDefault),
        loadError: String(item.loadError == null ? "" : item.loadError)
      };
    });
    resolveLessonDefaults(positions);
    return positions;
  }

  function lessonStorageKey() {
    return STORAGE_PREFIX + window.location.pathname;
  }

  function safeLocalStorage() {
    try {
      return window.localStorage;
    } catch (error) {
      return null;
    }
  }

  function restoreTeacherGameStatusPreference() {
    var storage = safeLocalStorage();
    if (!storage) {
      return;
    }
    try {
      teacherGameStatusEnabled = storage.getItem(GAME_STATUS_STORAGE_KEY) !== "off";
    } catch (error) {
      teacherGameStatusEnabled = true;
    }
  }

  function persistTeacherGameStatusPreference() {
    var storage = safeLocalStorage();
    if (!storage) {
      return false;
    }
    try {
      storage.setItem(GAME_STATUS_STORAGE_KEY, teacherGameStatusEnabled ? "on" : "off");
      return true;
    } catch (error) {
      return false;
    }
  }

  function setTeacherGameStatusEnabled(enabled) {
    teacherGameStatusEnabled = Boolean(enabled);
    persistTeacherGameStatusPreference();
    syncTeacherGameStatusControl();
    if (!teacherGameStatusEnabled) {
      disconnectTeacherGameStatusObserver();
      clearTeacherGameStatus();
      return;
    }
    if (iframeReady) {
      observeTeacherGameStatus();
    }
  }

  function persistImportedLesson() {
    var storage = safeLocalStorage();
    if (!storage) {
      lessonImportMessage = "Imported positions are available for this session, but browser storage is unavailable.";
      lessonImportMessageKind = "warning";
      return false;
    }
    try {
      if (!lessonPositions.length) {
        storage.removeItem(lessonStorageKey());
        return true;
      }
      storage.setItem(lessonStorageKey(), JSON.stringify({
        version: STORAGE_VERSION,
        fileName: lessonCsvFileName,
        positions: lessonPositions.map(function (position) {
          return {
            order: position.order,
            id: position.id,
            title: position.title,
            fen: position.fen,
            orientation: position.orientation,
            teacherNote: position.teacherNote,
            isDefault: position.isDefault,
            loadError: position.loadError || ""
          };
        }),
        activePositionId: activeLessonPositionId,
        savedAt: new Date().toISOString()
      }));
      return true;
    } catch (error) {
      lessonImportMessage = "Imported positions are available for this session, but they could not be saved in browser storage.";
      lessonImportMessageKind = "warning";
      return false;
    }
  }

  function removePersistedLesson() {
    var storage = safeLocalStorage();
    if (!storage) {
      return false;
    }
    try {
      storage.removeItem(lessonStorageKey());
      return true;
    } catch (error) {
      return false;
    }
  }

  function restoreImportedLesson() {
    var storage = safeLocalStorage();
    if (!storage) {
      return;
    }
    try {
      var raw = storage.getItem(lessonStorageKey());
      if (!raw) {
        return;
      }
      var saved = JSON.parse(raw);
      if (!saved || saved.version !== STORAGE_VERSION) {
        return;
      }
      var restoredPositions = normalizeStoredLessonPositions(saved.positions);
      var savedActiveId = String(saved.activePositionId == null ? "" : saved.activePositionId);
      lessonPositions = restoredPositions;
      lessonCsvFileName = String(saved.fileName == null ? "" : saved.fileName).trim() || "Imported lesson.csv";
      restoredLessonPositionId = restoredPositions.some(function (position) {
        return position.id === savedActiveId;
      }) ? savedActiveId : "";
      activeLessonPositionId = "";
    } catch (error) {
      lessonPositions = [];
      lessonCsvFileName = "";
      activeLessonPositionId = "";
      restoredLessonPositionId = "";
    }
  }

  function lessonPositionById(id) {
    return lessonPositions.find(function (position) {
      return position.id === id;
    }) || null;
  }

  function defaultLessonPosition() {
    return lessonPositions.find(function (position) {
      return position.isDefault;
    }) || lessonPositions[0] || null;
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

  function postToBoard(message) {
    if (!iframe || !iframe.contentWindow) {
      return;
    }
    iframe.contentWindow.postMessage(message, window.location.origin);
  }

  function requestIframeReady() {
    postToBoard({ type: "teacherBoardPing" });
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

  function setupSideToMoveControl() {
    return [
      '<div class="teacher-side-to-move" role="group" aria-label="Side to move">',
      '  <span class="teacher-side-to-move-label">Side to move</span>',
      '  <button type="button" data-teacher-action="side-to-move" data-teacher-side="w" aria-pressed="' + (setupSideToMove === "w" ? "true" : "false") + '">White</button>',
      '  <button type="button" data-teacher-action="side-to-move" data-teacher-side="b" aria-pressed="' + (setupSideToMove === "b" ? "true" : "false") + '">Black</button>',
      '</div>'
    ].join("");
  }

  function setupBoardMenu() {
    return [
      '<div class="teacher-board-menu-wrap">',
      '  <button type="button" class="teacher-board-tool teacher-board-menu-button" data-teacher-action="toggle-board-menu" aria-haspopup="menu" aria-expanded="' + (boardMenuOpen ? "true" : "false") + '">Board</button>',
      '  <div class="teacher-board-menu" role="menu" aria-label="Board positions" ' + (boardMenuOpen ? "" : "hidden") + '>',
      '    <button type="button" role="menuitem" data-teacher-action="empty-board">Empty</button>',
      '    <button type="button" role="menuitem" data-teacher-action="start-board">Start</button>',
      '    <button type="button" role="menuitem" data-teacher-action="page-board">Page</button>',
      '  </div>',
      '</div>'
    ].join("");
  }

  function lessonMenuMessageHtml() {
    if (!lessonImportMessage) {
      return "";
    }
    var kind = lessonImportMessageKind || "info";
    return '<div class="teacher-lesson-import-message is-' + escapeAttribute(kind) + '" role="status">' + escapeHtml(lessonImportMessage) + '</div>';
  }

  function renderLessonMenu() {
    if (!panel) {
      return;
    }
    var menu = panel.querySelector(".teacher-lesson-menu");
    if (!menu) {
      return;
    }

    var html = [];
    if (!lessonPositions.length) {
      html.push('<div class="teacher-lesson-menu-head">');
      html.push('  <div class="teacher-lesson-menu-empty">No lesson CSV loaded</div>');
      html.push('</div>');
      html.push(lessonMenuMessageHtml());
      html.push('<div class="teacher-lesson-menu-actions">');
      html.push('  <button type="button" role="menuitem" data-teacher-action="import-lesson-csv" aria-label="Import Lesson CSV using the file picker">Import Lesson CSV</button>');
      html.push('</div>');
    } else {
      html.push('<div class="teacher-lesson-menu-head">');
      html.push('  <div class="teacher-lesson-menu-file">' + escapeHtml(lessonCsvFileName) + '</div>');
      html.push('  <div class="teacher-lesson-menu-count">' + lessonPositions.length + ' prepared position' + (lessonPositions.length === 1 ? "" : "s") + '</div>');
      html.push('</div>');
      html.push(lessonMenuMessageHtml());
      html.push('<div class="teacher-lesson-position-list" aria-label="Prepared positions">');
      lessonPositions.forEach(function (position) {
        var active = position.id === activeLessonPositionId;
        var error = Boolean(position.loadError);
        var ariaLabel = position.title + ", " + position.orientation + " orientation" + (active ? ", active" : "") + (error ? ", load error: " + position.loadError : "");
        html.push('<button type="button" class="teacher-lesson-position-item' + (active ? " is-active" : "") + (error ? " has-error" : "") + '" role="menuitemradio" aria-checked="' + (active ? "true" : "false") + '" aria-label="' + escapeAttribute(ariaLabel) + '" data-teacher-lesson-position="' + escapeAttribute(position.id) + '">');
        html.push('  <span class="teacher-lesson-position-check" aria-hidden="true">' + (active ? "✓" : "") + '</span>');
        html.push('  <span class="teacher-lesson-position-title">' + escapeHtml(position.title) + '</span>');
        html.push('  <span class="teacher-lesson-position-orientation">' + (position.orientation === "black" ? "Black" : "White") + '</span>');
        if (error) {
          html.push('  <span class="teacher-lesson-position-error" aria-hidden="true" title="' + escapeAttribute(position.loadError) + '">!</span>');
        }
        html.push('</button>');
      });
      html.push('</div>');
      html.push('<div class="teacher-lesson-menu-actions">');
      html.push('  <button type="button" role="menuitem" data-teacher-action="replace-lesson-csv" aria-label="Replace Lesson CSV using the file picker">Replace CSV</button>');
      html.push('  <button type="button" role="menuitem" data-teacher-action="clear-imported-lesson">Clear Imported Lesson</button>');
      html.push('</div>');
    }
    menu.innerHTML = html.join("");
    menu.hidden = !lessonMenuOpen;
  }

  function renderLessonPositionStatus() {
    if (!panel) {
      return;
    }
    var status = panel.querySelector(".teacher-lesson-status");
    if (!status) {
      return;
    }
    var position = lessonPositionById(activeLessonPositionId);
    if (!position) {
      status.hidden = true;
      status.innerHTML = "";
      return;
    }
    status.innerHTML = [
      '<div class="teacher-lesson-status-title">' + escapeHtml(position.title) + '</div>',
      position.teacherNote ? '<div class="teacher-lesson-status-note">' + escapeHtml(position.teacherNote) + '</div>' : ""
    ].join("");
    status.hidden = false;
  }

  function syncLessonMenuUi() {
    if (!panel) {
      return;
    }
    var button = panel.querySelector('[data-teacher-action="toggle-lesson-menu"]');
    if (button) {
      button.setAttribute("aria-expanded", lessonMenuOpen ? "true" : "false");
      button.classList.toggle("is-active", lessonMenuOpen);
    }
    renderLessonMenu();
    renderLessonPositionStatus();
  }

  function lessonMenuFocusableItems() {
    if (!panel) {
      return [];
    }
    return Array.prototype.slice.call(panel.querySelectorAll(".teacher-lesson-menu button:not([disabled])"));
  }

  function focusInitialLessonMenuItem() {
    var items = lessonMenuFocusableItems();
    if (!items.length) {
      return;
    }
    var preferred = items.find(function (item) {
      return item.getAttribute("data-teacher-lesson-position") === activeLessonPositionId;
    }) || items[0];
    preferred.focus();
  }

  function setLessonMenuOpen(open, options) {
    var nextOpen = Boolean(open);
    var settings = options || {};
    if (nextOpen) {
      boardMenuOpen = false;
      if (setupOpen) {
        setSetupOpen(false);
      }
    }
    lessonMenuOpen = nextOpen;
    syncSelectedPieceButtons();
    syncLessonMenuUi();
    if (nextOpen && settings.focusMenu) {
      window.requestAnimationFrame(focusInitialLessonMenuItem);
    } else if (!nextOpen && settings.returnFocus && panel) {
      var button = panel.querySelector('[data-teacher-action="toggle-lesson-menu"]');
      if (button) {
        button.focus();
      }
    }
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
      '  <button type="button" class="teacher-board-icon-button teacher-board-max-button" data-teacher-action="maximize" aria-label="Maximize teacher board" title="Maximize">Max</button>',
      '  <button type="button" class="teacher-board-icon-button" data-teacher-action="close" aria-label="Close teacher board" title="Close">x</button>',
      '</div>',
      '<div class="teacher-board-body">',
      '  <iframe class="teacher-board-frame" title="Interactive teacher chessboard" loading="lazy"></iframe>',
      '  <div class="teacher-board-game-status" role="status" aria-live="assertive" hidden></div>',
      '</div>',
      '<div class="teacher-board-setup-tray" hidden>',
      '  <div class="teacher-piece-tray">',
      setupBoardMenu(),
       setupColorToggle(),
       setupPieceRow(),
       '    <button type="button" class="teacher-piece-button teacher-piece-eraser" data-teacher-piece="eraser" aria-pressed="false" title="Erase pieces">Erase</button>',
       setupSideToMoveControl(),
      '  </div>',
      '  <button type="button" class="teacher-board-tool teacher-setup-done" data-teacher-action="done-setup">Done</button>',
      '</div>',
      '<div class="teacher-lesson-status" aria-live="polite" hidden></div>',
      '<div class="teacher-board-tools" aria-label="Teacher board tools">',
      '  <div class="teacher-lesson-menu-wrap">',
      '    <button type="button" class="teacher-board-tool teacher-lesson-menu-button" data-teacher-action="toggle-lesson-menu" aria-haspopup="menu" aria-expanded="false" aria-controls="teacherLessonMenu" title="Import and load prepared lesson positions">Lesson</button>',
      '    <div id="teacherLessonMenu" class="teacher-lesson-menu" role="menu" aria-label="Lesson positions" hidden></div>',
      '  </div>',
      '  <button type="button" class="teacher-board-tool" data-teacher-action="setup" aria-pressed="false" title="Open the quick piece setup tray">Setup</button>',
      '  <button type="button" class="teacher-board-tool" data-teacher-action="annotate" aria-pressed="false" title="Keep marks while left-clicking. Right-click marks squares. Alt+right-drag draws arrows.">Annotate</button>',
      '  <button type="button" class="teacher-board-tool" data-teacher-action="take-back">Take Back</button>',
      '  <button type="button" class="teacher-board-tool" data-teacher-action="clear-marks">Clear marks</button>',
      '  <button type="button" class="teacher-board-tool teacher-board-result-toggle" data-teacher-action="toggle-game-status" aria-pressed="' + (teacherGameStatusEnabled ? "true" : "false") + '">Result: ' + (teacherGameStatusEnabled ? "On" : "Off") + '</button>',
      '  <button type="button" class="teacher-board-tool" data-teacher-action="flip">Flip</button>',
      '  <button type="button" class="teacher-board-tool" data-teacher-action="reset">Reset</button>',
      '</div>',
      '<input type="file" class="teacher-lesson-file-input" accept=".csv,text/csv" aria-label="Choose Lesson CSV" hidden>'
    ].join("");

    iframe = panel.querySelector(".teacher-board-frame");
    lessonFileInput = panel.querySelector(".teacher-lesson-file-input");
    iframe.addEventListener("load", handleTeacherIframeLoad);
    lessonFileInput.addEventListener("change", handleLessonFileChange);
    panel.addEventListener("click", handlePanelClick);
    panel.addEventListener("contextmenu", handlePanelContextMenu, true);
    document.body.appendChild(panel);
    syncTeacherGameStatusControl();
    syncLessonMenuUi();
  }

  function handlePanelContextMenu(event) {
    if (!event.shiftKey) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  }

  function ensurePanel() {
    if (!panel) {
      createPanel();
    }
    if (iframe && !iframe.getAttribute("src")) {
      iframeReady = false;
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
    panel.querySelectorAll('[data-teacher-action="side-to-move"]').forEach(function (button) {
      var active = button.getAttribute("data-teacher-side") === setupSideToMove;
      setButtonState(button, active);
    });
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
       '<button type="button" class="teacher-piece-button teacher-piece-eraser" data-teacher-piece="eraser" aria-pressed="false" title="Erase pieces">Erase</button>',
       setupSideToMoveControl()
    ].join("");
    syncSelectedPieceButtons();
  }

  function setSetupOpen(open) {
    setupOpen = Boolean(open);
    if (setupOpen) {
      lessonMenuOpen = false;
    }
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
    syncLessonMenuUi();
    post(setupOpen ? "enterTeacherSetup" : "exitTeacherSetup");
  }

  function closeTeacherInteractionModes(clearAnnotations) {
    lessonMenuOpen = false;
    boardMenuOpen = false;
    if (setupOpen) {
      setSetupOpen(false);
    } else {
      selectedPiece = "";
    }
    if (annotateOpen) {
      annotateOpen = false;
      setButtonState(panel && panel.querySelector('[data-teacher-action="annotate"]'), false);
      post("toggleAnnotate");
    }
    syncSelectedPieceButtons();
    syncLessonMenuUi();
    if (clearAnnotations) {
      post("clearAnnotations");
    }
  }

  function invalidatePendingLessonLoads() {
    lessonLoadGeneration += 1;
    pendingLessonPosition = null;
    pendingLessonLoads = Object.create(null);
  }

  function sendPendingLessonLoad() {
    if (!iframeReady || !pendingLessonPosition) {
      return;
    }
    var pending = pendingLessonPosition;
    if (pending.generation !== lessonLoadGeneration) {
      pendingLessonPosition = null;
      return;
    }
    if (pending.kind === "lesson" && !lessonPositionById(pending.positionId)) {
      pendingLessonPosition = null;
      return;
    }
    pendingLessonPosition = null;
    lessonLoadRequestCounter += 1;
    var requestId = "teacher-lesson-" + lessonLoadRequestCounter;
    pendingLessonLoads[requestId] = pending;
    postToBoard({
      type: "loadFen",
      fen: pending.fen,
      mark: pending.kind === "lesson" ? [] : undefined,
      requestId: requestId
    });
  }

  function queueLessonPositionLoad(position, options) {
    if (!position) {
      return;
    }
    var settings = options || {};
    invalidatePendingLessonLoads();
    closeTeacherInteractionModes(true);
    pendingLessonPosition = {
      kind: "lesson",
      positionId: position.id,
      fen: position.fen,
      generation: lessonLoadGeneration,
      silent: Boolean(settings.silent)
    };
    if (!settings.silent) {
      lessonImportMessage = 'Loading "' + position.title + '"…';
      lessonImportMessageKind = "info";
    }
    syncLessonMenuUi();
    if (iframeReady) {
      sendPendingLessonLoad();
    } else {
      requestIframeReady();
    }
  }

  function selectLessonPosition(id) {
    var position = lessonPositionById(id);
    if (!position) {
      return;
    }
    queueLessonPositionLoad(position);
  }

  function loadOriginalPagePosition(options) {
    var settings = options || {};
    invalidatePendingLessonLoads();
    boardMenuOpen = false;
    lessonMenuOpen = false;
    selectedPiece = "";
    syncSelectedPieceButtons();
    syncLessonMenuUi();
    pendingLessonPosition = {
      kind: "page",
      fen: teacherFen(),
      generation: lessonLoadGeneration,
      silent: Boolean(settings.silent)
    };
    if (!settings.silent) {
      lessonImportMessage = "Loading the page position…";
      lessonImportMessageKind = "info";
      syncLessonMenuUi();
    }
    if (iframeReady) {
      sendPendingLessonLoad();
    } else {
      requestIframeReady();
    }
  }

  function handleTeacherBoardLoadResult(data) {
    var requestId = String(data.requestId == null ? "" : data.requestId);
    var pending = pendingLessonLoads[requestId];
    if (!pending) {
      return;
    }
    delete pendingLessonLoads[requestId];
    if (pending.generation !== lessonLoadGeneration) {
      return;
    }

    if (!data.ok) {
      var errorMessage = String(data.error || "Invalid FEN.");
      if (pending.kind === "lesson") {
        var failedPosition = lessonPositionById(pending.positionId);
        if (failedPosition) {
          failedPosition.loadError = errorMessage;
          lessonImportMessage = 'Could not load "' + failedPosition.title + '": ' + errorMessage;
          lessonImportMessageKind = "danger";
          persistImportedLesson();
        }
      } else {
        lessonImportMessage = "Could not load the page position: " + errorMessage;
        lessonImportMessageKind = "danger";
      }
      syncLessonMenuUi();
      return;
    }

    syncSetupSideToMoveFromFen(data.fen || pending.fen);

    if (pending.kind === "lesson") {
      var position = lessonPositionById(pending.positionId);
      if (!position) {
        return;
      }
      postToBoard({ type: "setOrientation", orientation: position.orientation });
      position.loadError = "";
      activeLessonPositionId = position.id;
      restoredLessonPositionId = position.id;
      if (!pending.silent) {
        lessonImportMessage = 'Loaded "' + position.title + '".';
        lessonImportMessageKind = "success";
      }
      persistImportedLesson();
    } else {
      postToBoard({ type: "setOrientation", orientation: "white" });
      activeLessonPositionId = "";
      restoredLessonPositionId = "";
      if (!pending.silent) {
        lessonImportMessage = "Loaded the page position.";
        lessonImportMessageKind = "success";
      }
      persistImportedLesson();
    }
    syncLessonMenuUi();
  }

  function handleTeacherBoardMessage(event) {
    if (!iframe || event.source !== iframe.contentWindow || event.origin !== window.location.origin) {
      return;
    }
    var data = event.data;
    if (!data || typeof data !== "object") {
      return;
    }
    if (data.type === "teacherBoardReady") {
      iframeReady = true;
      observeTeacherGameStatus();
      syncSetupSideToMoveFromFen();
      sendPendingLessonLoad();
      return;
    }
    if (data.type === "teacherBoardLoadResult") {
      handleTeacherBoardLoadResult(data);
    }
  }

  function handleTeacherIframeLoad() {
    disconnectTeacherGameStatusObserver();
    clearTeacherGameStatus();
    iframeReady = false;
    requestIframeReady();
  }

  function openLessonCsvPicker() {
    if (!lessonFileInput) {
      return;
    }
    lessonFileInput.value = "";
    lessonFileInput.click();
  }

  function isCsvFile(file) {
    return Boolean(file && /\.csv$/i.test(String(file.name || "")));
  }

  async function importLessonCsvFile(file) {
    if (!file) {
      return;
    }
    try {
      if (!isCsvFile(file)) {
        throw new Error("Choose a file whose name ends in .csv.");
      }
      var imported = parseLessonCsv(await file.text());
      var warnings = [];
      if (imported.generatedIdCount) {
        warnings.push(imported.generatedIdCount + " missing ID" + (imported.generatedIdCount === 1 ? " was" : "s were") + " generated.");
      }
      if (imported.duplicateIdCount) {
        warnings.push(imported.duplicateIdCount + " duplicate ID" + (imported.duplicateIdCount === 1 ? " was" : "s were") + " renamed.");
      }
      if (imported.defaultAdded) {
        warnings.push("No default was specified, so the first position is the default.");
      }
      if (imported.multipleDefaults) {
        warnings.push("Only the first default position was retained.");
      }

      invalidatePendingLessonLoads();
      lessonPositions = imported.positions;
      activeLessonPositionId = "";
      restoredLessonPositionId = "";
      lessonCsvFileName = String(file.name || "lesson-positions.csv");
      lessonImportMessage = "Imported " + lessonPositions.length + " prepared position" + (lessonPositions.length === 1 ? "" : "s") + "." + (warnings.length ? " " + warnings.join(" ") : "");
      lessonImportMessageKind = warnings.length ? "warning" : "success";
      persistImportedLesson();
      syncLessonMenuUi();
      queueLessonPositionLoad(defaultLessonPosition());
    } catch (error) {
      lessonImportMessage = error && error.message ? error.message : "Unable to import that CSV.";
      lessonImportMessageKind = "danger";
      syncLessonMenuUi();
    } finally {
      if (lessonFileInput) {
        lessonFileInput.value = "";
      }
    }
  }

  function handleLessonFileChange(event) {
    var file = event.target && event.target.files ? event.target.files[0] : null;
    importLessonCsvFile(file);
  }

  function clearImportedLesson() {
    if (!lessonPositions.length) {
      return;
    }
    var fileName = lessonCsvFileName || "the imported lesson";
    if (!window.confirm('Clear imported lesson "' + fileName + '"? The downloaded CSV will not be deleted.')) {
      return;
    }
    invalidatePendingLessonLoads();
    var removed = removePersistedLesson();
    lessonPositions = [];
    activeLessonPositionId = "";
    restoredLessonPositionId = "";
    lessonCsvFileName = "";
    lessonImportMessage = removed ? "" : "The imported lesson was cleared for this session, but browser storage could not be updated.";
    lessonImportMessageKind = removed ? "" : "warning";
    setLessonMenuOpen(false);
    loadOriginalPagePosition({ silent: true });
  }

  function openPanel() {
    ensurePanel();
    panel.hidden = false;
    panel.classList.remove("is-minimized");
    requestIframeReady();
    if (lessonPositions.length) {
      var position = lessonPositionById(activeLessonPositionId) ||
        lessonPositionById(restoredLessonPositionId) ||
        defaultLessonPosition();
      queueLessonPositionLoad(position, { silent: true });
    }
  }

  function setMaximized(value) {
    maximized = Boolean(value);
    if (!panel) {
      return;
    }
    lessonMenuOpen = false;
    boardMenuOpen = false;
    panel.classList.toggle("is-maximized", maximized);
    var button = panel.querySelector('[data-teacher-action="maximize"]');
    if (button) {
      button.textContent = maximized ? "Restore" : "Max";
      button.setAttribute("aria-label", maximized ? "Restore teacher board" : "Maximize teacher board");
      button.setAttribute("title", maximized ? "Restore" : "Maximize");
    }
    syncSelectedPieceButtons();
    syncLessonMenuUi();
  }

  function closePanel() {
    if (!panel) {
      return;
    }
    invalidatePendingLessonLoads();
    if (annotateOpen) {
      post("toggleAnnotate");
    }
    annotateOpen = false;
    if (setupOpen) {
      setSetupOpen(false);
    } else {
      post("exitTeacherSetup");
    }
    lessonMenuOpen = false;
    boardMenuOpen = false;
    selectedPiece = "";
    panel.hidden = true;
    panel.classList.remove("is-minimized");
    setMaximized(false);
    setButtonState(panel.querySelector('[data-teacher-action="setup"]'), false);
    setButtonState(panel.querySelector('[data-teacher-action="annotate"]'), false);
    syncSelectedPieceButtons();
    syncLessonMenuUi();
  }

  function toggleMinimize() {
    if (!panel) {
      return;
    }
    lessonMenuOpen = false;
    boardMenuOpen = false;
    if (maximized) {
      setMaximized(false);
    }
    panel.classList.toggle("is-minimized");
    syncSelectedPieceButtons();
    syncLessonMenuUi();
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
    var lessonPositionButton = event.target.closest("[data-teacher-lesson-position]");
    if (lessonPositionButton) {
      selectLessonPosition(lessonPositionButton.getAttribute("data-teacher-lesson-position") || "");
      return;
    }

    var pieceButton = event.target.closest("[data-teacher-piece]");
    if (pieceButton) {
      boardMenuOpen = false;
      lessonMenuOpen = false;
      handlePieceSelect(pieceButton.getAttribute("data-teacher-piece") || "");
      syncLessonMenuUi();
      return;
    }

    var button = event.target.closest("[data-teacher-action]");
    if (!button) {
      boardMenuOpen = false;
      if (!event.target.closest(".teacher-lesson-menu-wrap")) {
        lessonMenuOpen = false;
      }
      syncSelectedPieceButtons();
      syncLessonMenuUi();
      return;
    }
    var action = button.getAttribute("data-teacher-action");

    if (action === "toggle-lesson-menu") {
      setLessonMenuOpen(!lessonMenuOpen, { focusMenu: !lessonMenuOpen });
      return;
    }
    if (action === "import-lesson-csv" || action === "replace-lesson-csv") {
      openLessonCsvPicker();
      return;
    }
    if (action === "clear-imported-lesson") {
      clearImportedLesson();
      return;
    }
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
    if (action === "side-to-move") {
      setupSideToMove = button.getAttribute("data-teacher-side") === "b" ? "b" : "w";
      boardMenuOpen = false;
      syncSelectedPieceButtons();
      post("setSideToMove", { side: setupSideToMove });
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
    if (action === "maximize") {
      if (panel.classList.contains("is-minimized")) {
        panel.classList.remove("is-minimized");
      }
      setMaximized(!maximized);
      return;
    }
    if (action === "toggle-game-status") {
      setTeacherGameStatusEnabled(!teacherGameStatusEnabled);
      return;
    }
    if (action === "setup") {
      lessonMenuOpen = false;
      if (!setupOpen && annotateOpen) {
        annotateOpen = false;
        setButtonState(panel.querySelector('[data-teacher-action="annotate"]'), false);
        post("toggleAnnotate");
      }
      setSetupOpen(!setupOpen);
      return;
    }
    if (action === "toggle-board-menu") {
      lessonMenuOpen = false;
      boardMenuOpen = !boardMenuOpen;
      syncSelectedPieceButtons();
      syncLessonMenuUi();
      return;
    }
    if (action === "done-setup") {
      setSetupOpen(false);
      return;
    }
    if (action === "empty-board") {
      invalidatePendingLessonLoads();
      selectedPiece = "";
      boardMenuOpen = false;
      syncSelectedPieceButtons();
      post("emptyTeacherBoard", { side: setupSideToMove });
      return;
    }
    if (action === "start-board") {
      invalidatePendingLessonLoads();
      selectedPiece = "";
      boardMenuOpen = false;
      syncSelectedPieceButtons();
      post("startTeacherBoard", { side: setupSideToMove });
      return;
    }
    if (action === "page-board") {
      loadOriginalPagePosition();
      return;
    }
    if (action === "annotate") {
      lessonMenuOpen = false;
      annotateOpen = !annotateOpen;
      if (annotateOpen && setupOpen) {
        setSetupOpen(false);
      }
      setButtonState(button, annotateOpen);
      post("toggleAnnotate");
      syncLessonMenuUi();
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
    if (action === "take-back") {
      post("takeBack");
      return;
    }
    if (action === "reset") {
      invalidatePendingLessonLoads();
      selectedPiece = "";
      syncSelectedPieceButtons();
      post("reset");
    }
  }

  function handleDocumentClick(event) {
    if (!lessonMenuOpen || !panel) {
      return;
    }
    if (!event.target.closest(".teacher-lesson-menu-wrap")) {
      setLessonMenuOpen(false);
    }
  }

  function handleDocumentKeydown(event) {
    if (!lessonMenuOpen || !panel) {
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setLessonMenuOpen(false, { returnFocus: true });
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Home" && event.key !== "End") {
      return;
    }
    var items = lessonMenuFocusableItems();
    if (!items.length) {
      return;
    }
    event.preventDefault();
    var currentIndex = items.indexOf(document.activeElement);
    var nextIndex;
    if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = items.length - 1;
    } else if (event.key === "ArrowUp") {
      nextIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
    } else {
      nextIndex = currentIndex < 0 || currentIndex >= items.length - 1 ? 0 : currentIndex + 1;
    }
    items[nextIndex].focus();
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

  restoreTeacherGameStatusPreference();
  restoreImportedLesson();
  window.addEventListener("message", handleTeacherBoardMessage);
  document.addEventListener("click", handleDocumentClick);
  document.addEventListener("keydown", handleDocumentKeydown);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectButton);
  } else {
    injectButton();
  }
})();
