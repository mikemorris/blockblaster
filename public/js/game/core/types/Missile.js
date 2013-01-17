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

	Missile.prototype.explode = function(callback) {

    var delta = {};

		this.vy = 0;
    delta['vy'] = this.vy;

		this.reload(callback);

    if (typeof callback === 'function') callback(this, delta);

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

    if (typeof callback === 'function') callback(this, delta);

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

    if (typeof callback === 'function') callback(this, delta);

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

    if (typeof callback === 'function') callback(this, delta);

	};

  Missile.prototype.interpolate = function() {

    // entity interpolation
    var dx = Math.abs(this.sx - this.x);
    var dy = Math.abs(this.sy - this.y);

    var difference = (!isNaN(dy) && dy < 0.1 && !isNaN(dx) && dx < 0.1);

    // return if no server updates to process
    if (!this.queue.server.length || difference) return;

    var x;
    var y;

    var count = this.queue.server.length - 1;

    var prev;
    var next;

    var from;
    var to;

    for(var i = 0; i < count; i++) {
      prev = this.queue.server[i];
      next = this.queue.server[i + 1];

      // if client offset time is between points, break
      if(time.client > prev.time && time.client < next.time) {
        from = prev;
        to = next;
        break;
      }
    }

    // FIXME: fix interpolation bounce and include interpolation delay in snap
    // or build alternative to missile object pool

    /* if (from && dy < 100) {
      // calculate client time percentage between to and from points
      var timePoint = 0;

      if (from.time !== to.time) {
        var difference = from.time - time.client;
        var spread = from.time - to.time;
        timePoint = difference / spread;
      }
      
      // interpolated position
      y = core.lerp(from.state.y, to.state.y, timePoint);
    
      // apply smoothing
      this.y = core.lerp(this.y, y, time.delta * core.smoothing);
    } else { */

      // TODO: not factoring in interpolation delay like Ship
      // no interpolation target found, smooth to most recent state
      this.y = core.lerp(this.y, this.sy, time.delta * core.smoothing);

    // }

    this.x = parseInt(this.sx);

    // reload if offscreen
		if(this.state.y < (0 - this.height)) {
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
