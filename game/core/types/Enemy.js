(function(root, factory) {
  if (typeof exports === 'object') {
    // Node.js
    module.exports = factory(
      require('../core'),
      require('../time'),
      require('./Entity'),
      undefined,
      require('node-uuid')
    );
  } else if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../core', '../time', './Entity', './Image'], factory);
  }
})(this, function(core, time, Entity, Image, uuid) {

	var Enemy = function(x, y, direction, id) {
    this.uuid = id ? id : (uuid ? uuid.v4() : false);

    // WARN: state must be initialized on entity, NOT prototype chain
    this.state = {};
    this.state.private = {};
    this.state.public = {};

		var properties = {
			x: x + core.getRandomNumber(-25, 25),
			y: y,
			speed: 100,
			vx: 100,
      vy: 0,
			direction: direction || 1,
      color: 'rgba(0, 0, 255, 0.25)',
      rotation: 0,
      scale: 1
		};

		this.set(properties);

    this.width = 50;
    this.height = 30;
    this.image = Image ? new Image('images/enemy.png') : false;

    this.missiles = [];
    this.maxMissiles = 5;

    this.range = 50;

    this.origin = {
      x: x,
      y: y
    };

    // interpolation queue
    this.queue = {};
    this.queue.server = [];
	};

	Enemy.prototype = new Entity();

	Enemy.prototype.destroy = function() {

		this.state.private.isHit = true;
		this.state.private.vy = -200;

	};

	Enemy.prototype.drawType = function(client) {
		if(core.debug) {
			if(this.state.private.isDestroyed) {
				this.color = 'red';
			}
			// Show hit-area
			client.ctx.fillStyle = this.color;
			client.ctx.fillRect(0,0,this.width, this.height);
			client.ctx.fill();
		}
		this.image.draw(client);
	};

	Enemy.prototype.move = function() {

    this.state.private.x += this.state.private.vx * this.state.private.direction * time.delta;

    // missile impact
		if(this.state.private.isHit) {

			this.state.private.y += this.state.private.vy * time.delta;
			this.state.private.rotation += 20 * time.delta;
			this.state.private.isDestroyed = this.state.private.y < -Math.max(this.height, this.width);

		} else {

			if(this.state.private.x > this.origin.x + this.range) {
				this.state.private.direction = -1;
			} else if (this.state.private.x < this.origin.x - this.range) {
				this.state.private.direction = 1;
			}

		}

	};

  Enemy.prototype.interpolate = function() {

    // entity interpolation
    var dx = Math.abs(this.state.public.x - this.state.private.x);
    var dy = Math.abs(this.state.public.y - this.state.private.y);

    var difference = Math.max(dx, dy);

    // return if no server updates to process
    if (!this.queue.server.length || difference < 0.1) return;

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

      if (dx < 100) {
        // apply smoothing
        this.state.private.x = core.lerp(this.state.private.x, x, time.delta * core.smoothing);
      } else {
        // apply smooth snap
        this.state.private.x = core.lerp(prev.state.x, x, time.delta * core.smoothing);
      }

      if (dy < 100) {
        // apply smoothing
        this.state.private.y = core.lerp(this.state.private.y, y, time.delta * core.smoothing);
      } else {
        // apply smooth snap
        this.state.private.y = core.lerp(prev.state.y, y, time.delta * core.smoothing);
      }
    }
  };

  Enemy.prototype.getState = function() {
    // only return state.private with keys
    // this.state.private initialized as {} in Entity
    if (Object.keys(this.state.private).length) {
      return {
        uuid: this.uuid,
        state: this.state.private
      }
    }
  };

  return Enemy;

});
