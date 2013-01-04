(function(root, factory) {
  if (typeof exports === 'object') {
    // Node.js
    module.exports = factory(
      require('../core/core'),
      require('../core/time'),
      require('./levels')
    );
  }
})(this, function(core, time, levels) {

  // commands to be processed
  var queue = [];

  var init = function(socket, store) {
    // init physics loop, fixed time step in milliseconds
    setInterval((function() {
      this.loop(socket, store);
    }).bind(this), 15);

    return this;
  };

  var updateMissiles = function(store, missiles) {
    var checkCollisions = function(missile) {
      // TODO: check collisions against ALL npcs, not just on this server
      var keys = Object.keys(levels.npcs);
      var length = keys.length;
      var key;
      var npc;

      for (var i = length; i--;) {
        key = keys[i];
        npc = levels.npcs[key];

        if(core.isCollision(npc, missile)) {
          missile.explode(store, function(uuid, delta) {
            var keys = Object.keys(delta);
            var length = keys.length;
            var key;

            for (var i = 0; i < length; i++) {
              key = keys[i];
              store.hset('missile:' + uuid, key, delta[key], function(err, res) {});
            }
          });

          npc.destroy();
        }
      }
    };

    for (var i = 0; i < missiles.length; i++) {
      (function(i) {
        var missile = missiles[i];
        var uuid = missile.uuid;

        if(missile.isLive) {
          missile.move(store, function(uuid, delta) {
            var keys = Object.keys(delta);
            var length = keys.length;
            var key;

            for (var i = 0; i < length; i++) {
              key = keys[i];
              store.hset('missile:' + uuid, key, delta[key], function(err, res) {});
            }
          });

          checkCollisions(missile);
        }
      })(i);
    }
  };

  var updateNPCs = function(socket, store) {
    var keys = Object.keys(levels.npcs);
    var length = keys.length;

    for (var i = 0; i < length; i++) {
      (function(i) {
        var uuid = keys[i];
        var npc = levels.npcs[uuid];

        if(npc.isDestroyed) {
          delete levels.npcs[uuid];

          store.multi()
            .srem('npc', uuid)
            .del('npc:' + uuid)
            .zrem('expire', 'npc+' + uuid)
            .exec(function(err, res) {
              socket.io.sockets.emit('npc:destroy', uuid);
            });
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
  };

  var loop = function(socket, store) {
    time.now = Date.now();
    time.delta = (time.now - time.then) / 1000;
    time.then = time.now;

    // update npc and object positions
    this.updateNPCs(socket, store);

    // TODO: process input inside player loop
    var players = Object.keys(levels.players);
    var length = players.length;
    var uuid;
    var player;

    // set position authoritatively for all players
    for (var i = 0; i < length; i++) {
      uuid = players[i];
      player = levels.players[uuid];

      this.updateMissiles(store, player.ship.missiles);

      // no input to process
      if (!player.queue.length) continue;

      (function iterate(player, uuid, move) {
        process.nextTick(function() {
          var vector;
          var vx;
          var vy;

          // calculate delta time vector
          vector = core.getVelocity(move.input);

          vx = parseInt(move.data.speed * time.delta * vector.dx);
          vy = parseInt(move.data.speed * time.delta * vector.dy);

          // pipe valid commands directly to redis
          // passing a negative value to redis.incrby() decrements
          if (vx !== 0) {
            store.hincrby('ship:' + player.ship.uuid, 'x', vx, function(err, res) {
              player.ship.x = res;
            });
          }

          if (vy !== 0) {
            store.hincrby('ship:' + player.ship.uuid, 'y', vy, function(err, res) {
              player.ship.y = res;
            });
          }

          if(move.input.spacebar) {
            player.ship.fire(store, function(uuid, delta) {
              var keys = Object.keys(delta);
              var length = keys.length;
              var key;

              for (var i = 0; i < length; i++) {
                key = keys[i];
                store.hset('missile:' + uuid, key, delta[key], function(err, res) {});
              }
            });
          } else {
            // TODO: no command with this state is being sent if ship is stationary
            player.ship.fireButtonReleased = true;
          }

          // update ack
          if (move.seq > player.ack) {
            store.hset('player:' + player.uuid, 'ack', move.seq, function(err, res) {
              player.ack = res;
            });
          }

          // if queue empty, stop looping
          if (!player.queue.length) return;
          iterate(player, uuid, player.queue.shift());
        });
      })(player, uuid, player.queue.shift());
    }

  }

  return {
    queue: queue,
    init: init,
    updateMissiles: updateMissiles,
    updateNPCs: updateNPCs,
    loop: loop
  };

});
