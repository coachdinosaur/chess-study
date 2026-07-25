from pathlib import Path
import re


def replace_required(source: str, before: str, after: str, label: str) -> str:
    if before not in source:
        raise RuntimeError(f"Expected {label} block was not found")
    return source.replace(before, after, 1)


def replace_regex_required(source: str, pattern: str, replacement: str, label: str) -> str:
    next_source, count = re.subn(pattern, lambda _: replacement, source, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f"Expected {label} pattern was not found")
    return next_source


def update_file(path: str, transform) -> None:
    file_path = Path(path)
    source = file_path.read_text(encoding="utf-8")
    next_source = transform(source)
    if next_source == source:
        raise RuntimeError(f"No changes applied to {path}")
    file_path.write_text(next_source, encoding="utf-8")


def patch_trainer(source: str) -> str:
    source = replace_required(
        source,
        "const STYLE_URL = './lichess-position-training.css?v=20260725-theme-board2';",
        "const STYLE_URL = './lichess-position-training.css?v=20260725-board-interaction3';",
        "trainer stylesheet version",
    )
    source = replace_required(
        source,
        """    if (piece?.color === this.current.solverColor) {
      this.selectedSquare = square;
      this.render();
      return;
    }

    const candidates = this.game.moves({ square: this.selectedSquare, verbose: true }).filter((move) => move.to === square);""",
        """    if (square === this.selectedSquare) {
      this.selectedSquare = '';
      this.feedback = { kind: 'info', text: 'Selection cleared.' };
      this.render();
      return;
    }

    if (piece?.color === this.current.solverColor) {
      this.selectedSquare = square;
      this.render();
      return;
    }

    const candidates = this.game.moves({ square: this.selectedSquare, verbose: true }).filter((move) => move.to === square);""",
        "click-again selection clearing",
    )
    board_markup = r'''    this.board.innerHTML = boardSquares(orientation).map((square, index) => {
      const piece = this.game?.get(square);
      const file = square.charCodeAt(0) - 97;
      const rank = Number(square[1]) - 1;
      const row = Math.floor(index / 8);
      const col = index % 8;
      const dark = (file + rank) % 2 === 0;
      const classes = [
        'position-training-square',
        dark ? 'dark' : 'light',
        square === this.selectedSquare ? 'selected' : '',
        legalTargets.has(square) ? 'legal-target' : '',
        square === this.hintSquare ? 'hinted' : '',
      ].filter(Boolean).join(' ');
      const pieceMarkup = piece ? pieceImageMarkup(piece.color, piece.type, 'position-training-piece') : '';
      const pieceLabel = piece ? ` ${piece.color === 'w' ? 'white' : 'black'} ${PIECE_NAMES[piece.type]}` : '';
      const rankLabel = col === 0
        ? `<small class="position-training-coordinate position-training-rank">${square[1]}</small>`
        : '';
      const fileLabel = row === 7
        ? `<small class="position-training-coordinate position-training-file">${square[0]}</small>`
        : '';
      return `<button type="button" class="${classes}" data-square="${square}" aria-label="${square}${pieceLabel}">${pieceMarkup}${rankLabel}${fileLabel}</button>`;
    }).join('');'''
    return replace_regex_required(
        source,
        r"    this\.board\.innerHTML = boardSquares\(orientation\)\.map\(\(square\) => \{.*?    \}\)\.join\(''\);",
        board_markup,
        "edge-only board coordinates",
    )


def patch_trainer_css(source: str) -> str:
    source = replace_required(source, "  touch-action: manipulation;", "  touch-action: none;", "trainer touch action")
    source = replace_regex_required(
        source,
        r"\.position-training-square > small \{.*?\.position-training-square\.dark > small \{\n  color: var\(--coord-dark-color\);\n\}",
        r'''.position-training-coordinate {
  position: absolute;
  z-index: 4;
  font-size: clamp(0.48rem, 1.2vw, 0.72rem);
  font-weight: 800;
  line-height: 1;
  pointer-events: none;
}

.position-training-rank {
  top: 3px;
  left: 4px;
}

.position-training-file {
  right: 4px;
  bottom: 3px;
}

.position-training-square.light > .position-training-coordinate {
  color: var(--coord-light-color);
}

.position-training-square.dark > .position-training-coordinate {
  color: var(--coord-dark-color);
}''',
        "trainer coordinate styles",
    )
    return source + r'''

.position-training-square.is-drag-source .position-training-piece {
  opacity: 0.42;
}

.position-training-square.drag-hover {
  outline: clamp(3px, 0.55vw, 5px) solid var(--focus-border);
  outline-offset: clamp(-5px, -0.55vw, -3px);
}

.position-training-drag-preview {
  position: fixed;
  z-index: 10002;
  width: clamp(2.8rem, 7vw, 5rem);
  height: clamp(2.8rem, 7vw, 5rem);
  transform: translate(-50%, -50%);
  pointer-events: none;
  filter: drop-shadow(0 0.45rem 0.55rem var(--panel-shadow-strong));
}

.position-training-drag-preview-piece {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  user-select: none;
  -webkit-user-drag: none;
}
'''


def patch_interactions(source: str) -> str:
    return replace_required(
        source,
        """    gesture.moved = true;
    dispatchSquareClick(gesture.board, gesture.sourceSquare);
    gesture.board.querySelector(`[data-square=\"${gesture.sourceSquare}\"]`)?.classList.add('is-drag-source');""",
        """    gesture.moved = true;
    const currentSource = gesture.board.querySelector(`[data-square=\"${gesture.sourceSquare}\"]`);
    if (!currentSource?.classList.contains('selected')) {
      dispatchSquareClick(gesture.board, gesture.sourceSquare);
    }
    gesture.board.querySelector(`[data-square=\"${gesture.sourceSquare}\"]`)?.classList.add('is-drag-source');""",
        "dragging an already-selected piece",
    )


def patch_app(source: str) -> str:
    queue_function = r'''function renderPuzzleQueueControls(pz) {
  const isGenerating = pz.isGeneratingPuzzleBatch || pz.generating;
  const historyLength = pz.puzzleHistory ? pz.puzzleHistory.length : 0;

  let generationStatusMarkup = '';
  if (pz.isGeneratingPuzzleBatch) {
    generationStatusMarkup = `
      <div class="banner puzzle-generating-banner puzzle-generation-status">
        <span class="puzzle-spinner" aria-hidden="true"></span>
        <div>
          <strong>Generating puzzles...</strong>
          <div class="puzzle-generating-detail">${escapeHtml(pz.puzzleBatchStatus)}</div>
          ${(pz.generatingAttempt > 0) ? `
            <div class="puzzle-generating-meta">${escapeHtml(puzzleGeneratingDetail())}</div>
          ` : ''}
        </div>
      </div>
      <div class="action-row puzzle-cancel-row">
        <button type="button" class="action-button danger" data-action="cancel-batch-generation">Cancel</button>
      </div>
    `;
  } else {
    generationStatusMarkup = `
      <div class="puzzle-queue-status">
        ${pz.puzzleQueue.length === 0 ? 'No ready puzzles. Generate 5 more.' : (pz.puzzleBatchStatus || `${pz.puzzleQueue.length} puzzle(s) ready.`)}
      </div>
    `;
  }

  const defaultRemaining = pz.puzzleQueue.filter((puzzle) => puzzle.source === 'default').length;
  const generatedReady = pz.puzzleQueue.filter((puzzle) => puzzle.source === 'generated').length;
  const totalReady = pz.puzzleQueue.length;
  const clearButtonMarkup = historyLength > 0
    ? `<button type="button" class="action-button danger puzzle-queue-flex-button" data-action="clear-puzzle-history">Clear Previous Puzzles</button>`
    : '';

  return `
    <div class="puzzle-queue-controls">
      <div class="puzzle-queue-summary">
        <div class="puzzle-queue-row"><span>Default puzzles remaining</span><strong>${defaultRemaining} / ${DEFAULT_PUZZLE_COUNT}</strong></div>
        <div class="puzzle-queue-row"><span>Generated puzzles ready</span><strong>${generatedReady}</strong></div>
        <div class="puzzle-queue-row is-total"><span>Total ready puzzles</span><strong>${totalReady}</strong></div>
        <div class="puzzle-queue-row is-muted"><span>Previous puzzles saved</span><strong>${historyLength}</strong></div>
      </div>
      <div class="puzzle-queue-actions">
        <button type="button" class="action-button tonal puzzle-queue-full-button" data-action="generate-puzzle-batch" ${(isGenerating || totalReady >= PUZZLE_QUEUE_MAX) ? 'disabled' : ''}>Generate 5 More Puzzles</button>
        <button type="button" class="action-button tonal puzzle-queue-full-button" data-action="restore-default-puzzles" ${isGenerating ? 'disabled' : ''}>Reset Default Puzzles</button>
        <div class="puzzle-queue-action-pair">
          <button type="button" class="action-button tonal puzzle-queue-flex-button" data-action="save-puzzle-csv" ${pz.puzzleQueue.length === 0 ? 'disabled' : ''}>Save Queue as CSV</button>
          <button type="button" class="action-button tonal puzzle-queue-flex-button" data-action="load-puzzle-csv" ${isGenerating ? 'disabled' : ''}>Load CSV Puzzles</button>
        </div>
        <div class="puzzle-queue-action-pair">
          <button type="button" class="action-button tonal puzzle-queue-flex-button" data-action="replay-previous-puzzle" ${(historyLength === 0 || isGenerating) ? 'disabled' : ''}>Replay Previous Puzzle</button>
          ${clearButtonMarkup}
        </div>
      </div>
      ${generationStatusMarkup}
    </div>
  `;
}

function renderPuzzleBoardInstruction()'''
    source = replace_regex_required(
        source,
        r"function renderPuzzleQueueControls\(pz\) \{.*?\n\}\n\nfunction renderPuzzleBoardInstruction\(\)",
        queue_function,
        "puzzle queue controls",
    )
    source = replace_required(
        source,
        '''class="action-button primary" data-action="new-puzzle" ${pz.puzzleQueue.length === 0 ? 'disabled' : ''} style="width: 100%;"''',
        '''class="action-button primary puzzle-primary-action" data-action="new-puzzle" ${pz.puzzleQueue.length === 0 ? 'disabled' : ''}''',
        "puzzle primary action",
    )
    source = replace_required(
        source,
        '''class="banner ${pz.lastResult.kind === 'solved' ? 'success' : (pz.lastResult.kind === 'incomplete' ? 'warning' : 'danger')}" style="margin-top: 8px;"''',
        '''class="banner puzzle-panel-message ${pz.lastResult.kind === 'solved' ? 'success' : (pz.lastResult.kind === 'incomplete' ? 'warning' : 'danger')}"''',
        "puzzle result banner",
    )
    source = replace_required(
        source,
        '''class="banner warning" style="margin-top: 8px;"''',
        '''class="banner warning puzzle-panel-message"''',
        "puzzle error banner",
    )
    return source


def patch_styles(source: str) -> str:
    return source + r'''

/* Puzzle tab theme-aligned queue controls */
.puzzle-queue-controls {
  display: grid;
  gap: var(--space-sm);
  margin-bottom: var(--space-sm);
  padding: var(--space-sm);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-card);
  background: var(--card-bg);
  color: var(--text);
  box-shadow: 0 0.35rem 0.9rem var(--panel-shadow);
}

.puzzle-queue-summary { display: grid; gap: 0.28rem; }
.puzzle-queue-row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-sm); font-size: 0.82rem; }
.puzzle-queue-row strong { color: var(--text); font-weight: 750; }
.puzzle-queue-row.is-total { margin-top: 0.12rem; padding-top: 0.4rem; border-top: 1px solid var(--section-divider-soft); }
.puzzle-queue-row.is-muted, .puzzle-queue-status, .puzzle-generating-meta { color: var(--text-muted); }
.puzzle-queue-actions { display: grid; gap: var(--space-xs); }
.puzzle-queue-action-pair { display: flex; gap: var(--space-xs); }
.puzzle-queue-full-button, .puzzle-primary-action { width: 100%; }
.puzzle-queue-flex-button { flex: 1 1 0; min-width: 0; }
.puzzle-queue-status, .puzzle-generating-meta { font-size: 0.78rem; line-height: 1.4; }
.puzzle-queue-status { text-align: center; }
.puzzle-generation-status, .puzzle-panel-message { margin-top: var(--space-xs); }
.puzzle-cancel-row { justify-content: center; margin-top: var(--space-xs); }

@media (max-width: 520px) {
  .puzzle-queue-action-pair { display: grid; }
}
'''


def patch_loader(source: str) -> str:
    return replace_required(
        source,
        "import './lichess-position-training.mjs?v=20260725-position-training2';",
        "import './lichess-position-training.mjs?v=20260725-position-training3';\nimport './lichess-position-training-interactions.mjs?v=20260725-board-interaction1';",
        "trainer module imports",
    )


def patch_index(source: str) -> str:
    source = replace_required(source, './styles.css?v=20260719-mobile-drag-ui1', './styles.css?v=20260725-puzzle-theme2', 'main stylesheet version')
    source = replace_required(source, './app.js?v=20260719-mobile-drag-ui1', './app.js?v=20260725-puzzle-theme2', 'main app version')
    source = replace_required(source, './focus-analysis-popup.mjs?v=20260725-position-training2', './focus-analysis-popup.mjs?v=20260725-position-training3', 'focus trainer version')
    return source


update_file('lichess-position-training.mjs', patch_trainer)
update_file('lichess-position-training.css', patch_trainer_css)
update_file('lichess-position-training-interactions.mjs', patch_interactions)
update_file('app.js', patch_app)
update_file('styles.css', patch_styles)
update_file('focus-analysis-popup.mjs', patch_loader)
update_file('index.html', patch_index)
