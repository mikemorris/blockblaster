(function(root, factory) {
  if (typeof exports === 'object') {
    // Node.js
    module.exports = factory(
      require('../core'),
      require('./Entity'),
      require('./Missile'),
      require('./Ship')
    );
  } else if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../core', './Entity', './Missile', './Ship'], factory);
  }
})(this, function(core, Entity, Missile, Ship) {

  // constructor
	var Player = function(player) {
		this.ship = new Ship();

    // init from existing state
    if (player && player.ship && player.ship.state) {
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

        this.ship.missiles[missile.uuid] = new Missile();
      }
    }

    // input queue
    this.queue = [];

    // most recent acknowledged command
    this.ack = 0;

    return this;
	};

	Player.prototype = new Entity();

	Player.prototype.getState = function() {
    return {
      state: this.state,
      ship: this.ship.getState()
    };
  };

  return Player;

});
