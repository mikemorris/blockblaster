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

    // init server update loop, fixed time step in milliseconds
    setInterval((function() {
      this.loop(socket, store);
    }).bind(this), 45);

    return this;

  };

  var updatePlayers = function(socket, store, data, callback) {

    store.smembers('player', function(err, res) {
      async.forEach(
        res,
        function(uuid, callback) {
          // publish delta updates for all players
          // to all players connected to this server
          var player = players.global[uuid];

          if (player) {
            players.getDelta(store, data, uuid, player, callback);
          } else {
            // add player to global object
            players.add(store, socket, uuid, callback);
          }
        }, function() {
          // notify async that iterator has completed
          if (typeof callback === 'function') callback();
        }
      );
    });

  };

  var updateNPCs = function(store, data, callback) {

    // iterate over all npcs in redis
    // TODO: should this just iterate over server NPCs instead?
    store.smembers('npc', function(err, res) {

      // don't return until all updateNPC calls have completed
      async.forEach(
        res,
        function(uuid, callback) {
          // publish delta updates for all npcs
          // to all players connected to this server
          var npc = npcs.global[uuid];

          if (npc) {
            npcs.getDelta(store, data, uuid, npc, callback);
          } else {
            // add player to global object
            npcs.add(store, uuid, callback);
          }
        }, function() {
          // notify async.parallel in loop that iterator has completed
          if (typeof callback === 'function') callback();
        }
      );
    });

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
    socket.io.sockets.emit('state:update', data);

  };

  var loop = function(socket, store) {

    // create data object containing
    // authoritative state and last processed input id
    var data = {};
    data.players = {};
    data.npcs = {};

    // get updated states from redis, then return delta object to client
    async.parallel([
      function(callback) { updatePlayers(socket, store, data, callback) },
      function(callback) { updateNPCs(store, data, callback) }
    ], function() {
      update(socket, data);
    });

  };

  return {
    init: init,
    updatePlayers: updatePlayers,
    updateNPCs: updateNPCs,
    loop: loop
  };

});
