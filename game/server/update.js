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

  var init = function(socket, store) {

    // init server full state update loop, fixed time step in milliseconds
    setInterval((function() {
      this.loop(socket, store);
    }).bind(this), 1000);

    // init server update deltaLoop, fixed time step in milliseconds
    setInterval((function() {
      this.deltaLoop(socket, store);
    }).bind(this), 45);

    return this;

  };

  var update = function(socket, data) {

    // server time stamp
    data.time = Date.now();

    // console.log(data);

    /*
    var keys = Object.keys(data.players);
    var key;

    for (var i = 0; i < keys.length; i++) {
      key = keys[i];
      if (data.players[key].ship && data.players[key].ship.missiles) {
        console.log(data.players[key].ship.missiles);
      }
    }
    */

    // return delta object to client
    socket.io.sockets.volatile.emit('state:update', data);

  };

  var loop = function(socket, store) {

    // create data object containing
    // authoritative state and last processed input id
    var data = {};
    data.players = {};
    data.npcs = {};

    // get updated states from redis, then return delta object to client
    async.parallel([
      function(callback) { players.state(store, data, callback) },
      function(callback) { npcs.state(store, data, callback) }
    ], function() {
      data.time = Date.now();
      // console.log(data);
      socket.io.sockets.volatile.emit('state:full', data);
    });

  };

  var deltaLoop = function(socket, store) {

    // create data object containing
    // authoritative state and last processed input id
    var data = {};
    data.players = {};
    data.npcs = {};

    // get updated states from redis, then return delta object to client
    async.parallel([
      function(callback) { players.delta(store, data, callback); },
      function(callback) { npcs.delta(store, data, callback); }
    ], function() {
      update(socket, data);
    });

  };

  return {
    init: init,
    loop: loop,
    deltaLoop: deltaLoop
  };

});
