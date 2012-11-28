var update = (function() {
  var module = {

    init: function(redis, game, _) {
      // init server update loop, fixed time step in milliseconds
      setInterval(function() {
        module.loop(redis, game, _);
      }, 45);

      return module;
    },

    loop: function(redis, game, _) {
      var store = game.redis.store;

      // create data object containing
      // authoritative state and last processed input id
      var data = {};
      data.players = {};

      store.smembers('players', function(err, res) {
        var players = res;
        var length = players.length;
        var uid;

        for (var i = 0; i < length; i++) {
          uid = players[i];
          module.update(store, uid, data, game, _);
        }
      });
    },

    update: function(store, uid, data, game, _) {
      var physics = game.physics;

      // acknowledge most recent processed command and clear array
      if (physics.processed.length) {
        data.ack = _.max(physics.processed);
        physics.processed = [];
      }

      // defer to redis for absolute state
      store.get('player:' + uid + ':ship:x', function(err, res) {
        var x = res;
        var player = game.players[uid];

        // publish state if changed
        if (x !== null && player && player.ship.x != x) {
          player.ship.x = x;

          data.players[uid] = {};
          data.players[uid].ship = {};
          data.players[uid].ship.x = player.ship.x;
        }
    
        // TODO: only send this update once, not once for each player
        module.emit(game.socket.io, data, physics);
      });
    },

    emit: function(io, data, physics) {
      // server time stamp
      data.time = physics.time.now;

      console.log(data);

      // return delta object to client
      io.sockets.emit('state:update', data);
    }
  }

  return module;
});

module.exports = update();
