(function () {
  'use strict';

  var SUPABASE_URL = 'https://oxcottitwvayrrcuypmb.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_-0VdtXfcJH__vKlXrX5QIg_8QKXmf6z';
  var POLL_INTERVAL_MS = 2000;
  var client = null;
  var realtimeChannel = null;
  var pollTimer = null;
  var refreshInFlight = null;
  var stopped = false;
  var lastRenderedSignature = null;
  var initializedSessionKey = '';
  var initializationInFlight = false;
  var initializationTimer = null;

  function hashParams() {
    return new URLSearchParams(location.hash.replace(/^#/, ''));
  }

  function normalizeRoomCode(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  }

  function sessionDetails() {
    var hash = hashParams();
    var search = new URLSearchParams(location.search);
    var roomCode = normalizeRoomCode(hash.get('room') || search.get('room'));
    var role = hash.get('role') || search.get('role') || '';
    var accessToken = hash.get('access') || '';

    if (!accessToken && roomCode && role === 'teacher') {
      try {
        var saved = JSON.parse(sessionStorage.getItem('live-board-credentials:' + roomCode) || 'null');
        if (saved && saved.role === 'teacher') accessToken = saved.teacherToken || '';
      } catch (_) {}
    }

    return { roomCode: roomCode, role: role, accessToken: accessToken };
  }

  function validSessionDetails(details) {
    return Boolean(
      details &&
      details.roomCode &&
      details.accessToken &&
      (details.role === 'teacher' || details.role === 'student')
    );
  }

  function sessionKey(details) {
    if (!validSessionDetails(details)) return '';
    return [details.roomCode, details.role, details.accessToken].join('|');
  }

  function detailsFromReadyEvent(event) {
    var detail = event && event.detail && typeof event.detail === 'object' ? event.detail : {};
    return {
      roomCode: normalizeRoomCode(detail.roomCode),
      role: detail.role === 'teacher' || detail.role === 'student' ? detail.role : '',
      accessToken: String(detail.accessToken || '')
    };
  }

  async function rpc(functionName, parameters) {
    if (!client) throw new Error('Supabase client is unavailable');
    var response = await client.rpc(functionName, parameters);
    if (response.error) throw response.error;
    return response.data;
  }

  function setStatus(text, isError) {
    var element = document.getElementById('messageBoardStatus');
    if (!element) return;
    element.textContent = text || '';
    element.classList.toggle('error', Boolean(isError));
  }

  function appendLinkedText(container, text) {
    var pattern = /(https:\/\/[^\s]+)/g;
    var cursor = 0;
    var match;

    while ((match = pattern.exec(text)) !== null) {
      if (match.index > cursor) {
        container.append(document.createTextNode(text.slice(cursor, match.index)));
      }

      var cleanUrl = match[0].replace(/[),.;!?]+$/, '');
      var trailing = match[0].slice(cleanUrl.length);
      var anchor = document.createElement('a');
      anchor.href = cleanUrl;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';

      try {
        anchor.textContent = new URL(cleanUrl).hostname.toLowerCase().endsWith('lichess.org')
          ? 'Open Lichess link'
          : cleanUrl;
      } catch (_) {
        anchor.textContent = cleanUrl;
      }

      container.append(anchor);
      if (trailing) container.append(document.createTextNode(trailing));
      cursor = match.index + match[0].length;
    }

    if (cursor < text.length) {
      container.append(document.createTextNode(text.slice(cursor)));
    }
  }

  function formatTime(value) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit'
    }).format(date);
  }

  function signatureFor(messages) {
    return messages.map(function (message) {
      return [message.id, message.sender_role, message.created_at, message.body].join('|');
    }).join('\n');
  }

  function render(messages) {
    var list = document.getElementById('sessionMessageList');
    if (!list) return;

    var signature = signatureFor(messages);
    if (signature === lastRenderedSignature) return;
    lastRenderedSignature = signature;
    list.replaceChildren();

    if (!messages.length) {
      var empty = document.createElement('p');
      empty.className = 'session-message-empty';
      empty.textContent = 'No session messages yet.';
      list.appendChild(empty);
      return;
    }

    messages.forEach(function (message) {
      var article = document.createElement('article');
      article.className = 'session-message ' + message.sender_role;

      var meta = document.createElement('div');
      meta.className = 'session-message-meta';

      var sender = document.createElement('strong');
      sender.textContent = message.sender_role === 'teacher' ? 'Coach' : 'Student';

      var time = document.createElement('time');
      time.dateTime = message.created_at;
      time.textContent = formatTime(message.created_at);
      meta.append(sender, time);

      var body = document.createElement('p');
      appendLinkedText(body, String(message.body || ''));
      article.append(meta, body);
      list.appendChild(article);
    });

    list.scrollTop = list.scrollHeight;
  }

  function refresh(details) {
    if (refreshInFlight) return refreshInFlight;

    refreshInFlight = rpc('get_live_board_messages', {
      p_room_code: details.roomCode,
      p_access_token: details.accessToken
    }).then(function (messages) {
      render(Array.isArray(messages) ? messages : []);
      return messages;
    }).finally(function () {
      refreshInFlight = null;
    });

    return refreshInFlight;
  }

  function schedulePoll(details) {
    if (stopped) return;
    if (pollTimer) window.clearTimeout(pollTimer);

    pollTimer = window.setTimeout(function () {
      refresh(details).catch(function (error) {
        console.warn('Could not refresh Live Board messages.', error);
      }).finally(function () {
        schedulePoll(details);
      });
    }, POLL_INTERVAL_MS);
  }

  async function broadcastChanged() {
    if (!realtimeChannel) return;
    try {
      await realtimeChannel.send({
        type: 'broadcast',
        event: 'messages-changed',
        payload: { changedAt: Date.now() }
      });
    } catch (error) {
      console.warn('Message broadcast failed; polling will recover.', error);
    }
  }

  async function initializeForSession(details) {
    var panel = document.getElementById('sessionMessages');
    if (!panel) return false;

    var key = sessionKey(details);
    if (!key || initializedSessionKey === key || initializationInFlight) {
      return initializedSessionKey === key;
    }

    initializationInFlight = true;
    try {
      if (!window.supabase || typeof window.supabase.createClient !== 'function') {
        panel.hidden = false;
        setStatus('Messages could not connect.', true);
        return false;
      }

      client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      },
      global: {
        fetch: function (input, init) {
          var options = Object.assign({}, init || {}, { cache: 'no-store' });
          return window.fetch(input, options);
        }
      }
    });

    panel.hidden = false;

    var clearButton = document.getElementById('clearSessionMessagesButton');
    var form = document.getElementById('sessionMessageForm');
    var input = document.getElementById('sessionMessageInput');
    var sendButton = document.getElementById('sendSessionMessageButton');

    if (!clearButton || !form || !input || !sendButton) return;
    clearButton.hidden = details.role !== 'teacher';

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      var body = input.value.trim();
      if (!body) return;

      sendButton.disabled = true;
      setStatus('Sending…');

      try {
        await rpc('post_live_board_message', {
          p_room_code: details.roomCode,
          p_access_token: details.accessToken,
          p_body: body
        });
        input.value = '';
        await refresh(details);
        setStatus('Sent');
        await broadcastChanged();
      } catch (error) {
        console.warn('Could not send Live Board message.', error);
        setStatus('Message could not be sent.', true);
      } finally {
        sendButton.disabled = false;
        input.focus();
      }
    });

    clearButton.addEventListener('click', async function () {
      if (!window.confirm('Clear all messages from this Live Board session?')) return;

      clearButton.disabled = true;
      setStatus('Clearing…');

      try {
        await rpc('clear_live_board_messages', {
          p_room_code: details.roomCode,
          p_teacher_token: details.accessToken
        });
        await refresh(details);
        setStatus('Messages cleared');
        await broadcastChanged();
      } catch (error) {
        console.warn('Could not clear Live Board messages.', error);
        setStatus('Messages could not be cleared.', true);
      } finally {
        clearButton.disabled = false;
      }
    });

    realtimeChannel = client.channel('live-board:' + details.roomCode, {
      config: { broadcast: { self: false, ack: false } }
    });

    realtimeChannel
      .on('broadcast', { event: 'messages-changed' }, function () {
        refresh(details).catch(function (error) {
          console.warn('Could not refresh after a message broadcast.', error);
        });
      })
      .subscribe(function (status) {
        if (status === 'SUBSCRIBED') {
          refresh(details).catch(function () {});
        }
      });

    window.addEventListener('focus', function () {
      refresh(details).catch(function () {});
    });
    window.addEventListener('online', function () {
      refresh(details).catch(function () {});
    });
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) refresh(details).catch(function () {});
    });

    try {
      await refresh(details);
      setStatus('Messages update automatically');
    } catch (error) {
      console.warn('Could not load Live Board messages.', error);
      setStatus('Messages could not be loaded.', true);
    }

    schedulePoll(details);

      initializedSessionKey = key;
      window.LiveBoardMessages = {
        refresh: function () { return refresh(details); },
        sessionKey: key
      };
      return true;
    } finally {
      initializationInFlight = false;
    }
  }

  function scheduleInitializationCheck(delay) {
    if (stopped || initializedSessionKey || initializationTimer) return;
    initializationTimer = window.setTimeout(function () {
      initializationTimer = null;
      initializeWhenReady();
    }, Math.max(100, Number(delay) || 400));
  }

  async function initializeWhenReady(preferredDetails) {
    if (stopped || initializedSessionKey || initializationInFlight) return;

    var details = validSessionDetails(preferredDetails) ? preferredDetails : sessionDetails();
    if (!validSessionDetails(details)) {
      scheduleInitializationCheck(document.hidden ? 1500 : 400);
      return;
    }

    try {
      var started = await initializeForSession(details);
      if (!started && !initializedSessionKey) scheduleInitializationCheck(1000);
    } catch (error) {
      console.warn('Could not initialize Live Board messages.', error);
      setStatus('Messages could not connect.', true);
      scheduleInitializationCheck(1200);
    }
  }

  function handleSessionReady(event) {
    var details = detailsFromReadyEvent(event);
    initializeWhenReady(validSessionDetails(details) ? details : null);
  }

  window.addEventListener('live-board-session-ready', handleSessionReady);
  window.addEventListener('hashchange', function () { initializeWhenReady(); });
  window.addEventListener('popstate', function () { initializeWhenReady(); });

  window.addEventListener('beforeunload', function () {
    stopped = true;
    if (initializationTimer) window.clearTimeout(initializationTimer);
    if (pollTimer) window.clearTimeout(pollTimer);
    if (realtimeChannel) realtimeChannel.unsubscribe();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initializeWhenReady(); }, { once: true });
  } else {
    initializeWhenReady();
  }
})();