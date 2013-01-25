(function(root, factory) {
  if (typeof exports === 'object') {
    // Node.js
    module.exports = factory(
      require('./players'),
      require('./npcs'),
      require('./levels'),
      require('async'),
      require('redis'),
      require('underscore')
    );
  }
})(this, function(players, npcs, levels, async, redis, _) {

  var init = function(socket) {

    // init server full state update loop, fixed time step in milliseconds
    setInterval((function() {
      full(socket);
    }), 1000);

    // init server delta state update loop, fixed time step in milliseconds
    setInterval((function() {
      delta(socket);
    }), 45);

    return this;

  };

  var full = function(socket) {

    var data = {};
    data.players = {};
    data.npcs = {};

    // get full update, emit to clients
    async.parallel([
      function(callback) { players.full(data, callback); },
      function(callback) { npcs.full(data, callback); }
    ], function() {
      data.time = Date.now();
      socket.io.sockets.volatile.emit('state:full', data);
    });

  };

  var delta = function(socket) {

    var data = {};
    data.players = {};
    data.npcs = {};

    // get delta update, emit to clients
    async.parallel([
      function(callback) { players.delta(data, callback); },
      function(callback) { npcs.delta(data, callback); }
    ], function() {
      data.time = Date.now();
      socket.io.sockets.volatile.emit('state:delta', data);
    });

  };

  return {
    init: init
  };

});
