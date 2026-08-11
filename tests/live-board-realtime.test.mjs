import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../live-board-realtime.js', import.meta.url), 'utf8');

class EventTargetStub {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event) {
    for (const listener of this.listeners.get(event.type) || []) listener.call(this, event);
    return !event.defaultPrevented;
  }
}

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }
}

class FakeRoomDatabase {
  constructor() {
    this.rooms = new Map();
    this.calls = [];
  }

  addRoom(roomCode, overrides = {}) {
    this.rooms.set(roomCode, {
      room_code: roomCode,
      teacherToken: overrides.teacherToken || 'teacher-secret',
      studentTokens: new Set(overrides.studentTokens || ['student-full', 'student-short']),
      fen: overrides.fen || '8/8/8/8/8/8/4K3/7k w - - 0 1',
      pgn: '',
      orientation: 'white',
      last_move: null,
      student_moves_allowed: true,
      revision: 0,
      active_lesson_id: '',
    });
  }

  publicRow(room) {
    const { teacherToken, studentTokens, ...row } = room;
    return structuredClone(row);
  }

  async rpc(clientId, name, args) {
    this.calls.push({ clientId, name, args: structuredClone(args) });
    const room = this.rooms.get(args.p_room_code);

    if (name === 'get_live_board_room') {
      const tokenAllowed = room && (
        args.p_access_token === room.teacherToken
        || room.studentTokens.has(args.p_access_token)
      );
      return tokenAllowed
        ? { data: this.publicRow(room), error: null }
        : { data: null, error: { message: 'Room was not found.' } };
    }

    if (name === 'create_live_board_room') {
      if (room) return { data: null, error: { message: 'Room code already exists.' } };
      return { data: null, error: { message: 'Unexpected create in this test.' } };
    }

    if (!room || args.p_expected_revision !== room.revision) {
      return { data: null, error: { message: 'Revision conflict.' } };
    }

    if (name === 'update_live_board_teacher') {
      if (args.p_teacher_token !== room.teacherToken) {
        return { data: null, error: { message: 'Teacher token is invalid.' } };
      }
      Object.assign(room, {
        fen: args.p_fen,
        pgn: args.p_pgn,
        orientation: args.p_orientation,
        last_move: args.p_last_move,
        student_moves_allowed: args.p_student_moves_allowed,
        active_lesson_id: args.p_active_lesson_id,
        revision: room.revision + 1,
      });
      return { data: this.publicRow(room), error: null };
    }

    if (name === 'update_live_board_student') {
      if (!room.studentTokens.has(args.p_student_token)) {
        return { data: null, error: { message: 'Student token is invalid.' } };
      }
      Object.assign(room, {
        fen: args.p_fen,
        pgn: args.p_pgn,
        last_move: args.p_last_move,
        revision: room.revision + 1,
      });
      return { data: this.publicRow(room), error: null };
    }

    return { data: null, error: { message: `Unexpected RPC: ${name}` } };
  }
}

class FakeRealtimeHub {
  constructor() {
    this.channels = new Set();
  }

  createChannel(owner, topic, options) {
    const channel = new FakeRealtimeChannel(this, owner, topic, options);
    this.channels.add(channel);
    return channel;
  }

  remove(channel) {
    this.channels.delete(channel);
  }

  broadcast(sender, message) {
    for (const channel of this.channels) {
      if (channel === sender || !channel.subscribed || channel.topic !== sender.topic) continue;
      for (const handler of channel.handlers) {
        if (handler.type === 'broadcast' && handler.filter.event === message.event) {
          handler.listener({ type: 'broadcast', event: message.event, payload: message.payload });
        }
      }
    }
  }
}

class FakeRealtimeChannel {
  constructor(hub, owner, topic, options) {
    this.hub = hub;
    this.owner = owner;
    this.topic = topic;
    this.options = options;
    this.handlers = [];
    this.subscribed = false;
    this.statusListener = null;
    this.nextSendResult = null;
  }

  on(type, filter, listener) {
    this.handlers.push({ type, filter, listener });
    return this;
  }

  subscribe(listener) {
    this.statusListener = listener;
    return this;
  }

  emitStatus(nextStatus, error = null) {
    this.subscribed = nextStatus === 'SUBSCRIBED';
    this.statusListener?.(nextStatus, error);
  }

  async send(message) {
    if (this.nextSendResult) {
      const result = this.nextSendResult;
      this.nextSendResult = null;
      return result;
    }
    if (!this.subscribed) return 'timed out';
    this.hub.broadcast(this, message);
    return 'ok';
  }
}

function createPage({ id, url, database, hub }) {
  let currentUrl = new URL(url);
  const windowTarget = new EventTargetStub();
  const documentTarget = new EventTargetStub();
  const connectionStatus = { textContent: '' };
  const channels = [];
  const warnings = [];

  const location = {
    get href() { return currentUrl.href; },
    get pathname() { return currentUrl.pathname; },
    get search() { return currentUrl.search; },
    get hash() { return currentUrl.hash; },
  };
  const history = {
    replaceState(_state, _title, nextUrl) {
      currentUrl = new URL(nextUrl, currentUrl);
    },
  };
  const document = Object.assign(documentTarget, {
    visibilityState: 'visible',
    getElementById(elementId) {
      return elementId === 'connectionStatus' ? connectionStatus : null;
    },
  });
  const client = {
    rpc(name, args) {
      return database.rpc(id, name, args);
    },
    channel(topic, options) {
      const channel = hub.createChannel(id, topic, options);
      channels.push(channel);
      return channel;
    },
    removeChannel(channel) {
      hub.remove(channel);
    },
  };
  const window = Object.assign(windowTarget, {
    supabase: { createClient: () => client },
    prompt() {},
  });
  class CustomEventStub {
    constructor(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    }
  }

  const context = vm.createContext({
    window,
    document,
    location,
    history,
    sessionStorage: new MemoryStorage(),
    navigator: { clipboard: { writeText: async () => {} } },
    crypto: globalThis.crypto,
    URL,
    URLSearchParams,
    CustomEvent: CustomEventStub,
    Uint8Array,
    Set,
    Promise,
    Number,
    String,
    Array,
    JSON,
    console: {
      log: console.log.bind(console),
      info: console.info.bind(console),
      warn: (...args) => warnings.push(args),
      error: (...args) => warnings.push(args),
    },
  });
  vm.runInContext(source, context, { filename: 'live-board-realtime.js' });

  return { window, document, channels, connectionStatus, database, warnings };
}

function secureUrl(roomCode, role) {
  const access = role === 'teacher'
    ? 'access=teacher-secret&student=student-full'
    : 'access=student-short';
  return `https://example.test/live-board.html?room=${roomCode}&role=${role}#room=${roomCode}&role=${role}&${access}`;
}

function boardState(fen) {
  return {
    fen,
    pgn: '',
    orientation: 'white',
    lastMove: null,
    studentMovesAllowed: true,
    activeLessonId: '',
  };
}

async function drain(...transports) {
  for (let pass = 0; pass < 5; pass += 1) {
    await Promise.all(transports.map((transport) => transport.queue));
    await Promise.resolve();
  }
}

test('teacher and student exchange authoritative revisions on one shared room topic', async () => {
  const database = new FakeRoomDatabase();
  const hub = new FakeRealtimeHub();
  database.addRoom('ABC234');
  database.addRoom('OTHER9', { studentTokens: ['student-short'] });

  const teacherPage = createPage({ id: 'teacher', url: secureUrl('ABC234', 'teacher'), database, hub });
  const studentPage = createPage({ id: 'student', url: secureUrl('ABC234', 'student'), database, hub });
  const otherPage = createPage({ id: 'other-student', url: secureUrl('OTHER9', 'student'), database, hub });

  const teacher = new teacherPage.window.BroadcastChannel('cd-live-board:ABC234');
  const student = new studentPage.window.BroadcastChannel('cd-live-board:ABC234');
  const otherStudent = new otherPage.window.BroadcastChannel('cd-live-board:OTHER9');
  const teacherStates = [];
  const studentStates = [];
  const otherStates = [];
  teacher.addEventListener('message', (event) => teacherStates.push(event.data.state));
  student.addEventListener('message', (event) => studentStates.push(event.data.state));
  otherStudent.addEventListener('message', (event) => otherStates.push(event.data.state));

  assert.equal(teacherPage.channels[0].topic, 'live-board:ABC234');
  assert.equal(studentPage.channels[0].topic, 'live-board:ABC234');
  assert.equal(otherPage.channels[0].topic, 'live-board:OTHER9');
  assert.equal(teacherPage.channels[0].topic.includes('teacher-secret'), false);
  assert.equal(teacherPage.channels[0].options.config.broadcast.ack, true);

  // Match the application bootstrap: the teacher publishes once to claim an existing room.
  teacher.postMessage({ type: 'state', state: boardState('8/8/8/8/8/8/4K3/7k w - - 0 1') });
  teacherPage.channels[0].emitStatus('SUBSCRIBED');
  studentPage.channels[0].emitStatus('SUBSCRIBED');
  otherPage.channels[0].emitStatus('SUBSCRIBED');
  await drain(teacher, student, otherStudent);

  teacherStates.length = 0;
  studentStates.length = 0;
  otherStates.length = 0;

  student.postMessage({ type: 'student-move', state: boardState('8/8/8/8/8/8/4K3/7k b - - 1 1') });
  await drain(student, teacher, otherStudent);
  assert.equal(database.rooms.get('ABC234').revision, 1);
  assert.equal(teacherStates.at(-1).revision, 1, 'student move reaches teacher');
  assert.equal(otherStates.length, 0, 'another room does not receive the update');

  teacher.postMessage({ type: 'state', state: boardState('8/8/8/8/8/4K3/8/7k w - - 2 2') });
  await drain(teacher, student, otherStudent);
  assert.equal(database.rooms.get('ABC234').revision, 2);
  assert.equal(studentStates.at(-1).revision, 2, 'teacher move reaches student');

  for (let index = 0; index < 6; index += 1) {
    const mover = index % 2 === 0 ? student : teacher;
    mover.postMessage({
      type: index % 2 === 0 ? 'student-move' : 'state',
      state: boardState(`8/8/8/8/8/4K3/8/7k ${index % 2 ? 'w' : 'b'} - - ${index + 3} ${index + 3}`),
    });
    await drain(teacher, student);
  }

  assert.equal(database.rooms.get('ABC234').revision, 8);
  assert.equal(teacherStates.at(-1).revision, 8);
  assert.equal(studentStates.at(-1).revision, 8);
  assert.equal(
    database.calls.filter((call) => call.name.startsWith('update_live_board_')).length,
    8,
    'remote refreshes do not feed back into extra writes',
  );

  const teacherReadsBeforeDuplicate = database.calls.filter(
    (call) => call.clientId === 'teacher' && call.name === 'get_live_board_room',
  ).length;
  await studentPage.channels[0].send({ type: 'broadcast', event: 'changed', payload: { revision: 8 } });
  await drain(teacher);
  const teacherReadsAfterDuplicate = database.calls.filter(
    (call) => call.clientId === 'teacher' && call.name === 'get_live_board_room',
  ).length;
  assert.equal(teacherReadsAfterDuplicate, teacherReadsBeforeDuplicate, 'duplicate signals do not refetch');
});

test('an unacknowledged revision signal retries after the realtime channel reconnects', async () => {
  const database = new FakeRoomDatabase();
  const hub = new FakeRealtimeHub();
  database.addRoom('REC123');

  const teacherPage = createPage({ id: 'teacher', url: secureUrl('REC123', 'teacher'), database, hub });
  const studentPage = createPage({ id: 'student', url: secureUrl('REC123', 'student'), database, hub });
  const teacher = new teacherPage.window.BroadcastChannel('cd-live-board:REC123');
  const student = new studentPage.window.BroadcastChannel('cd-live-board:REC123');
  const studentStates = [];
  student.addEventListener('message', (event) => studentStates.push(event.data.state));

  teacher.postMessage({ type: 'state', state: boardState('8/8/8/8/8/8/4K3/7k w - - 0 1') });
  teacherPage.channels[0].emitStatus('SUBSCRIBED');
  studentPage.channels[0].emitStatus('SUBSCRIBED');
  await drain(teacher, student);
  studentStates.length = 0;

  teacherPage.channels[0].nextSendResult = 'timed out';
  teacher.postMessage({ type: 'state', state: boardState('8/8/8/8/8/4K3/8/7k b - - 1 1') });
  await drain(teacher, student);
  assert.equal(database.rooms.get('REC123').revision, 1, 'the database remains authoritative');
  assert.equal(studentStates.length, 0, 'the failed signal is not mistaken for delivery');

  teacherPage.channels[0].emitStatus('CHANNEL_ERROR');
  teacherPage.channels[0].emitStatus('SUBSCRIBED');
  await drain(teacher, student);

  assert.equal(studentStates.at(-1).revision, 1, 'the queued revision is announced after reconnect');
  assert.equal(studentStates.at(-1).fen, database.rooms.get('REC123').fen);
  assert.match(String(teacherPage.warnings[0]?.[0]), /will retry after reconnecting/);
});
