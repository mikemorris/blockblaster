(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js
    module.exports = factory({
      'core': require('../core/game.core'),
      'time': require('../core/game.time'),
      'levels': require('../core/game.levels')
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

  /*
  this.checkCollisions = function(npc) {
    for (var i = scene.missiles.length; i--;) {
      var missile = scene.missiles[i];

      if(game.core.isCollision(npc, missile)) {
        missile.explode();
        npc.destroy();
        return true;
      }
    }
  };
  */

  var updatePlayers = function() {
    var players = Object.keys(scene.players);
    var length = players.length;
    var uid;
    var player;

    for (var i = 0; i < length; i++) {
      uid = players[i];
      player = scene.players[uid];

      // this.updateMissles(player.ship.missiles);

      // set position authoritatively for all players
      player.ship.respondToInput();
      player.ship.move(game.time);
    }
  };

  // TODO: move destroyed logic to server
  var updateNPCs = function(store) {
    var anyDestroyed = false;

    // TODO: is this loop syntax faster?
    for (var i = game.levels.npcs.length; i--;) {
      (function(i) {
        var npc = game.levels.npcs[i];

        if(npc.isDestroyed) {
          anyDestroyed = true;
          delete game.levels.npcs[i];
        } else {
          // scene.checkCollisions(npc);
          npc.move(game.time, function() {
            store.set('npc:' + i + ':x', npc.x, function(err, res) {});
          });
        }
      })(i);
    }

    if(anyDestroyed) {
      // clean null objects from npc array
      game.levels.npcs.clean();

      // if no npcs left, reload
      if(game.levels.npcs.length < 1) {
        game.levels.loadNPCs();
      }
    }

    // console.log(game.levels.npcs[0]);
  };

  var loop = function(store) {
    // TODO: integrate into game.client.setDelta?
    game.time.now = Date.now();
    game.time.delta = (game.time.now - game.time.then) / 1000;
    game.time.then = game.time.now;

    // update npc and object positions
    this.updateNPCs(store);

    // TODO: process input inside player loop
    // no input to process
    if (!this.queue.length) return;

    (function iterate(queue, processed, move) {
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
          store.incrby('player:' + move.uid + ':ship:x', vx, function(err, res) {});
        }

        if (vy !== 0) {
          store.incrby('player:' + move.uid + ':ship:y', vy, function(err, res) {});
        }

        // shift ack state to queue
        processed.push(move.seq);

        // if queue empty, stop looping
        if (!queue.length) return;
        iterate(queue, processed, queue.shift());
      });
    })(this.queue, this.processed, this.queue.shift());
  }

  return {
    queue: queue,
    processed: processed,
    init: init,
    updatePlayers: updatePlayers,
    updateNPCs: updateNPCs,
    loop: loop
  };

});
