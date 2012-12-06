(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js
    module.exports = factory(
      {
        'levels': require('../core/game.levels'),
        'physics': require('./game.physics')
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
      var uid;

      // console.log(players);

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
      if (x !== null && player && player.ship.x != x) {
        player.ship.x = x;

        data.players[uid] = {};
        data.players[uid].ship = {};
        data.players[uid].ship.x = player.ship.x;
      }

      // notify async that iterator has completed
      if (typeof callback === 'function') callback();
    });
  };

  var updateNPCs = function(store, data, callback) {
    store.lrange('npcs', 0, -1, function(err, res) {
      var npcs = res;
      var length = npcs.length;
      var index;

      async.forEach(
        npcs,
        function(index, callback) {
          updateNPC(store, index, data, callback);
        }, function() {
          // notify async that iterator has completed
          if (typeof callback === 'function') callback();
        }
      );
    });
  };

  var updateNPC = function(store, index, data, callback) {
    // defer to redis for absolute state
    store.get('npc:' + index + ':x', function(err, res) {
      var x = parseInt(res);
      var npc = game.levels.npcs[index];

      // publish state if changed
      if (x !== null && npc && npc.x != x) {
        npc.x = x;

        data.npcs.push({
          x: npc.x
        });
      }

      // notify async that iterator has completed
      if (typeof callback === 'function') callback();
    });
  };

  var update = function(socket, data) {
    // server time stamp
    data.time = game.physics.time.now;

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
    data.npcs = []

    // acknowledge most recent processed command and clear array
    if (physics.processed.length) {
      data.ack = _.max(physics.processed);
      physics.processed = [];
    }

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
