import { useState, useEffect, useCallback, MouseEvent } from "react";
import { assetUrl } from "../lib/asset-url";

interface OpeningHubViewProps {
  onOpenCatalan: () => void;
}

export function OpeningHubView({ onOpenCatalan }: OpeningHubViewProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem("sidebar-collapsed-v1") === "true";
    } catch {
      return false;
    }
  });

  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      const stored = window.localStorage.getItem("color-theme-v1");
      if (stored === "dark" || stored === "light") return stored;
    } catch {}
    return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem("color-theme-v1", theme);
    } catch {}
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("sidebar-collapsed-v1", String(next));
      } catch {}
      return next;
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey && e.key.toLowerCase() === "b") || (e.altKey && e.key.toLowerCase() === "b")) {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
          return;
        }
        e.preventDefault();
        toggleSidebar();
      }
      if (e.key === "Escape" && menuOpen) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen, toggleSidebar]);

  const handleCatalanCardClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName === "A" && target.getAttribute("href") !== "#/chapters/1") {
      return;
    }
    e.preventDefault();
    onOpenCatalan();
  };

  return (
    <div className={`app-shell opening-hub-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      {/* Top Navigation Bar */}
      <header className="topbar hub-topbar">
        <button
          className="sidebar-toggle desktop-sidebar-toggle"
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"}
          title={sidebarCollapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <button
          className="sidebar-toggle menu-button"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label="Toggle navigation"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <a className="brand hub-brand" href="/">
          <img
            className="brand-mark"
            src={assetUrl("app_icon_chess_study.png")}
            alt="CD Digital Chess"
            width={34}
            height={34}
          />
          <span>
            <strong>CD DIGITAL CHESS</strong>
            <small>Opening Courses Hub</small>
          </span>
        </a>
        <div className="hub-topbar-actions">
          <span className="hub-screen-badge">Opening Courses</span>
          <button
            type="button"
            className="hub-theme-btn"
            onClick={toggleTheme}
            aria-label="Toggle light and dark theme"
            title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            {theme === "dark" ? (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Desktop Navigation Sidebar */}
      <aside id="appSidebar" className={`sidebar hub-sidebar ${menuOpen ? "open" : ""}`} aria-label="Application Navigation">
        <div className="hub-sidebar-header">
          <a className="hub-sidebar-brand" href="/">
            <img
              src={assetUrl("app_icon_chess_study.png")}
              alt="CD Digital Chess"
              className="hub-sidebar-icon"
              width={30}
              height={30}
            />
            <div className="hub-sidebar-brand-text">
              <span className="hub-brand-top">CD DIGITAL</span>
              <span className="hub-brand-bottom">CHESS</span>
            </div>
          </a>
          <button
            className="sidebar-collapse-btn"
            type="button"
            onClick={toggleSidebar}
            aria-label="Collapse sidebar"
            title="Collapse sidebar (Ctrl+B)"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        </div>

        <nav className="hub-nav" aria-label="Primary destinations">
          {/* Group: WORKSPACE */}
          <div className="hub-nav-group">
            <span className="hub-nav-group-label">Workspace</span>
            <a className="hub-nav-item" href="/" title="Analyze a Position">
              <svg className="hub-nav-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="11" y1="8" x2="11" y2="14" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
              <span className="hub-nav-label">Analyze a Position</span>
            </a>
          </div>

          {/* Group: EXPLORE */}
          <div className="hub-nav-group">
            <span className="hub-nav-group-label">Explore</span>
            <a className="hub-nav-item" href="/lessons/" title="Explore Lessons">
              <svg className="hub-nav-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                <path d="M12 6v6" />
                <path d="M9 9h6" />
              </svg>
              <span className="hub-nav-label">Explore Lessons</span>
            </a>
            <a className="hub-nav-item is-active" href="/openings/" aria-current="page" title="Explore Openings">
              <svg className="hub-nav-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
              </svg>
              <span className="hub-nav-label">Explore Openings</span>
            </a>
          </div>

          {/* Group: TOOLS */}
          <div className="hub-nav-group">
            <span className="hub-nav-group-label">Tools</span>
            <a className="hub-nav-item" href="/3d/" title="Open 3D Board">
              <svg className="hub-nav-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
              <span className="hub-nav-label">Open 3D Board</span>
            </a>
            <a className="hub-nav-item" href="/live-board.html" title="Live Board">
              <svg className="hub-nav-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                <line x1="12" y1="20" x2="12.01" y2="20" />
              </svg>
              <span className="hub-nav-label">Live Board</span>
            </a>
          </div>

          {/* Group: COACHING */}
          <div className="hub-nav-group">
            <span className="hub-nav-group-label">Coaching</span>
            <a className="hub-nav-item" href="/management/" title="Teacher Management">
              <svg className="hub-nav-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span className="hub-nav-label">Teacher Management</span>
            </a>
          </div>

          {/* Group: INFO */}
          <div className="hub-nav-group">
            <span className="hub-nav-group-label">Info</span>
            <a className="hub-nav-item" href="/about/" title="About the App">
              <svg className="hub-nav-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span className="hub-nav-label">About the App</span>
            </a>
          </div>
        </nav>

        <div className="hub-sidebar-footer">
          <button
            type="button"
            className="hub-sidebar-theme-toggle"
            onClick={toggleTheme}
            aria-label="Toggle dark theme"
          >
            <span className="theme-toggle-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            </span>
            <span className="theme-toggle-label">Dark Theme</span>
            <span className={`theme-toggle-switch ${theme === "dark" ? "is-active" : ""}`} aria-hidden="true">
              <span className="theme-toggle-thumb" />
            </span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Scrim */}
      {menuOpen && (
        <button
          className="scrim"
          onClick={() => setMenuOpen(false)}
          aria-label="Close navigation"
        />
      )}

      {/* Main Hub Content */}
      <main className="content hub-content">
        <div className="view hub-view">
          {/* Header Section */}
          <header className="hub-hero">
            <div className="hub-eyebrow-container">
              <span className="hub-eyebrow-icon" aria-hidden="true">♟</span>
              <span className="hub-eyebrow">CD DIGITAL CHESS REPERTOIRE</span>
            </div>
            <h1 className="hub-title">Opening Courses</h1>
            <p className="hub-subtitle">
              Study practical opening repertoires, key ideas, and important variations through interactive chess lessons.
            </p>
          </header>

          {/* Course Selection Section */}
          <section className="hub-section" aria-labelledby="chooseCourseHeading">
            <div className="hub-section-head">
              <h2 id="chooseCourseHeading" className="hub-section-title">
                Choose an Opening Course
              </h2>
              <span className="hub-section-count">2 Courses Available</span>
            </div>

            <div className="hub-course-grid">
              {/* Card 1: Beating the Anti-Sicilian */}
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
                  <div className="hub-card-badge-row">
                    <span className="hub-card-category-badge">Sicilian Defense</span>
                    <span className="hub-card-role-badge hub-role-black">Black Repertoire</span>
                  </div>
                  <div className="hub-card-piece-emblem" aria-hidden="true">
                    <img
                      src={assetUrl("assets/pieces/mpchess/bN.svg")}
                      alt=""
                      width={44}
                      height={44}
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

                <div className="hub-card-meta">
                  <div className="hub-card-meta-item">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                    </svg>
                    <span>5 Chapters</span>
                  </div>
                  <div className="hub-card-meta-item">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span>Anti-Sicilian Systems</span>
                  </div>
                  <div className="hub-card-meta-item">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                    <span>Stockfish 18 Analysis</span>
                  </div>
                </div>

                <div className="hub-card-footer">
                  <a
                    className="hub-card-button hub-btn-primary"
                    href="/openings-sicilian/"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span>Open Course</span>
                    <span className="hub-btn-arrow" aria-hidden="true">→</span>
                  </a>
                </div>
              </article>

              {/* Card 2: Catalan Opening */}
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
                  <div className="hub-card-badge-row">
                    <span className="hub-card-category-badge hub-category-catalan">1.d4 Repertoire</span>
                    <span className="hub-card-role-badge hub-role-white">White Repertoire</span>
                  </div>
                  <div className="hub-card-piece-emblem" aria-hidden="true">
                    <img
                      src={assetUrl("assets/pieces/mpchess/wB.svg")}
                      alt=""
                      width={44}
                      height={44}
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

                <div className="hub-card-meta">
                  <div className="hub-card-meta-item">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                    </svg>
                    <span>16 Chapters</span>
                  </div>
                  <div className="hub-card-meta-item">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span>Strategic Ideas &amp; Models</span>
                  </div>
                  <div className="hub-card-meta-item">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                    <span>Stockfish 18 Analysis</span>
                  </div>
                </div>

                <div className="hub-card-footer">
                  <a
                    className="hub-card-button hub-btn-primary"
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

          {/* Hub Footer */}
          <footer className="hub-footer">
            <span className="hub-footer-brand">CD Digital Chess · Interactive Opening Courses</span>
            <span className="hub-footer-links">
              <a href="/lessons/">Lessons Index</a>
              <span className="hub-footer-divider">·</span>
              <a href="/">Study Board</a>
              <span className="hub-footer-divider">·</span>
              <a href="/about/">About</a>
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}
