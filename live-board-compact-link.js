(function () {
  'use strict';

  function normalizeRoomCode(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  }

  function expandCompactStudentLink() {
    var rawHash = String(location.hash || '').replace(/^#/, '');
    if (!rawHash) return;

    var prefix = rawHash.indexOf('j=') === 0 ? 'j=' : (rawHash.indexOf('s=') === 0 ? 's=' : '');
    if (!prefix) return;

    var compactValue = rawHash.slice(prefix.length);
    var separatorIndex = compactValue.indexOf('.');
    if (separatorIndex < 1) return;

    var roomCode = normalizeRoomCode(compactValue.slice(0, separatorIndex));
    var studentAccess = compactValue.slice(separatorIndex + 1).trim();
    if (!roomCode || !studentAccess) return;

    var hash = new URLSearchParams();
    hash.set('room', roomCode);
    hash.set('role', 'student');
    hash.set('access', studentAccess);

    history.replaceState(null, '', location.pathname + location.search + '#' + hash.toString());
  }

  expandCompactStudentLink();
})();