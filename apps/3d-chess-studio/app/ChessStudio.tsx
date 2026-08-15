import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square as RulesSquare } from "chess.js";
import {
  ChessBoard3D,
  PIECE_PALETTES,
  type ArrowAnnotation,
  type CameraView,
  type ChessBoardHandle,
  type LastMove,
  type PiecePaletteId,
  type SquareAnnotation,
} from "./ChessBoard3D";
import {
  PIECE_TYPES,
  cloneDocument,
  create2DStudyUrl,
  createShareableUrl,
  emptyDocument,
  findBestBotMove,
  kingsOnlyDocument,
  parseFen,
  parseUrlPosition,
  pieceCode,
  pieceLabel,
  positionWarnings,
  startingDocument,
  toFen,
  type BotDifficulty,
  type BotSide,
  type PieceCode,
  type PieceColor,
  type PositionDocument,
  type Square,
  type ThemeId,
} from "./chess";
import {
  isAudioMuted,
  playCaptureSound,
  playCastleSound,
  playCheckSound,
  playGameOverSound,
  playMoveSound,
  toggleAudioMuted,
} from "./audio";

type Tool = "place" | "move" | "erase";
type PromotionPiece = "q" | "r" | "b" | "n";
type PendingPromotion = {
  from: Square;
  to: Square;
  color: "w" | "b";
};

type MoveRecord = {
  san: string;
  from: Square;
  to: Square;
  fen: string;
  captured: boolean;
  isCheck: boolean;
  isCastle: boolean;
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

const THEME_OPTIONS: { id: ThemeId; label: string }[] = [
  { id: "classic-walnut", label: "Classic Walnut" },
  { id: "tournament-vinyl", label: "Tournament Vinyl" },
  { id: "modern-marble", label: "Modern Marble" },
  { id: "midnight-obsidian", label: "Midnight Obsidian" },
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

  // Theme State
  const [themeId, setThemeId] = useState<ThemeId>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("3d-chess-theme") as ThemeId | null;
      if (saved && ["classic-walnut", "tournament-vinyl", "modern-marble", "midnight-obsidian"].includes(saved)) {
        return saved;
      }
    }
    return "classic-walnut";
  });

  // Piece Palette State
  const [piecePaletteId, setPiecePaletteId] = useState<PiecePaletteId>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("3d-chess-piece-palette") as PiecePaletteId | null;
      if (saved && Object.keys(PIECE_PALETTES).includes(saved)) {
        return saved;
      }
    }
    return "theme-default";
  });

  // Annotations (3D Arrows & Highlights)
  const [arrows, setArrows] = useState<ArrowAnnotation[]>([]);
  const [squareHighlights, setSquareHighlights] = useState<SquareAnnotation[]>([]);

  // Play Mode Opponent & AI Engine
  const [playOpponent, setPlayOpponent] = useState<"human" | "bot">("human");
  const [botSide, setBotSide] = useState<BotSide>("black");
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>("club");
  const [botThinking, setBotThinking] = useState(false);

  // Play Mode History & Acoustic State
  const [moveHistory, setMoveHistory] = useState<MoveRecord[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [initialPlayFen, setInitialPlayFen] = useState<string>(() => toFen(startingDocument()));
  const [lastMove, setLastMove] = useState<LastMove | null>(null);
  const [soundMuted, setSoundMuted] = useState<boolean>(() => isAudioMuted());

  const fen = useMemo(() => toFen(document), [document]);
  const warnings = useMemo(() => positionWarnings(document), [document]);
  const pieceCount = Object.keys(document.board).length;
  const isReviewingHistory = playMode && historyIndex < moveHistory.length - 1;

  const announce = useCallback((message: string) => {
    setAnnouncement(message);
    if (announcementTimer.current) clearTimeout(announcementTimer.current);
    announcementTimer.current = setTimeout(() => setAnnouncement("Ready"), 2400);
  }, []);

  // Theme switcher handler
  const handleThemeChange = (newTheme: ThemeId) => {
    setThemeId(newTheme);
    if (typeof window !== "undefined") {
      localStorage.setItem("3d-chess-theme", newTheme);
    }
    const label = THEME_OPTIONS.find((t) => t.id === newTheme)?.label || newTheme;
    announce(`${label} theme loaded`);
  };

  // Piece Palette switcher handler
  const handlePiecePaletteChange = (newPalette: PiecePaletteId) => {
    setPiecePaletteId(newPalette);
    if (typeof window !== "undefined") {
      localStorage.setItem("3d-chess-piece-palette", newPalette);
    }
    const label = PIECE_PALETTES[newPalette]?.label || newPalette;
    announce(`${label} piece colors active`);
  };

  // URL Deep-Link Bridge on mount
  useEffect(() => {
    const urlFen = parseUrlPosition();
    if (urlFen) {
      try {
        const parsed = parseFen(urlFen);
        setDocument(cloneDocument(parsed));
        setFenDraft(toFen(parsed));
        setInitialPlayFen(toFen(parsed));
        announce("Position loaded from link");
      } catch {
        // Ignore malformed URL FEN silently
      }
    }
  }, [announce]);

  const legalDestinations = useMemo(() => {
    if (!playMode || !moveFrom) return [];
    try {
      const game = new Chess(fen);
      const moves = game.moves({ square: moveFrom as RulesSquare, verbose: true });
      return moves.map((m) => m.to as Square);
    } catch {
      return [];
    }
  }, [fen, moveFrom, playMode]);

  const checkSquare = useMemo(() => {
    if (!playMode) return null;
    try {
      const game = new Chess(fen);
      if (!game.isCheck()) return null;
      const turn = game.turn();
      const kingCode = turn === "w" ? "wK" : "bK";
      const found = Object.entries(document.board).find(([, code]) => code === kingCode);
      return found ? (found[0] as Square) : null;
    } catch {
      return null;
    }
  }, [document.board, fen, playMode]);

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
      if (botThinking) {
        return { label: "Computer is thinking...", detail: `${botDifficulty.toUpperCase()} bot`, tone: "playing" };
      }
      return {
        label: `${turn} to move`,
        detail: game.isCheck() ? "Check" : isReviewingHistory ? `Reviewing move ${historyIndex + 1}` : playOpponent === "bot" ? `vs Computer (${botDifficulty})` : "Local two-player game",
        tone: game.isCheck() ? "check" : "playing",
      };
    } catch {
      return { label: "Position cannot be played", detail: "Return to Setup", tone: "game-over" };
    }
  }, [botDifficulty, botThinking, fen, historyIndex, isReviewingHistory, playMode, playOpponent]);

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
    if (playMode && moveHistory.length > 0) {
      // If playing vs bot, undo 2 half-moves so the human player gets their turn back
      const undoCount = playOpponent === "bot" && moveHistory.length >= 2 ? 2 : 1;
      const nextHistory = moveHistory.slice(0, -undoCount);
      setMoveHistory(nextHistory);
      setHistoryIndex(nextHistory.length - 1);
      const targetFen = nextHistory.length > 0 ? nextHistory[nextHistory.length - 1].fen : initialPlayFen;
      const targetDoc = parseFen(targetFen);
      setDocument(cloneDocument(targetDoc));
      setFenDraft(toFen(targetDoc));
      setMoveFrom(null);
      setLastMove(nextHistory.length > 0 ? { from: nextHistory[nextHistory.length - 1].from, to: nextHistory[nextHistory.length - 1].to } : null);
      announce(undoCount === 2 ? "Undid last turn" : "Undid last move");
      return;
    }
    if (!past.length) return;
    const previous = past[past.length - 1];
    setPast((items) => items.slice(0, -1));
    setFuture((items) => [cloneDocument(document), ...items].slice(0, 80));
    setDocument(cloneDocument(previous));
    setFenDraft(toFen(previous));
    setMoveFrom(null);
    announce("Undid last change");
  }, [announce, document, initialPlayFen, moveHistory, past, playMode, playOpponent]);

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
        const nextFen = game.fen();
        const next = parseFen(nextFen);
        const isCheck = game.isCheck();
        const isCheckmate = game.isCheckmate();
        const isGameOver = game.isGameOver();
        const isCastle = move.flags.includes("k") || move.flags.includes("q");
        const captured = Boolean(move.captured);

        if (isGameOver) {
          playGameOverSound();
        } else if (isCheck) {
          playCheckSound();
        } else if (isCastle) {
          playCastleSound();
        } else if (captured) {
          playCaptureSound();
        } else {
          playMoveSound();
        }

        const record: MoveRecord = {
          san: move.san,
          from,
          to,
          fen: nextFen,
          captured,
          isCheck,
          isCastle,
        };

        const newHistory = [...moveHistory.slice(0, historyIndex + 1), record];
        setMoveHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        setLastMove({ from, to });

        const suffix = isCheckmate ? " — checkmate" : isCheck ? " — check" : "";
        commit(next, `${move.san}${suffix}`);
        setMoveFrom(null);
        setPendingPromotion(null);
      } catch {
        announce("That move is not legal");
      }
    },
    [announce, commit, fen, historyIndex, moveHistory],
  );

  const finishPlayMoveRef = useRef(finishPlayMove);
  finishPlayMoveRef.current = finishPlayMove;

  // Trigger Local Bot Opponent Move
  useEffect(() => {
    if (!playMode || playOpponent !== "bot" || isReviewingHistory) {
      setBotThinking(false);
      return;
    }

    let game: Chess;
    try {
      game = new Chess(fen);
    } catch {
      setBotThinking(false);
      return;
    }

    if (game.isGameOver()) {
      setBotThinking(false);
      return;
    }

    const currentTurn = game.turn();
    const isBotTurn =
      (botSide === "white" && currentTurn === "w") ||
      (botSide === "black" && currentTurn === "b");

    if (!isBotTurn) {
      setBotThinking(false);
      return;
    }

    setBotThinking(true);
    const delay = 420 + Math.random() * 200;
    const timer = setTimeout(() => {
      try {
        const best = findBestBotMove(game, botDifficulty);
        if (best) {
          finishPlayMoveRef.current(best.from, best.to, best.promotion || "q");
        }
      } catch (err) {
        console.error("Bot move failed", err);
      } finally {
        setBotThinking(false);
      }
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [botDifficulty, botSide, fen, isReviewingHistory, playMode, playOpponent]);

  const actOnPlaySquare = useCallback(
    (square: Square) => {
      if (botThinking) {
        announce("Computer is thinking...");
        return;
      }
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

      // Check if user is clicking their own piece vs bot's piece
      if (playOpponent === "bot") {
        const isUserTurn = (botSide === "white" && turn === "b") || (botSide === "black" && turn === "w");
        if (!isUserTurn) {
          announce("Wait for computer move");
          return;
        }
      }

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
    [announce, botSide, botThinking, document.board, fen, finishPlayMove, moveFrom, pendingPromotion, playOpponent],
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
      setLastMove(null);
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

  const copyPgn = async () => {
    try {
      const pairs: string[] = [];
      for (let i = 0; i < moveHistory.length; i += 2) {
        const moveNum = Math.floor(i / 2) + 1;
        const white = moveHistory[i]?.san ?? "";
        const black = moveHistory[i + 1]?.san ?? "";
        pairs.push(black ? `${moveNum}. ${white} ${black}` : `${moveNum}. ${white}`);
      }
      const pgn = pairs.join(" ");
      await navigator.clipboard.writeText(pgn || "1. ");
      announce("PGN copied to clipboard");
    } catch {
      announce("Could not copy PGN");
    }
  };

  const copyShareLink = async () => {
    const url = createShareableUrl(fen);
    try {
      await navigator.clipboard.writeText(url);
      announce("Share link copied to clipboard");
    } catch {
      const input = window.document.createElement("textarea");
      input.value = url;
      window.document.body.appendChild(input);
      input.select();
      window.document.execCommand("copy");
      input.remove();
      announce("Share link copied to clipboard");
    }
  };

  const handleAddArrow = useCallback((arrow: ArrowAnnotation) => {
    setArrows((prev) => {
      const exists = prev.find((a) => a.from === arrow.from && a.to === arrow.to && a.color === arrow.color);
      if (exists) {
        return prev.filter((a) => !(a.from === arrow.from && a.to === arrow.to));
      }
      return [...prev.filter((a) => !(a.from === arrow.from && a.to === arrow.to)), arrow];
    });
  }, []);

  const handleToggleSquareHighlight = useCallback((highlight: SquareAnnotation) => {
    setSquareHighlights((prev) => {
      const exists = prev.find((h) => h.square === highlight.square);
      if (exists) {
        return prev.filter((h) => h.square !== highlight.square);
      }
      return [...prev, highlight];
    });
  }, []);

  const clearAnnotations = useCallback(() => {
    setArrows([]);
    setSquareHighlights([]);
    boardRef.current?.clearAnnotations?.();
    announce("Cleared annotations");
  }, [announce]);

  const goToMoveIndex = useCallback(
    (index: number) => {
      if (index < -1 || index >= moveHistory.length) return;
      setHistoryIndex(index);
      setMoveFrom(null);
      setPendingPromotion(null);
      if (index === -1) {
        const doc = parseFen(initialPlayFen);
        setDocument(cloneDocument(doc));
        setFenDraft(toFen(doc));
        setLastMove(null);
        announce("Initial position");
      } else {
        const record = moveHistory[index];
        const doc = parseFen(record.fen);
        setDocument(cloneDocument(doc));
        setFenDraft(toFen(doc));
        setLastMove({ from: record.from, to: record.to });
        announce(`Move ${index + 1}: ${record.san}`);
      }
    },
    [announce, initialPlayFen, moveHistory],
  );

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
    setLastMove(null);
  };

  const enterPlayMode = () => {
    try {
      new Chess(fen);
      setPlayMode(true);
      setInitialPlayFen(fen);
      setMoveHistory([]);
      setHistoryIndex(-1);
      setLastMove(null);
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

  const handleFlipBoard = useCallback(() => {
    setFlipped((value) => !value);
    boardRef.current?.flipCamera?.();
    announce("Flipped board perspective");
  }, [announce]);

  const startNewGame = () => {
    const startDoc = startingDocument();
    const startFen = toFen(startDoc);
    setInitialPlayFen(startFen);
    setMoveHistory([]);
    setHistoryIndex(-1);
    setLastMove(null);
    commit(startDoc, "New game started");
    setMoveFrom(null);
    setPendingPromotion(null);
    if (playOpponent === "bot" && botSide === "white") {
      setFlipped(true);
      boardRef.current?.setView("black");
    } else {
      setFlipped(false);
      boardRef.current?.setView("angle");
    }
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
      if (event.key.toLowerCase() === "f") handleFlipBoard();
      if (event.key.toLowerCase() === "c") clearAnnotations();
      if (event.key === "0") boardRef.current?.resetCamera();
      if (playMode && event.key === "ArrowLeft") {
        event.preventDefault();
        goToMoveIndex(historyIndex - 1);
      }
      if (playMode && event.key === "ArrowRight") {
        event.preventDefault();
        goToMoveIndex(historyIndex + 1);
      }
      if (event.key === "Escape") {
        setMoveFrom(null);
        setPendingPromotion(null);
      }
    };
    window.addEventListener("keydown", keyHandler);
    return () => window.removeEventListener("keydown", keyHandler);
  }, [clearAnnotations, goToMoveIndex, handleFlipBoard, historyIndex, playMode, redo, undo]);

  const hasAnnotations = arrows.length > 0 || squareHighlights.length > 0;

  return (
    <main className={`studio-shell ${playMode ? "is-play-mode" : ""}`}>
      <header className="studio-header">
        <div className="brand-lockup">
          <span className="brand-cube" aria-hidden="true"><i /><i /><i /></span>
          <div>
            <p className="eyebrow">Interactive 3D Chess Studio</p>
            <h1>3D Chess Position Studio</h1>
          </div>
        </div>
        <div className="header-actions">
          <div className="mode-switch" role="group" aria-label="Studio mode">
            <button type="button" className={!playMode ? "is-active" : ""} aria-pressed={!playMode} onClick={enterSetupMode}>Setup</button>
            <button type="button" className={playMode ? "is-active" : ""} aria-pressed={playMode} onClick={enterPlayMode}>Play</button>
          </div>

          <div className="theme-select-wrapper" title="Board theme">
            <select
              className="theme-select"
              value={themeId}
              onChange={(e) => handleThemeChange(e.target.value as ThemeId)}
              aria-label="Select board theme"
            >
              {THEME_OPTIONS.map(({ id, label }) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="theme-select-wrapper" title="Piece colors">
            <select
              className="theme-select"
              value={piecePaletteId}
              onChange={(e) => handlePiecePaletteChange(e.target.value as PiecePaletteId)}
              aria-label="Select piece colors"
            >
              {Object.entries(PIECE_PALETTES).map(([id, info]) => (
                <option key={id} value={id}>
                  {info.label}
                </option>
              ))}
            </select>
          </div>

          {!playMode && <span className="position-count">{pieceCount} pieces</span>}
          {playMode ? (
            <>
              <button className="quiet-button" type="button" onClick={undo} disabled={!moveHistory.length}>Undo move</button>
              <button className="quiet-button" type="button" onClick={startNewGame}>New game</button>
            </>
          ) : (
            <>
              <button className="quiet-button" type="button" onClick={undo} disabled={!past.length}>Undo</button>
              <button className="quiet-button" type="button" onClick={redo} disabled={!future.length}>Redo</button>
            </>
          )}
          <button
            className={`quiet-button sound-toggle ${soundMuted ? "is-muted" : ""}`}
            type="button"
            onClick={() => setSoundMuted(toggleAudioMuted())}
            aria-label={soundMuted ? "Unmute audio" : "Mute audio"}
            title={soundMuted ? "Audio muted" : "Audio enabled"}
          >
            {soundMuted ? "🔇 Muted" : "🔊 Sound"}
          </button>
          <button className="primary-button" type="button" onClick={() => boardRef.current?.downloadPng()}>
            Download PNG
          </button>
        </div>
      </header>

      <section className={`studio-grid ${playMode ? "is-play-mode" : ""}`}>
        {!playMode && (
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
            <div className="annotation-help-box">
              <p className="annotation-help-title">💡 3D Tactical Markings</p>
              <p className="right-click-note">
                <b>Right-drag</b> to draw 3D tactical arrows (Shift=Blue, Ctrl=Red).<br />
                <b>Right-click</b> to highlight square. Press <b>C</b> to clear.
              </p>
            </div>
          </aside>
        )}

        <section className="board-stage" aria-label="3D chessboard workspace">
          {!playMode && (
            <div className="board-toolbar">
              <div className="view-buttons" aria-label="Camera views">
                {CAMERA_BUTTONS.map(({ view, label }) => (
                  <button key={view} type="button" onClick={() => boardRef.current?.setView(view)}>{label}</button>
                ))}
              </div>
              <div className="board-toolbar-end">
                {hasAnnotations && (
                  <button type="button" className="clear-marks-btn" onClick={clearAnnotations} title="Clear 3D arrows and highlights">
                    Clear marks ({arrows.length + squareHighlights.length})
                  </button>
                )}
                <button type="button" onClick={copyShareLink} title="Copy shareable direct link to position">
                  Share link
                </button>
                <button type="button" onClick={handleFlipBoard} aria-pressed={flipped}>
                  Flip board
                </button>
                <button type="button" onClick={() => boardRef.current?.resetCamera()}>Reset camera</button>
              </div>
            </div>
          )}

          <div className="board-viewport">
            <ChessBoard3D
              ref={boardRef}
              position={document.board}
              flipped={flipped}
              activeSquare={moveFrom}
              legalDestinations={legalDestinations}
              lastMove={lastMove}
              checkSquare={checkSquare}
              themeId={themeId}
              piecePaletteId={piecePaletteId}
              arrows={arrows}
              squareHighlights={squareHighlights}
              onSquarePress={actOnSquare}
              onSquareErase={playMode ? () => announce("Right-click erase is disabled in Play mode") : eraseSquare}
              onAddArrow={handleAddArrow}
              onToggleSquareHighlight={handleToggleSquareHighlight}
            />
            {!playMode && (
              <div className="viewport-status" aria-live="polite">
                <span className={`status-dot ${announcement === "Ready" ? "ready" : "active"}`} />
                {moveFrom ? `${moveFrom} selected — choose destination` : announcement}
              </div>
            )}
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
          {!playMode && (
            <div className="camera-help" aria-label="Camera control instructions">
              <span><b>Drag</b> rotate</span>
              <span><b>Wheel / pinch</b> zoom</span>
              <span><b>Right-drag</b> draw 3D arrow</span>
            </div>
          )}
        </section>

        {playMode && (
          <aside className="panel play-history-panel" aria-label="Game moves and history">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Notation & Opponent</p>
                <h2>Game mode</h2>
              </div>
              <span className="step-chip">{moveHistory.length}</span>
            </div>

            {playStatus && (
              <div className={`sidebar-play-status ${playStatus.tone}`} aria-live="polite">
                <div className="sidebar-status-main">
                  <span className="play-turn-dot" aria-hidden="true" />
                  <div className="sidebar-status-texts">
                    <strong>{playStatus.label}</strong>
                    <span>{playStatus.detail}</span>
                  </div>
                </div>
                <div className="sidebar-viewport-status">
                  <span className={`status-dot ${announcement === "Ready" && !moveFrom ? "ready" : "active"}`} aria-hidden="true" />
                  <span className="sidebar-status-announcement">
                    {moveFrom ? `${moveFrom} selected — choose destination` : announcement}
                  </span>
                </div>
              </div>
            )}

            <div className="opponent-box">
              <div className="opponent-selector" role="group" aria-label="Game opponent">
                <button
                  type="button"
                  className={playOpponent === "human" ? "is-active" : ""}
                  onClick={() => setPlayOpponent("human")}
                >
                  2 Players (Local)
                </button>
                <button
                  type="button"
                  className={playOpponent === "bot" ? "is-active" : ""}
                  onClick={() => setPlayOpponent("bot")}
                >
                  vs Computer (Bot)
                </button>
              </div>

              {playOpponent === "bot" && (
                <div className="bot-controls">
                  <div className="bot-option-row">
                    <span className="bot-label">You play:</span>
                    <div className="segmented-small">
                      <button
                        type="button"
                        className={botSide === "black" ? "is-active" : ""}
                        onClick={() => {
                          setBotSide("black");
                          setFlipped(false);
                          boardRef.current?.setView("angle");
                        }}
                      >
                        White
                      </button>
                      <button
                        type="button"
                        className={botSide === "white" ? "is-active" : ""}
                        onClick={() => {
                          setBotSide("white");
                          setFlipped(true);
                          boardRef.current?.setView("black");
                        }}
                      >
                        Black
                      </button>
                    </div>
                  </div>
                  <div className="bot-option-row">
                    <span className="bot-label">Level:</span>
                    <div className="segmented-small">
                      <button
                        type="button"
                        className={botDifficulty === "casual" ? "is-active" : ""}
                        onClick={() => setBotDifficulty("casual")}
                      >
                        Casual
                      </button>
                      <button
                        type="button"
                        className={botDifficulty === "club" ? "is-active" : ""}
                        onClick={() => setBotDifficulty("club")}
                      >
                        Club
                      </button>
                      <button
                        type="button"
                        className={botDifficulty === "master" ? "is-active" : ""}
                        onClick={() => setBotDifficulty("master")}
                      >
                        Master
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="section-rule" />

            <div className="sidebar-camera-section" aria-label="Camera and board controls">
              <div className="sidebar-section-header">
                <span className="sidebar-section-title">Camera & Board</span>
                {hasAnnotations && (
                  <button type="button" className="clear-marks-mini-btn" onClick={clearAnnotations} title="Clear 3D arrows and highlights">
                    Clear marks ({arrows.length + squareHighlights.length})
                  </button>
                )}
              </div>

              <div className="sidebar-camera-grid" role="group" aria-label="Camera angles">
                {CAMERA_BUTTONS.map(({ view, label }) => (
                  <button key={view} type="button" onClick={() => boardRef.current?.setView(view)}>{label}</button>
                ))}
              </div>

              <div className="sidebar-board-actions">
                <button type="button" className="share-btn" onClick={copyShareLink} title="Copy shareable direct link to position">
                  Share link
                </button>
                <button type="button" onClick={handleFlipBoard} aria-pressed={flipped} title="Flip board perspective (F)">
                  Flip board
                </button>
                <button type="button" onClick={() => boardRef.current?.resetCamera()} title="Reset camera view (0)">
                  Reset camera
                </button>
              </div>
            </div>

            <div className="section-rule" />

            <div className="history-step-bar" role="group" aria-label="Move navigation">
              <button
                type="button"
                className="quiet-button nav-button"
                disabled={historyIndex <= -1}
                onClick={() => goToMoveIndex(-1)}
                title="Start of game"
                aria-label="Start of game"
              >
                ⏮
              </button>
              <button
                type="button"
                className="quiet-button nav-button"
                disabled={historyIndex <= -1}
                onClick={() => goToMoveIndex(historyIndex - 1)}
                title="Previous move"
                aria-label="Previous move"
              >
                ◀
              </button>
              <button
                type="button"
                className="quiet-button nav-button"
                disabled={historyIndex >= moveHistory.length - 1}
                onClick={() => goToMoveIndex(historyIndex + 1)}
                title="Next move"
                aria-label="Next move"
              >
                ▶
              </button>
              <button
                type="button"
                className="quiet-button nav-button"
                disabled={historyIndex >= moveHistory.length - 1}
                onClick={() => goToMoveIndex(moveHistory.length - 1)}
                title="Latest live move"
                aria-label="Latest live move"
              >
                ⏭
              </button>
            </div>

            {isReviewingHistory && (
              <div className="review-notice" role="status">
                <span>Reviewing move {historyIndex + 1} of {moveHistory.length}</span>
                <button type="button" onClick={() => goToMoveIndex(moveHistory.length - 1)}>
                  Resume live
                </button>
              </div>
            )}

            <div className="move-history-table" role="table" aria-label="Moves log">
              {moveHistory.length === 0 ? (
                <p className="empty-history-text">Make a move on the board to begin notation recording.</p>
              ) : (
                <div className="moves-rows">
                  {Array.from({ length: Math.ceil(moveHistory.length / 2) }).map((_, rowIndex) => {
                    const whiteIdx = rowIndex * 2;
                    const blackIdx = whiteIdx + 1;
                    const whiteMove = moveHistory[whiteIdx];
                    const blackMove = moveHistory[blackIdx];
                    return (
                      <div key={rowIndex} className="move-row" role="row">
                        <span className="move-num">{rowIndex + 1}.</span>
                        <button
                          type="button"
                          className={`move-btn ${historyIndex === whiteIdx ? "is-current" : ""}`}
                          onClick={() => goToMoveIndex(whiteIdx)}
                        >
                          {whiteMove.san}
                        </button>
                        {blackMove ? (
                          <button
                            type="button"
                            className={`move-btn ${historyIndex === blackIdx ? "is-current" : ""}`}
                            onClick={() => goToMoveIndex(blackIdx)}
                          >
                            {blackMove.san}
                          </button>
                        ) : (
                          <span className="move-placeholder" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="section-rule" />
            <div className="history-actions">
              <button className="quiet-button" type="button" onClick={copyPgn} disabled={moveHistory.length === 0}>
                Copy PGN
              </button>
              <button className="quiet-button" type="button" onClick={copyFen}>
                Copy FEN
              </button>
              <a
                className="quiet-button bridge-link"
                href={create2DStudyUrl(fen)}
                target="_blank"
                rel="noreferrer"
                title="Open this position in the 2D Study Board"
              >
                2D Board ↗
              </a>
            </div>
          </aside>
        )}

        {!playMode && (
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
              <div className="fen-actions-mini">
                <button type="button" onClick={copyFen}>Copy FEN</button>
                <button type="button" onClick={copyShareLink}>Share URL</button>
              </div>
            </div>
            <textarea
              id="fen-input"
              className={fenError ? "has-error" : ""}
              value={fenDraft}
              onChange={(event) => { setFenDraft(event.target.value); setFenError(""); }}
              rows={3}
              spellCheck={false}
              aria-describedby={fenError ? "fen-error" : "fen-help"}
            />
            {fenError ? <p className="field-error" id="fen-error">{fenError}</p> : <p className="field-help" id="fen-help">Paste a FEN to load any position, or copy the live position above.</p>}
            <div className="fen-load-row">
              <button className="load-button" type="button" onClick={loadFen}>Load FEN</button>
              <a
                className="quiet-button bridge-link-subtle"
                href={create2DStudyUrl(fen)}
                target="_blank"
                rel="noreferrer"
                title="Open this position in the 2D Study Board"
              >
                Open in 2D Board ↗
              </a>
            </div>

            {warnings.length > 0 && (
              <div className="warning-card">
                <strong>Position check</strong>
                {warnings.map((warning) => <p key={warning}>{warning}</p>)}
              </div>
            )}
          </aside>
        )}
      </section>

      {!playMode && (
        <footer className="studio-footer">
          <span>All position editing stays in your browser.</span>
          <span>Keyboard: 1 Place · 2 Move · 3 Erase · F Flip · C Clear marks · 0 Reset camera · Ctrl/⌘ Z Undo</span>
        </footer>
      )}
    </main>
  );
}
