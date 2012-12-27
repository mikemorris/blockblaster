(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js
    module.exports = factory({
      'core': require('../core'),
      'Entity': require('./Entity'),
      'Missile': require('./Missile'),
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
		this.ship = new game.Ship();

    // init from existing state
    if (player) {
      var keys = Object.keys(player.ship.state);
      var length = keys.length;
      var key;

      for (var i = 0; i < length; i++) {
        key = keys[i];

        // TODO: not all state may be ints, fix this
        // watch out for server passing redis state as strings
        // canvas will only draw Numbers
        this.ship[key] = parseInt(player.ship.state[key]);
      }

      // init missiles
      // keys = Object.keys(player.ship.missiles);
      // length = keys.length;

      // TODO: this should not be necessary
      this.ship.missiles = {};
      var missile;

      for (var j = 0; j < player.ship.missiles.length; j++) {
        missile = player.ship.missiles[j];

        this.ship.missiles[missile.uuid] = new game.Missile();
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
