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

    this.width = 10;
    this.height = 20;

    this.ship = ship;

		var properties = {
			speed: 300,
			vy: 0,
			y: -this.height,
			x: -this.width
		};

		this.set(properties);

    // interpolation queue
    this.queue = {};
    this.queue.server = [];
	};

	Missile.prototype = new Rectangle();

	Missile.prototype.explode = function(callback) {

    var delta = {};

		this.vy = 0;
    delta['vy'] = this.vy;

		this.reload(callback);

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

	Missile.prototype.move = function(callback) {

    var delta = {};

    var dy = Math.abs(this.sy - this.y);
    var difference;

    if (this.sx) {
      this.x = this.sx;
    }

    if (this.sy) {
      if (dy > 150) {
        this.y = this.sy;
      } else {
        // update reconciled position
        this.y = core.lerp(this.y, this.sy, time.delta * core.smoothing);
      }
    } else {
      this.y -= this.vy * time.delta;
      delta['y'] = this.y;
    }

    // reload if offscreen
		if(this.state.y < (0 - this.height)) {
			this.reload(callback);
		}

    if (typeof callback === 'function') callback(this.uuid, delta);

	};

  Missile.prototype.reconcile = function(data) {

    // server reconciliation
    var dx = 0;
    var dy = 0;

    // update reconciled position with client prediction
    // server position plus dead reckoning
    dy = parseInt(this.vy * time.delta);

    // set reconciled position
    this.sx = parseInt(data.state.x);
    this.sy = parseInt(data.state.y) + dy;

  };

	Missile.prototype.reload = function(callback) {

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

  Missile.prototype.interpolate = function(callback) {

    // entity interpolation
    var dy = Math.abs(this.sy - this.y);

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
      x = core.lerp(prev.state.x, this.sx, timePoint);
      y = core.lerp(prev.state.y, this.sy, timePoint);
    
      if (dy < 100) {
        // apply smoothing
        this.y = core.lerp(this.y, y, time.delta * core.smoothing);
      } else {
        // apply smooth snap
        this.y = core.lerp(prev.state.y, y, time.delta * core.smoothing);
      }

      // always snap
      this.x = core.lerp(prev.state.x, x, time.delta * core.smoothing);
    }

    // reload if offscreen
		if(this.y < (0 - this.height)) {
			this.reload();
		}

    // only draw once x interpolates
    if (this.x === this.sx && typeof callback === 'function') callback();
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
