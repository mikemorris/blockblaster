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
      var uid;

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
    store.lrange('npcs', 0, -1, function(err, res) {
      var npcs = res;
      var length = npcs.length;
      var index;

      async.forEach(
        npcs,
        function(index, callback) {
          updateNPC(socket, store, index, data, callback);
        }, function() {
          // notify async that iterator has completed
          if (typeof callback === 'function') callback();
        }
      );
    });
  };

  var updateNPC = function(socket, store, index, data, callback) {
    // defer to redis for absolute state
    store.get('npc:' + index + ':x', function(err, res) {
      var x = parseInt(res);
      var npc = game.levels.npcs[index];

      // publish state if changed
      if (x && npc && npc.state && npc.state.x != x) {
        npc.state.x = x;

        if (npc.state.isDestroyed) {
          socket.io.sockets.emit('npc:destroy', index);
        }
        
        data.npcs.push(npc.state);
      }

      // notify async that iterator has completed
      if (typeof callback === 'function') callback();
    });
  };

  var update = function(socket, data) {
    // server time stamp
    data.time = game.time.now;

    console.log(data);

    /*
    var keys = Object.keys(data.players);
    var key;

    var missiles;
    var missile;
    
    for (var i = 0; i < keys.length; i++) {
      key = keys[i];
      missiles = data.players[key].ship.missiles;
      console.log(missiles);
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
    data.npcs = []

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
