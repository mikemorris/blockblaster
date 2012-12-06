(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js
    module.exports = factory({
      'core': require('../game.core'),
      'Object': require('./game.Object'),
      'Ship': require('./game.Ship')
    });
  } else if (typeof define === 'function' && define.amd) {
    // AMD
    define(factory);
  } else {
    // browser globals (root is window)
    // window.GAME.core = factory(window.GAME || {});
    root.GAME.returnExports = factory(root.GAME || {});
  }
})(this, function(game) {

  // constructor
	game.Player = function(player) {
		this.ship = new game.Ship({
      speed: 300,
      maxMissiles: 3,
      repeatRate: 30
    });

    // init from existing state
    if (player) {
      this.ship.x = player.ship.x;
    }

    return this;
	};

	game.Player.prototype = new game.Object();

  return game.Player;

});
