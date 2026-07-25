import { readFile, writeFile } from 'node:fs/promises';

async function replaceRequired(path, replacements) {
  let source = await readFile(path, 'utf8');
  for (const [before, after] of replacements) {
    if (!source.includes(before)) {
      throw new Error(`Expected source block not found in ${path}`);
    }
    source = source.replace(before, after);
  }
  await writeFile(path, source);
}

await replaceRequired('lichess-position-training.mjs', [
  [
    "const STYLE_URL = './lichess-position-training.css?v=20260725-theme-board2';",
    "const STYLE_URL = './lichess-position-training.css?v=20260725-edge-coordinates3';",
  ],
  [
`    this.board.innerHTML = boardSquares(orientation).map((square) => {
      const piece = this.game?.get(square);
      const file = square.charCodeAt(0) - 97;
      const rank = Number(square[1]) - 1;
      const dark = (file + rank) % 2 === 0;
      const classes = [
        'position-training-square',
        dark ? 'dark' : 'light',
        square === this.selectedSquare ? 'selected' : '',
        legalTargets.has(square) ? 'legal-target' : '',
        square === this.hintSquare ? 'hinted' : '',
      ].filter(Boolean).join(' ');
      const pieceMarkup = piece ? pieceImageMarkup(piece.color, piece.type, 'position-training-piece') : '';
      const pieceLabel = piece ? \` \${piece.color === 'w' ? 'white' : 'black'} \${PIECE_NAMES[piece.type]}\` : '';
      return \`<button type="button" class="\${classes}" data-square="\${square}" aria-label="\${square}\${pieceLabel}">\${pieceMarkup}<small>\${square}</small></button>\`;
    }).join('');`,
`    this.board.innerHTML = boardSquares(orientation).map((square, index) => {
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
      const pieceLabel = piece ? \` \${piece.color === 'w' ? 'white' : 'black'} \${PIECE_NAMES[piece.type]}\` : '';
      const rankLabel = col === 0
        ? \`<small class="position-training-coordinate position-training-rank">\${square[1]}</small>\`
        : '';
      const fileLabel = row === 7
        ? \`<small class="position-training-coordinate position-training-file">\${square[0]}</small>\`
        : '';
      return \`<button type="button" class="\${classes}" data-square="\${square}" aria-label="\${square}\${pieceLabel}">\${pieceMarkup}\${rankLabel}\${fileLabel}</button>\`;
    }).join('');`,
  ],
]);

await replaceRequired('lichess-position-training.css', [[
`.position-training-square > small {
  position: absolute;
  left: 4px;
  bottom: 2px;
  z-index: 4;
  font-size: clamp(0.48rem, 1.2vw, 0.72rem);
  font-weight: 800;
  line-height: 1;
  pointer-events: none;
}

.position-training-square.light > small {
  color: var(--coord-light-color);
}

.position-training-square.dark > small {
  color: var(--coord-dark-color);
}`,
`.position-training-coordinate {
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
}`,
]]);

await replaceRequired('focus-analysis-popup.mjs', [[
  "import './lichess-position-training.mjs?v=20260725-position-training2';",
  "import './lichess-position-training.mjs?v=20260725-position-training3';",
]]);
