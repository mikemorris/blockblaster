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

	var Missile = function(ship, missile) {
    this.uuid = missile ? missile.uuid : (uuid ? uuid.v4() : false);

    // WARN: state must be initialized on entity, NOT prototype chain
    this.state = {};
    this.state.private = {};
    this.state.public = {};

    this.ship = ship;

    this.width = 10;
    this.height = 20;

		var properties = {
      x: missile ? parseInt(missile.state.x) : -this.width,
      y: missile ? parseInt(missile.state.y) : -this.height,
      vx: 0,
			vy: 0,
			speed: 300
		};

		this.set(properties);

    // interpolation queue
    this.queue = {};
    this.queue.server = [];
	};

	Missile.prototype = new Rectangle();

	Missile.prototype.explode = function() {

		this.state.private.vy = 0;
		this.reload();

	};

	Missile.prototype.fire = function() {

    if (this.ship) {
      this.state.private.x = this.ship.state.private.x + this.ship.width / 2 - this.width / 2;

      this.state.private.y = this.ship.state.private.y;
    }

		this.state.private.vy = this.state.private.speed;

    // switch missile to active state
		this.state.private.isLive = true;

	};

	Missile.prototype.move = function() {

    this.state.private.y -= this.state.private.vy * time.delta;

    // reload if offscreen
		if(this.state.private.y < (0 - this.height)) {
			this.reload();
		}

	};

  Missile.prototype.reconcile = function(data) {

    // server reconciliation
    var x;
    var y;

    var dx = 0;
    var dy = 0;

    // update reconciled position with client prediction
    // server position plus dead reckoning
    dx = parseInt(this.state.private.vx * time.delta);
    dy = parseInt(this.state.private.vy * time.delta);

    x = parseInt(data.state.x) + dx;
    y = parseInt(data.state.y) + dy;

    // set reconciled position
    this.state.private.x = x;
    this.state.private.y = y;

  };

	Missile.prototype.reload = function() {

		this.state.private.x = -this.height;

    if (this.ship) {
      this.state.private.y = this.ship.state.private.y;
    }

    // reload missile
		this.state.private.isLive = false;

	};

  Missile.prototype.interpolate = function(callback) {

    // entity interpolation
    var dy = Math.abs(this.state.public.y - this.state.private.y);

    // return if no server updates to process
    if (!this.queue.server.length) return;

    var x;
    var y;

    var count = this.queue.server.length - 1;

    var prev;
    var next;

    for(var i = 0; i < count; i++) {
      prev = this.queue.server[i];
      next = this.queue.server[i + 1];

      // if client offset time is between points, break
      if(time.client > prev.time && time.client < next.time) break;
    }

    if (prev) {
      // calculate client time percentage between points
      var timePoint = 0;
      var difference = prev.time - time.client;
      var spread = prev.time - time.server;
      timePoint = difference / spread;

      // interpolated position
      x = core.lerp(prev.state.x, this.state.public.x, timePoint);
      y = core.lerp(prev.state.y, this.state.public.y, timePoint);
    
      if (dy < 100) {
        // apply smoothing
        this.state.private.y = core.lerp(this.state.private.y, y, time.delta * core.smoothing);
      } else {
        // apply smooth snap
        this.state.private.y = core.lerp(prev.state.y, y, time.delta * core.smoothing);
      }

      // always snap
      this.state.private.x = core.lerp(prev.state.x, x, time.delta * core.smoothing);
    }

    // reload if offscreen
		if(this.state.private.y < (0 - this.height)) {
			this.reload();
		}

    // only draw once x interpolates
    if (this.state.private.x === this.state.public.x && typeof callback === 'function') callback();
  };

	Missile.prototype.getState = function() {
    return {
      uuid: this.uuid,
      state: {
        y: this.state.private.y,
        x: this.state.private.x,
        isLive: this.state.private.isLive
      }
    };
  };

  return Missile;

});
