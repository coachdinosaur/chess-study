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
    this.innerHTML = '';
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
    const payload = {
      type,
      target: event.target || this,
      currentTarget: this,
      preventDefault() {},
      stopPropagation() {},
      ...event,
    };
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
    if (classMatch) return this.className.split(/\s+/).includes(classMatch[1]);
    if (/^[a-z]+$/i.test(selector)) return this.tagName === selector.toUpperCase();
    return false;
  }

  closest(selector) {
    let node = this;
    while (node) {
      if (node.matches?.(selector)) return node;
      node = node.parent;
    }
    return null;
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
    this.elementFromPointResult = null;
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
    for (const listener of this.docListeners.get(type) || []) listener({
      type,
      preventDefault() {},
      stopPropagation() {},
      ...event,
    });
  }

  elementFromPoint() {
    return this.elementFromPointResult;
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

function createSandbox({ search = '' } = {}) {
  const documentStub = new FakeDocument();
  const storage = new MemoryStorage();
  const hub = { channels: [], sent: [] };
  const url = `https://chess.example/live-board.html${search}`;
  const context = {
    Node: FakeNode,
    Element: FakeElement,
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
    addEventListener() {},
    removeEventListener() {},
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
    overlay: documentStub.getElementById('liveBoardAnnotationOverlay'),
    stateMessages: () => hub.sent.filter((entry) => entry.message.state),
  };
}

function squareButton(board, square) {
  return board.children.find((child) => child.dataset.square === square);
}

function annotationSpan(board, square, kind) {
  return squareButton(board, square)?.children.find(
    (child) => typeof child.className === 'string' && child.className.includes(kind),
  );
}

// State payloads are produced inside the vm realm, so their arrays/objects
// carry foreign prototypes — normalize through JSON before deepEqual.
function toPlain(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function lastPublishedAnnotations(sandbox) {
  const states = sandbox.stateMessages();
  return toPlain(states.at(-1)?.message.state.annotations);
}

function rightClickSquare(sandbox, square, modifiers = {}) {
  const button = squareButton(sandbox.board, square);
  assert.ok(button, `square ${square} should exist`);
  sandbox.board.dispatch('mousedown', { button: 2, target: button, ...modifiers });
  sandbox.documentStub.elementFromPointResult = button;
  sandbox.documentStub.dispatchDocument('mouseup', { clientX: 1, clientY: 1 });
}

test('teacher right-click toggles a green circle and publishes it in room state', () => {
  const sandbox = createSandbox({ search: '?room=ABC123&role=teacher' });
  rightClickSquare(sandbox, 'e4');

  const span = annotationSpan(sandbox.board, 'e4', 'board-annotation-circle');
  assert.ok(span, 'circle span rendered inside the square');
  assert.ok(span.className.includes('is-green'));
  assert.deepEqual(lastPublishedAnnotations(sandbox).circledSquares, ['e4']);

  rightClickSquare(sandbox, 'e4');
  assert.equal(annotationSpan(sandbox.board, 'e4', 'board-annotation-circle'), undefined, 'second click removes the circle');
  assert.deepEqual(lastPublishedAnnotations(sandbox).circledSquares, []);
});

test('teacher draws colored marks: Ctrl circle is orange, Shift is blue', () => {
  const sandbox = createSandbox({ search: '?room=ABC123&role=teacher' });
  rightClickSquare(sandbox, 'd4', { ctrlKey: true });
  rightClickSquare(sandbox, 'f6', { shiftKey: true });

  assert.ok(annotationSpan(sandbox.board, 'd4', 'board-annotation-circle').className.includes('is-orange'));
  assert.ok(annotationSpan(sandbox.board, 'f6', 'board-annotation-circle').className.includes('is-blue'));
  assert.deepEqual(lastPublishedAnnotations(sandbox).circledSquares, [
    { square: 'd4', color: 'orange' },
    { square: 'f6', color: 'blue' },
  ]);
});

test('teacher Alt+right-drag draws an arrow that publishes from/to squares', () => {
  const sandbox = createSandbox({ search: '?room=ABC123&role=teacher' });
  const start = squareButton(sandbox.board, 'e2');
  const end = squareButton(sandbox.board, 'e4');

  sandbox.board.dispatch('mousedown', { button: 2, target: start, altKey: true });
  sandbox.documentStub.elementFromPointResult = end;
  sandbox.documentStub.dispatchDocument('mousemove', { clientX: 5, clientY: 5, buttons: 2 });
  sandbox.documentStub.dispatchDocument('mouseup', { clientX: 5, clientY: 5 });

  assert.match(sandbox.overlay.innerHTML, /board-annotation-arrow/, 'arrow svg rendered in the overlay');
  assert.deepEqual(lastPublishedAnnotations(sandbox).arrows, [{ from: 'e2', to: 'e4' }]);
});

test('teacher left click clears all marks and suppresses the square click', () => {
  const sandbox = createSandbox({ search: '?room=ABC123&role=teacher' });
  rightClickSquare(sandbox, 'c3');
  assert.ok(annotationSpan(sandbox.board, 'c3', 'board-annotation-circle'));

  const target = squareButton(sandbox.board, 'a1');
  sandbox.board.dispatch('mousedown', { button: 0, target });
  target.dispatch('click');

  assert.equal(annotationSpan(sandbox.board, 'c3', 'board-annotation-circle'), undefined, 'marks cleared');
  assert.equal(squareButton(sandbox.board, 'a1').className.includes('selected'), false, 'clearing click is not treated as a square selection');
  assert.deepEqual(lastPublishedAnnotations(sandbox).circledSquares, []);
});

test('student right-click never annotates and marks apply from remote state', () => {
  const sandbox = createSandbox({ search: '?room=ABC123&role=student' });
  rightClickSquare(sandbox, 'e4');
  assert.equal(annotationSpan(sandbox.board, 'e4', 'board-annotation-circle'), undefined, 'student cannot draw');

  const channel = sandbox.hub.channels[0];
  channel.receive?.({
    type: 'state',
    roomCode: 'ABC123',
    sender: 'teacher-client',
    state: {
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      pgn: '',
      orientation: 'white',
      lastMove: null,
      studentMovesAllowed: true,
      revision: 5,
      activeLessonId: '',
      annotations: { paintedSquares: [], circledSquares: ['e4'], starredSquares: [], arrows: [{ from: 'e2', to: 'e4' }] },
    },
  });

  assert.ok(annotationSpan(sandbox.board, 'e4', 'board-annotation-circle'), 'remote circle rendered for the student');
  assert.match(sandbox.overlay.innerHTML, /board-annotation-arrow/, 'remote arrow rendered for the student');
});

test('annotation stylesheet and overlay markup contract exists', () => {
  assert.match(css, /\.board-annotation-overlay/);
  assert.match(css, /\.board-annotation-circle/);
  assert.match(css, /\.board-annotation-arrow/);
  assert.match(css, /--annotation-accent-rgb/);
});
