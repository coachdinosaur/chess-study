/**
 * CD Digital Chess — Application Navigation & Layout Manager
 * Manages three-column desktop sidebar, collapsible icon rail, mobile drawer, and theme synchronization.
 */

(function () {
  'use strict';

  const STORAGE_KEY_COLLAPSED = 'sidebar-collapsed-v1';

  let mobileDrawerOpen = false;
  let sidebarCollapsed = false;

  function init() {
    bindNavigationEvents();
    bindSidebarCollapse();
    bindMobileDrawer();
    bindThemeToggles();
  }

  function bindSidebarCollapse() {
    const toggleBtns = document.querySelectorAll('.sidebar-collapse-btn, [data-action="toggle-sidebar"]');
    
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY_COLLAPSED);
      if (stored === 'true') {
        setSidebarCollapsed(true, false);
      }
    } catch {}

    toggleBtns.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        setSidebarCollapsed(!sidebarCollapsed, true);
      });
    });

    // Keyboard shortcut: Ctrl+B or Alt+B toggles sidebar
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey && e.key.toLowerCase() === 'b') || (e.altKey && e.key.toLowerCase() === 'b')) {
        const target = e.target;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
          return;
        }
        e.preventDefault();
        setSidebarCollapsed(!sidebarCollapsed, true);
      }
    });
  }

  function setSidebarCollapsed(collapsed, persist = true) {
    sidebarCollapsed = collapsed;
    const pageShell = document.querySelector('.page-shell');
    const sidebar = document.getElementById('appSidebar');
    const toggleBtns = document.querySelectorAll('.sidebar-collapse-btn, [data-action="toggle-sidebar"]');

    if (pageShell) {
      pageShell.classList.toggle('is-sidebar-collapsed', collapsed);
    }
    if (sidebar) {
      sidebar.classList.toggle('is-collapsed', collapsed);
    }

    toggleBtns.forEach((btn) => {
      btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      btn.setAttribute('title', collapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)');
      btn.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
    });

    if (persist) {
      try {
        window.localStorage.setItem(STORAGE_KEY_COLLAPSED, collapsed ? 'true' : 'false');
      } catch {}
    }

    // Trigger resize after animation completes so board / SVG canvas recalculates smoothly
    window.setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 260);
  }

  function bindNavigationEvents() {
    document.addEventListener('click', (e) => {
      const navTargetBtn = e.target.closest('[data-nav-target]');
      if (navTargetBtn) {
        const target = navTargetBtn.getAttribute('data-nav-target');
        if (target === 'analyze') {
          e.preventDefault();
          // Activate analysis tab if in workspace
          const analysisTabBtn = document.querySelector('.tab-chip[data-tab="analysis"]');
          if (analysisTabBtn && !analysisTabBtn.classList.contains('is-active')) {
            analysisTabBtn.click();
          }
          closeMobileDrawer();
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
