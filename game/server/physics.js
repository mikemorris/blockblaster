(function(root, factory) {
  if (typeof exports === 'object') {
    // Node.js
    module.exports = factory(
      require('../core/core'),
      require('../core/time'),
      require('./players'),
      require('./npcs'),
      require('async')
    );
  }
})(this, function(core, time, players, npcs, async) {

  var init = function() {
    // init physics loop, fixed time step in milliseconds
    setInterval((function() {
      loop();
    }), 15);

    return this;
  };

  var checkCollisions = function(missile) {
    async.forEach(
      Object.keys(npcs.global),
      function(uuid, callback) {
        var npc = npcs.global[uuid];

        if(core.isCollision(npc, missile)) {
          missile.explode();
          npc.destroy();
        }

        // notify async.forEach that function has completed
        if (typeof callback === 'function') callback();
      }
    );
  };

  var updateMissiles = function(missiles) {
    async.forEach(
      missiles,
      function(missile, callback) {
        if(missile.state.private.isLive) {
          missile.move();
          checkCollisions(missile);
        }

        // notify async.forEach that function has completed
        if (typeof callback === 'function') callback();
      }
    );
  };

  var updateNPCs = function() {
    async.forEach(
      Object.keys(npcs.global),
      function(uuid, callback) {
        var npc = npcs.global[uuid];

        if(npc.state.private.isDestroyed) {
          npcs.remove(npcs, uuid);
        } else {
          npc.move();
        }

        // notify async.forEach that function has completed
        if (typeof callback === 'function') callback();
      }
    );
  };

  var updatePlayers = function() {
    async.forEach(
      Object.keys(players.global),
      function(uuid, callback) {
        var player = players.global[uuid];
 
        updateMissiles(player.ship.missiles);

        if (player.ship.queue.input.length) {
          player.ship.processInput(player.ship.queue.input.shift());
        }

        // notify async.forEach that function has completed
        if (typeof callback === 'function') callback();
      }
    );
  };

  var loop = function() {
    time.now = Date.now();
    time.delta = (time.now - time.then) / 1000;
    time.then = time.now;

    // update npc and player positions
    updateNPCs();
    updatePlayers();
  }

  return {
    init: init
  };

});
