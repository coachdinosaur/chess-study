(function () {
  'use strict';

  if (!window.supabase || typeof window.supabase.createClient !== 'function') return;

  var originalCreateClient = window.supabase.createClient.bind(window.supabase);

  window.supabase.createClient = function () {
    var client = originalCreateClient.apply(null, arguments);
    var originalRpc = client.rpc.bind(client);

    client.rpc = function (functionName, parameters, options) {
      if (functionName === 'create_live_board_room' && parameters && parameters.p_student_token) {
        var nextParameters = Object.assign({}, parameters, {
          p_student_short_token: String(parameters.p_student_token).slice(0, 16)
        });
        return originalRpc('create_live_board_room_v2', nextParameters, options);
      }
      return originalRpc(functionName, parameters, options);
    };

    return client;
  };
})();