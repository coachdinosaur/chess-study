import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as chessModule from '../vendor/chess.js';

const liveBoardSource = await readFile(new URL('../live-board.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../live-board.css', import.meta.url), 'utf8');

class FakeNode {}

class FakeElement extends FakeNode {
  constructor(tag = 'div') {
    super();
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.parent = null;
    this.listeners = new Map();
    this.attributes = new Map();
    this.dataset = {};
    this.style = {};
    this.className = '';
    this.hidden = false;
    this.disabled = false;
    this.textContent = '';
    this.value = '';
    this.selected = false;
  }

  get classList() {
    const element = this;
    const classes = () => element.className.split(/\s+/).filter(Boolean);
    return {
      add: (...names) => {
        const set = new Set(classes());
        names.forEach((name) => set.add(name));
        element.className = [...set].join(' ');
      },
      remove: (...names) => {
        const set = new Set(classes());
        names.forEach((name) => set.delete(name));
        element.className = [...set].join(' ');
      },
      toggle: (name, force) => {
        const set = new Set(classes());
        const shouldAdd = force === undefined ? !set.has(name) : Boolean(force);
        if (shouldAdd) set.add(name);
        else set.delete(name);
        element.className = [...set].join(' ');
        return shouldAdd;
      },
      contains: (name) => classes().includes(name),
    };
  }

  appendChild(child) {
    if (child && child.parent) {
      const index = child.parent.children.indexOf(child);
      if (index >= 0) child.parent.children.splice(index, 1);
    }
    if (child && typeof child === 'object') child.parent = this;
    this.children.push(child);
    return child;
  }

  append(...nodes) {
    nodes.forEach((node) => this.appendChild(node));
  }

  replaceChildren() {
    for (const child of this.children) child.parent = null;
    this.children = [];
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type, event = {}) {
    const payload = { type, target: event.target || this, currentTarget: this, preventDefault() {}, stopPropagation() {}, ...event };
    for (const listener of this.listeners.get(type) || []) listener(payload);
    return payload;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === 'class') this.className = String(value);
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  matches(selector) {
    const classMatch = selector.match(/^\.([A-Za-z0-9_-]+)/);
    if (classMatch && !this.className.split(/\s+/).includes(classMatch[1])) return false;
    if (/^[a-z]+$/i.test(selector)) return this.tagName === selector.toUpperCase();
    const attrMatch = selector.match(/\[([a-zA-Z-]+)="([^"]*)"\]/);
    if (attrMatch) return String(this.dataset[attrMatch[1]] ?? this.attributes.get(attrMatch[1]) ?? '') === attrMatch[2];
    return true;
  }

  querySelector(selector) {
    for (const child of this.children) {
      if (child.matches?.(selector)) return child;
      const found = child.querySelector?.(selector);
      if (found) return found;
    }
    return null;
  }

  querySelectorAll(selector) {
    const found = [];
    for (const child of this.children) {
      if (child.matches?.(selector)) found.push(child);
      found.push(...(child.querySelectorAll?.(selector) || []));
    }
    return found;
  }

  contains(node) {
    if (node === this) return true;
    return this.children.some((child) => child.contains?.(node));
  }

  focus() {}
}

class FakeDocument extends FakeElement {
  constructor() {
    super('#document');
    this.documentElement = new FakeElement('html');
    this.documentElement.dataset = {};
    this.body = new FakeElement('body');
    this.appendChild(this.documentElement);
    this.documentElement.appendChild(this.body);
    this.docListeners = new Map();
  }

  getElementById(id) {
    if (!this.byId) this.byId = new Map();
    if (!this.byId.has(id)) this.byId.set(id, new FakeElement('div'));
    return this.byId.get(id);
  }

  createElement(tag) {
    return new FakeElement(tag);
  }

  addEventListener(type, listener) {
    if (!this.docListeners.has(type)) this.docListeners.set(type, new Set());
    this.docListeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    this.docListeners.get(type)?.delete(listener);
  }

  dispatchDocument(type, event) {
    for (const listener of this.docListeners.get(type) || []) listener(event);
  }

  querySelector() { return null; }
  querySelectorAll() { return []; }
}

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

class FakeChannel {
  constructor(hub, name) {
    this.hub = hub;
    this.name = name;
    this.listeners = new Map();
    this.closed = false;
    hub.channels.push(this);
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  postMessage(message) {
    this.hub.sent.push({ channel: this, message });
  }

  close() {
    this.closed = true;
  }

  receive(message) {
    for (const listener of this.listeners.get('message') || []) listener({ data: message });
  }
}

const WHITE_PROMO_FEN = 'k7/6P1/8/8/8/8/8/K6R w - - 0 1';
const BLACK_PROMO_FEN = "7k/8/8/8/8/8/R5p1/K7 b - - 0 1";

function createSandbox({ search = '' } = {}) {
  const documentStub = new FakeDocument();
  const storage = new MemoryStorage();
  const hub = { channels: [], sent: [] };
  const url = `https://chess.example/live-board.html${search}`;
  const context = {
    Node: FakeNode,
    document: documentStub,
    localStorage: storage,
    crypto,
    URL,
    URLSearchParams,
    location: { href: url, search },
    history: { replaceState() {} },
    BroadcastChannel: class {
      constructor(name) { return new FakeChannel(hub, name); }
    },
    console,
    Chess: chessModule.Chess,
    DEFAULT_POSITION: chessModule.DEFAULT_POSITION,
    setTimeout,
    clearTimeout,
    requestAnimationFrame: (fn) => fn(),
  };
  context.window = context;
  vm.createContext(context);

  const source = liveBoardSource.replace(/^import\s*\{[^}]*}\s*from\s*'[^']*';/m, '');
  vm.runInContext(source, context, { filename: 'live-board.js' });
  const board = documentStub.getElementById('liveBoard');
  return {
    context,
    documentStub,
    storage,
    hub,
    board,
    overlayRoot: documentStub.body,
    fen: () => documentStub.getElementById('fenInput').value,
    moveListText: () => documentStub.getElementById('moveList').children.map((li) => li.textContent).join(' '),
    studentMoveMessages: () => hub.sent.filter((entry) => entry.message.type === 'student-move'),
  };
}

function squareButton(board, square) {
  return board.children.find((child) => child.dataset.square === square);
}

function clickSquare(board, square) {
  const button = squareButton(board, square);
  assert.ok(button, `square ${square} should exist on the rendered board`);
  button.dispatch('click');
}

function loadPosition(sandbox, fen) {
  sandbox.documentStub.getElementById('fenInput').value = fen;
  sandbox.documentStub.getElementById('loadFenButton').dispatch('click');
}

function promotionOption(overlay, piece) {
  return overlay.querySelector('.promotion-options').children.find((button) => button.dataset.piece === piece);
}

test('promotion chooser CSS and markup contract exists', () => {
  assert.match(css, /\.promotion-overlay/);
  assert.match(css, /\.promotion-dialog/);
  assert.match(css, /\.promotion-option/);
  assert.match(liveBoardSource, /openPromotionChooser/);
  assert.match(liveBoardSource, /PROMOTION_CHOICES = \['q', 'r', 'b', 'n'\]/);
  assert.doesNotMatch(liveBoardSource, /\? 'q' : undefined/);
});

test('student pawn move to the last rank opens the chooser instead of committing a queen', () => {
  const sandbox = createSandbox({ search: '?room=ABC123&role=student' });
  loadPosition(sandbox, WHITE_PROMO_FEN);

  clickSquare(sandbox.board, 'g7');
  clickSquare(sandbox.board, 'g8');

  assert.equal(sandbox.fen(), WHITE_PROMO_FEN, 'no move may be committed before a piece is chosen');
  const overlay = sandbox.overlayRoot.querySelector('.promotion-overlay');
  assert.ok(overlay, 'promotion overlay is present');
  assert.equal(overlay.hidden, false);
  const options = overlay.querySelector('.promotion-options').children;
  assert.equal(options.length, 4);
  assert.deepEqual(options.map((button) => button.dataset.piece), ['q', 'r', 'b', 'n']);
  const optionImages = options.map((button) => button.children[0].src);
  assert.deepEqual(optionImages, [
    './assets/pieces/mpchess/wQ.svg',
    './assets/pieces/mpchess/wR.svg',
    './assets/pieces/mpchess/wB.svg',
    './assets/pieces/mpchess/wN.svg',
  ], 'chooser shows white pieces for a white promotion');
});

test('student chooses rook, bishop, knight, and queen; the published move carries the selection', () => {
  for (const piece of ['q', 'r', 'b', 'n']) {
    const sandbox = createSandbox({ search: '?room=ABC123&role=student' });
    loadPosition(sandbox, WHITE_PROMO_FEN);
    clickSquare(sandbox.board, 'g7');
    clickSquare(sandbox.board, 'g8');

    const overlay = sandbox.overlayRoot.querySelector('.promotion-overlay');
    promotionOption(overlay, piece).dispatch('click');

    assert.equal(sandbox.fen(), `k5${piece.toUpperCase()}1/8/8/8/8/8/8/K6R b - - 0 1`, `${piece} promotion committed on the student board`);
    assert.ok(sandbox.moveListText().includes(`g8=${piece.toUpperCase()}`), 'move list shows the chosen promotion');
    assert.equal(overlay.hidden, true, 'chooser closes after the choice');

    const moveMessages = sandbox.studentMoveMessages();
    assert.equal(moveMessages.length, 1, 'exactly one move message is published (no intermediate queen)');
    assert.match(moveMessages[0].message.state.pgn, new RegExp(`g8=${piece.toUpperCase()}`), 'published PGN carries the selected promotion piece');
  }
});

test('black student promotion shows black pieces and publishes the chosen piece', () => {
  const sandbox = createSandbox({ search: '?room=ABC123&role=student' });
  loadPosition(sandbox, BLACK_PROMO_FEN);

  clickSquare(sandbox.board, 'g2');
  clickSquare(sandbox.board, 'g1');

  const overlay = sandbox.overlayRoot.querySelector('.promotion-overlay');
  assert.equal(overlay.hidden, false);
  const optionImages = overlay.querySelector('.promotion-options').children.map((button) => button.children[0].src);
  assert.deepEqual(optionImages, [
    './assets/pieces/mpchess/bQ.svg',
    './assets/pieces/mpchess/bR.svg',
    './assets/pieces/mpchess/bB.svg',
    './assets/pieces/mpchess/bN.svg',
  ], 'chooser shows black pieces for a black promotion');

  promotionOption(overlay, 'n').dispatch('click');
  assert.equal(sandbox.fen(), "7k/8/8/8/8/8/R7/K5n1 w - - 0 2", "black knight promotion committed");
  const moveMessages = sandbox.studentMoveMessages();
  assert.match(moveMessages[0].message.state.pgn, /g1=N/);
});

test('dismissing the chooser with Escape leaves a valid, unpublished position', () => {
  const sandbox = createSandbox({ search: '?room=ABC123&role=student' });
  loadPosition(sandbox, WHITE_PROMO_FEN);
  clickSquare(sandbox.board, 'g7');
  clickSquare(sandbox.board, 'g8');

  const overlay = sandbox.overlayRoot.querySelector('.promotion-overlay');
  sandbox.documentStub.dispatchDocument('keydown', { key: 'Escape', target: overlay, preventDefault() {} });

  assert.equal(overlay.hidden, true, 'chooser is hidden after Escape');
  assert.equal(sandbox.fen(), WHITE_PROMO_FEN, 'position is unchanged');
  assert.equal(sandbox.studentMoveMessages().length, 0, 'no move was published');
  assert.equal(squareButton(sandbox.board, 'g7').className.includes('selected'), false, 'selection cleared after dismissal');
});

test('dismissing via outside click keeps the position valid and lets the next square click work', () => {
  const sandbox = createSandbox({ search: '?room=ABC123&role=student' });
  loadPosition(sandbox, WHITE_PROMO_FEN);
  clickSquare(sandbox.board, 'g7');
  clickSquare(sandbox.board, 'g8');

  const overlay = sandbox.overlayRoot.querySelector('.promotion-overlay');
  const kingSquare = squareButton(sandbox.board, 'a1');
  sandbox.documentStub.dispatchDocument('pointerdown', { target: kingSquare });

  assert.equal(overlay.hidden, true, 'chooser closes on outside pointerdown');
  assert.equal(sandbox.fen(), WHITE_PROMO_FEN, 'position unchanged');
  kingSquare.dispatch('click');
  assert.equal(squareButton(sandbox.board, 'a1').className.includes('selected'), true, 'king selectable after dismissal');
});

test('teacher sees exactly the promoted piece the student chose', () => {
  const student = createSandbox({ search: '?room=ABC123&role=student' });
  loadPosition(student, WHITE_PROMO_FEN);
  clickSquare(student.board, 'g7');
  clickSquare(student.board, 'g8');
  promotionOption(student.overlayRoot.querySelector('.promotion-overlay'), 'r').dispatch('click');

  const teacher = createSandbox({ search: '?room=ABC123&role=teacher' });
  const studentMove = student.studentMoveMessages()[0];
  assert.ok(studentMove, 'student published a move');
  teacher.hub.channels[0].receive({ ...studentMove.message, sender: 'student-client' });

  assert.equal(teacher.fen(), "k5R1/8/8/8/8/8/8/K6R b - - 0 1", "teacher board shows the rook promotion");
  const g8 = squareButton(teacher.board, 'g8');
  const image = g8.children.find((child) => child.tagName === "IMG");
  assert.equal(image.src, './assets/pieces/mpchess/wR.svg', 'teacher board renders a white rook on g8');
});

test('ordinary non-promotion moves behave exactly as before', () => {
  const sandbox = createSandbox({ search: '?room=ABC123&role=student' });
  loadPosition(sandbox, 'k7/8/8/8/8/8/4P3/K6R w - - 0 1');
  clickSquare(sandbox.board, 'e2');
  clickSquare(sandbox.board, 'e4');

  assert.equal(sandbox.fen(), 'k7/8/8/8/4P3/8/8/K6R b - - 0 1', 'pawn push committed directly');
  const moveMessages = sandbox.studentMoveMessages();
  assert.equal(moveMessages.length, 1);
  assert.match(moveMessages[0].message.state.pgn, /e4/);
  assert.equal(sandbox.overlayRoot.querySelector('.promotion-overlay'), null);
});
