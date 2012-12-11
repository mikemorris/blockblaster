(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js
    module.exports = factory({
      'core': require('../core/core'),
      'time': require('../core/time'),
      'levels': require('./levels')
    });
  }
})(this, function(game) {

  // commands to be processed
  var queue = [];

  // processed command ids for client ack
  var processed = [];

  var init = function(socket, store) {
    // init physics loop, fixed time step in milliseconds
    setInterval((function() {
      this.loop(socket, store);
    }).bind(this), 15);

    return this;
  };

  var updateMissiles = function(missiles) {
    var checkCollisions = function(missile) {
      var keys = Object.keys(game.levels.npcs);
      var length = keys.length;
      var key;
      var npc;

      for (var i = length; i--;) {
        key = keys[i];
        npc = game.levels.npcs[key];

        if(game.core.isCollision(npc, missile)) {
          missile.explode();
          npc.destroy();
        }
      }
    };

    for (var i = missiles.length; i--;) {
      var missile = missiles[i];
      if(missile.isLive) {
        missile.move();
        checkCollisions(missile);
      }
    }
  };

  var updateNPCs = function(socket, store) {
    var anyDestroyed = false;

    // TODO: is this loop syntax faster?
    var keys = Object.keys(game.levels.npcs);
    var length = keys.length;

    for (var i = 0; i < length; i++) {
      (function(i) {
        var uuid = keys[i];
        var npc = game.levels.npcs[uuid];

        if(npc.isDestroyed) {
          anyDestroyed = true;
          delete game.levels.npcs[uuid];

          // TODO: flag enemy as destroyed in redis
          // store.set('npc:' + i + ':x', npc.x, function(err, res) {});
        } else {
          npc.move(store, function(uuid, delta) {
            var keys = Object.keys(delta);
            var length = keys.length;
            var key;

            for (var i = 0; i < length; i++) {
              key = keys[i];
              store.hset('npc:' + uuid, key, delta[key], function(err, res) {});
            }
          });
        }
      })(i);
    }

    if(anyDestroyed) {
      // if no npcs left, reload
      if(Object.keys(game.levels.npcs).length < 1) {
        // TODO: break into single loadNPC events?
        game.levels.loadEnemies(store);
        socket.io.sockets.emit('npcs', game.levels.npcs);
      }
    }
  };

  var loop = function(socket, store) {
    game.time.now = Date.now();
    game.time.delta = (game.time.now - game.time.then) / 1000;
    game.time.then = game.time.now;

    // update npc and object positions
    this.updateNPCs(socket, store);

    // TODO: process input inside player loop
    var players = Object.keys(game.levels.players);
    var length = players.length;
    var uid;
    var player;

    // set position authoritatively for all players
    for (var i = 0; i < length; i++) {
      uid = players[i];
      player = game.levels.players[uid];

      this.updateMissiles(player.ship.missiles);

      // no input to process
      if (!player.queue.length) continue;

      (function iterate(player, uid, move) {
        process.nextTick(function() {
          var vector;
          var vx;
          var vy;

          // calculate delta time vector
          vector = game.core.getVelocity(move.input);

          vx = parseInt(move.data.speed * game.time.delta * vector.dx);
          vy = parseInt(move.data.speed * game.time.delta * vector.dy);

          // pipe valid commands directly to redis
          // passing a negative value to redis.incrby() decrements
          if (vx !== 0) {
            store.incrby('player:' + uid + ':ship:x', vx, function(err, res) {});
          }

          if (vy !== 0) {d
            store.incrby('player:' + uid + ':ship:y', vy, function(err, res) {});
          }

          if(move.input.spacebar) {
            player.ship.fire();
          } else {
            // TODO: no command with this state is being sent if ship is stationary
            player.ship.fireButtonReleased = true;
          }

          // shift ack state to queue
          player.processed.push(move.seq);

          // if queue empty, stop looping
          if (!player.queue.length) return;
          iterate(player, uid, player.queue.shift());
        });
      })(player, uid, player.queue.shift());
    }

  }

  return {
    queue: queue,
    processed: processed,
    init: init,
    updateMissiles: updateMissiles,
    updateNPCs: updateNPCs,
    loop: loop
  };

});
