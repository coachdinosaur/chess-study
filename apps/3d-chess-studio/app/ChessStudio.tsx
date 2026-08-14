import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChessBoard3D,
  type BoardTheme,
  type CameraView,
  type ChessBoardHandle,
} from "./ChessBoard3D";
import {
  PIECE_SYMBOLS,
  PIECE_TYPES,
  cloneDocument,
  emptyDocument,
  kingsOnlyDocument,
  parseFen,
  pieceCode,
  pieceLabel,
  positionWarnings,
  startingDocument,
  toFen,
  type PieceCode,
  type PieceColor,
  type PositionDocument,
  type Square,
} from "./chess";

type Tool = "place" | "move" | "erase";

const CAMERA_BUTTONS: { view: CameraView; label: string }[] = [
  { view: "angle", label: "Angle" },
  { view: "top", label: "Top" },
  { view: "white", label: "White" },
  { view: "black", label: "Black" },
  { view: "left", label: "Left" },
  { view: "right", label: "Right" },
  { view: "low", label: "Low" },
];

const EN_PASSANT_OPTIONS = [
  "-",
  ..."abcdefgh".split("").map((file) => `${file}3`),
  ..."abcdefgh".split("").map((file) => `${file}6`),
];

function ToolButton({
  active,
  title,
  description,
  shortcut,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  shortcut: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`tool-button ${active ? "is-active" : ""}`}
      type="button"
      onClick={onClick}
      aria-pressed={active}
    >
      <span className="tool-copy">
        <strong>{title}</strong>
        <span>{description}</span>
      </span>
      <kbd>{shortcut}</kbd>
    </button>
  );
}

function PiecePalette({
  color,
  selected,
  onSelect,
}: {
  color: PieceColor;
  selected: PieceCode;
  onSelect: (piece: PieceCode) => void;
}) {
  return (
    <div className="piece-group">
      <div className="piece-group-heading">
        <span className={`color-dot ${color}`} />
        <span>{color === "white" ? "White pieces" : "Black pieces"}</span>
      </div>
      <div className="piece-grid">
        {PIECE_TYPES.map((type) => {
          const code = pieceCode(color, type);
          return (
            <button
              key={code}
              type="button"
              className={`piece-button ${color} ${selected === code ? "is-selected" : ""}`}
              onClick={() => onSelect(code)}
              aria-pressed={selected === code}
              aria-label={`Place ${pieceLabel(code)}`}
              title={pieceLabel(code)}
            >
              <span aria-hidden="true">{PIECE_SYMBOLS[code]}</span>
              <small>{type[0].toUpperCase()}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function ChessStudio() {
  const boardRef = useRef<ChessBoardHandle>(null);
  const announcementTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [document, setDocument] = useState<PositionDocument>(() => startingDocument());
  const [past, setPast] = useState<PositionDocument[]>([]);
  const [future, setFuture] = useState<PositionDocument[]>([]);
  const [tool, setTool] = useState<Tool>("place");
  const [selectedPiece, setSelectedPiece] = useState<PieceCode>("wP");
  const [moveFrom, setMoveFrom] = useState<Square | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [boardTheme, setBoardTheme] = useState<BoardTheme>("classic");
  const [fenDraft, setFenDraft] = useState(() => toFen(startingDocument()));
  const [fenError, setFenError] = useState("");
  const [announcement, setAnnouncement] = useState("Ready");

  const fen = useMemo(() => toFen(document), [document]);
  const warnings = useMemo(() => positionWarnings(document), [document]);
  const pieceCount = Object.keys(document.board).length;

  const announce = useCallback((message: string) => {
    setAnnouncement(message);
    if (announcementTimer.current) clearTimeout(announcementTimer.current);
    announcementTimer.current = setTimeout(() => setAnnouncement("Ready"), 2400);
  }, []);

  useEffect(() => () => {
    if (announcementTimer.current) clearTimeout(announcementTimer.current);
  }, []);

  const commit = useCallback(
    (next: PositionDocument, message?: string) => {
      setPast((items) => [...items.slice(-79), cloneDocument(document)]);
      setFuture([]);
      setDocument(cloneDocument(next));
      setFenDraft(toFen(next));
      if (message) announce(message);
    },
    [announce, document],
  );

  const undo = useCallback(() => {
    if (!past.length) return;
    const previous = past[past.length - 1];
    setPast((items) => items.slice(0, -1));
    setFuture((items) => [cloneDocument(document), ...items].slice(0, 80));
    setDocument(cloneDocument(previous));
    setFenDraft(toFen(previous));
    setMoveFrom(null);
    announce("Undid last change");
  }, [announce, document, past]);

  const redo = useCallback(() => {
    if (!future.length) return;
    const next = future[0];
    setFuture((items) => items.slice(1));
    setPast((items) => [...items.slice(-79), cloneDocument(document)]);
    setDocument(cloneDocument(next));
    setFenDraft(toFen(next));
    setMoveFrom(null);
    announce("Redid change");
  }, [announce, document, future]);

  const eraseSquare = useCallback(
    (square: Square) => {
      if (!document.board[square]) return;
      const next = cloneDocument(document);
      delete next.board[square];
      commit(next, `Removed piece from ${square}`);
      if (moveFrom === square) setMoveFrom(null);
    },
    [commit, document, moveFrom],
  );

  const actOnSquare = useCallback(
    (square: Square) => {
      if (tool === "erase") {
        eraseSquare(square);
        return;
      }

      if (tool === "place") {
        const next = cloneDocument(document);
        next.board[square] = selectedPiece;
        commit(next, `${pieceLabel(selectedPiece)} placed on ${square}`);
        setMoveFrom(null);
        return;
      }

      if (!moveFrom) {
        if (!document.board[square]) {
          announce("Choose an occupied square first");
          return;
        }
        setMoveFrom(square);
        announce(`Selected ${square}; choose a destination`);
        return;
      }

      if (moveFrom === square) {
        setMoveFrom(null);
        announce("Move cancelled");
        return;
      }

      const movingPiece = document.board[moveFrom];
      if (!movingPiece) {
        setMoveFrom(null);
        return;
      }
      const next = cloneDocument(document);
      delete next.board[moveFrom];
      next.board[square] = movingPiece;
      commit(next, `Moved ${pieceLabel(movingPiece)} from ${moveFrom} to ${square}`);
      setMoveFrom(null);
    },
    [announce, commit, document, eraseSquare, moveFrom, selectedPiece, tool],
  );

  const selectPiece = (piece: PieceCode) => {
    setSelectedPiece(piece);
    setTool("place");
    setMoveFrom(null);
    announce(`${pieceLabel(piece)} selected`);
  };

  const loadFen = () => {
    try {
      const parsed = parseFen(fenDraft);
      commit(parsed, "FEN loaded");
      setFenError("");
      setMoveFrom(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "That FEN could not be loaded.";
      setFenError(message);
      announce("FEN needs attention");
    }
  };

  const copyFen = async () => {
    try {
      await navigator.clipboard.writeText(fen);
      announce("FEN copied");
    } catch {
      const input = window.document.createElement("textarea");
      input.value = fen;
      window.document.body.appendChild(input);
      input.select();
      window.document.execCommand("copy");
      input.remove();
      announce("FEN copied");
    }
  };

  const updateDocument = (patch: Partial<PositionDocument>, message?: string) => {
    commit({ ...cloneDocument(document), ...patch }, message);
  };

  const toggleCastling = (flag: "K" | "Q" | "k" | "q") => {
    const current = document.castling === "-" ? "" : document.castling;
    const order = "KQkq";
    const nextFlags = current.includes(flag)
      ? current.replace(flag, "")
      : [...new Set(`${current}${flag}`)].sort((a, b) => order.indexOf(a) - order.indexOf(b)).join("");
    updateDocument({ castling: nextFlags || "-" }, "Castling rights updated");
  };

  const applyPreset = (next: PositionDocument, label: string) => {
    commit(next, `${label} loaded`);
    setMoveFrom(null);
  };

  useEffect(() => {
    const keyHandler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, button")) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
        return;
      }
      if (event.key === "1") setTool("place");
      if (event.key === "2") setTool("move");
      if (event.key === "3") setTool("erase");
      if (event.key.toLowerCase() === "f") setFlipped((value) => !value);
      if (event.key === "0") boardRef.current?.resetCamera();
      if (event.key === "Escape") setMoveFrom(null);
    };
    window.addEventListener("keydown", keyHandler);
    return () => window.removeEventListener("keydown", keyHandler);
  }, [redo, undo]);

  return (
    <main className="studio-shell">
      <header className="studio-header">
        <div className="brand-lockup">
          <span className="brand-cube" aria-hidden="true"><i /><i /><i /></span>
          <div>
            <p className="eyebrow">Interactive editor</p>
            <h1>3D Chess Position Studio</h1>
          </div>
        </div>
        <div className="header-actions">
          <span className="position-count">{pieceCount} pieces</span>
          <button className="quiet-button" type="button" onClick={undo} disabled={!past.length}>Undo</button>
          <button className="quiet-button" type="button" onClick={redo} disabled={!future.length}>Redo</button>
          <button className="primary-button" type="button" onClick={() => boardRef.current?.downloadPng()}>
            Download PNG
          </button>
        </div>
      </header>

      <section className="studio-grid">
        <aside className="panel tool-panel" aria-label="Piece and editing tools">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Build position</p>
              <h2>Pieces & tools</h2>
            </div>
            <span className="step-chip">01</span>
          </div>

          <div className="tool-stack">
            <ToolButton active={tool === "place"} title="Place" description="Choose a piece, then a square" shortcut="1" onClick={() => { setTool("place"); setMoveFrom(null); }} />
            <ToolButton active={tool === "move"} title="Move" description="Choose a piece, then its destination" shortcut="2" onClick={() => { setTool("move"); setMoveFrom(null); }} />
            <ToolButton active={tool === "erase"} title="Erase" description="Remove a piece from any square" shortcut="3" onClick={() => { setTool("erase"); setMoveFrom(null); }} />
          </div>

          <div className="section-rule" />
          <PiecePalette color="white" selected={selectedPiece} onSelect={selectPiece} />
          <PiecePalette color="black" selected={selectedPiece} onSelect={selectPiece} />

          <div className="section-rule" />
          <div className="preset-heading">Quick setups</div>
          <div className="preset-grid">
            <button type="button" onClick={() => applyPreset(startingDocument(), "Starting position")}>Start position</button>
            <button type="button" onClick={() => applyPreset(kingsOnlyDocument(), "Kings only")}>Kings only</button>
            <button type="button" className="danger-quiet" onClick={() => applyPreset(emptyDocument(), "Empty board")}>Clear board</button>
          </div>
          <p className="right-click-note">Tip: right-click any square to remove its piece.</p>
        </aside>

        <section className="board-stage" data-theme={boardTheme} aria-label="3D chessboard workspace">
          <div className="board-toolbar">
            <div className="view-buttons" aria-label="Camera views">
              {CAMERA_BUTTONS.map(({ view, label }) => (
                <button key={view} type="button" onClick={() => boardRef.current?.setView(view)}>{label}</button>
              ))}
            </div>
            <div className="board-toolbar-end">
              <div className="theme-switch" role="group" aria-label="Board style">
                {([
                  ["classic", "Classic"],
                  ["anime", "Anime"],
                  ["samurai", "Samurai"],
                ] as const).map(([theme, label]) => (
                  <button
                    key={theme}
                    type="button"
                    data-theme-option={theme}
                    className={boardTheme === theme ? "is-active" : ""}
                    aria-pressed={boardTheme === theme}
                    aria-label={`${label} board theme`}
                    onClick={() => setBoardTheme(theme)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setFlipped((value) => !value)} aria-pressed={flipped}>
                Flip board
              </button>
              <button type="button" onClick={() => boardRef.current?.resetCamera()}>Reset camera</button>
            </div>
          </div>

          <div className="board-viewport">
            <ChessBoard3D
              ref={boardRef}
              position={document.board}
              flipped={flipped}
              theme={boardTheme}
              activeSquare={moveFrom}
              onSquarePress={actOnSquare}
              onSquareErase={eraseSquare}
            />
            <div className="viewport-status" aria-live="polite">
              <span className={`status-dot ${announcement === "Ready" ? "ready" : "active"}`} />
              {moveFrom ? `${moveFrom} selected — choose destination` : announcement}
            </div>
          </div>
          <div className="camera-help" aria-label="Camera control instructions">
            <span><b>Drag</b> rotate</span>
            <span><b>Wheel / pinch</b> zoom</span>
            <span><b>Right-drag / two fingers</b> pan</span>
          </div>
        </section>

        <aside className="panel position-panel" aria-label="Position details and FEN">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Position data</p>
              <h2>Setup details</h2>
            </div>
            <span className="step-chip">02</span>
          </div>

          <div className="field-group">
            <span className="field-label" id="side-to-move-label">Side to move</span>
            <div className="segmented" role="group" aria-labelledby="side-to-move-label">
              <button type="button" className={document.sideToMove === "w" ? "is-active" : ""} onClick={() => updateDocument({ sideToMove: "w" }, "White to move")}>White</button>
              <button type="button" className={document.sideToMove === "b" ? "is-active" : ""} onClick={() => updateDocument({ sideToMove: "b" }, "Black to move")}>Black</button>
            </div>
          </div>

          <fieldset className="field-group castling-field">
            <legend>Castling rights</legend>
            <div className="check-grid">
              {(["K", "Q", "k", "q"] as const).map((flag) => (
                <label key={flag}>
                  <input type="checkbox" checked={document.castling.includes(flag)} onChange={() => toggleCastling(flag)} />
                  <span>{flag === "K" ? "White O-O" : flag === "Q" ? "White O-O-O" : flag === "k" ? "Black O-O" : "Black O-O-O"}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="compact-fields">
            <label>
              En passant
              <select value={document.enPassant} onChange={(event) => updateDocument({ enPassant: event.target.value }, "En-passant square updated")}>
                {EN_PASSANT_OPTIONS.map((square) => <option key={square} value={square}>{square}</option>)}
              </select>
            </label>
            <label>
              Halfmove
              <input type="number" min={0} value={document.halfmove} onChange={(event) => updateDocument({ halfmove: Math.max(0, Number(event.target.value) || 0) })} />
            </label>
            <label>
              Fullmove
              <input type="number" min={1} value={document.fullmove} onChange={(event) => updateDocument({ fullmove: Math.max(1, Number(event.target.value) || 1) })} />
            </label>
          </div>

          <div className="section-rule" />
          <div className="fen-heading">
            <label htmlFor="fen-input">FEN</label>
            <button type="button" onClick={copyFen}>Copy current</button>
          </div>
          <textarea
            id="fen-input"
            className={fenError ? "has-error" : ""}
            value={fenDraft}
            onChange={(event) => { setFenDraft(event.target.value); setFenError(""); }}
            rows={4}
            spellCheck={false}
            aria-describedby={fenError ? "fen-error" : "fen-help"}
          />
          {fenError ? <p className="field-error" id="fen-error">{fenError}</p> : <p className="field-help" id="fen-help">Paste a FEN to load any position, or copy the live position above.</p>}
          <button className="load-button" type="button" onClick={loadFen}>Load FEN</button>

          {warnings.length > 0 && (
            <div className="warning-card">
              <strong>Position check</strong>
              {warnings.map((warning) => <p key={warning}>{warning}</p>)}
            </div>
          )}
        </aside>
      </section>

      <footer className="studio-footer">
        <span>All position editing stays in your browser.</span>
        <span>Keyboard: 1 Place · 2 Move · 3 Erase · F Flip · 0 Reset camera · Ctrl/⌘ Z Undo</span>
      </footer>
    </main>
  );
}
