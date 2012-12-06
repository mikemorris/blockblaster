(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    // AMD
    define(factory);
  } else {
    // browser globals (root is window)
    root.GAME.returnExports = factory(root.GAME || {});
    // window.GAME.core = factory(window.GAME || {});
  }
})(this, function(game) {

  var init = function(async, redis, game, _) {
    // init server update loop, fixed time step in milliseconds
    setInterval((function() {
      this.loop(async, redis, game, _);
    }).bind(this), 45);

    return this;
  };

  var updatePlayers = function(async, store, data, game, _, callback) {
    store.smembers('players', function(err, res) {
      var players = res;
      var length = players.length;
      var uid;

      // console.log(players);

      async.forEach(
        players,
        function(uid, callback) {
          updatePlayer(store, uid, data, game, _, callback);
        }, function() {
          // notify async that iterator has completed
          if (typeof callback === 'function') callback();
        }
      );
    });
  };

  var updatePlayer = function(store, uid, data, game, _, callback) {
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

  var updateNPCs = function(async, store, data, game, _, callback) {
    store.lrange('npcs', 0, -1, function(err, res) {
      var npcs = res;
      var length = npcs.length;
      var index;

      async.forEach(
        npcs,
        function(index, callback) {
          updateNPC(store, index, data, game, _, callback);
        }, function() {
          // notify async that iterator has completed
          if (typeof callback === 'function') callback();
        }
      );
    });
  };

  var updateNPC = function(store, index, data, game, _, callback) {
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

  var update = function(game, data) {
    // server time stamp
    data.time = game.physics.time.now;

    console.log(data);

    // return delta object to client
    game.socket.io.sockets.emit('state:update', data);
  };

  var loop = function(async, redis, game, _) {
    var store = game.redis.store;
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
      function(callback) { updatePlayers(async, store, data, game, _, callback) },
      function(callback) { updateNPCs(async, store, data, game, _, callback) }
    ], function() {
      update(game, data);
    });

  };

  return {
    init: init,
    updatePlayers: updatePlayers,
    updateNPCs: updateNPCs,
    loop: loop
  };

});
