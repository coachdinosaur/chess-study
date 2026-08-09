"use client";

import { MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import LessonLoading from "./LessonLoading";
import { Chessboard } from "./components/Chessboard";
import { MarkdownChapterView } from "./components/MarkdownRenderer";
import { playAnalysisMove } from "./board-analysis";
import type { AnalysisMove, BoardMoveInput } from "./board-analysis";
import { extractFenBlocks, type ChapterSummary, type MarkdownChapter } from "./lib/markdown-chapter";
import type { MoveNavigation } from "./lib/markdown-moves";
import { loadAllChapters, loadChapterById } from "./lib/chapter-markdown-loader";
import { assetUrl } from "./lib/asset-url";
import { CHAPTER_SUMMARIES, isChapterId } from "./chapter-catalog.generated";
import { scoreToWhiteFraction } from "./stockfish-client";
import type { AnalysisUpdate, EnginePhase, EngineScore, StockfishClient, StockfishEvent } from "./stockfish-client";

const CHAPTER_NAVIGATION_PAINT_DELAY_MS = 120;

function EvaluationRail({ score, flipped }: { score: EngineScore | null; flipped: boolean }) {
  const whitePercent = (scoreToWhiteFraction(score) ?? 0.5) * 100;
  const blackPercent = 100 - whitePercent;
  const segments = flipped
    ? [{ side: "white", height: whitePercent }, { side: "black", height: blackPercent }]
    : [{ side: "black", height: blackPercent }, { side: "white", height: whitePercent }];
  return <div className="evaluation-rail" role="img" aria-label={score ? "Engine evaluation" : "Neutral engine evaluation"}>
    <div className="evaluation-segments" aria-hidden="true">{segments.map((segment) => <div className={`evaluation-segment ${segment.side}`} style={{ height: `${segment.height}%` }} key={segment.side} />)}</div>
  </div>;
}

function initialNavigation(markdown: string): MoveNavigation {
  const fen = extractFenBlocks(markdown)[0]?.fen ?? new Chess().fen();
  return { steps: [{ fen, label: "Chapter start" }], index: 0 };
}

function PageControls({ page, pageNumber, pageCount, onChange }: { page: number; pageNumber: number; pageCount: number; onChange: (index: number) => void }) {
  return <nav className="lesson-page-controls" aria-label={`Chapter page ${pageNumber}, ${page + 1} of ${pageCount}`}>
    <button type="button" disabled={page === 0} onClick={() => onChange(page - 1)}>Previous</button>
    <strong>Page {pageNumber} · {page + 1} of {pageCount}</strong>
    <button type="button" disabled={page === pageCount - 1} onClick={() => onChange(page + 1)}>Next</button>
  </nav>;
}

function LessonReader({ chapter }: { chapter: MarkdownChapter }) {
  const start = useMemo(() => initialNavigation(chapter.pages[0]?.markdown ?? chapter.markdown), [chapter]);
  const [pageIndex, setPageIndex] = useState(0);
  const [navigation, setNavigation] = useState<MoveNavigation>(start);
  const [flipped, setFlipped] = useState(false);
  const [analysisMoves, setAnalysisMoves] = useState<AnalysisMove[]>([]);
  const [enginePhase, setEnginePhase] = useState<EnginePhase>("uninitialized");
  const [engineAnalysis, setEngineAnalysis] = useState<AnalysisUpdate | null>(null);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [analysisRequested, setAnalysisRequested] = useState(false);
  const clientRef = useRef<StockfishClient | null>(null);
  const clientLoadRef = useRef<Promise<StockfishClient> | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const currentFenRef = useRef(start.steps[0].fen);
  const analysisRequestedRef = useRef(false);

  const currentStep = navigation.steps[navigation.index] ?? navigation.steps[0];
  const lastAnalysisMove = analysisMoves.at(-1) ?? null;
  const displayedFen = lastAnalysisMove?.fen ?? currentStep.fen;
  const visibleAnalysis = engineAnalysis?.fen === displayedFen ? engineAnalysis : null;
  const currentPage = chapter.pages[pageIndex] ?? chapter.pages[0];

  const selectNavigation = useCallback((next: MoveNavigation) => {
    setNavigation(next);
    setAnalysisMoves([]);
    setEngineAnalysis(null);
  }, []);

  const moveWithinLine = useCallback((index: number) => {
    setNavigation((current) => ({ ...current, index: Math.max(0, Math.min(index, current.steps.length - 1)) }));
    setAnalysisMoves([]);
    setEngineAnalysis(null);
  }, []);

  const pageColumnRef = useRef<HTMLElement>(null);

  const selectPage = useCallback((nextIndex: number) => {
    const clamped = Math.max(0, Math.min(nextIndex, chapter.pages.length - 1));
    const page = chapter.pages[clamped];
    if (!page) return;
    setPageIndex(clamped);
    setNavigation(initialNavigation(page.markdown));
    setAnalysisMoves([]);
    setEngineAnalysis(null);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = pageColumnRef.current;
        if (!el) return;
        const topbar = document.querySelector<HTMLElement>(".topbar");
        const offset = topbar?.offsetHeight ?? 78;
        const y = el.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo(0, y);
      });
    });
  }, [chapter.pages]);

  const applyAnalysisMove = useCallback((input: BoardMoveInput) => {
    const move = playAnalysisMove(displayedFen, input);
    if (!move) return;
    setEngineAnalysis(null);
    setAnalysisMoves((current) => [...current, move]);
  }, [displayedFen]);

  const ensureEngine = useCallback(async () => {
    if (clientRef.current) return clientRef.current;
    if (clientLoadRef.current) return clientLoadRef.current;
    const loading = import("./stockfish-client").then(({ StockfishClient: Client }) => {
      const client = new Client({ workerUrl: "/openings/stockfish/stockfish-18-lite-single.js" });
      unsubscribeRef.current = client.subscribe((event: StockfishEvent) => {
        setEnginePhase(event.phase);
        setEngineError(event.error);
        if (event.analysis?.fen === currentFenRef.current) setEngineAnalysis(event.analysis);
        if (event.phase === "error") {
          analysisRequestedRef.current = false;
          setAnalysisRequested(false);
        }
      });
      clientRef.current = client;
      return client;
    }).finally(() => { clientLoadRef.current = null; });
    clientLoadRef.current = loading;
    return loading;
  }, []);

  const toggleAnalysis = useCallback(async () => {
    if (analysisRequestedRef.current || enginePhase === "searching" || enginePhase === "restarting") {
      analysisRequestedRef.current = false;
      setAnalysisRequested(false);
      await clientRef.current?.stop();
      return;
    }
    analysisRequestedRef.current = true;
    setAnalysisRequested(true);
    setEngineError(null);
    try {
      const client = await ensureEngine();
      if (analysisRequestedRef.current) await client.analyze(currentFenRef.current);
    } catch (error) {
      analysisRequestedRef.current = false;
      setAnalysisRequested(false);
      setEnginePhase("error");
      setEngineError(error instanceof Error ? error.message : "Stockfish could not analyze this position.");
    }
  }, [enginePhase, ensureEngine]);

  useEffect(() => {
    currentFenRef.current = displayedFen;
    if (analysisRequestedRef.current && clientRef.current) {
      setEngineAnalysis(null);
      void clientRef.current.analyze(displayedFen).catch((error) => setEngineError(error instanceof Error ? error.message : String(error)));
    }
  }, [displayedFen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
      if (event.key === "ArrowLeft") moveWithinLine(navigation.index - 1);
      if (event.key === "ArrowRight") moveWithinLine(navigation.index + 1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [moveWithinLine, navigation.index]);

  useEffect(() => () => {
    unsubscribeRef.current?.();
    clientRef.current?.dispose();
    unsubscribeRef.current = null;
    clientRef.current = null;
  }, []);

  const analysisButtonLabel = enginePhase === "loading"
    ? "Loading engine…"
    : enginePhase === "stopping"
      ? "Stopping…"
      : analysisRequested
        ? "Stop"
        : "Analyze";
  const pvOutput = visibleAnalysis
    ? [`Depth ${visibleAnalysis.depth ?? "—"}`, visibleAnalysis.score?.label ?? "—", visibleAnalysis.formattedPv].filter(Boolean).join(" · ")
    : "";

  return <main className="view lesson-reader">
    <section className="guided-layout">
      <aside className="sticky-board">
        <div className="analysis-pv" aria-label="Stockfish principal variation"><span className="analysis-pv-output">{pvOutput}</span></div>
        <div className="board-frame primary-board-frame"><div className="board-analysis-row">
          <EvaluationRail score={visibleAnalysis?.score ?? null} flipped={flipped} />
          <div className="primary-board"><Chessboard fen={displayedFen} flipped={flipped} onMove={applyAnalysisMove} lastMove={lastAnalysisMove} /></div>
        </div></div>
        <div className="board-controls" aria-label="Chessboard controls">
          <div className="board-nav-controls">
            <button onClick={() => moveWithinLine(0)} aria-label="Go to line start">|‹</button>
            <button onClick={() => moveWithinLine(navigation.index - 1)} aria-label="Previous move">‹</button>
            <span>{lastAnalysisMove?.label ?? currentStep.label}</span>
            <button onClick={() => moveWithinLine(navigation.index + 1)} aria-label="Next move">›</button>
            <button onClick={() => moveWithinLine(navigation.steps.length - 1)} aria-label="Go to line end">›|</button>
          </div>
          {analysisMoves.length > 0 && <div className="analysis-branch-controls" aria-label="Analysis branch controls">
            <span>Analysis branch · {analysisMoves.length} {analysisMoves.length === 1 ? "ply" : "plies"}</span>
            <div><button onClick={() => setAnalysisMoves((current) => current.slice(0, -1))}>Undo</button><button onClick={() => setAnalysisMoves([])}>Reset</button></div>
          </div>}
          <div className="board-action-controls">
            <button className="analysis-button" onClick={toggleAnalysis} disabled={enginePhase === "stopping" || enginePhase === "error"} aria-pressed={analysisRequested}>{analysisButtonLabel}</button>
            <button className="flip-button" onClick={() => setFlipped((current) => !current)} aria-label="Flip board">↻ Flip</button>
          </div>
          {engineError && <p className="analysis-error" role="alert">{engineError}</p>}
        </div>
        <div className="active-line"><span>{analysisMoves.length ? "Analysis from" : "Markdown line"}</span><strong>{currentStep.label}</strong><small>{navigation.steps.length - 1} navigable {navigation.steps.length === 2 ? "move" : "moves"} in this line</small></div>
      </aside>
      <section className="lesson-page-column" ref={pageColumnRef} aria-label={`Chapter ${chapter.chapterNumber}, page ${currentPage?.number ?? pageIndex + 1}`}>
        <PageControls page={pageIndex} pageNumber={currentPage?.number ?? pageIndex + 1} pageCount={chapter.pages.length} onChange={selectPage} />
        <MarkdownChapterView markdown={currentPage?.markdown ?? chapter.markdown} onMove={selectNavigation} activeNavigation={navigation} chapterNumber={chapter.chapterNumber} />
        <PageControls page={pageIndex} pageNumber={currentPage?.number ?? pageIndex + 1} pageCount={chapter.pages.length} onChange={selectPage} />
      </section>
    </section>
  </main>;
}

function ChapterReader({ chapter, chapters, onNavigate }: {
  chapter: MarkdownChapter;
  chapters: readonly ChapterSummary[];
  onNavigate: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [chapterTarget, setChapterTarget] = useState<ChapterSummary>();

  const navigateChapter = (event: MouseEvent<HTMLAnchorElement>, target: ChapterSummary) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || target.id === chapter.id) return;
    event.preventDefault();
    setMenuOpen(false);
    setChapterTarget(target);
    window.setTimeout(() => onNavigate(target.id), CHAPTER_NAVIGATION_PAINT_DELAY_MS);
  };

  return <div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
    <header className="topbar">
      <button className="sidebar-toggle desktop-sidebar-toggle" onClick={() => setSidebarCollapsed((current) => !current)} aria-label={sidebarCollapsed ? "Show navigation" : "Hide navigation"}>☰</button>
      <button className="sidebar-toggle menu-button" onClick={() => setMenuOpen((current) => !current)} aria-label="Toggle navigation">☰</button>
      <a className="brand" href={`#/chapters/${chapter.id}`}><img className="brand-mark" src={assetUrl("app_icon_chess_study.png")} alt="" width={38} height={38} /><span><strong>Sicilian Defense: Beating the Anti-Sicilian</strong><small>Chapter {chapter.chapterNumber}</small></span></a>
    </header>
    <aside id="course-sidebar" className={`sidebar ${menuOpen ? "open" : ""}`}>
      <nav>
        <p>CD Digital Chess</p>
        <a className="platform-link" href="/"><span className="nav-glyph" aria-hidden="true">SB</span><span>Study Board</span></a>
        <a className="platform-link" href="/lessons/"><span className="nav-glyph" aria-hidden="true">LS</span><span>Lessons</span></a>
        <p className="sidebar-section-heading">Opening Course</p>
        {chapters.map((summary) => <a className={`course-link ${summary.id === chapter.id ? "active" : ""}`} href={`#/chapters/${summary.id}`} onClick={(event) => navigateChapter(event, summary)} key={summary.id}><span className="nav-glyph">{summary.id}</span><span>{summary.label}</span></a>)}
      </nav>
    </aside>
    {menuOpen && <button className="scrim" onClick={() => setMenuOpen(false)} aria-label="Close navigation" />}
    <div className="content"><LessonReader chapter={chapter} key={chapter.id} /></div>
    {chapterTarget && chapterTarget.id !== chapter.id && <LessonLoading label={`Loading ${chapterTarget.label}…`} overlay />}
  </div>;
}

function chapterIdFromLocation(): string | null {
  const hashPath = window.location.hash.replace(/^#/, "");
  const route = hashPath || window.location.pathname;
  const match = /(?:^|\/)chapters\/(\d+)\/?$/.exec(route);
  if (match) return isChapterId(match[1]) ? match[1] : null;
  return hashPath ? null : "1";
}

function MissingChapter() {
  return <main className="missing-chapter">
    <img src={assetUrl("app_icon_chess_study.png")} alt="" width={72} height={72} />
    <h1>Chapter not found</h1>
    <p>This static opening book contains the Sicilian chapters.</p>
    <a href="#/chapters/1">Open Chapter 1</a>
  </main>;
}

export default function SicilianApp() {
  useMemo(() => loadAllChapters(), []);
  const [chapterId, setChapterId] = useState<string | null>(() => chapterIdFromLocation());

  useEffect(() => {
    const updateRoute = () => {
      setChapterId(chapterIdFromLocation());
      window.scrollTo({ top: 0, behavior: "auto" });
    };
    window.addEventListener("hashchange", updateRoute);
    window.addEventListener("popstate", updateRoute);
    return () => {
      window.removeEventListener("hashchange", updateRoute);
      window.removeEventListener("popstate", updateRoute);
    };
  }, []);

  const navigate = useCallback((id: string) => {
    const target = `/chapters/${id}`;
    if (window.location.hash === `#${target}`) {
      setChapterId(id);
      return;
    }
    window.location.hash = target;
  }, []);

  const chapter = chapterId ? loadChapterById(chapterId) : undefined;
  if (!chapter) return <MissingChapter />;

  return <ChapterReader
    chapter={chapter}
    chapters={CHAPTER_SUMMARIES}
    onNavigate={navigate}
    key={chapter.id}
  />;
}
