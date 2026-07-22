(function () {
  'use strict';

  var SUPABASE_URL = 'https://oxcottitwvayrrcuypmb.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_-0VdtXfcJH__vKlXrX5QIg_8QKXmf6z';
  var pendingTeacherTokens = null;
  var adapters = new Set();

  function randomToken() {
    var bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, function (byte) {
      return byte.toString(16).padStart(2, '0');
    }).join('');
  }

  function hashParams() {
    return new URLSearchParams(location.hash.replace(/^#/, ''));
  }

  function normalizeRoomCode(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  }

  function prepareRouteFromHash() {
    var hash = hashParams();
    var room = normalizeRoomCode(hash.get('room'));
    var role = hash.get('role');
    if (!room || (role !== 'teacher' && role !== 'student')) return;
    var url = new URL(location.href);
    url.searchParams.set('room', room);
    url.searchParams.set('role', role);
    history.replaceState(null, '', url.pathname + url.search + location.hash);
  }

  prepareRouteFromHash();

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error('Supabase client did not load. Live Board will not synchronize across devices.');
    return;
  }

  var client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });

  function stateFromRow(row) {
    return {
      fen: row.fen,
      pgn: row.pgn || '',
      orientation: row.orientation === 'black' ? 'black' : 'white',
      lastMove: row.last_move || null,
      studentMovesAllowed: row.student_moves_allowed !== false,
      revision: Number(row.revision) || 0,
      activeLessonId: row.active_lesson_id || ''
    };
  }

  function roomCodeFromChannel(name) {
    return normalizeRoomCode(String(name || '').split(':').pop());
  }

  function roleFromPage() {
    return new URLSearchParams(location.search).get('role') || hashParams().get('role') || '';
  }

  function credentialsFor(roomCode) {
    var hash = hashParams();
    var role = roleFromPage();
    if (role === 'teacher') {
      var teacherToken = hash.get('access');
      var studentToken = hash.get('student');
      if ((!teacherToken || !studentToken) && pendingTeacherTokens) {
        teacherToken = pendingTeacherTokens.teacherToken;
        studentToken = pendingTeacherTokens.studentToken;
      }
      if (teacherToken && studentToken) {
        try {
          sessionStorage.setItem('live-board-credentials:' + roomCode, JSON.stringify({
            role: 'teacher', teacherToken: teacherToken, studentToken: studentToken
          }));
        } catch (_) {}
        return { role: 'teacher', accessToken: teacherToken, studentToken: studentToken };
      }
    }

    if (role === 'student') {
      var studentAccess = hash.get('access');
      if (studentAccess) return { role: 'student', accessToken: studentAccess, studentToken: studentAccess };
    }

    try {
      var saved = JSON.parse(sessionStorage.getItem('live-board-credentials:' + roomCode) || 'null');
      if (saved && saved.role === 'teacher') {
        return { role: 'teacher', accessToken: saved.teacherToken, studentToken: saved.studentToken };
      }
    } catch (_) {}

    return { role: role, accessToken: '', studentToken: '' };
  }

  function writeTeacherHash(roomCode, credentials) {
    var hash = new URLSearchParams();
    hash.set('room', roomCode);
    hash.set('role', 'teacher');
    hash.set('access', credentials.accessToken);
    hash.set('student', credentials.studentToken);
    history.replaceState(null, '', location.pathname + location.search + '#' + hash.toString());
  }

  function studentLink(roomCode, studentToken) {
    var url = new URL(location.href);
    url.search = '';
    var hash = new URLSearchParams();
    hash.set('room', roomCode);
    hash.set('role', 'student');
    hash.set('access', studentToken);
    url.hash = hash.toString();
    return url.href;
  }

  function dispatchMessage(adapter, state) {
    adapter.listeners.forEach(function (listener) {
      try {
        listener({ data: { roomCode: adapter.roomCode, sender: 'supabase-server', type: 'state', state: state } });
      } catch (error) {
        console.error('Live Board message listener failed.', error);
      }
    });
  }

  function status(text) {
    var element = document.getElementById('connectionStatus');
    if (element) element.textContent = text;
  }

  async function fetchState(adapter) {
    if (!adapter.credentials.accessToken) return null;
    var response = await client.rpc('get_live_board_room', {
      p_room_code: adapter.roomCode,
      p_access_token: adapter.credentials.accessToken
    });
    if (response.error) throw response.error;
    adapter.serverRevision = Number(response.data.revision) || 0;
    var state = stateFromRow(response.data);
    dispatchMessage(adapter, state);
    status('Connected through Supabase');
    return state;
  }

  async function createRoom(adapter, state) {
    var response = await client.rpc('create_live_board_room', {
      p_room_code: adapter.roomCode,
      p_teacher_token: adapter.credentials.accessToken,
      p_student_token: adapter.credentials.studentToken,
      p_fen: state.fen,
      p_pgn: state.pgn || '',
      p_orientation: state.orientation || 'white'
    });
    if (response.error) {
      if (/already exists/i.test(response.error.message || '')) {
        return fetchState(adapter);
      }
      throw response.error;
    }
    adapter.created = true;
    adapter.serverRevision = Number(response.data.revision) || 0;
    writeTeacherHash(adapter.roomCode, adapter.credentials);
    status('Supabase room created');
    return stateFromRow(response.data);
  }

  async function updateTeacher(adapter, state) {
    var response = await client.rpc('update_live_board_teacher', {
      p_room_code: adapter.roomCode,
      p_teacher_token: adapter.credentials.accessToken,
      p_expected_revision: adapter.serverRevision,
      p_fen: state.fen,
      p_pgn: state.pgn || '',
      p_orientation: state.orientation || 'white',
      p_last_move: state.lastMove || null,
      p_student_moves_allowed: state.studentMovesAllowed !== false,
      p_active_lesson_id: state.activeLessonId || ''
    });
    if (response.error) throw response.error;
    adapter.serverRevision = Number(response.data.revision) || 0;
    return stateFromRow(response.data);
  }

  async function updateStudent(adapter, state) {
    var response = await client.rpc('update_live_board_student', {
      p_room_code: adapter.roomCode,
      p_student_token: adapter.credentials.accessToken,
      p_expected_revision: adapter.serverRevision,
      p_fen: state.fen,
      p_pgn: state.pgn || '',
      p_last_move: state.lastMove || null
    });
    if (response.error) throw response.error;
    adapter.serverRevision = Number(response.data.revision) || 0;
    return stateFromRow(response.data);
  }

  function SupabaseBroadcastChannel(name) {
    this.name = name;
    this.roomCode = roomCodeFromChannel(name);
    this.credentials = credentialsFor(this.roomCode);
    this.listeners = new Set();
    this.serverRevision = 0;
    this.created = false;
    this.closed = false;
    this.queue = Promise.resolve();

    if (!this.roomCode || !this.credentials.accessToken) {
      status('Missing secure room link');
      return;
    }

    var self = this;
    this.realtime = client.channel('live-board:' + this.roomCode + ':' + this.credentials.studentToken, {
      config: { broadcast: { self: false, ack: false } }
    });
    this.realtime
      .on('broadcast', { event: 'changed' }, function () {
        self.queue = self.queue.then(function () { return fetchState(self); }).catch(function (error) {
          console.warn('Live Board refresh failed.', error);
          status('Reconnecting…');
        });
      })
      .subscribe(function (subscriptionStatus) {
        if (subscriptionStatus === 'SUBSCRIBED') {
          status('Connected through Supabase');
          if (self.credentials.role === 'student') {
            self.queue = self.queue.then(function () { return fetchState(self); }).catch(function (error) {
              console.warn('Could not join Live Board room.', error);
              status('Room link is invalid or expired');
            });
          }
        }
      });
    adapters.add(this);
  }

  SupabaseBroadcastChannel.prototype.addEventListener = function (type, listener) {
    if (type === 'message' && typeof listener === 'function') this.listeners.add(listener);
  };

  SupabaseBroadcastChannel.prototype.removeEventListener = function (type, listener) {
    if (type === 'message') this.listeners.delete(listener);
  };

  SupabaseBroadcastChannel.prototype.postMessage = function (message) {
    var self = this;
    if (this.closed || !message || !this.credentials.accessToken) return;
    if (message.type === 'request-state') {
      this.queue = this.queue.then(function () { return fetchState(self); }).catch(function () {});
      return;
    }
    if (!message.state) return;

    this.queue = this.queue.then(async function () {
      var authoritative;
      if (self.credentials.role === 'teacher') {
        authoritative = self.created
          ? await updateTeacher(self, message.state)
          : await createRoom(self, message.state);
        self.created = true;
      } else {
        authoritative = await updateStudent(self, message.state);
      }
      dispatchMessage(self, authoritative);
      await self.realtime.send({ type: 'broadcast', event: 'changed', payload: { revision: self.serverRevision } });
      status('Synced through Supabase');
    }).catch(async function (error) {
      console.warn('Live Board update was rejected.', error);
      status('Refreshing authoritative board…');
      try { await fetchState(self); } catch (_) { status('Live Board connection failed'); }
    });
  };

  SupabaseBroadcastChannel.prototype.close = function () {
    this.closed = true;
    this.listeners.clear();
    adapters.delete(this);
    if (this.realtime) client.removeChannel(this.realtime);
  };

  window.BroadcastChannel = SupabaseBroadcastChannel;

  document.addEventListener('click', function (event) {
    var target = event.target && event.target.closest ? event.target.closest('button') : null;
    if (!target) return;

    if (target.id === 'createRoomButton') {
      pendingTeacherTokens = { teacherToken: randomToken(), studentToken: randomToken() };
      return;
    }

    if (target.id === 'copyStudentLinkButton') {
      event.preventDefault();
      event.stopImmediatePropagation();
      var code = normalizeRoomCode((document.getElementById('roomCodeLabel') || {}).textContent);
      var credentials = credentialsFor(code);
      if (!code || !credentials.studentToken) return;
      var link = studentLink(code, credentials.studentToken);
      navigator.clipboard.writeText(link).then(function () {
        status('Student link copied');
      }).catch(function () {
        window.prompt('Copy this student link:', link);
      });
      return;
    }

    if (target.id === 'joinRoomButton') {
      var hash = hashParams();
      if (hash.get('role') !== 'student' || !hash.get('access')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        var message = document.getElementById('roomSetupMessage');
        if (message) {
          message.textContent = 'Open the secure student link copied by the teacher. A room code alone is not enough.';
          message.classList.add('error');
        }
      }
    }
  }, true);

  window.addEventListener('online', function () {
    adapters.forEach(function (adapter) {
      adapter.queue = adapter.queue.then(function () { return fetchState(adapter); }).catch(function () {});
    });
  });
})();
