(function () {
  'use strict';

  if (!window.supabase || typeof window.supabase.createClient !== 'function') return;

  var originalCreateClient = window.supabase.createClient;

  window.supabase.createClient = function () {
    var client = originalCreateClient.apply(this, arguments);
    var originalChannel = client.channel.bind(client);

    client.channel = function (name, options) {
      var normalizedName = String(name || '');
      if (
        normalizedName.indexOf('live-board:') === 0
        || normalizedName.indexOf('live-board-messages:') === 0
      ) {
        var parts = normalizedName.split(':');
        normalizedName = parts.slice(0, 2).join(':');
      }
      return originalChannel(normalizedName, options);
    };

    return client;
  };
})();