(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js
    module.exports = factory({
      'core': require('../core'),
      'Entity': require('./Entity'),
      'Ship': require('./Ship')
    });
  } else if (typeof define === 'function' && define.amd) {
    // AMD
    define(factory);
  } else {
    // browser globals (root is window)
    root.GAME = root.GAME || {};
    root.GAME.Player = factory(root.GAME || {});
  }
})(this, function(game) {

  // constructor
	var Player = function(player) {
		this.ship = new game.Ship({
      speed: 300,
      maxMissiles: 3,
      repeatRate: 30
    });

    // init from existing state
    if (player) {
      this.ship.state.x = player.ship.x;
      this.speed = player.ship.speed;
      this.maxMissiles = player.ship.maxMissiles;
      this.repeatRate = player.ship.repeatRate;
    }

    return this;
	};

	Player.prototype = new game.Entity();

  return Player;

});
