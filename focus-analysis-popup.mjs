const root = document.documentElement;

if (root.dataset.embed !== '1' && root.dataset.boardOnly !== '1') {
  const STOP_SECTION_LABELS = new Set([
    'PGN comment',
    'Lesson note',
    'Practice mode',
    'Line navigation',
    'Board setup',
    'Analysis',
    'Play vs Stockfish',
    'Endgame puzzle',
  ]);

  let popup = null;
  let titleElement = null;
  let evaluationElement = null;
  let bodyElement = null;
  let toggleButton = null;
  let minimized = false;
  let userClosed = false;
  let analysisRequested = false;
  let syncFrame = 0;
  let dragState = null;

  function pageShell() {
    return document.querySelector('.page-shell');
  }

  function focusModeActive() {
    return Boolean(pageShell()?.classList.contains('is-focus-mode'));
  }

  function normalizedLines(element) {
    // Focus mode hides the control pane with display:none. textContent still
    // exposes the rendered PV/tablebase text, while innerText becomes empty.
    return String(element?.textContent || '')
      .split(/\r?\n/)
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
  }

  function lineHeader(line) {
    const tablebase = line.match(/^TB\s*(\d+)\s+Line\s*(.*)$/i);
    if (tablebase) {
      return {
        kind: 'tablebase',
        index: Number(tablebase[1]),
        meta: tablebase[2].trim(),
      };
    }

    const engine = line.match(/^PV\s*(\d+)\s+Depth\s*([^\s]+)\s*(.*)$/i);
    if (engine) {
      return {
        kind: 'engine',
        index: Number(engine[1]),
        depth: engine[2].trim(),
        meta: engine[3].trim(),
      };
    }

    return null;
  }

  function firstEvaluationLabel(source, entries, analysisText) {
    if (source === 'engine') {
      const evaluation = analysisText.match(/Evaluation\s+([+\-]?(?:M\d+|\d+(?:\.\d+)?))/i);
      if (evaluation) {
        return evaluation[1];
      }
    }

    for (const entry of entries) {
      const match = entry.meta.match(/([+\-]?(?:M\d+|\d+(?:\.\d+)?|TB\s*[+\-=]))\s*$/i);
      if (match) {
        return match[1].replace(/\s+/g, ' ');
      }
    }
    return '';
  }

  function analysisSummary(source, analysisLines) {
    const statusLabel = source === 'tablebase' ? 'Tablebase status' : 'Engine status';
    const index = analysisLines.findIndex((line) => line === statusLabel);
    if (index >= 0) {
      for (let cursor = index + 1; cursor < analysisLines.length; cursor += 1) {
        const candidate = analysisLines[cursor];
        if (!candidate || STOP_SECTION_LABELS.has(candidate)) {
          break;
        }
        if (/^(Result|DTM|DTZ|Evaluation|Depth|Nodes)\b/i.test(candidate)) {
          continue;
        }
        return candidate;
      }
    }

    return analysisLines.find((line) => (
      /^(Probing|Loading|Analyzing|Continuing|Stopping|Tablebase solved|Tablebase unavailable)/i.test(line)
    )) || '';
  }

  function collectSnapshot() {
    const notationLines = normalizedLines(document.getElementById('notationPanel'));
    const analysisLines = normalizedLines(document.getElementById('analysisPanel'));
    const titleIndex = notationLines.findIndex((line) => line === 'Tablebase moves' || line === 'Engine lines');
    const title = titleIndex >= 0 ? notationLines[titleIndex] : '';
    const source = title === 'Tablebase moves' ? 'tablebase' : 'engine';
    const entries = [];
    let currentEntry = null;

    if (titleIndex >= 0) {
      for (let cursor = titleIndex + 1; cursor < notationLines.length; cursor += 1) {
        const line = notationLines[cursor];
        if (STOP_SECTION_LABELS.has(line)) {
          break;
        }
        const header = lineHeader(line);
        if (header) {
          currentEntry = { ...header, text: '' };
          entries.push(currentEntry);
          continue;
        }
        if (currentEntry) {
          currentEntry.text = currentEntry.text ? `${currentEntry.text} ${line}` : line;
        }
      }
    }

    const focusButton = document.getElementById('focusModeAnalyzeButton');
    const working = Boolean(
      focusButton?.classList.contains('is-loading')
      || focusButton?.classList.contains('is-analyzing')
      || focusButton?.getAttribute('aria-pressed') === 'true',
    );
    const summary = analysisSummary(source, analysisLines);

    if (!entries.length && working) {
      entries.push({
        kind: source,
        index: 1,
        depth: '',
        meta: 'Working',
        text: summary || (source === 'tablebase' ? 'Probing tablebase moves…' : 'Analyzing current position…'),
      });
    }

    return {
      source,
      title: source === 'tablebase' ? 'Tablebase' : 'Stockfish',
      evaluation: firstEvaluationLabel(source, entries, analysisLines.join('\n')),
      summary,
      entries,
      working,
    };
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[character]);
  }

  function renderSnapshot(snapshot) {
    titleElement.textContent = snapshot.title;
    evaluationElement.textContent = snapshot.evaluation;
    bodyElement.innerHTML = `${snapshot.summary ? `<p class="focus-analysis-summary">${escapeHtml(snapshot.summary)}</p>` : ''}${snapshot.entries.map((entry) => {
      const label = entry.kind === 'tablebase'
        ? `TB ${entry.index}`
        : `PV ${entry.index}`;
      const detail = entry.kind === 'engine' && entry.depth
        ? `Depth ${entry.depth}${entry.meta ? ` · ${entry.meta}` : ''}`
        : entry.meta;
      return `<article class="focus-analysis-line">
        <div class="focus-analysis-line-head">
          <strong>${escapeHtml(label)}</strong>
          <span>${escapeHtml(detail || '')}</span>
        </div>
        <p>${escapeHtml(entry.text || 'Waiting for an analysis line…')}</p>
      </article>`;
    }).join('')}`;
  }

  function setMinimized(nextValue) {
    minimized = Boolean(nextValue);
    popup.classList.toggle('is-minimized', minimized);
    toggleButton.setAttribute('aria-label', minimized ? 'Expand analysis' : 'Minimize analysis');
    toggleButton.setAttribute('title', minimized ? 'Expand' : 'Minimize');
    toggleButton.textContent = minimized ? '⌄' : '⌃';
  }

  function hidePopup() {
    if (popup) {
      popup.hidden = true;
    }
  }

  function syncPopup() {
    syncFrame = 0;
    if (!popup || !focusModeActive()) {
      hidePopup();
      return;
    }

    const snapshot = collectSnapshot();
    const shouldShow = !userClosed
      && analysisRequested
      && (snapshot.entries.length > 0 || snapshot.working);

    if (!shouldShow) {
      hidePopup();
      return;
    }

    renderSnapshot(snapshot);
    popup.hidden = false;
  }

  function scheduleSync() {
    if (syncFrame) {
      return;
    }
    syncFrame = window.requestAnimationFrame(syncPopup);
  }

  function clampPopupToViewport() {
    if (!popup || popup.hidden) {
      return;
    }
    const rect = popup.getBoundingClientRect();
    const margin = 8;
    const left = Math.max(margin, Math.min(window.innerWidth - rect.width - margin, rect.left));
    const top = Math.max(margin, Math.min(window.innerHeight - rect.height - margin, rect.top));
    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
    popup.style.right = 'auto';
  }

  function startDrag(event) {
    if (event.button !== undefined && event.button !== 0) {
      return;
    }
    if (event.target.closest('button')) {
      return;
    }
    const rect = popup.getBoundingClientRect();
    dragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: rect.left,
      top: rect.top,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    popup.classList.add('is-dragging');
    event.preventDefault();
  }

  function continueDrag(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }
    const margin = 8;
    const width = popup.offsetWidth;
    const height = popup.offsetHeight;
    const left = Math.max(
      margin,
      Math.min(window.innerWidth - width - margin, dragState.left + event.clientX - dragState.startX),
    );
    const top = Math.max(
      margin,
      Math.min(window.innerHeight - height - margin, dragState.top + event.clientY - dragState.startY),
    );
    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
    popup.style.right = 'auto';
  }

  function finishDrag(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }
    dragState = null;
    popup.classList.remove('is-dragging');
  }

  function createPopup() {
    popup = document.createElement('section');
    popup.className = 'focus-analysis-popup';
    popup.hidden = true;
    popup.setAttribute('aria-label', 'Focus mode analysis');
    popup.innerHTML = `
      <header class="focus-analysis-popup-head" data-focus-analysis-drag title="Drag to move">
        <span class="focus-analysis-popup-grip" aria-hidden="true">⠿</span>
        <strong class="focus-analysis-popup-title">Analysis</strong>
        <span class="focus-analysis-popup-eval"></span>
        <button type="button" class="focus-analysis-popup-button" data-focus-analysis-toggle aria-label="Minimize analysis" title="Minimize">⌃</button>
        <button type="button" class="focus-analysis-popup-button" data-focus-analysis-close aria-label="Close analysis" title="Close">×</button>
      </header>
      <div class="focus-analysis-popup-body"></div>
    `;
    document.body.appendChild(popup);

    titleElement = popup.querySelector('.focus-analysis-popup-title');
    evaluationElement = popup.querySelector('.focus-analysis-popup-eval');
    bodyElement = popup.querySelector('.focus-analysis-popup-body');
    toggleButton = popup.querySelector('[data-focus-analysis-toggle]');
    const closeButton = popup.querySelector('[data-focus-analysis-close]');
    const dragHandle = popup.querySelector('[data-focus-analysis-drag]');

    toggleButton.addEventListener('click', () => setMinimized(!minimized));
    closeButton.addEventListener('click', () => {
      userClosed = true;
      hidePopup();
    });
    dragHandle.addEventListener('pointerdown', startDrag);
    dragHandle.addEventListener('pointermove', continueDrag);
    dragHandle.addEventListener('pointerup', finishDrag);
    dragHandle.addEventListener('pointercancel', finishDrag);
  }

  function initialize() {
    createPopup();

    const focusAnalyzeButton = document.getElementById('focusModeAnalyzeButton');
    const exitFocusButton = document.getElementById('exitFocusModeButton');
    const notationPanel = document.getElementById('notationPanel');
    const analysisPanel = document.getElementById('analysisPanel');
    const shell = pageShell();

    focusAnalyzeButton?.addEventListener('click', () => {
      if (!focusModeActive()) {
        return;
      }
      analysisRequested = true;
      userClosed = false;
      window.setTimeout(scheduleSync, 0);
    }, true);

    exitFocusButton?.addEventListener('click', () => {
      analysisRequested = false;
      userClosed = false;
      hidePopup();
    }, true);

    const contentObserver = new MutationObserver(scheduleSync);
    if (notationPanel) {
      contentObserver.observe(notationPanel, { childList: true, subtree: true, characterData: true });
    }
    if (analysisPanel) {
      contentObserver.observe(analysisPanel, { childList: true, subtree: true, characterData: true });
    }
    if (focusAnalyzeButton) {
      contentObserver.observe(focusAnalyzeButton, { attributes: true, attributeFilter: ['class', 'aria-pressed', 'title'] });
    }

    if (shell) {
      const focusObserver = new MutationObserver(() => {
        if (!focusModeActive()) {
          analysisRequested = false;
          userClosed = false;
          hidePopup();
        }
        scheduleSync();
      });
      focusObserver.observe(shell, { attributes: true, attributeFilter: ['class'] });
    }

    window.addEventListener('resize', clampPopupToViewport);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
}
