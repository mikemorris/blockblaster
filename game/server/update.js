(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js
    module.exports = factory(
      {
        'levels': require('./levels'),
        'physics': require('./physics'),
        'time': require('../core/time')
      },
      require('async'),
      require('redis'),
      require('underscore')
    );
  }
})(this, function(game, async, redis, _) {

  var init = function(socket, store) {

    // init server update loop, fixed time step in milliseconds
    setInterval((function() {
      this.loop(socket, store);
    }).bind(this), 45);

    return this;

  };

  var updatePlayers = function(store, data, callback) {

    store.smembers('players', function(err, res) {
      var players = res;
      var length = players.length;

      async.forEach(
        players,
        function(uid, callback) {
          updatePlayer(store, uid, data, callback);
        }, function() {
          // notify async that iterator has completed
          if (typeof callback === 'function') callback();
        }
      );
    });

  };

  var updatePlayer = function(store, uid, data, callback) {

    // defer to redis for absolute state
    store.get('player:' + uid + ':ship:x', function(err, res) {
      var x = parseInt(res);
      var player = game.levels.players[uid];

      // publish state if changed
      // TODO: delta?
      if (x !== null && player && player.ship.x != x) {
        player.ship.x = x;

        data.players[uid] = {};
        data.players[uid].ship = {};
        data.players[uid].ship.state = {};

        var keys = Object.keys(player.ship);
        var length = keys.length;
        var key;

        for (var i = 0; i < length; i++) {
          key = keys[i];

          // TODO: clean this up, some values are false
          if (player.ship[key] !== false) {
            data.players[uid].ship.state[key] = player.ship[key];
          }
        }

        data.players[uid].ship.state.missiles = [];

        for (var i = 0; i < player.ship.missiles.length; i++) {
          var missile = {
            sy: player.ship.missiles[i],
            x: player.ship.missiles[i],
            isLive: player.ship.missiles[i]
          };
          data.players[uid].ship.state.missiles.push(missile);
        }
      }

      // notify async that iterator has completed
      if (typeof callback === 'function') callback();
    });

  };

  var updateNPCs = function(store, data, callback) {

    // iterate over all npcs in redis
    // TODO: should this just iterate over server NPCs instead?
    store.smembers('npcs', function(err, res) {
      var npcs = res;
      var length = npcs.length;

      // don't return until all updateNPC calls have completed
      async.forEach(
        npcs,
        function(uuid, callback) {
          // only publish updates for NPCs originating from this server
          var npc = game.levels.npcs[uuid];

          if (npc) {
            updateNPC(store, data, npc, uuid, callback);
          }
        }, function() {
          // notify async.parallel in loop that iterator has completed
          if (typeof callback === 'function') callback();
        }
      );
    });

  };

  var updateNPC = function(store, data, npc, uuid, callback) {

    // defer to redis for absolute state, delta compression
    store.hgetall('npc:' + uuid, function(err, res) {

      // save reference to old values and update state
      var prev = npc.state;

      // some scope issues with iterating over res and updating values individually?
      var next = npc.state = res;

      // init delta array for changed keys
      var delta = [];

      // iterate over new values and compare to old
      var keys = Object.keys(next);
      var length = keys.length;
      var key;

      for (var i = 0; i < length; i++) {
        key = keys[i];

        // check for changed values and push key to delta array
        if (prev[key] !== next[key]) {
          delta.push(key);
        }
      }

      // set changed values in data object
      if (delta.length > 0) {
        data.npcs[uuid] = _.pick(next, delta);
      }

      // notify async.forEach in updateNPCs that function has completed
      if (typeof callback === 'function') callback();

    });

  };

  var update = function(socket, data) {

    // server time stamp
    data.time = game.time.now;

    console.log(data);

    // return delta object to client
    socket.io.sockets.emit('state:update', data);

  };

  var loop = function(socket, store) {

    var physics = game.physics;

    // create data object containing
    // authoritative state and last processed input id
    var data = {};
    data.players = {};
    data.npcs = {};

    // acknowledge most recent processed command and clear array
    if (physics.processed.length) {
      data.ack = _.max(physics.processed);
      physics.processed = [];
    }

    // get updated states from redis, then return delta object to client
    async.parallel([
      function(callback) { updatePlayers(store, data, callback) },
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
