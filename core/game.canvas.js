(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    // AMD
    define(factory);
  } else {
    // browser globals (root is window)
    // window.GAME.core = factory(window.GAME || {});
    root.GAME.returnExports = factory(root.GAME || {});
  }
})(this, function(game) {

  this.init = function() {
    // set methods to run every frame
    // TODO: decouple this asynchronously?
    game.client.actions = [
      this.clearCanvas,
      this.updatePlayers,
      this.updateMissles,
      this.updateNPCs
    ];
  };

  this.clearCanvas: function() {
    game.ctx.clearRect(0, 0, game.canvas.width, game.canvas.height);
  };

  this.createCanvas: function(width, height) {
    game.canvas = document.createElement('canvas');
    game.ctx = game.canvas.getContext('2d');
    game.canvas.width = width;
    game.canvas.height = height;
    document.getElementById('canvas-wrapper').appendChild(game.canvas);
  };

  this.updateMissles = function() {
    for (var i = scene.missiles.length; i--;) {
      var missile = scene.missiles[i];
      if(missile.isLive) {
        missile.move();
        missile.draw();
      }
    }
  };

  this.updatePlayers = function() {
    var players = Object.keys(scene.players);
    var length = players.length;
    var uid;
    var player;

    for (var i = 0; i < length; i++) {
      uid = players[i];
      player = scene.players[uid];

      // this.updateMissles(player.ship.missiles);

      // client prediction only for active player
      if (uid === game.uid) {
        player.ship.respondToInput();
        player.ship.move();
      } else {
        // interpolate position of other players
        player.ship.interpolate();
      }

      player.ship.draw();
    }
  };

  // TODO: move destroyed logic to server
  this.updateNPCs = function() {
    var anyDestroyed = false;

    // TODO: is this loop syntax faster?
    for (var i = scene.npcs.length; i--;) {
      var npc = scene.npcs[i];
      if(npc.isDestroyed) {
        anyDestroyed = true;
        delete scene.npcs[i];
      } else {
        // scene.checkCollisions(npc);
        npc.move();
        npc.draw();
      }
    }

    if(anyDestroyed) {
      // clean null objects from npc array
      scene.npcs.clean();

      // if no npcs left, reload
      if(scene.npcs.length < 1) {
        scene.loadNPCs();
      }
    }
  };

	return this;

});
