import { useState, MouseEvent } from "react";
import { assetUrl } from "../lib/asset-url";

interface OpeningHubViewProps {
  onOpenCatalan: () => void;
}

export function OpeningHubView({ onOpenCatalan }: OpeningHubViewProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleCatalanCardClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "A" && target.getAttribute("href") !== "#/chapters/1") {
      return;
    }
    e.preventDefault();
    onOpenCatalan();
  };

  return (
    <div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      {/* Top Bar */}
      <header className="topbar">
        <button
          className="sidebar-toggle desktop-sidebar-toggle"
          onClick={() => setSidebarCollapsed((current) => !current)}
          aria-label={sidebarCollapsed ? "Show navigation" : "Hide navigation"}
        >
          ☰
        </button>
        <button
          className="sidebar-toggle menu-button"
          onClick={() => setMenuOpen((current) => !current)}
          aria-label="Toggle navigation"
        >
          ☰
        </button>
        <a className="brand" href="/openings/">
          <img
            className="brand-mark"
            src={assetUrl("app_icon_chess_study.png")}
            alt=""
            width={38}
            height={38}
          />
          <span>
            <strong>CD Digital Chess</strong>
            <small>Opening Courses</small>
          </span>
        </a>
      </header>

      {/* Sidebar matching Catalan & Sicilian design */}
      <aside id="course-sidebar" className={`sidebar ${menuOpen ? "open" : ""}`}>
        <nav>
          <p>CD Digital Chess</p>
          <a className="platform-link" href="/">
            <span className="nav-glyph" aria-hidden="true">SB</span>
            <span>Study Board</span>
          </a>
          <a className="platform-link" href="/lessons/">
            <span className="nav-glyph" aria-hidden="true">LS</span>
            <span>Lessons</span>
          </a>
          <a className="platform-link active" href="/openings/">
            <span className="nav-glyph" aria-hidden="true">OC</span>
            <span>Opening Courses</span>
          </a>

          <p className="sidebar-section-heading">Opening Repertoires</p>
          <a className="course-link" href="/openings-sicilian/">
            <span className="nav-glyph">SI</span>
            <span>Beating the Anti-Sicilian</span>
          </a>
          <a
            className="course-link"
            href="#/chapters/1"
            onClick={(e) => {
              e.preventDefault();
              onOpenCatalan();
            }}
          >
            <span className="nav-glyph">CA</span>
            <span>Catalan Opening</span>
          </a>
        </nav>

        <div className="sidebar-footer">
          <div className="source-card">
            <span>CD Digital Chess</span>
            <strong>Opening Courses Hub</strong>
            <small>Interactive opening repertoires with master games and local Stockfish analysis.</small>
          </div>
        </div>
      </aside>

      {/* Mobile drawer scrim */}
      {menuOpen && (
        <button
          className="scrim"
          onClick={() => setMenuOpen(false)}
          aria-label="Close navigation"
        />
      )}

      {/* Main Hub Content Area */}
      <main className="content">
        <div className="view hub-view">
          {/* Top Title & Supporting Text */}
          <header className="hub-hero">
            <h1 className="hub-title">Opening Courses</h1>
            <p className="hub-subtitle">
              Study practical opening repertoires, key ideas, and important variations through interactive chess lessons.
            </p>
          </header>

          {/* Section Heading & Cards */}
          <section className="hub-section" aria-labelledby="chooseCourseHeading">
            <div className="hub-section-head">
              <h2 id="chooseCourseHeading" className="hub-section-title">
                Choose an Opening Course
              </h2>
            </div>

            <div className="hub-course-grid">
              {/* Course Card 1 — Beating the Anti-Sicilian */}
              <article
                className="hub-card hub-card-sicilian"
                onClick={() => {
                  window.location.href = "/openings-sicilian/";
                }}
                role="link"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    window.location.href = "/openings-sicilian/";
                  }
                }}
              >
                <div className="hub-card-header">
                  <span className="hub-card-category-badge">Sicilian Defense</span>
                  <div className="hub-card-piece-emblem" aria-hidden="true">
                    <img
                      src={assetUrl("assets/pieces/mpchess/bN.svg")}
                      alt=""
                      width={40}
                      height={40}
                      loading="lazy"
                    />
                  </div>
                </div>

                <div className="hub-card-body">
                  <h3 className="hub-card-title">Beating the Anti-Sicilian</h3>
                  <p className="hub-card-desc">
                    A practical opening course focused on how to meet the Anti-Sicilian systems and fight for an active position as Black.
                  </p>
                </div>

                <div className="hub-card-footer">
                  <a
                    className="hub-card-button"
                    href="/openings-sicilian/"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span>Open Course</span>
                    <span className="hub-btn-arrow" aria-hidden="true">→</span>
                  </a>
                </div>
              </article>

              {/* Course Card 2 — Catalan Opening */}
              <article
                className="hub-card hub-card-catalan"
                onClick={handleCatalanCardClick}
                role="link"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpenCatalan();
                  }
                }}
              >
                <div className="hub-card-header">
                  <span className="hub-card-category-badge">Catalan Atelier</span>
                  <div className="hub-card-piece-emblem" aria-hidden="true">
                    <img
                      src={assetUrl("assets/pieces/mpchess/wB.svg")}
                      alt=""
                      width={40}
                      height={40}
                      loading="lazy"
                    />
                  </div>
                </div>

                <div className="hub-card-body">
                  <h3 className="hub-card-title">Catalan Opening</h3>
                  <p className="hub-card-desc">
                    Study the Catalan, its strategic ideas, important variations, and model positions through interactive lessons.
                  </p>
                </div>

                <div className="hub-card-footer">
                  <a
                    className="hub-card-button"
                    href="#/chapters/1"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onOpenCatalan();
                    }}
                  >
                    <span>Open Course</span>
                    <span className="hub-btn-arrow" aria-hidden="true">→</span>
                  </a>
                </div>
              </article>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
