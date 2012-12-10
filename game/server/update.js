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
        player.ship.state.x = x;

        data.players[uid] = {};
        data.players[uid].ship = {};
        data.players[uid].ship.x = player.ship.state.x;
        data.players[uid].ship.missiles = [];

        for (var i = 0; i < player.ship.missiles.length; i++) {
          var missile = player.ship.missiles[i].state;
          data.players[uid].ship.missiles.push(missile);
        }
      }

      // notify async that iterator has completed
      if (typeof callback === 'function') callback();
    });
  };

  var updateNPCs = function(socket, store, data, callback) {
    store.smembers('npcs', function(err, res) {
      var npcs = res;
      var length = npcs.length;

      async.forEach(
        npcs,
        function(uuid, callback) {
          updateNPC(socket, store, uuid, data, callback);
        }, function() {
          // notify async that iterator has completed
          if (typeof callback === 'function') callback();
        }
      );
    });
  };

  var updateNPC = function(socket, store, uuid, data, callback) {
    // defer to redis for absolute state
    // TODO: clean up this callback mess
    store.get('npc:' + uuid + ':x', function(err, res) {
      var x = parseInt(res);

      store.get('npc:' + uuid + ':y', function(err, res) {
        var y = parseInt(res);
        var npc = game.levels.npcs[uuid];

        // publish state if changed
        // TODO: fix this to actually return on delta
        if (x && npc && npc.state && npc.state.x != x) {
          npc.state.x = x;
          npc.state.y = y;

          if (npc.state.isDestroyed) {
            socket.io.sockets.emit('npc:destroy', uuid);
          }
          
          data.npcs[uuid] = npc.state;
        }

        // notify async that iterator has completed
        if (typeof callback === 'function') callback();
      });
    });
  };

  var update = function(socket, data) {
    // server time stamp
    data.time = game.time.now;

    //  console.log(data);

    /*
    var keys = Object.keys(data.npcs);
    var uuid;
    
    for (var i = 0; i < keys.length; i++) {
      uuid = keys[i];
      npc = data.npcs[uuid];

      if (npc.isHit) {
        console.log(npc);
      }
    }
    */

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

    async.parallel([
      function(callback) { updatePlayers(store, data, callback) },
      function(callback) { updateNPCs(socket, store, data, callback) }
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
