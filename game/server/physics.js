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

  var init = function(store) {
    // init physics loop, fixed time step in milliseconds
    setInterval((function() {
      this.loop(store);
    }).bind(this), 15);

    return this;
  };

  var checkCollisions = function(npc) {
    for (var i = scene.missiles.length; i--;) {
      var missile = scene.missiles[i];

      if(game.core.isCollision(npc, missile)) {
        missile.explode();
        npc.destroy();
        return true;
      }
    }
  };

  var updateMissiles = function(missiles) {
    for (var i = missiles.length; i--;) {
      var missile = missiles[i];
      if(missile.state.isLive) {
        missile.move();
      }
    }
  };

  var updateNPCs = function(store) {
    var anyDestroyed = false;

    // TODO: is this loop syntax faster?
    for (var i = game.levels.npcs.length; i--;) {
      var npc = game.levels.npcs[i];

      if(npc.isDestroyed) {
        anyDestroyed = true;
        delete game.levels.npcs[i];

        // TODO: flag enemy as destroyed in redis
        // store.set('npc:' + i + ':x', npc.x, function(err, res) {});
      } else {
        npc.move((function(i) {
          store.set('npc:' + i + ':x', npc.state.x, function(err, res) {});
        })(i));
      }
    }

    if(anyDestroyed) {
      // clean null objects from npc array
      game.levels.npcs.clean();

      // if no npcs left, reload
      if(game.levels.npcs.length < 1) {
        game.levels.loadNPCs();
      }
    }
  };

  var loop = function(store) {
    // TODO: integrate into game.client.setDelta?
    game.time.now = Date.now();
    game.time.delta = (game.time.now - game.time.then) / 1000;
    game.time.then = game.time.now;

    // update npc and object positions
    this.updateNPCs(store);

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
      // this.checkCollisions(missile, npcs);

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
