from pathlib import Path


def replace_once(path, old, new):
    file_path = Path(path)
    text = file_path.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one anchor, found {count}.')
    file_path.write_text(text.replace(old, new), encoding='utf-8')


replace_once(
    'app.js',
    """  const menuWidth = 310;
  const menuHeight = 250;
""",
    """  const menuWidth = 360;
  const menuHeight = 520;
""",
)

replace_once(
    'app.js',
    """  const options = MOVE_ANNOTATIONS.map((annotation) => {
    const selected = currentNag === annotation.nag;
    return `
      <button
        type="button"
        class="move-annotation-option ${selected ? 'is-selected' : ''}"
        data-action="set-move-annotation"
        data-node-id="${escapeHtml(node.id)}"
        data-nag="${annotation.nag}"
        role="menuitemradio"
        aria-checked="${selected}"
      >
        <span class="move-annotation-option-glyph">${escapeHtml(annotation.glyph)}</span>
        <span class="move-annotation-option-label">${escapeHtml(annotation.label)}</span>
      </button>
    `;
  }).join('');
""",
    """  const groupNames = [...new Set(MOVE_ANNOTATIONS.map((annotation) => annotation.group || 'Other'))];
  const groups = groupNames.map((groupName) => {
    const options = MOVE_ANNOTATIONS
      .filter((annotation) => (annotation.group || 'Other') === groupName)
      .map((annotation) => {
        const selected = currentNag === annotation.nag;
        return `
          <button
            type="button"
            class="move-annotation-option ${selected ? 'is-selected' : ''}"
            data-action="set-move-annotation"
            data-node-id="${escapeHtml(node.id)}"
            data-nag="${annotation.nag}"
            role="menuitemradio"
            aria-checked="${selected}"
          >
            <span class="move-annotation-option-glyph">${escapeHtml(annotation.glyph)}</span>
            <span class="move-annotation-option-label">${escapeHtml(annotation.label)}</span>
          </button>
        `;
      }).join('');
    return `
      <section class="move-annotation-group" aria-label="${escapeHtml(groupName)}">
        <div class="move-annotation-group-title">${escapeHtml(groupName)}</div>
        <div class="move-annotation-option-grid">${options}</div>
      </section>
    `;
  }).join('');
""",
)

replace_once(
    'app.js',
    """        <span>Choose one glyph</span>
      </div>
      <div class="move-annotation-option-grid">${options}</div>
""",
    """        <span>Move or position</span>
      </div>
      ${groups}
""",
)

replace_once(
    'styles.css',
    """/* Move-quality annotation glyphs and the notation context menu. */
""",
    """/* Move-quality and position-evaluation glyphs with the notation context menu. */
""",
)

replace_once(
    'styles.css',
    """  width: min(19rem, calc(100vw - 1rem));
  padding: 0.75rem;
""",
    """  width: min(22rem, calc(100vw - 1rem));
  max-height: calc(100vh - 1rem);
  padding: 0.75rem;
  overflow-y: auto;
""",
)

replace_once(
    'styles.css',
    """.move-annotation-option-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.35rem;
}
""",
    """.move-annotation-group {
  display: grid;
  gap: 0.35rem;
}

.move-annotation-group-title {
  padding: 0 0.15rem;
  color: var(--text-soft);
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.move-annotation-option-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.35rem;
}
""",
)

replace_once(
    'styles.css',
    """  .move-annotation-menu {
    max-height: calc(100vh - 1rem);
    overflow-y: auto;
  }
""",
    """""",
)

replace_once(
    'README.md',
    """- Add PGN comments, standard move-annotation glyphs (`!`, `?`, `!!`, `??`, `!?`, `?!`), lesson notes, arrows, circles, stars, and colored square highlights.
""",
    """- Add PGN comments, move-quality glyphs (`!`, `?`, `!!`, `??`, `!?`, `?!`, `□`), position-evaluation glyphs (`=`, `∞`, `⩲`, `⩱`, `±`, `∓`, `+−`, `−+`), lesson notes, arrows, circles, stars, and colored square highlights.
""",
)

replace_once(
    'USER_GUIDE.md',
    """1. Right-click the move you want to judge. On a touch device, long-press the move.
2. Choose `!`, `?`, `!!`, `??`, `!?`, or `?!` from the popup menu.
3. Choose **Clear annotation** to remove the glyph.

The glyph is shown directly after the move, such as `Nf5!`. Move annotations are saved in lesson JSON and preserved when PGN is imported or exported. The six visible choices use the standard PGN NAG meanings.
""",
    """1. Right-click the move you want to annotate. On a touch device, long-press the move.
2. Choose a glyph from **Move quality** or **Position evaluation**.
3. Choose **Clear annotation** to remove the glyph.

Move-quality choices are `!`, `?`, `!!`, `??`, `!?`, `?!`, and `□` for a forced or only move. Position-evaluation choices are `=`, `∞`, `⩲`, `⩱`, `±`, `∓`, `+−`, and `−+`.

The glyph is shown directly after the move, such as `Nf5!` or `Nf5⩲`. Move annotations are saved in lesson JSON and preserved when PGN is imported or exported. The punctuation move-quality glyphs are exported as familiar suffixes; positional glyphs use their standard numeric PGN NAG values for compatibility.
""",
)

print('Additional move glyphs applied.')
