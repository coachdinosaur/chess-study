/**
 * CD Digital Chess — Top Players Leaderboards Module
 * Manages category selection, data rendering, and modal interactions for FIDE Top 10 rankings.
 */

const DATA_URL = './assets/top-players.json';
const STORAGE_KEY_CAT = 'top-players-active-category-v1';

let cachedData = null;
let currentCategoryId = 'world_standard';

/**
 * Fetch top players dataset
 */
export async function loadTopPlayersData() {
  if (cachedData) return cachedData;
  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cachedData = await res.json();
    return cachedData;
  } catch (err) {
    console.error('Failed to load top players data:', err);
    return null;
  }
}

/**
 * Open the Top Players modal dialog
 */
export async function openTopPlayersModal(categoryId) {
  const modal = document.getElementById('topPlayersModal');
  if (!modal) return;

  if (categoryId) {
    currentCategoryId = categoryId;
  } else {
    try {
      const saved = window.sessionStorage.getItem(STORAGE_KEY_CAT);
      if (saved) currentCategoryId = saved;
    } catch {}
  }

  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');

  const data = await loadTopPlayersData();
  renderTopPlayersModal(data);

  // Focus close button or category chip for accessibility
  const activeChip = modal.querySelector('.top-players-chip.is-active') || modal.querySelector('[data-action="close-top-players"]');
  if (activeChip) activeChip.focus();
}

/**
 * Close the Top Players modal dialog
 */
export function closeTopPlayersModal() {
  const modal = document.getElementById('topPlayersModal');
  if (!modal) return;

  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}

/**
 * Render the modal content (chips, table, footer)
 */
function renderTopPlayersModal(data) {
  const modal = document.getElementById('topPlayersModal');
  if (!modal) return;

  const container = modal.querySelector('#topPlayersContent');
  if (!container) return;

  if (!data || !data.categories) {
    container.innerHTML = `
      <div class="top-players-empty">
        <p>Could not load leaderboard data. Please check your connection and try again.</p>
        <button type="button" class="action-button tonal" data-action="retry-top-players">Retry</button>
      </div>
    `;
    return;
  }

  const categories = Object.values(data.categories);
  if (!data.categories[currentCategoryId]) {
    currentCategoryId = categories[0]?.id || 'world_standard';
  }
  const currentCategory = data.categories[currentCategoryId];

  // 1. Build Category Chips Navigation
  const chipsHtml = `
    <div class="top-players-nav" role="tablist" aria-label="Ranking Categories">
      ${categories
        .map(
          (cat) => `
        <button
          type="button"
          role="tab"
          class="top-players-chip ${cat.id === currentCategoryId ? 'is-active' : ''}"
          data-category="${cat.id}"
          aria-selected="${cat.id === currentCategoryId ? 'true' : 'false'}"
          title="${cat.title}"
        >
          <span class="chip-flag" aria-hidden="true">${cat.flag}</span>
          <span class="chip-label">${cat.shortTitle}</span>
        </button>
      `
        )
        .join('')}
    </div>
  `;

  // 2. Build Category Header & Description
  const categoryHeaderHtml = `
    <div class="top-players-cat-head">
      <div class="cat-head-info">
        <h3 class="cat-head-title">${currentCategory.flag} ${currentCategory.title}</h3>
        <span class="cat-head-badge">${currentCategory.category}</span>
      </div>
      <a
        href="${currentCategory.url}"
        target="_blank"
        rel="noopener noreferrer"
        class="cat-fide-link"
        title="View live list on FIDE website"
      >
        <span>FIDE List</span>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
          <polyline points="15 3 21 3 21 9"></polyline>
          <line x1="10" y1="14" x2="21" y2="3"></line>
        </svg>
      </a>
    </div>
  `;

  // 3. Build Player Table / Cards
  const players = currentCategory.players || [];
  let tableHtml = '';

  if (players.length === 0) {
    tableHtml = `<p class="top-players-no-data">No ranking data available for this category.</p>`;
  } else {
    tableHtml = `
      <div class="top-players-table-wrap">
        <table class="top-players-table" aria-label="${currentCategory.title} Leaderboard">
          <thead>
            <tr>
              <th scope="col" class="th-rank">#</th>
              <th scope="col" class="th-player">Player</th>
              <th scope="col" class="th-fed">Country</th>
              <th scope="col" class="th-rating">Rating</th>
              <th scope="col" class="th-year">B-Year</th>
              <th scope="col" class="th-action">Profile</th>
            </tr>
          </thead>
          <tbody>
            ${players
              .map((p) => {
                const rankClass = p.rank === 1 ? 'rank-gold' : p.rank === 2 ? 'rank-silver' : p.rank === 3 ? 'rank-bronze' : '';
                const rankIcon = p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : p.rank;
                const titleBadge = p.title ? `<span class="player-title-badge title-${p.title.toLowerCase()}">${p.title}</span>` : '';

                return `
                <tr class="top-player-row ${rankClass}">
                  <td class="td-rank">
                    <span class="rank-badge ${rankClass}" aria-label="Rank ${p.rank}">${rankIcon}</span>
                  </td>
                  <td class="td-player">
                    <div class="player-name-cell">
                      ${titleBadge}
                      <span class="player-name">${escapeHtml(p.name)}</span>
                    </div>
                  </td>
                  <td class="td-fed">
                    <div class="fed-cell" title="${p.fed}">
                      <span class="fed-flag" aria-hidden="true">${p.flagEmoji || '🏳️'}</span>
                      <span class="fed-code">${p.fed}</span>
                    </div>
                  </td>
                  <td class="td-rating">
                    <span class="rating-badge">${p.rating}</span>
                  </td>
                  <td class="td-year">
                    <span class="birth-year">${p.birthYear || '—'}</span>
                  </td>
                  <td class="td-action">
                    ${
                      p.profileUrl
                        ? `
                      <a
                        href="${p.profileUrl}"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="fide-profile-btn"
                        title="View ${escapeHtml(p.name)}'s official FIDE profile"
                        aria-label="View FIDE profile for ${escapeHtml(p.name)}"
                      >
                        <span>Card</span>
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                          <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                      </a>
                    `
                        : '—'
                    }
                  </td>
                </tr>
              `;
              })
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // 4. Build Footer Attribution
  const footerHtml = `
    <div class="top-players-footer-meta">
      <span class="meta-source">Source: <strong>${escapeHtml(data.source || 'FIDE')}</strong> (${data.updatedAt || 'August 2026'})</span>
      <a href="https://ratings.fide.com" target="_blank" rel="noopener noreferrer" class="meta-link">ratings.fide.com ↗</a>
    </div>
  `;

  container.innerHTML = `
    ${chipsHtml}
    ${categoryHeaderHtml}
    ${tableHtml}
    ${footerHtml}
  `;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Initialize event listeners
 */
export function initTopPlayers() {
  document.addEventListener('click', (e) => {
    // 1. Open Top Players Modal
    const openTrigger = e.target.closest('[data-action="open-top-players"]');
    if (openTrigger) {
      e.preventDefault();
      const targetCat = openTrigger.getAttribute('data-category') || null;
      openTopPlayersModal(targetCat);
      return;
    }

    // 2. Close Modal
    const closeTrigger = e.target.closest('[data-action="close-top-players"]');
    if (closeTrigger) {
      e.preventDefault();
      closeTopPlayersModal();
      return;
    }

    // 3. Category Chip Click
    const chip = e.target.closest('.top-players-chip[data-category]');
    if (chip) {
      e.preventDefault();
      const categoryId = chip.getAttribute('data-category');
      if (categoryId && categoryId !== currentCategoryId) {
        currentCategoryId = categoryId;
        try {
          window.sessionStorage.setItem(STORAGE_KEY_CAT, categoryId);
        } catch {}
        renderTopPlayersModal(cachedData);
      }
      return;
    }

    // 4. Retry loading
    const retryBtn = e.target.closest('[data-action="retry-top-players"]');
    if (retryBtn) {
      e.preventDefault();
      cachedData = null;
      loadTopPlayersData().then((data) => renderTopPlayersModal(data));
      return;
    }

    // 5. Backdrop click to close
    const modal = document.getElementById('topPlayersModal');
    if (modal && !modal.hidden && e.target === modal) {
      closeTopPlayersModal();
    }
  });

  // Keyboard shortcut: Escape to close modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = document.getElementById('topPlayersModal');
      if (modal && !modal.hidden) {
        closeTopPlayersModal();
      }
    }
  });
}

// Auto-initialize when loaded
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTopPlayers);
  } else {
    initTopPlayers();
  }
}
