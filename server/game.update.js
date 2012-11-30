var update = (function() {
  var module = {

    init: function(redis, async, game, _) {
      // init server update loop, fixed time step in milliseconds
      setInterval(function() {
        module.loop(redis, async, game, _);
      }, 45);

      return module;
    },

    loop: function(redis, async, game, _) {
      var store = game.redis.store;
      var physics = game.physics;

      // create data object containing
      // authoritative state and last processed input id
      var data = {};
      data.players = {};

      // acknowledge most recent processed command and clear array
      if (physics.processed.length) {
        data.ack = _.max(physics.processed);
        physics.processed = [];
      }

      store.smembers('players', function(err, res) {
        var players = res;
        var length = players.length;
        var uid;

        console.log(players);

        async.forEach(
          players,
          function(uid, callback) {
            module.update(store, uid, data, game, _, callback);
          },
          function(err) {
            // server time stamp
            data.time = physics.time.now;

            console.log(data);

            // return delta object to client
            game.socket.io.sockets.emit('state:update', data);
          }
        );
      });
    },

    update: function(store, uid, data, game, _, callback) {
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

        // notify async that iterator has completed
        if (typeof callback === 'function') callback();
      });
    }

  }

  return module;
});

module.exports = update();
