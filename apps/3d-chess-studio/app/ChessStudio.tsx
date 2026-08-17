import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square as RulesSquare } from "chess.js";
import {
  ChessBoard3D,
  PIECE_PALETTES,
  type ArrowAnnotation,
  type CameraView,
  type ChessBoardHandle,
  type ClockDesignId,
  CLOCK_DESIGNS,
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
  type BestMoveResult,
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
  playClockSound,
  playGameOverSound,
  playMoveSound,
  toggleAudioMuted,
} from "./audio";
import { stockfishMaster } from "./stockfish-master";
import {
  LiveSession,
  createStudentLiveUrl,
  generateRoomCode,
  parseLiveRoomFromUrl,
  type RemotePointer,
  type Role,
} from "./live-session";

export type TimeControlId = "none" | "1m" | "3m" | "3m2s" | "5m" | "5m3s" | "10m" | "15m10s";

export const TIME_CONTROLS: Record<TimeControlId, { label: string; baseSeconds: number; incrementSeconds: number }> = {
  none: { label: "No Clock", baseSeconds: 0, incrementSeconds: 0 },
  "1m": { label: "1 min", baseSeconds: 60, incrementSeconds: 0 },
  "3m": { label: "3 min", baseSeconds: 180, incrementSeconds: 0 },
  "3m2s": { label: "3 | 2", baseSeconds: 180, incrementSeconds: 2 },
  "5m": { label: "5 min", baseSeconds: 300, incrementSeconds: 0 },
  "5m3s": { label: "5 | 3", baseSeconds: 300, incrementSeconds: 3 },
  "10m": { label: "10 min", baseSeconds: 600, incrementSeconds: 0 },
  "15m10s": { label: "15 | 10", baseSeconds: 900, incrementSeconds: 10 },
};

function formatClockTime(ms: number): string {
  if (ms <= 0) return "0:00.0";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (ms < 20000) {
    const tenths = Math.floor((ms % 1000) / 100);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}.${tenths}`;
  }
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}

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

const CLOCK_DESIGN_OPTIONS: { id: ClockDesignId; label: string }[] = [
  { id: "dgt-3000", label: "🏆 FIDE DGT 3000 (Official)" },
  { id: "chronos-metal", label: "⚡ Chronos Blitz Metal" },
  { id: "quantum-cyber", label: "🛸 Quantum Cyber Titanium" },
  { id: "analog-wood", label: "🪵 BHB Vintage Wood Analog" },
  { id: "analog-vintage", label: "⚙️ Retro Mechanical Chrome" },
  { id: "nordic-birch", label: "🌿 Nordic Birch Minimalist" },
  { id: "none", label: "🚫 Hide 3D Clock" },
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

  // 3D Clock Design State
  const [clockDesignId, setClockDesignId] = useState<ClockDesignId>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("3d-chess-clock-design") as ClockDesignId | null;
      if (saved) {
        if ((saved as string) === "digital-tournament") return "dgt-3000";
        if ((saved as string) === "digital-cyber") return "quantum-cyber";
        if (["dgt-3000", "chronos-metal", "quantum-cyber", "analog-wood", "analog-vintage", "nordic-birch", "none"].includes(saved)) {
          return saved;
        }
      }
    }
    return "dgt-3000";
  });

  // Annotations (3D Arrows & Highlights)
  const [arrows, setArrows] = useState<ArrowAnnotation[]>([]);
  const [squareHighlights, setSquareHighlights] = useState<SquareAnnotation[]>([]);

  // Studio UX & Layout Optimizations
  const [showReserveTrays, setShowReserveTrays] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Live Session State
  const [liveRoomId, setLiveRoomId] = useState<string | null>(null);
  const [liveRole, setLiveRole] = useState<Role | null>(null);
  const [liveStatus, setLiveStatus] = useState<"disconnected" | "connecting" | "connected" | "error">("disconnected");
  const [peerConnected, setPeerConnected] = useState<boolean>(false);
  const [studentMovesAllowed, setStudentMovesAllowed] = useState<boolean>(true);
  const [remotePointer, setRemotePointer] = useState<RemotePointer | null>(null);
  const liveSessionRef = useRef<LiveSession | null>(null);
  const lastBroadcastSquareRef = useRef<Square | null>(null);

  // Play Mode Opponent & AI Engine
  const [playOpponent, setPlayOpponent] = useState<"human" | "bot">("human");
  const [botSide, setBotSide] = useState<BotSide>("black");
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>("club");
  const [botThinking, setBotThinking] = useState(false);
  const [resignedSide, setResignedSide] = useState<"w" | "b" | null>(null);
  const [confirmingResign, setConfirmingResign] = useState<boolean>(false);
  const resignConfirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const botWorkerRef = useRef<Worker | null>(null);
  const botRequestIdRef = useRef<number>(0);

  // Play Mode History & Acoustic State
  const [moveHistory, setMoveHistory] = useState<MoveRecord[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [initialPlayFen, setInitialPlayFen] = useState<string>(() => toFen(startingDocument()));
  const [lastMove, setLastMove] = useState<LastMove | null>(null);
  const [soundMuted, setSoundMuted] = useState<boolean>(() => isAudioMuted());
  const historyTableRef = useRef<HTMLDivElement | null>(null);

  // Chess Clock State
  const [timeControlId, setTimeControlId] = useState<TimeControlId>("none");
  const [whiteTimeMs, setWhiteTimeMs] = useState<number>(300000);
  const [blackTimeMs, setBlackTimeMs] = useState<number>(300000);
  const [activeClockSide, setActiveClockSide] = useState<"w" | "b" | null>(null);
  const [clockRunning, setClockRunning] = useState<boolean>(false);
  const [flagFallenSide, setFlagFallenSide] = useState<"w" | "b" | null>(null);

  const fen = useMemo(() => toFen(document), [document]);
  const warnings = useMemo(() => positionWarnings(document), [document]);
  const pieceCount = Object.keys(document.board).length;
  const isReviewingHistory = playMode && historyIndex < moveHistory.length - 1;

  // Auto-scroll move history table smoothly when a move is made
  useEffect(() => {
    if (historyTableRef.current && !isReviewingHistory) {
      historyTableRef.current.scrollTop = historyTableRef.current.scrollHeight;
    }
  }, [moveHistory.length, isReviewingHistory]);

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

  // Clock Design switcher handler
  const handleClockDesignChange = (newDesign: ClockDesignId) => {
    setClockDesignId(newDesign);
    if (typeof window !== "undefined") {
      localStorage.setItem("3d-chess-clock-design", newDesign);
    }
    const label = CLOCK_DESIGN_OPTIONS.find((c) => c.id === newDesign)?.label || newDesign;
    announce(`${label} clock design loaded`);
  };

  const resetClock = useCallback((tcId: TimeControlId = timeControlId) => {
    const tc = TIME_CONTROLS[tcId];
    setWhiteTimeMs(tc.baseSeconds * 1000);
    setBlackTimeMs(tc.baseSeconds * 1000);
    setActiveClockSide(null);
    setClockRunning(false);
    setFlagFallenSide(null);
  }, [timeControlId]);

  const handleTimeControlChange = (tcId: TimeControlId) => {
    setTimeControlId(tcId);
    resetClock(tcId);
    announce(tcId === "none" ? "Chess clock disabled" : `Clock set to ${TIME_CONTROLS[tcId].label}`);
  };

  const pressClock = useCallback((side?: "w" | "b") => {
    if (flagFallenSide || resignedSide) return;

    if (!playMode) {
      setPlayMode(true);
    }

    let tcId = timeControlId;
    if (tcId === "none") {
      tcId = "5m";
      setTimeControlId("5m");
      resetClock("5m");
    }

    const tc = TIME_CONTROLS[tcId];
    playClockSound();

    if (!activeClockSide) {
      const targetSide = side === "w" ? "b" : side === "b" ? "w" : (document.sideToMove === "w" ? "b" : "w");
      setActiveClockSide(targetSide);
      setClockRunning(true);
      return;
    }

    if (side === "w" || (!side && activeClockSide === "w")) {
      setWhiteTimeMs((prev) => prev + tc.incrementSeconds * 1000);
      setActiveClockSide("b");
      setClockRunning(true);
    } else if (side === "b" || (!side && activeClockSide === "b")) {
      setBlackTimeMs((prev) => prev + tc.incrementSeconds * 1000);
      setActiveClockSide("w");
      setClockRunning(true);
    }
  }, [activeClockSide, document.sideToMove, flagFallenSide, playMode, resetClock, resignedSide, timeControlId]);

  // Chess Clock Ticking Interval Effect
  useEffect(() => {
    if (!playMode || timeControlId === "none" || !clockRunning || !activeClockSide || flagFallenSide || resignedSide) {
      return;
    }
    let lastTime = performance.now();
    const interval = setInterval(() => {
      const now = performance.now();
      const delta = now - lastTime;
      lastTime = now;

      if (activeClockSide === "w") {
        setWhiteTimeMs((prev) => {
          const next = prev - delta;
          if (next <= 0) {
            setFlagFallenSide("w");
            setClockRunning(false);
            playGameOverSound();
            announce("Black won on time (White flag fell)");
            return 0;
          }
          return next;
        });
      } else {
        setBlackTimeMs((prev) => {
          const next = prev - delta;
          if (next <= 0) {
            setFlagFallenSide("b");
            setClockRunning(false);
            playGameOverSound();
            announce("White won on time (Black flag fell)");
            return 0;
          }
          return next;
        });
      }
    }, 50);

    return () => clearInterval(interval);
  }, [activeClockSide, announce, clockRunning, flagFallenSide, playMode, resignedSide, timeControlId]);

  const initLiveSession = useCallback((roomId: string, role: Role) => {
    if (liveSessionRef.current) {
      liveSessionRef.current.disconnect();
      liveSessionRef.current = null;
    }

    setLiveRoomId(roomId);
    setLiveRole(role);

    const session = new LiveSession(roomId, role, {
      onStatusChange: (status) => {
        setLiveStatus(status);
        if (status === "connected") {
          announce(`Live session connected (${role === "teacher" ? "Coach" : "Student"})`);
        } else if (status === "disconnected") {
          announce("Live session disconnected");
        }
      },
      onPeerPresenceChange: (online) => {
        setPeerConnected(online);
        if (online) {
          announce(role === "teacher" ? "Student joined the 3D room" : "Coach is online in the 3D room");
        }
      },
      onPositionSync: (doc, actionLabel, actor) => {
        setDocument(cloneDocument(doc));
        setFenDraft(toFen(doc));
        setInitialPlayFen(toFen(doc));
        setMoveFrom(null);
        announce(`${actor === "teacher" ? "Coach" : "Student"}: ${actionLabel}`);
      },
      onLockStateChange: (allowed) => {
        setStudentMovesAllowed(allowed);
        announce(allowed ? "Coach unlocked the board" : "Coach locked the board (view only)");
      },
      onRemotePointer: (pointer) => {
        setRemotePointer(pointer);
      },
      onAnnotationsSync: (newArrows, newHighlights) => {
        setArrows(newArrows);
        setSquareHighlights(newHighlights);
      },
      onPresetSync: (preset, actor) => {
        const nextDoc = preset === "empty" ? emptyDocument() : startingDocument();
        setDocument(cloneDocument(nextDoc));
        setFenDraft(toFen(nextDoc));
        setInitialPlayFen(toFen(nextDoc));
        setMoveFrom(null);
        announce(`${actor === "teacher" ? "Coach" : "Student"} loaded ${preset} preset`);
      },
    });

    liveSessionRef.current = session;
    session.connect();
  }, [announce]);

  // Clean up session on unmount
  useEffect(() => {
    return () => {
      if (liveSessionRef.current) {
        liveSessionRef.current.disconnect();
        liveSessionRef.current = null;
      }
    };
  }, []);

  // URL Deep-Link Bridge & Live Room Check on mount
  useEffect(() => {
    const roomParams = parseLiveRoomFromUrl();
    if (roomParams) {
      initLiveSession(roomParams.roomId, roomParams.role);
    }

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
  }, [announce, initLiveSession]);

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

  const isGameOver = useMemo(() => {
    if (!playMode) return false;
    if (resignedSide) return true;
    try {
      const game = new Chess(fen);
      return game.isGameOver();
    } catch {
      return true;
    }
  }, [fen, playMode, resignedSide]);

  const playStatus = useMemo(() => {
    if (!playMode) return null;
    if (resignedSide) {
      const loser = resignedSide === "w" ? "White" : "Black";
      const winner = resignedSide === "w" ? "Black" : "White";
      return {
        label: `${loser} resigned`,
        detail: `${winner} wins by resignation`,
        tone: "game-over",
      };
    }
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
  }, [botDifficulty, botThinking, fen, historyIndex, isReviewingHistory, playMode, playOpponent, resignedSide]);

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
      if (liveSessionRef.current) {
        liveSessionRef.current.sendPosition(next, message || "Position updated");
      }
    },
    [announce, document],
  );

  const undo = useCallback(() => {
    if (liveRole === "student" && !studentMovesAllowed) {
      announce("Board is locked by teacher");
      return;
    }
    if (resignedSide) {
      setResignedSide(null);
      setConfirmingResign(false);
    }
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
  }, [announce, document, initialPlayFen, liveRole, moveHistory, past, playMode, playOpponent, resignedSide, studentMovesAllowed]);

  const redo = useCallback(() => {
    if (liveRole === "student" && !studentMovesAllowed) {
      announce("Board is locked by teacher");
      return;
    }
    if (!future.length) return;
    const next = future[0];
    setFuture((items) => items.slice(1));
    setPast((items) => [...items.slice(-79), cloneDocument(document)]);
    setDocument(cloneDocument(next));
    setFenDraft(toFen(next));
    setMoveFrom(null);
    announce("Redid change");
  }, [announce, document, future, liveRole, studentMovesAllowed]);

  const eraseSquare = useCallback(
    (square: Square) => {
      if (liveRole === "student" && !studentMovesAllowed) {
        announce("Board is locked by teacher");
        return;
      }
      if (!document.board[square]) return;
      const next = cloneDocument(document);
      delete next.board[square];
      commit(next, `Removed piece from ${square}`);
      if (moveFrom === square) setMoveFrom(null);
    },
    [announce, commit, document, liveRole, moveFrom, studentMovesAllowed],
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
          setClockRunning(false);
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

  const handleResign = useCallback(() => {
    if (!playMode || resignedSide) return;
    try {
      const game = new Chess(fen);
      if (game.isGameOver()) {
        announce("Game is already finished");
        return;
      }
    } catch {
      return;
    }

    if (!confirmingResign) {
      setConfirmingResign(true);
      if (resignConfirmTimer.current) clearTimeout(resignConfirmTimer.current);
      resignConfirmTimer.current = setTimeout(() => {
        setConfirmingResign(false);
      }, 4000);
      announce("Click Resign again to confirm");
      return;
    }

    // Confirmed resignation
    if (resignConfirmTimer.current) clearTimeout(resignConfirmTimer.current);
    setConfirmingResign(false);

    let sideToResign: "w" | "b" = "w";
    try {
      const game = new Chess(fen);
      if (playOpponent === "bot") {
        sideToResign = botSide === "white" ? "b" : "w";
      } else {
        sideToResign = game.turn();
      }
    } catch {
      sideToResign = "w";
    }

    setResignedSide(sideToResign);
    setBotThinking(false);
    playGameOverSound();
    const loser = sideToResign === "w" ? "White" : "Black";
    const winner = sideToResign === "w" ? "Black" : "White";
    announce(`${loser} resigned. ${winner} wins!`);
  }, [announce, botSide, confirmingResign, fen, playMode, playOpponent, resignedSide]);

  const finishPlayMoveRef = useRef(finishPlayMove);
  finishPlayMoveRef.current = finishPlayMove;

  // Instantiate background bot worker for non-blocking search
  useEffect(() => {
    if (typeof Worker !== "undefined") {
      try {
        const worker = new Worker(new URL("./bot.worker.ts", import.meta.url), { type: "module" });
        botWorkerRef.current = worker;
        return () => {
          worker.terminate();
          botWorkerRef.current = null;
        };
      } catch (err) {
        console.warn("Could not instantiate bot Web Worker; falling back to main thread engine.", err);
      }
    }
  }, []);

  // Trigger Local Bot Opponent Move (Non-blocking Web Worker with main-thread fallback)
  useEffect(() => {
    if (!playMode || playOpponent !== "bot" || isReviewingHistory || resignedSide) {
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
    const requestId = ++botRequestIdRef.current;
    const minDelay = 420 + Math.random() * 200;
    const startTime = performance.now();

    let timer: ReturnType<typeof setTimeout> | undefined;

    const executeMove = (best: BestMoveResult | null) => {
      if (requestId !== botRequestIdRef.current) return;
      setBotThinking(false);
      if (best) {
        finishPlayMoveRef.current(best.from, best.to, best.promotion || "q");
        if (timeControlId !== "none") {
          setTimeout(() => {
            pressClock();
          }, 150);
        }
      }
    };

    if (botDifficulty === "master") {
      let cancelled = false;
      stockfishMaster
        .findMasterMove(fen, 600)
        .then((best) => {
          if (cancelled || requestId !== botRequestIdRef.current) return;
          if (best) {
            const elapsed = performance.now() - startTime;
            const remainingDelay = Math.max(0, minDelay - elapsed);
            timer = setTimeout(() => {
              executeMove(best);
            }, remainingDelay);
          } else {
            // Fallback to worker if Stockfish didn't respond
            if (botWorkerRef.current) {
              botWorkerRef.current.postMessage({ id: requestId, fen, difficulty: "master" });
            } else {
              const fallback = findBestBotMove(game, "master");
              executeMove(fallback);
            }
          }
        })
        .catch(() => {
          if (cancelled || requestId !== botRequestIdRef.current) return;
          if (botWorkerRef.current) {
            botWorkerRef.current.postMessage({ id: requestId, fen, difficulty: "master" });
          } else {
            const fallback = findBestBotMove(game, "master");
            executeMove(fallback);
          }
        });

      return () => {
        cancelled = true;
        stockfishMaster.stop();
        if (timer) clearTimeout(timer);
      };
    }

    if (botWorkerRef.current) {
      const worker = botWorkerRef.current;
      const onMessage = (e: MessageEvent<{ id: number; bestMove: BestMoveResult | null }>) => {
        if (e.data.id === requestId) {
          worker.removeEventListener("message", onMessage);
          const elapsed = performance.now() - startTime;
          const remainingDelay = Math.max(0, minDelay - elapsed);
          timer = setTimeout(() => {
            executeMove(e.data.bestMove);
          }, remainingDelay);
        }
      };

      worker.addEventListener("message", onMessage);
      worker.postMessage({ id: requestId, fen, difficulty: botDifficulty });

      return () => {
        worker.removeEventListener("message", onMessage);
        if (timer) clearTimeout(timer);
      };
    } else {
      timer = setTimeout(() => {
        try {
          const best = findBestBotMove(game, botDifficulty);
          executeMove(best);
        } catch (err) {
          console.error("Bot move failed", err);
          setBotThinking(false);
        }
      }, minDelay);

      return () => {
        if (timer) clearTimeout(timer);
      };
    }
  }, [botDifficulty, botSide, fen, isReviewingHistory, playMode, playOpponent, resignedSide]);

  const actOnPlaySquare = useCallback(
    (square: Square) => {
      if (resignedSide) {
        announce("Game is over by resignation");
        return;
      }
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
      if (liveRole === "student" && !studentMovesAllowed) {
        announce("Board is locked by teacher");
        return;
      }
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
    [actOnPlaySquare, announce, commit, document, eraseSquare, liveRole, moveFrom, playMode, selectedPiece, studentMovesAllowed, tool],
  );

  const selectPiece = (piece: PieceCode) => {
    if (liveRole === "student" && !studentMovesAllowed) {
      announce("Board is locked by teacher");
      return;
    }
    setSelectedPiece(piece);
    setTool("place");
    setMoveFrom(null);
    announce(`${pieceLabel(piece)} selected`);
  };

  const handleSelectReservePiece = useCallback(
    (code: PieceCode) => {
      if (liveRole === "student" && !studentMovesAllowed) {
        announce("Board is locked by teacher");
        return;
      }
      setSelectedPiece(code);
      setTool("place");
      setMoveFrom(null);
      announce(`${pieceLabel(code)} selected from 3D tray`);
    },
    [announce, liveRole, studentMovesAllowed],
  );

  const handleDropReservePiece = useCallback(
    (code: PieceCode, square: Square) => {
      if (liveRole === "student" && !studentMovesAllowed) {
        announce("Board is locked by teacher");
        return;
      }
      if (playMode) {
        announce("Cannot place reserve pieces during play");
        return;
      }
      setSelectedPiece(code);
      setTool("place");
      setMoveFrom(null);
      const next = cloneDocument(document);
      next.board[square] = code;
      commit(next, `${pieceLabel(code)} placed on ${square}`);
    },
    [announce, commit, document, liveRole, playMode, studentMovesAllowed],
  );

  const handleDropMovePiece = useCallback(
    (from: Square, to: Square) => {
      if (from === to) return;
      if (liveRole === "student" && !studentMovesAllowed) {
        announce("Board is locked by teacher");
        return;
      }
      if (playMode) {
        try {
          const game = new Chess(fen);
          const turn = game.turn();
          if (playOpponent === "bot" && botThinking) {
            announce("Computer is calculating");
            return;
          }
          if (playOpponent === "bot") {
            const humanColor = botSide === "white" ? "b" : "w";
            if (turn !== humanColor) {
              announce("Wait for computer move");
              return;
            }
          }
          const candidates = game
            .moves({ square: from as RulesSquare, verbose: true })
            .filter((move) => move.to === to);
          if (!candidates.length) {
            announce("That move is not legal");
            return;
          }
          if (candidates.some((move) => move.isPromotion())) {
            setPendingPromotion({ from, to, color: turn });
            announce("Choose a promotion piece");
            return;
          }
          finishPlayMove(from, to);
        } catch {
          announce("That move is not legal");
        }
        return;
      }

      const movingPiece = document.board[from];
      if (!movingPiece) return;
      const next = cloneDocument(document);
      delete next.board[from];
      next.board[to] = movingPiece;
      commit(next, `Moved ${pieceLabel(movingPiece)} from ${from} to ${to}`);
      setMoveFrom(null);
    },
    [announce, botSide, botThinking, commit, document.board, fen, finishPlayMove, liveRole, playMode, playOpponent, studentMovesAllowed],
  );

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => !prev);
  };

  const toggleReserveTrays = () => {
    setShowReserveTrays((prev) => {
      const next = !prev;
      announce(next ? "3D Piece trays visible" : "3D Piece trays hidden");
      return next;
    });
  };

  const handleHoverSquare = useCallback((square: Square | null) => {
    if (lastBroadcastSquareRef.current !== square) {
      lastBroadcastSquareRef.current = square;
      if (liveSessionRef.current) {
        liveSessionRef.current.sendRemotePointer(square);
      }
    }
  }, []);

  const handleCreateLiveRoom = () => {
    const newRoomId = generateRoomCode();
    window.location.hash = `room=${newRoomId}&role=teacher`;
    initLiveSession(newRoomId, "teacher");
  };

  const handleCopyStudentLink = async () => {
    if (!liveRoomId) return;
    const url = createStudentLiveUrl(liveRoomId);
    try {
      await navigator.clipboard.writeText(url);
      announce("Student 3D room link copied to clipboard");
    } catch {
      const input = window.document.createElement("textarea");
      input.value = url;
      window.document.body.appendChild(input);
      input.select();
      window.document.execCommand("copy");
      input.remove();
      announce("Student 3D room link copied to clipboard");
    }
  };

  const handleToggleLock = () => {
    if (liveRole !== "teacher" || !liveSessionRef.current) return;
    const nextState = !studentMovesAllowed;
    setStudentMovesAllowed(nextState);
    liveSessionRef.current.sendLockState(nextState);
    announce(nextState ? "Student moves enabled" : "Student board locked");
  };

  const handleLeaveLiveRoom = () => {
    if (liveSessionRef.current) {
      liveSessionRef.current.disconnect();
      liveSessionRef.current = null;
    }
    setLiveRoomId(null);
    setLiveRole(null);
    setLiveStatus("disconnected");
    setPeerConnected(false);
    setRemotePointer(null);
    window.location.hash = "";
    announce("Left live session");
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
      const next = exists
        ? prev.filter((a) => !(a.from === arrow.from && a.to === arrow.to))
        : [...prev.filter((a) => !(a.from === arrow.from && a.to === arrow.to)), arrow];
      if (liveSessionRef.current) {
        liveSessionRef.current.sendAnnotations(next, squareHighlights);
      }
      return next;
    });
  }, [squareHighlights]);

  const handleToggleSquareHighlight = useCallback((highlight: SquareAnnotation) => {
    setSquareHighlights((prev) => {
      const exists = prev.find((h) => h.square === highlight.square && h.color === highlight.color);
      const next = exists
        ? prev.filter((h) => h.square !== highlight.square)
        : [...prev.filter((h) => h.square !== highlight.square), highlight];
      if (liveSessionRef.current) {
        liveSessionRef.current.sendAnnotations(arrows, next);
      }
      return next;
    });
  }, [arrows]);

  const clearAnnotations = useCallback(() => {
    setArrows([]);
    setSquareHighlights([]);
    boardRef.current?.clearAnnotations?.();
    if (liveSessionRef.current) {
      liveSessionRef.current.sendAnnotations([], []);
    }
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
    if (liveRole === "student" && !studentMovesAllowed) {
      announce("Board is locked by teacher");
      return;
    }
    commit(next, `${label} loaded`);
    setMoveFrom(null);
    setLastMove(null);
    if (liveRole === "teacher" && liveSessionRef.current) {
      if (label === "Starting position") {
        liveSessionRef.current.sendPreset("start");
      } else if (label === "Empty board") {
        liveSessionRef.current.sendPreset("empty");
      }
    }
  };

  const enterPlayMode = () => {
    setFenError("");
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
      setResignedSide(null);
      setConfirmingResign(false);
      if (resignConfirmTimer.current) clearTimeout(resignConfirmTimer.current);
      resetClock();
      announce("Play mode ready");
    } catch {
      // If position was invalid or empty, start a standard game
      const startDoc = startingDocument();
      const startFen = toFen(startDoc);
      commit(startDoc, "Standard game started");
      setPlayMode(true);
      setInitialPlayFen(startFen);
      setMoveHistory([]);
      setHistoryIndex(-1);
      setLastMove(null);
      setTool("move");
      setMoveFrom(null);
      setPendingPromotion(null);
      setResignedSide(null);
      setConfirmingResign(false);
      if (resignConfirmTimer.current) clearTimeout(resignConfirmTimer.current);
      resetClock();
      announce("Play mode ready with standard starting position");
    }
  };

  const enterSetupMode = () => {
    setPlayMode(false);
    setMoveFrom(null);
    setPendingPromotion(null);
    setResignedSide(null);
    setConfirmingResign(false);
    if (resignConfirmTimer.current) clearTimeout(resignConfirmTimer.current);
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
    setFenError("");
    setPlayMode(true);
    setInitialPlayFen(startFen);
    setMoveHistory([]);
    setHistoryIndex(-1);
    setLastMove(null);
    setTool("move");
    commit(startDoc, "New game started");
    setMoveFrom(null);
    setPendingPromotion(null);
    setResignedSide(null);
    setConfirmingResign(false);
    if (resignConfirmTimer.current) clearTimeout(resignConfirmTimer.current);
    resetClock();
    if (playOpponent === "bot" && botSide === "white") {
      setFlipped(true);
      boardRef.current?.setView("black");
    } else {
      setFlipped(false);
      boardRef.current?.setView("angle");
    }
    announce("Fresh new game started");
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
      if (playMode && timeControlId !== "none" && event.code === "Space") {
        event.preventDefault();
        pressClock();
        return;
      }
      if (!playMode && event.key === "1") setTool("place");
      if (!playMode && event.key === "2") setTool("move");
      if (!playMode && event.key === "3") setTool("erase");
      if (event.key.toLowerCase() === "f") handleFlipBoard();
      if (event.key.toLowerCase() === "c") clearAnnotations();
      if (event.key.toLowerCase() === "z" && !event.ctrlKey && !event.metaKey) toggleSidebar();
      if (!playMode && event.key.toLowerCase() === "t") toggleReserveTrays();
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
  }, [clearAnnotations, goToMoveIndex, handleFlipBoard, historyIndex, playMode, pressClock, redo, resetClock, timeControlId, undo]);

  const hasAnnotations = arrows.length > 0 || squareHighlights.length > 0;

  return (
    <main className={`studio-shell ${playMode ? "is-play-mode" : ""} ${sidebarCollapsed ? "is-sidebar-collapsed" : ""}`}>
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

          <div className="theme-select-wrapper" title="3D Chess clock design">
            <select
              className="theme-select"
              value={clockDesignId}
              onChange={(e) => handleClockDesignChange(e.target.value as ClockDesignId)}
              aria-label="Select 3D chess clock design"
            >
              {CLOCK_DESIGN_OPTIONS.map(({ id, label }) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {!playMode && <span className="position-count">{pieceCount} pieces</span>}
          {playMode ? (
            <>
              <button className="quiet-button" type="button" onClick={undo} disabled={!moveHistory.length}>Undo move</button>
              <button
                className={`quiet-button danger-quiet ${confirmingResign ? "is-confirming" : ""}`}
                type="button"
                onClick={handleResign}
                disabled={isGameOver}
                title={confirmingResign ? "Click again to confirm resignation" : "Resign game"}
              >
                {confirmingResign ? "Confirm Resign?" : "Resign"}
              </button>
              <button className="quiet-button" type="button" onClick={startNewGame}>New game</button>
            </>
          ) : (
            <>
              <button className="quiet-button" type="button" onClick={undo} disabled={!past.length}>Undo</button>
              <button className="quiet-button" type="button" onClick={redo} disabled={!future.length}>Redo</button>
            </>
          )}
          <button
            className={`quiet-button focus-btn ${sidebarCollapsed ? "is-active" : ""}`}
            type="button"
            onClick={toggleSidebar}
            title={sidebarCollapsed ? "Show side panels (Z)" : "Focus mode - Expand board (Z)"}
            aria-pressed={sidebarCollapsed}
          >
            {sidebarCollapsed ? "⛶ Panels" : "⛶ Focus"}
          </button>
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

      {/* Live Collaboration Session Bar */}
      <div className="live-session-bar" role="region" aria-label="Live collaboration">
        {!liveRoomId ? (
          <div className="live-session-offline">
            <button
              type="button"
              className="live-create-btn"
              onClick={handleCreateLiveRoom}
              title="Start a synchronized 3D room with a student"
            >
              <span className="live-pulse-dot" />
              <span>Start Live Room (Coach)</span>
            </button>
            <span className="live-hint">Share a real-time synchronized 3D board for setup training or live coaching</span>
          </div>
        ) : (
          <div className="live-session-active">
            <div className="live-room-pill">
              <span className={`live-status-dot ${liveStatus === "connected" ? "connected" : "connecting"}`} />
              <strong>Room {liveRoomId}</strong>
              <span className="live-role-tag">{liveRole === "teacher" ? "Coach" : "Student"}</span>
            </div>

            <div className="live-peer-pill">
              <span className={`peer-dot ${peerConnected ? "online" : "waiting"}`} />
              <span>
                {peerConnected
                  ? liveRole === "teacher"
                    ? "Student connected"
                    : "Coach connected"
                  : liveRole === "teacher"
                  ? "Waiting for student..."
                  : "Connecting to coach..."}
              </span>
            </div>

            {liveRole === "teacher" && (
              <>
                <button
                  type="button"
                  className="live-action-btn primary"
                  onClick={handleCopyStudentLink}
                  title="Copy student link to clipboard"
                >
                  🔗 Copy Student Link
                </button>
                <button
                  type="button"
                  className={`live-action-btn lock-btn ${!studentMovesAllowed ? "is-locked" : ""}`}
                  onClick={handleToggleLock}
                  title={studentMovesAllowed ? "Lock student board" : "Unlock student board"}
                >
                  {studentMovesAllowed ? "🔓 Lock Student" : "🔒 Unlock Student"}
                </button>
              </>
            )}

            {liveRole === "student" && (
              <span className={`live-lock-badge ${!studentMovesAllowed ? "locked" : "unlocked"}`}>
                {!studentMovesAllowed ? "🔒 View Only (Coach Locked)" : "✏️ Setup Allowed"}
              </span>
            )}

            <button
              type="button"
              className="live-action-btn exit-btn"
              onClick={handleLeaveLiveRoom}
              title="Leave live room"
            >
              ✕ Exit
            </button>
          </div>
        )}
      </div>

      <section className={`studio-grid ${playMode ? "is-play-mode" : ""} ${sidebarCollapsed ? "is-sidebar-collapsed" : ""}`}>
        {!playMode && !sidebarCollapsed && (
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
                <b>Drag & Drop</b> pieces from trays onto squares.<br />
                <b>Right-drag</b> 3D tactical arrows (Shift=Blue, Ctrl=Red).<br />
                <b>Right-click</b> square highlight. Press <b>C</b> to clear.
              </p>
            </div>
          </aside>
        )}

        <section className="board-stage" aria-label="3D chessboard workspace">
          {sidebarCollapsed && (
            <button
              type="button"
              className="floating-sidebar-toggle"
              onClick={toggleSidebar}
              title="Show side panels (Z)"
            >
              ▶ Panels
            </button>
          )}

          {hasAnnotations && (
            <div className="floating-clear-marks">
              <button
                type="button"
                className="clear-marks-btn"
                onClick={clearAnnotations}
                title="Clear 3D tactical markings (C)"
              >
                Clear marks ({arrows.length + squareHighlights.length})
              </button>
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
              clockDesignId={clockDesignId}
              arrows={arrows}
              squareHighlights={squareHighlights}
              selectedReservePiece={selectedPiece}
              remotePointer={remotePointer}
              showReserveTrays={!playMode && showReserveTrays}
              onSquarePress={actOnSquare}
              onSquareErase={playMode ? () => announce("Right-click erase is disabled in Play mode") : eraseSquare}
              onSelectReservePiece={handleSelectReservePiece}
              onDropReservePiece={handleDropReservePiece}
              onDropMovePiece={handleDropMovePiece}
              onHoverSquare={handleHoverSquare}
              onAddArrow={handleAddArrow}
              onToggleSquareHighlight={handleToggleSquareHighlight}
              clockState={{
                enabled: playMode && timeControlId !== "none",
                whiteTimeMs,
                blackTimeMs,
                activeSide: activeClockSide,
                flagFallenSide,
              }}
              onPressClock={pressClock}
            />
            {playMode && timeControlId !== "none" && (
              <div className="floating-tournament-clock side-placed" role="region" aria-label="Tournament chess clock">
                <div className="clock-top-rocker" aria-hidden="true">
                  <div className={`rocker-lever white-lever ${activeClockSide === "w" ? "is-down" : "is-up"}`} />
                  <div className={`rocker-lever black-lever ${activeClockSide === "b" ? "is-down" : "is-up"}`} />
                </div>
                <div className="clock-faces-row">
                  <div className={`clock-side-card white-card ${activeClockSide === "w" ? "is-active" : ""} ${flagFallenSide === "w" ? "flag-fallen" : ""}`}>
                    <span className="clock-side-label">WHITE</span>
                    <span className="clock-digital-time">{formatClockTime(whiteTimeMs)}</span>
                    {flagFallenSide === "w" && <span className="flag-badge">FLAG</span>}
                  </div>
                  <button
                    type="button"
                    className={`clock-tap-btn ${clockRunning ? "is-running" : ""}`}
                    onClick={() => pressClock()}
                    title="Tap clock to end turn (Spacebar)"
                  >
                    <span className="clock-tap-icon">⏱️</span>
                    <span className="clock-tap-text">{activeClockSide ? "TAP (Space)" : "START"}</span>
                  </button>
                  <div className={`clock-side-card black-card ${activeClockSide === "b" ? "is-active" : ""} ${flagFallenSide === "b" ? "flag-fallen" : ""}`}>
                    <span className="clock-side-label">BLACK</span>
                    <span className="clock-digital-time">{formatClockTime(blackTimeMs)}</span>
                    {flagFallenSide === "b" && <span className="flag-badge">FLAG</span>}
                  </div>
                </div>
              </div>
            )}
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

        {playMode && !sidebarCollapsed && (
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

              <div className="sidebar-game-actions">
                <button
                  type="button"
                  className="sidebar-new-game-btn"
                  onClick={startNewGame}
                  title="Start a fresh new chess game"
                >
                  <span>✨</span> New Game
                </button>
                <button
                  type="button"
                  className="sidebar-undo-btn"
                  onClick={undo}
                  disabled={!moveHistory.length}
                  title="Take back last move"
                >
                  <span>↩</span> Undo Move
                </button>
                <button
                  type="button"
                  className={`sidebar-resign-btn ${confirmingResign ? "is-confirming" : ""}`}
                  onClick={handleResign}
                  disabled={isGameOver}
                  title={confirmingResign ? "Click again to confirm resignation" : "Resign this game"}
                >
                  <span>🏳️</span> {confirmingResign ? "Confirm Resignation?" : "Resign Game"}
                </button>
              </div>
            </div>

            <div className="clock-controls-box">
              <div className="clock-header-row">
                <span className="clock-section-title">⏱️ Tournament Clock</span>
                {timeControlId !== "none" && (
                  <button type="button" className="clock-reset-mini-btn" onClick={() => resetClock()} title="Reset clock to initial time">
                    Reset
                  </button>
                )}
              </div>
              <div className="time-control-selector" role="group" aria-label="Time control presets">
                {(["none", "1m", "3m", "3m2s", "5m", "5m3s", "10m", "15m10s"] as TimeControlId[]).map((tc) => (
                  <button
                    key={tc}
                    type="button"
                    className={`tc-pill ${timeControlId === tc ? "is-active" : ""}`}
                    onClick={() => handleTimeControlChange(tc)}
                  >
                    {TIME_CONTROLS[tc].label}
                  </button>
                ))}
              </div>
              <div className="clock-model-select-row">
                <span className="clock-model-label">3D Model:</span>
                <select
                  className="clock-mini-select"
                  value={clockDesignId}
                  onChange={(e) => handleClockDesignChange(e.target.value as ClockDesignId)}
                  aria-label="Select 3D clock design"
                >
                  {CLOCK_DESIGN_OPTIONS.map(({ id, label }) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
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

            <div ref={historyTableRef} className="move-history-table" role="table" aria-label="Moves log">
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
