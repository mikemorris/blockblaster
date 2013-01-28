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

    // WARN: state must be initialized on entity, NOT prototype chain
    this.state = {};
    this.state.private = {};
    this.state.public = {};

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
      this.ship.missiles = [];
      keys = Object.keys(player.ship.missiles);
      length = keys.length;

      var missile;

      for (var j = 0; j < length; j++) {
        key = keys[j];
        missile = player.ship.missiles[key];
        this.ship.missiles.push(new Missile(this.ship, missile));
      }
    }

    // input queue
    this.queue = [];

    return this;
	};

	Player.prototype = new Entity();

	Player.prototype.getState = function() {
    return {
      state: this.state.private,
      ship: this.ship.getState()
    };
  };

  Player.prototype.getDelta = function(async, _) {

    var delta = {};

    // PLAYER
    // save reference to old values and update state
    // WARN: clone produces shallow copy
    var prev = this.state.public;
    var next = this.state.public = _.clone(this.state.private);

    // init delta array for changed keys
    var deltaKeys = [];

    // iterate over new values and compare to old
    var keys = Object.keys(next);
    var length = keys.length;
    var key;

    for (var i = 0; i < length; i++) {
      key = keys[i];

      // check for changed values and push key to deltaKeys array
      if (prev[key] !== next[key]) {
        deltaKeys.push(key);
      }
    }

    // set changed values in data object
    if (deltaKeys.length > 0) {
      delta.state = _.pick(next, deltaKeys);
    }

    // SHIP
    // save reference to old values and update state
    // WARN: clone produces shallow copy
    prev = this.ship.state.public;
    next = this.ship.state.public = _.clone(this.ship.state.private);

    // init delta array for changed keys
    deltaKeys = [];

    // iterate over new values and compare to old
    keys = Object.keys(next);
    length = keys.length;
    key;

    for (var j = 0; j < length; j++) {
      key = keys[j];

      // check for changed values and push key to deltaKeys array
      if (prev[key] !== next[key]) {
        deltaKeys.push(key);
      }
    }

    // set changed values in data object
    if (deltaKeys.length) {
      delta.ship = {};
      delta.ship.state = _.pick(next, deltaKeys);
    }

    // MISSILES
    // init missiles
    var missiles = {};

    // iterate over missiles
    async.forEach(
      this.ship.missiles,
      function(missile, callback) {
        // save reference to old values and update state
        // WARN: clone produces shallow copy
        var prev = missile.state.public;
        var next = missile.state.public = _.clone(missile.state.private);

        // init delta array for changed keys
        var deltaKeys = [];

        // iterate over new values and compare to old
        var keys = Object.keys(next);
        var length = keys.length;
        var key;

        for (var k = 0; k < length; k++) {
          key = keys[k];

          // check for changed values and push key to deltaKeys array
          if (prev[key] !== next[key]) {
            deltaKeys.push(key);
          }
        }

        // set changed values in data object
        if (deltaKeys.length) {
          var deltaMissile = {};
          deltaMissile.state = _.pick(next, deltaKeys);
          missiles[missile.uuid] = deltaMissile;
        }

        // notify async.forEach that iterator has completed
        if (typeof callback === 'function') callback();
      },
      function() {
        if (Object.keys(missiles).length) {
          delta.ship = delta.ship || {};
          delta.ship.missiles = missiles;
        }

        // set changed values in data object
        if (Object.keys(delta).length) {
          delta.uuid = this.uuid;
          delta.time = Date.now();
        }
      }
    );

    return delta;
  };

  return Player;

});
