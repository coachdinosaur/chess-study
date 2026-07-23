(function () {
  'use strict';

  var SUPABASE_URL = 'https://oxcottitwvayrrcuypmb.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_-0VdtXfcJH__vKlXrX5QIg_8QKXmf6z';
  var realtimeChannel = null;
  var pollTimer = null;

  function hashParams() {
    return new URLSearchParams(location.hash.replace(/^#/, ''));
  }

  function normalizeRoomCode(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  }

  function sessionDetails() {
    var hash = hashParams();
    var search = new URLSearchParams(location.search);
    var role = hash.get('role') || search.get('role') || '';
    return {
      roomCode: normalizeRoomCode(hash.get('room') || search.get('room')),
      role: role,
      accessToken: hash.get('access') || '',
      sharedChannelToken: role === 'teacher' ? (hash.get('student') || '') : (hash.get('access') || '')
    };
  }

  function appendLinkedText(container, text) {
    var pattern = /(https:\/\/[^\s]+)/g;
    var cursor = 0;
    var match;
    while ((match = pattern.exec(text)) !== null) {
      if (match.index > cursor) container.append(document.createTextNode(text.slice(cursor, match.index)));
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
    if (cursor < text.length) container.append(document.createTextNode(text.slice(cursor)));
  }

  function formatTime(value) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
  }

  function setStatus(text, isError) {
    var element = document.getElementById('messageBoardStatus');
    if (!element) return;
    element.textContent = text || '';
    element.classList.toggle('error', Boolean(isError));
  }

  function render(messages) {
    var list = document.getElementById('sessionMessageList');
    if (!list) return;
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

  async function refresh(client, details) {
    if (!details.roomCode || !details.accessToken) return;
    var response = await client.rpc('get_live_board_messages', {
      p_room_code: details.roomCode,
      p_access_token: details.accessToken
    });
    if (response.error) throw response.error;
    render(Array.isArray(response.data) ? response.data : []);
  }

  async function notifyChanged() {
    if (!realtimeChannel) return;
    try {
      await realtimeChannel.send({ type: 'broadcast', event: 'messages-changed', payload: {} });
    } catch (_) {}
  }

  async function initialize() {
    var panel = document.getElementById('sessionMessages');
    if (!panel || !window.supabase || typeof window.supabase.createClient !== 'function') return;

    var details = sessionDetails();
    if (!details.roomCode || !details.accessToken || !['teacher', 'student'].includes(details.role)) return;

    panel.hidden = false;
    var clearButton = document.getElementById('clearSessionMessagesButton');
    clearButton.hidden = details.role !== 'teacher';

    var client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });

    var form = document.getElementById('sessionMessageForm');
    var input = document.getElementById('sessionMessageInput');
    var sendButton = document.getElementById('sendSessionMessageButton');

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      var body = input.value.trim();
      if (!body) return;
      sendButton.disabled = true;
      setStatus('Sending…');
      try {
        var response = await client.rpc('post_live_board_message', {
          p_room_code: details.roomCode,
          p_access_token: details.accessToken,
          p_body: body
        });
        if (response.error) throw response.error;
        input.value = '';
        setStatus('Sent');
        await refresh(client, details);
        await notifyChanged();
      } catch (error) {
        console.warn('Could not send session message.', error);
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
        var response = await client.rpc('clear_live_board_messages', {
          p_room_code: details.roomCode,
          p_teacher_token: details.accessToken
        });
        if (response.error) throw response.error;
        setStatus('Messages cleared');
        await refresh(client, details);
        await notifyChanged();
      } catch (error) {
        console.warn('Could not clear session messages.', error);
        setStatus('Messages could not be cleared.', true);
      } finally {
        clearButton.disabled = false;
      }
    });

    if (details.sharedChannelToken) {
      realtimeChannel = client.channel('live-board-messages:' + details.roomCode + ':' + details.sharedChannelToken, {
        config: { broadcast: { self: false, ack: false } }
      });
      realtimeChannel
        .on('broadcast', { event: 'messages-changed' }, function () {
          refresh(client, details).catch(function () {});
        })
        .subscribe();
    }

    try {
      await refresh(client, details);
      setStatus('Messages are temporary to this room');
    } catch (error) {
      console.warn('Could not load session messages.', error);
      setStatus('Messages could not be loaded.', true);
    }

    pollTimer = window.setInterval(function () {
      refresh(client, details).catch(function () {});
    }, 15000);
  }

  window.addEventListener('beforeunload', function () {
    if (pollTimer) window.clearInterval(pollTimer);
    if (realtimeChannel) realtimeChannel.unsubscribe();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();