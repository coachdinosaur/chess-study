(function () {
  'use strict';

  function normalizeRoomCode(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  }

  function expandCompactStudentLink() {
    var rawHash = String(location.hash || '').replace(/^#/, '');
    if (!rawHash || rawHash.indexOf('s=') !== 0) return;

    var compactValue = rawHash.slice(2);
    var separatorIndex = compactValue.indexOf('.');
    if (separatorIndex < 1) return;

    var roomCode = normalizeRoomCode(compactValue.slice(0, separatorIndex));
    var studentToken = compactValue.slice(separatorIndex + 1).trim();
    if (!roomCode || !studentToken) return;

    var hash = new URLSearchParams();
    hash.set('room', roomCode);
    hash.set('role', 'student');
    hash.set('access', studentToken);

    history.replaceState(null, '', location.pathname + location.search + '#' + hash.toString());
  }

  expandCompactStudentLink();
})();
