from pathlib import Path


def replace_once(path, old, new):
    file_path = Path(path)
    text = file_path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one anchor, found {count}')
    file_path.write_text(text.replace(old, new, 1), encoding='utf-8')


replace_once(
    'app.js',
    """  MOVE_ANNOTATIONS,
  moveNagFromValue,
  moveNagGlyph,
  moveNagLabel,
} from './move-annotations.mjs';
""",
    """  MOVE_ANNOTATIONS,
  moveNagDetails,
  moveNagFromValue,
  moveNagGlyph,
  moveNagLabel,
} from './move-annotations.mjs';
""",
)

replace_once(
    'app.js',
    """function buildBoardMarkup() {
  const pieces = currentDisplayPieces();
""",
    """function currentMoveQualityBoardEffect() {
  if (
    (state.activeTab !== TAB_STUDY && state.activeTab !== TAB_ANALYSIS)
    || state.practice.active
    || state.play.active
  ) {
    return null;
  }
  const node = getCurrentAnalysisNode();
  if (!node || node.id === state.analysis.rootId || !SQUARE_PATTERN.test(node.to)) {
    return null;
  }
  const annotation = moveNagDetails(node.nag);
  if (!annotation || annotation.group !== 'Move quality') {
    return null;
  }
  return {
    square: node.to,
    nag: annotation.nag,
    glyph: annotation.glyph,
    label: annotation.label,
  };
}

function renderMoveQualityBoardEffect(effect) {
  if (!effect) {
    return '';
  }
  return `<span
    class="move-quality-board-effect is-nag-${effect.nag}"
    role="img"
    aria-label="${escapeHtml(effect.label)}"
    title="${escapeHtml(effect.label)}"
  >${escapeHtml(effect.glyph)}</span>`;
}

function buildBoardMarkup() {
  const pieces = currentDisplayPieces();
""",
)

replace_once(
    'app.js',
    """  const boardDragMoves = currentBoardDragMoves();
  const draggableSources = new Set(boardDragMoves.map((move) => move.from));
  let markup = '';
""",
    """  const boardDragMoves = currentBoardDragMoves();
  const draggableSources = new Set(boardDragMoves.map((move) => move.from));
  const moveQualityEffect = currentMoveQualityBoardEffect();
  let markup = '';
""",
)

replace_once(
    'app.js',
    """          ${piece ? `
            <div class="board-piece-shell ${pieceDraggable ? 'is-draggable' : ''}" data-square="${square}" data-piece="${piece}" draggable="${pieceDraggable}">
              <img class="board-piece" src="${PIECE_ASSETS[piece]}" alt="">
            </div>
          ` : ''}
        </div>
""",
    """          ${piece ? `
            <div class="board-piece-shell ${pieceDraggable ? 'is-draggable' : ''}" data-square="${square}" data-piece="${piece}" draggable="${pieceDraggable}">
              <img class="board-piece" src="${PIECE_ASSETS[piece]}" alt="">
            </div>
          ` : ''}
          ${moveQualityEffect?.square === square ? renderMoveQualityBoardEffect(moveQualityEffect) : ''}
        </div>
""",
)

replace_once(
    'app.js',
    """  moveAnnotationMenuState = { open: false, nodeId: '', x: 0, y: 0 };
  state.analysis.boardMessage = message;
  syncLessonFileStatus(message);
  schedulePersist();
  renderNotationPanel();
}

function renderMoveAnnotationMenu() {
""",
    """  moveAnnotationMenuState = { open: false, nodeId: '', x: 0, y: 0 };
  state.analysis.boardMessage = message;
  syncLessonFileStatus(message);
  schedulePersist();
  renderNotationPanel();
  renderBoard();
}

function renderMoveAnnotationMenu() {
""",
)

styles_path = Path('styles.css')
styles = styles_path.read_text(encoding='utf-8')
marker = '/* Board badge for the selected move\'s move-quality annotation. */'
if marker in styles:
    raise RuntimeError('styles.css: board move-quality styles already exist')
styles += """

/* Board badge for the selected move's move-quality annotation. */
.board-square {
  position: relative;
}

.move-quality-board-effect {
  position: absolute;
  top: 4%;
  right: 4%;
  z-index: 9;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 38%;
  min-width: 1.05rem;
  max-width: 2.15rem;
  aspect-ratio: 1;
  padding: 0 0.08em;
  border: 2px solid rgba(255, 255, 255, 0.88);
  border-radius: 50%;
  color: #fff;
  font-family: var(--font-display);
  font-size: clamp(0.64rem, calc(var(--board-size, 42rem) / 44), 1.05rem);
  font-weight: 900;
  line-height: 1;
  letter-spacing: -0.08em;
  text-align: center;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.28);
  box-shadow: 0 0.12rem 0.28rem rgba(0, 0, 0, 0.34);
  pointer-events: none;
  user-select: none;
}

.move-quality-board-effect::after {
  content: '';
  position: absolute;
  left: 4%;
  bottom: -8%;
  width: 30%;
  height: 30%;
  border-radius: 15% 0 45% 0;
  background: inherit;
  transform: rotate(34deg);
  z-index: -1;
}

.move-quality-board-effect.is-nag-1 { background: #5c9b3a; }
.move-quality-board-effect.is-nag-2 { background: #d49319; }
.move-quality-board-effect.is-nag-3 { background: #249cb7; }
.move-quality-board-effect.is-nag-4 { background: #c84c4c; }
.move-quality-board-effect.is-nag-5 { background: #2b9b86; }
.move-quality-board-effect.is-nag-6 { background: #3c91cf; }
.move-quality-board-effect.is-nag-7 { background: #6f7883; }
"""
styles_path.write_text(styles, encoding='utf-8')

replace_once(
    'USER_GUIDE.md',
    """The glyph is shown directly after the move, such as `Nf5!` or `Nf5⩲`. Move annotations are saved in lesson JSON and preserved when PGN is imported or exported. The punctuation move-quality glyphs are exported as familiar suffixes; positional glyphs use their standard numeric PGN NAG values for compatibility.
""",
    """The glyph is shown directly after the move, such as `Nf5!` or `Nf5⩲`. Move annotations are saved in lesson JSON and preserved when PGN is imported or exported. The punctuation move-quality glyphs are exported as familiar suffixes; positional glyphs use their standard numeric PGN NAG values for compatibility.

When an annotated move is selected in **Study** or **Analysis**, its move-quality glyph also appears as a colored badge beside the piece on the move's destination square. Position-evaluation glyphs remain in the notation only, so the board does not become a traveling punctuation convention.
""",
)
