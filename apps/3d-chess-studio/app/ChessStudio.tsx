import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square as RulesSquare } from "chess.js";
import {
  ChessBoard3D,
  type CameraView,
  type ChessBoardHandle,
} from "./ChessBoard3D";
import {
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
type PromotionPiece = "q" | "r" | "b" | "n";
type PendingPromotion = {
  from: Square;
  to: Square;
  color: "w" | "b";
};

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
              <img
                src={`${import.meta.env.BASE_URL}pieces/mpchess/${code}.svg`}
                alt=""
                aria-hidden="true"
              />
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
  const [fenDraft, setFenDraft] = useState(() => toFen(startingDocument()));
  const [fenError, setFenError] = useState("");
  const [announcement, setAnnouncement] = useState("Ready");
  const [playMode, setPlayMode] = useState(false);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);

  const fen = useMemo(() => toFen(document), [document]);
  const warnings = useMemo(() => positionWarnings(document), [document]);
  const pieceCount = Object.keys(document.board).length;
  const playStatus = useMemo(() => {
    if (!playMode) return null;
    try {
      const game = new Chess(fen);
      const turn = game.turn() === "w" ? "White" : "Black";
      if (game.isCheckmate()) {
        return { label: `${turn} is checkmated`, detail: `${turn === "White" ? "Black" : "White"} wins`, tone: "game-over" };
      }
      if (game.isStalemate()) return { label: "Stalemate", detail: "Draw", tone: "game-over" };
      if (game.isInsufficientMaterial()) return { label: "Insufficient material", detail: "Draw", tone: "game-over" };
      if (game.isDrawByFiftyMoves()) return { label: "Fifty-move rule", detail: "Draw", tone: "game-over" };
      return {
        label: `${turn} to move`,
        detail: game.isCheck() ? "Check" : "Local two-player game",
        tone: game.isCheck() ? "check" : "playing",
      };
    } catch {
      return { label: "Position cannot be played", detail: "Return to Setup", tone: "game-over" };
    }
  }, [fen, playMode]);

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

  const finishPlayMove = useCallback(
    (from: Square, to: Square, promotion: PromotionPiece = "q") => {
      try {
        const game = new Chess(fen);
        const move = game.move({ from, to, promotion });
        const next = parseFen(game.fen());
        const suffix = game.isCheckmate() ? " — checkmate" : game.isCheck() ? " — check" : "";
        commit(next, `${move.san}${suffix}`);
        setMoveFrom(null);
        setPendingPromotion(null);
      } catch {
        announce("That move is not legal");
      }
    },
    [announce, commit, fen],
  );

  const actOnPlaySquare = useCallback(
    (square: Square) => {
      if (pendingPromotion) {
        announce("Choose a promotion piece first");
        return;
      }

      let game: Chess;
      try {
        game = new Chess(fen);
      } catch {
        announce("Return to Setup and correct this position");
        return;
      }
      if (game.isGameOver()) {
        announce("This game is over");
        return;
      }

      const selected = document.board[square];
      const turn = game.turn();
      if (!moveFrom) {
        if (!selected || selected[0] !== turn) {
          announce(`${turn === "w" ? "White" : "Black"} must choose a piece`);
          return;
        }
        setMoveFrom(square);
        announce(`${square} selected`);
        return;
      }

      if (moveFrom === square) {
        setMoveFrom(null);
        announce("Move cancelled");
        return;
      }

      if (selected?.[0] === turn) {
        setMoveFrom(square);
        announce(`${square} selected`);
        return;
      }

      const candidates = game
        .moves({ square: moveFrom as RulesSquare, verbose: true })
        .filter((move) => move.to === square);
      if (!candidates.length) {
        announce("That move is not legal");
        return;
      }
      if (candidates.some((move) => move.isPromotion())) {
        setPendingPromotion({ from: moveFrom, to: square, color: turn });
        announce("Choose a promotion piece");
        return;
      }
      finishPlayMove(moveFrom, square);
    },
    [announce, document.board, fen, finishPlayMove, moveFrom, pendingPromotion],
  );

  const actOnSquare = useCallback(
    (square: Square) => {
      if (playMode) {
        actOnPlaySquare(square);
        return;
      }
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
    [actOnPlaySquare, announce, commit, document, eraseSquare, moveFrom, playMode, selectedPiece, tool],
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

  const enterPlayMode = () => {
    try {
      new Chess(fen);
      setPlayMode(true);
      setTool("move");
      setMoveFrom(null);
      setPendingPromotion(null);
      announce("Play mode ready");
    } catch {
      setFenError("This position is not legal enough to start a game.");
      announce("Correct the position before playing");
    }
  };

  const enterSetupMode = () => {
    setPlayMode(false);
    setMoveFrom(null);
    setPendingPromotion(null);
    announce("Setup mode ready");
  };

  const startNewGame = () => {
    commit(startingDocument(), "New game started");
    setMoveFrom(null);
    setPendingPromotion(null);
    setFlipped(false);
    boardRef.current?.setView("angle");
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
      if (!playMode && event.key === "1") setTool("place");
      if (!playMode && event.key === "2") setTool("move");
      if (!playMode && event.key === "3") setTool("erase");
      if (event.key.toLowerCase() === "f") setFlipped((value) => !value);
      if (event.key === "0") boardRef.current?.resetCamera();
      if (event.key === "Escape") {
        setMoveFrom(null);
        setPendingPromotion(null);
      }
    };
    window.addEventListener("keydown", keyHandler);
    return () => window.removeEventListener("keydown", keyHandler);
  }, [playMode, redo, undo]);

  return (
    <main className={`studio-shell ${playMode ? "is-play-mode" : ""}`}>
      <header className="studio-header">
        <div className="brand-lockup">
          <span className="brand-cube" aria-hidden="true"><i /><i /><i /></span>
          <div>
            <p className="eyebrow">Interactive editor</p>
            <h1>3D Chess Position Studio</h1>
          </div>
        </div>
        <div className="header-actions">
          <div className="mode-switch" role="group" aria-label="Studio mode">
            <button type="button" className={!playMode ? "is-active" : ""} aria-pressed={!playMode} onClick={enterSetupMode}>Setup</button>
            <button type="button" className={playMode ? "is-active" : ""} aria-pressed={playMode} onClick={enterPlayMode}>Play</button>
          </div>
          {!playMode && <span className="position-count">{pieceCount} pieces</span>}
          {playMode ? (
            <>
              <button className="quiet-button" type="button" onClick={undo} disabled={!past.length}>Undo move</button>
              <button className="quiet-button" type="button" onClick={startNewGame}>New game</button>
            </>
          ) : (
            <>
              <button className="quiet-button" type="button" onClick={undo} disabled={!past.length}>Undo</button>
              <button className="quiet-button" type="button" onClick={redo} disabled={!future.length}>Redo</button>
            </>
          )}
          <button className="primary-button" type="button" onClick={() => boardRef.current?.downloadPng()}>
            Download PNG
          </button>
        </div>
      </header>

      <section className={`studio-grid ${playMode ? "is-play-mode" : ""}`}>
        {!playMode && <aside className="panel tool-panel" aria-label="Piece and editing tools">
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
        </aside>}

        <section className="board-stage" aria-label="3D chessboard workspace">
          <div className="board-toolbar">
            <div className="view-buttons" aria-label="Camera views">
              {CAMERA_BUTTONS.map(({ view, label }) => (
                <button key={view} type="button" onClick={() => boardRef.current?.setView(view)}>{label}</button>
              ))}
            </div>
            <div className="board-toolbar-end">
              <button type="button" onClick={() => setFlipped((value) => !value)} aria-pressed={flipped}>
                Flip board
              </button>
              <button type="button" onClick={() => boardRef.current?.resetCamera()}>Reset camera</button>
            </div>
          </div>

          {playMode && playStatus && (
            <div className={`play-status-bar ${playStatus.tone}`} aria-live="polite">
              <span className="play-turn-dot" aria-hidden="true" />
              <strong>{playStatus.label}</strong>
              <span>{playStatus.detail}</span>
            </div>
          )}

          <div className="board-viewport">
            <ChessBoard3D
              ref={boardRef}
              position={document.board}
              flipped={flipped}
              activeSquare={moveFrom}
              onSquarePress={actOnSquare}
              onSquareErase={playMode ? () => announce("Right-click erase is disabled in Play mode") : eraseSquare}
            />
            <div className="viewport-status" aria-live="polite">
              <span className={`status-dot ${announcement === "Ready" ? "ready" : "active"}`} />
              {moveFrom ? `${moveFrom} selected — choose destination` : announcement}
            </div>
            {pendingPromotion && (
              <div className="promotion-picker" role="dialog" aria-modal="true" aria-labelledby="promotion-title">
                <strong id="promotion-title">Promote pawn</strong>
                <span>Choose the new piece</span>
                <div>
                  {(["q", "r", "b", "n"] as PromotionPiece[]).map((promotion) => {
                    const code = `${pendingPromotion.color}${promotion.toUpperCase()}` as PieceCode;
                    return (
                      <button
                        key={promotion}
                        type="button"
                        onClick={() => finishPlayMove(pendingPromotion.from, pendingPromotion.to, promotion)}
                        aria-label={`Promote to ${promotion === "q" ? "queen" : promotion === "r" ? "rook" : promotion === "b" ? "bishop" : "knight"}`}
                      >
                        <img src={`${import.meta.env.BASE_URL}pieces/mpchess/${code}.svg`} alt="" aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          {!playMode && <div className="camera-help" aria-label="Camera control instructions">
            <span><b>Drag</b> rotate</span>
            <span><b>Wheel / pinch</b> zoom</span>
            <span><b>Right-drag / two fingers</b> pan</span>
          </div>}
        </section>

        {!playMode && <aside className="panel position-panel" aria-label="Position details and FEN">
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
        </aside>}
      </section>

      {!playMode && <footer className="studio-footer">
        <span>All position editing stays in your browser.</span>
        <span>Keyboard: 1 Place · 2 Move · 3 Erase · F Flip · 0 Reset camera · Ctrl/⌘ Z Undo</span>
      </footer>}
    </main>
  );
}
