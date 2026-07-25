import { readFile, writeFile } from 'node:fs/promises';

const filePath = new URL('../lichess-position-training.mjs', import.meta.url);
let source = await readFile(filePath, 'utf8');

function replaceExact(label, before, after) {
  if (!source.includes(before)) {
    throw new Error(`Could not find ${label} in lichess-position-training.mjs.`);
  }
  source = source.replace(before, after);
}

replaceExact(
  'position-training stylesheet version',
  "const STYLE_URL = './lichess-position-training.css?v=20260725-position-training1';",
  "const STYLE_URL = './lichess-position-training.css?v=20260725-theme-board2';",
);

replaceExact(
  'Unicode piece map',
  `const PIECES = Object.freeze({
  w: Object.freeze({ k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' }),
  b: Object.freeze({ k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }),
});`,
  `const PIECE_ASSETS = Object.freeze({
  w: Object.freeze({
    k: './assets/pieces/mpchess/wK.svg',
    q: './assets/pieces/mpchess/wQ.svg',
    r: './assets/pieces/mpchess/wR.svg',
    b: './assets/pieces/mpchess/wB.svg',
    n: './assets/pieces/mpchess/wN.svg',
    p: './assets/pieces/mpchess/wP.svg',
  }),
  b: Object.freeze({
    k: './assets/pieces/mpchess/bK.svg',
    q: './assets/pieces/mpchess/bQ.svg',
    r: './assets/pieces/mpchess/bR.svg',
    b: './assets/pieces/mpchess/bB.svg',
    n: './assets/pieces/mpchess/bN.svg',
    p: './assets/pieces/mpchess/bP.svg',
  }),
});

const PIECE_NAMES = Object.freeze({
  k: 'king',
  q: 'queen',
  r: 'rook',
  b: 'bishop',
  n: 'knight',
  p: 'pawn',
});

function pieceImageMarkup(color, type, className) {
  const src = PIECE_ASSETS[color]?.[type];
  if (!src) return '';
  return \`<img class="\${className}" src="\${src}" alt="" draggable="false">\`;
}`,
);

replaceExact(
  'board piece rendering',
  `      const glyph = piece ? PIECES[piece.color][piece.type] : '';
      return \`<button type="button" class="\${classes}" data-square="\${square}" aria-label="\${square}\${piece ? \` \${piece.color === 'w' ? 'white' : 'black'} \${piece.type}\` : ''}"><span>\${glyph}</span><small>\${square}</small></button>\`;`,
  `      const pieceMarkup = piece ? pieceImageMarkup(piece.color, piece.type, 'position-training-piece') : '';
      const pieceLabel = piece ? \` \${piece.color === 'w' ? 'white' : 'black'} \${PIECE_NAMES[piece.type]}\` : '';
      return \`<button type="button" class="\${classes}" data-square="\${square}" aria-label="\${square}\${pieceLabel}">\${pieceMarkup}<small>\${square}</small></button>\`;`,
);

replaceExact(
  'promotion piece rendering',
  `    container.innerHTML = \`<p>Promote to:</p>\${options.map((piece) => \`<button type="button" data-pt-promotion-piece="\${piece}" aria-label="Promote to \${piece}">\${PIECES[color][piece]}</button>\`).join('')}\`;`,
  `    container.innerHTML = \`<p>Promote to:</p>\${options.map((piece) => \`<button type="button" data-pt-promotion-piece="\${piece}" aria-label="Promote to \${PIECE_NAMES[piece]}">\${pieceImageMarkup(color, piece, 'position-training-promotion-piece')}</button>\`).join('')}\`;`,
);

await writeFile(filePath, source, 'utf8');
console.log('Patched lichess-position-training.mjs to use the main app theme stylesheet and mpchess piece assets.');
