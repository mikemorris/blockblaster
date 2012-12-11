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
      var keys = Object.keys(player.ship.state);
      var length = keys.length;
      var key;

      for (var i = 0; i < length; i++) {
        key = keys[i];
        this.ship[key] = player.ship.state[key];
      }
    }

    // input queue
    this.queue = []
    this.processed = [];

    return this;
	};

	Player.prototype = new game.Entity();

	Player.prototype.getState = function() {
    return {
      state: this.state,
      ship: this.ship.getState()
    };
  };

  return Player;

});
