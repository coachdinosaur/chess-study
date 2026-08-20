/**
 * CD Digital Chess — Application Navigation & Layout Manager
 * Manages three-column desktop sidebar, mobile drawer, Home/Workspace views, and theme sync.
 */

(function () {
  'use strict';

  const VIEW_HOME = 'home';
  const VIEW_WORKSPACE = 'workspace';

  let currentView = VIEW_WORKSPACE;
  let mobileDrawerOpen = false;

  function init() {
    bindNavigationEvents();
    bindMobileDrawer();
    bindThemeToggles();
    handleInitialRoute();
    window.addEventListener('hashchange', handleHashChange);
  }

  function handleInitialRoute() {
    const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
    if (hash === 'home') {
      setView(VIEW_HOME, false);
    } else {
      setView(VIEW_WORKSPACE, false);
    }
  }

  function handleHashChange() {
    const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
    if (hash === 'home') {
      setView(VIEW_HOME, false);
    } else {
      setView(VIEW_WORKSPACE, false);
    }
  }

  function setView(viewName, updateHash = true) {
    currentView = viewName;
    const homeViewEl = document.getElementById('homeView');
    const workspaceViewEl = document.getElementById('workspaceView');
    const pageShell = document.querySelector('.page-shell');

    if (viewName === VIEW_HOME) {
      if (homeViewEl) homeViewEl.hidden = false;
      if (workspaceViewEl) workspaceViewEl.hidden = true;
      if (pageShell) {
        pageShell.classList.add('is-view-home');
        pageShell.classList.remove('is-view-workspace');
      }
      updateActiveNav('home');
      if (updateHash) {
        window.history.pushState(null, '', '#home');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      if (homeViewEl) homeViewEl.hidden = true;
      if (workspaceViewEl) workspaceViewEl.hidden = false;
      if (pageShell) {
        pageShell.classList.remove('is-view-home');
        pageShell.classList.add('is-view-workspace');
      }
      updateActiveNav('analyze');
      if (updateHash) {
        window.history.pushState(null, '', '#analyze');
      }
    }
  }

  function updateActiveNav(navKey) {
    const allNavButtons = document.querySelectorAll('[data-nav-target]');
    allNavButtons.forEach((btn) => {
      const target = btn.getAttribute('data-nav-target');
      const isActive = target === navKey;
      btn.classList.toggle('is-active', isActive);
      if (isActive) {
        btn.setAttribute('aria-current', 'page');
      } else {
        btn.removeAttribute('aria-current');
      }
    });

    const activeBadge = document.getElementById('mobileActiveScreenBadge');
    if (activeBadge) {
      if (navKey === 'home') {
        activeBadge.textContent = 'Home';
      } else if (navKey === 'analyze') {
        activeBadge.textContent = 'Analyze a Position';
      }
    }
  }

  function bindNavigationEvents() {
    document.addEventListener('click', (e) => {
      const navTargetBtn = e.target.closest('[data-nav-target]');
      if (navTargetBtn) {
        const target = navTargetBtn.getAttribute('data-nav-target');
        if (target === 'home') {
          e.preventDefault();
          setView(VIEW_HOME);
          closeMobileDrawer();
        } else if (target === 'analyze') {
          e.preventDefault();
          setView(VIEW_WORKSPACE);
          // Activate analysis tab if in workspace
          const analysisTabBtn = document.querySelector('.tab-chip[data-tab="analysis"]');
          if (analysisTabBtn && !analysisTabBtn.classList.contains('is-active')) {
            analysisTabBtn.click();
          }
          closeMobileDrawer();
        }
        return;
      }

      // Quick start action buttons from home view
      const quickActionBtn = e.target.closest('[data-home-action]');
      if (quickActionBtn) {
        const action = quickActionBtn.getAttribute('data-home-action');
        if (action === 'analyze') {
          e.preventDefault();
          setView(VIEW_WORKSPACE);
          const analysisTabBtn = document.querySelector('.tab-chip[data-tab="analysis"]');
          if (analysisTabBtn) analysisTabBtn.click();
        } else if (action === 'puzzle') {
          e.preventDefault();
          setView(VIEW_WORKSPACE);
          const puzzleTabBtn = document.querySelector('.tab-chip[data-tab="puzzle"]');
          if (puzzleTabBtn) puzzleTabBtn.click();
        } else if (action === 'setup') {
          e.preventDefault();
          setView(VIEW_WORKSPACE);
          const setupTabBtn = document.querySelector('.tab-chip[data-tab="setup"]');
          if (setupTabBtn) setupTabBtn.click();
        }
      }
    });
  }

  function bindMobileDrawer() {
    const toggleBtn = document.getElementById('mobileMenuToggle');
    const closeBtn = document.getElementById('mobileDrawerClose');
    const backdrop = document.getElementById('mobileDrawerBackdrop');

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        if (mobileDrawerOpen) {
          closeMobileDrawer();
        } else {
          openMobileDrawer();
        }
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', closeMobileDrawer);
    }

    if (backdrop) {
      backdrop.addEventListener('click', closeMobileDrawer);
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mobileDrawerOpen) {
        closeMobileDrawer();
      }
    });
  }

  function openMobileDrawer() {
    const drawer = document.getElementById('mobileNavDrawer');
    const backdrop = document.getElementById('mobileDrawerBackdrop');
    const toggleBtn = document.getElementById('mobileMenuToggle');

    if (drawer) {
      drawer.classList.add('is-open');
      drawer.setAttribute('aria-hidden', 'false');
    }
    if (backdrop) {
      backdrop.classList.add('is-open');
    }
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-expanded', 'true');
    }
    document.body.classList.add('mobile-drawer-active');
    mobileDrawerOpen = true;
  }

  function closeMobileDrawer() {
    const drawer = document.getElementById('mobileNavDrawer');
    const backdrop = document.getElementById('mobileDrawerBackdrop');
    const toggleBtn = document.getElementById('mobileMenuToggle');

    if (drawer) {
      drawer.classList.remove('is-open');
      drawer.setAttribute('aria-hidden', 'true');
    }
    if (backdrop) {
      backdrop.classList.remove('is-open');
    }
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-expanded', 'false');
    }
    document.body.classList.remove('mobile-drawer-active');
    mobileDrawerOpen = false;
  }

  function bindThemeToggles() {
    document.addEventListener('click', (e) => {
      const themeToggle = e.target.closest('[data-action="toggle-app-theme"]');
      if (themeToggle) {
        e.preventDefault();
        const currentTheme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
        const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = nextTheme;
        try {
          window.localStorage.setItem('color-theme-v1', nextTheme);
        } catch {}

        // Sync with existing app.js toggle button state if present
        const mainThemeToggle = document.getElementById('toggleThemeButton');
        if (mainThemeToggle) {
          mainThemeToggle.setAttribute('aria-checked', nextTheme === 'dark' ? 'true' : 'false');
        }

        // Sync all theme switch toggles
        updateThemeSwitches(nextTheme);
      }
    });

    // Observe theme changes on html element to keep sidebar switches in sync
    const observer = new MutationObserver(() => {
      const theme = document.documentElement.dataset.theme || 'light';
      updateThemeSwitches(theme);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  function updateThemeSwitches(theme) {
    const switches = document.querySelectorAll('[data-action="toggle-app-theme"]');
    switches.forEach((sw) => {
      sw.setAttribute('aria-checked', theme === 'dark' ? 'true' : 'false');
      const label = sw.querySelector('.theme-toggle-label');
      if (label) {
        label.textContent = theme === 'dark' ? 'Dark Theme' : 'Light Theme';
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
