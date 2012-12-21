(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js
    module.exports = factory(
      {
        'time': require('../time.js'),
        'Rectangle': require('./Rectangle')
      },
      require('node-uuid')
    );
  } else if (typeof define === 'function' && define.amd) {
    // AMD
    define(factory);
  } else {
    // browser globals (root is window)
    root.GAME = root.GAME || {};
    root.GAME.Missile = factory(root.GAME || {});
  }
})(this, function(game, uuid) {

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

	Missile.prototype = new game.Rectangle();

	Missile.prototype.explode = function() {
		this.vy = 0;
		this.reload();
	};

	Missile.prototype.fire = function() {
		this.x = this.ship.x + this.ship.width / 2 - this.width / 2;
		this.y = this.ship.y;
		this.vy = this.speed;

    // switch missile to active state
		this.isLive = true;
	};

	Missile.prototype.move = function(direction) {

    var delta = {};

		this.y -= this.vy * game.time.delta;
    delta['y'] = this.y;

    // reload if offscreen
		if(this.y < (0 - this.height)) {
			this.reload();
		}

    if (typeof callback === 'function') callback(this.uuid, delta);

	};

	Missile.prototype.reload = function() {
		this.x = -this.height;
		this.y = this.ship.y;

    // reload missile
		this.isLive = false;
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

    var count = game.queue.server.length - 1;

    var prev;
    var next;

    for(var i = 0; i < count; i++) {
      prev = this.queue.server[i];
      next = this.queue.server[i + 1];

      // if client offset time is between points, set target and break
      if(game.time.client > prev.time && game.time.client < next.time) {
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
      var difference = target.time - game.time.client;
      var spread = target.time - current.time;
      timePoint = difference / spread;
    }

    // interpolated position
    y = game.core.lerp(current.state.y, target.state.y, timePoint);

    // apply smoothing
    this.y = game.core.lerp(this.y, y, game.time.delta * game.smoothing);

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
