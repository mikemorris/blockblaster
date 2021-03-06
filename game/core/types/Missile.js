(function(root, factory) {
  if (typeof exports === 'object') {
    // Node.js
    module.exports = factory(
      require('../core.js'),
      require('../time.js'),
      require('./Rectangle'),
      require('node-uuid')
    );
  } else if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../core', '../time', './Rectangle'], factory);
  }
})(this, function(core, time, Rectangle, uuid) {

	var Missile = function(ship) {
    this.uuid = uuid ? uuid.v4() : false;

		var properties = {
			speed: 300,
			vy: 0,
			y: 0,
			x: 0
		};

		this.set(properties);

    this.width = 10;
    this.height = 20;

    this.ship = ship;

    // interpolation queue
    this.queue = {};
    this.queue.server = [];
	};

	Missile.prototype = new Rectangle();

	Missile.prototype.explode = function(store, callback) {

    var delta = {};

		this.vy = 0;
    delta['y'] = this.y;

		this.reload(store, callback);

    if (typeof callback === 'function') callback(this.uuid, delta);

	};

	Missile.prototype.fire = function(store, callback) {

    var delta = {};

    if (this.ship) {
      this.x = this.ship.x + this.ship.width / 2 - this.width / 2;
      delta['x'] = this.x;

      this.y = this.ship.y;
      delta['y'] = this.y;
    }

		this.vy = this.speed;
    delta['vy'] = this.vy;

    // switch missile to active state
		this.isLive = true;
    delta['isLive'] = this.isLive;

    if (typeof callback === 'function') callback(this.uuid, delta);

	};

	Missile.prototype.move = function(store, callback) {

    var delta = {};

		this.y -= this.vy * time.delta;
    delta['y'] = this.y;

    // reload if offscreen
		if(this.y < (0 - this.height)) {
			this.reload(store, callback);
		}

    if (typeof callback === 'function') callback(this.uuid, delta);

	};

	Missile.prototype.reload = function(store, callback) {

    var delta = {};

		this.x = -this.height;
    delta['x'] = this.x;

    if (this.ship) {
      this.y = this.ship.y;
      delta['y'] = this.y;
    }

    // reload missile
		this.isLive = false;
    delta['isLive'] = this.isLive;

    if (typeof callback === 'function') callback(this.uuid, delta);

	};

  Missile.prototype.interpolate = function() {
    // entity interpolation
    var difference = Math.abs(this.sy - this.y);

    // return if no server updates to process
    if (!this.queue.server.length || difference < 0.1) return;

    // snap if large difference
    if (difference > 150) this.y = this.sy;

    var y;
    var vy;

    var target
    var current;

    var count = this.queue.server.length - 1;

    var prev;
    var next;

    for(var i = 0; i < count; i++) {
      prev = this.queue.server[i];
      next = this.queue.server[i + 1];

      // if client offset time is between points, set target and break
      if(time.client > prev.time && time.client < next.time) {
        target = prev;
        current = next;
        break;
      }
    }

    // no interpolation target found, snap to most recent state
    if(!target) {
      target = current = this.queue.server[this.queue.server.length - 1];
    }

    // calculate client time percentage between current and target points
    var timePoint = 0;

    if (target.time !== current.time) {
      var difference = target.time - time.client;
      var spread = target.time - current.time;
      timePoint = difference / spread;
    }

    // interpolated position
    y = core.lerp(current.state.y, target.state.y, timePoint);

    // apply smoothing
    this.y = core.lerp(this.y, y, time.delta * core.smoothing);

    // reload if offscreen
		if(this.y < (0 - this.height)) {
			this.reload();
		}
  };

	Missile.prototype.getState = function() {
    return {
      uuid: this.uuid,
      state: {
        y: this.y,
        x: this.x,
        isLive: this.isLive
      }
    };
  };

  return Missile;

});
