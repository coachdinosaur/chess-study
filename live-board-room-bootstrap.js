(function () {
  'use strict';

  var SecureBroadcastChannel = window.BroadcastChannel;
  if (typeof SecureBroadcastChannel !== 'function') return;

  window.BroadcastChannel = function LiveBoardBootstrapChannel(name) {
    var role = document.documentElement.dataset.role;
    if (role === 'teacher' || role === 'student') {
      var url = new URL(location.href);
      if (url.searchParams.get('role') !== role) {
        url.searchParams.set('role', role);
        history.replaceState(null, '', url.pathname + url.search + url.hash);
      }
    }

    return new SecureBroadcastChannel(name);
  };

  window.BroadcastChannel.prototype = SecureBroadcastChannel.prototype;
})();
