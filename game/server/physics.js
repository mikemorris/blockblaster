(function(root, factory) {
  if (typeof exports === 'object') {
    // Node.js
    module.exports = factory(
      require('../core/core'),
      require('../core/time'),
      require('./players'),
      require('./npcs')
    );
  }
})(this, function(core, time, players, npcs) {

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
      var keys = Object.keys(npcs.global);
      var length = keys.length;
      var key;
      var npc;

      for (var i = length; i--;) {
        key = keys[i];
        npc = npcs.global[key];

        if(core.isCollision(npc, missile)) {
          missile.explode(function(missile, delta) {
            var keys = Object.keys(delta);
            var length = keys.length;
            var key;

            for (var i = 0; i < length; i++) {
              key = keys[i];
              store.hset('missile:' + missile.uuid, key, delta[key], function(err, res) {});
            }
          });

          npc.destroy(store, function(missile, delta) {
            var keys = Object.keys(delta);
            var length = keys.length;
            var key;

            for (var i = 0; i < length; i++) {
              key = keys[i];
              store.hset('npc:' + uuid, key, delta[key], function(err, res) {});
            }
          });
        }
      }
    };

    for (var i = 0; i < missiles.length; i++) {
      var missile = missiles[i];
      var uuid = missile.uuid;

      if(missile.isLive) {
        missile.move(function(missile, delta) {
          // double check necessary because of asyncronocity
          // FIXME: last move callback firing after reload callback
          var keys = Object.keys(delta);
          var length = keys.length;
          var key;

          for (var j = 0; j < length; j++) {
            key = keys[j];
            store.hset('missile:' + missile.uuid, key, delta[key], function(err, res) {});
          }
        });

        checkCollisions(missile);
      }
    }
  };

  var updateNPCs = function(socket, store) {
    var keys = npcs.local;
    var length = keys.length;

    for (var i = 0; i < length; i++) {
      (function(i) {
        var uuid = keys[i];
        var npc = npcs.global[uuid];

        if(npc.isDestroyed) {
          npcs.remove(uuid);

          store.multi()
            .srem('npc', uuid)
            .del('npc:' + uuid)
            .zrem('expire', 'npc+' + uuid)
            .exec(function(err, res) {});
        } else {
          npc.move(store, function(missile, delta) {
            var keys = Object.keys(delta);
            var length = keys.length;
            var key;

            for (var i = 0; i < length; i++) {
              key = keys[i];
              store.hset('npc:' + uuid, key, delta[key], function(err, res) {});
            }

            // expire all NPCs to clean redis on server crash
            store.zadd('expire', Date.now(), 'npc+' + uuid, function(err, res) {});
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
    var keys = players.local;
    var length = keys.length;

    var uuid;
    var player;

    // set position authoritatively for all players
    for (var i = 0; i < length; i++) {
      uuid = keys[i];
      player = players.global[uuid];

      this.updateMissiles(store, player.ship.missiles);

      // no input to process
      if (!player.queue.length) {
        // update expiration if no player input to process
        store.zadd('expire', Date.now(), 'player+' + uuid, function(err, res) {});
        continue;
      }

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
            player.ship.fire(store, function(missile, delta) {
              var keys = Object.keys(delta);
              var length = keys.length;
              var key;

              for (var i = 0; i < length; i++) {
                key = keys[i];
                store.hset('missile:' + missile.uuid, key, delta[key], function(err, res) {});
              }
            });
          } else {
            // TODO: no command with this state is being sent if ship is stationary
            player.ship.fireButtonReleased = true;
          }

          // update ack
          if (move.seq > player.ack) {
            store.hset('player:' + uuid, 'ack', move.seq, function(err, res) {
              player.ack = res;
            });
          }

          // only expire socket or browser session clients
          store.zadd('expire', Date.now(), 'player+' + uuid, function(err, res) {});

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
