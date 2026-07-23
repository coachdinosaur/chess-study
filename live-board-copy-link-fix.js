(function () {
  'use strict';

  function normalizeRoomCode(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  }

  function hashParams() {
    return new URLSearchParams(location.hash.replace(/^#/, ''));
  }

  function setStatus(text) {
    var element = document.getElementById('connectionStatus');
    if (element) element.textContent = text;
  }

  function credentialsFor(roomCode) {
    var hash = hashParams();
    var studentToken = hash.get('student');
    if (studentToken) return { studentToken: studentToken };

    try {
      var saved = JSON.parse(sessionStorage.getItem('live-board-credentials:' + roomCode) || 'null');
      if (saved && saved.studentToken) return { studentToken: saved.studentToken };
    } catch (_) {}

    return { studentToken: '' };
  }

  function makeStudentLink(roomCode, studentToken) {
    var url = new URL(location.href);
    url.search = '';
    url.hash = 'j=' + roomCode + '.' + String(studentToken).slice(0, 16);
    return url.href;
  }

  function legacyCopy(text) {
    var textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    var copied = false;
    try { copied = document.execCommand('copy'); } catch (_) {}
    textarea.remove();
    return copied;
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (_) {}
    }
    return legacyCopy(text);
  }

  async function copyStudentLink() {
    var code = normalizeRoomCode((document.getElementById('roomCodeLabel') || {}).textContent);
    if (!code) {
      setStatus('Room is not ready yet');
      return;
    }

    var credentials = credentialsFor(code);
    for (var attempt = 0; !credentials.studentToken && attempt < 12; attempt += 1) {
      setStatus('Preparing secure student link…');
      await new Promise(function (resolve) { setTimeout(resolve, 250); });
      credentials = credentialsFor(code);
    }

    if (!credentials.studentToken) {
      setStatus('Student link is not ready. Create the room again.');
      return;
    }

    var link = makeStudentLink(code, credentials.studentToken);
    if (await copyText(link)) {
      setStatus('Short student link copied');
      return;
    }

    setStatus('Clipboard blocked. Copy the link from the dialog.');
    window.prompt('Copy this student link:', link);
  }

  document.addEventListener('click', function (event) {
    var target = event.target && event.target.closest ? event.target.closest('#copyStudentLinkButton') : null;
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    copyStudentLink();
  }, true);
})();