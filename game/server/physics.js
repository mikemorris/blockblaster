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

  var init = function() {
    // init physics loop, fixed time step in milliseconds
    setInterval((function() {
      loop();
    }), 15);

    return this;
  };

  var checkCollisions = function(missile) {
    var keys = Object.keys(npcs.global);
    var length = keys.length;

    var uuid;
    var npc;

    for (var i = 0; i < length; i++) {
      uuid = keys[i];
      npc = npcs.global[uuid];

      if(core.isCollision(npc, missile)) {
        missile.explode();
        npc.destroy();
      }
    }
  };

  var updateMissiles = function(missiles) {
    var length = missiles.length;
    var missile;

    for (var i = 0; i < length; i++) {
      missile = missiles[i];

      if(missile.state.private.isLive) {
        missile.move();
        checkCollisions(missile);
      }
    }
  };

  var updateNPCs = function() {
    var keys = Object.keys(npcs.global);
    var length = keys.length;

    var uuid;
    var npc;

    for (var i = 0; i < length; i++) {
      uuid = keys[i];
      npc = npcs.global[uuid];

      if(npc.state.private.isDestroyed) {
        npcs.remove(npcs, uuid);
      } else {
        npc.move();
      }
    }
  };

  var updatePlayers = function() {
    var keys = Object.keys(players.global);
    var length = keys.length;

    var uuid;
    var player;

    // set position authoritatively for all players
    for (var i = 0; i < length; i++) {
      uuid = keys[i];
      player = players.global[uuid];

      updateMissiles(player.ship.missiles);

      if (player.ship.queue.input.length) {
        player.ship.processInput(player.ship.queue.input.shift());
      }
    }
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
