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

		var properties = {
			x: x + core.getRandomNumber(-25, 25),
			y: y,
			speed: 100,
			vx: 100,
      vy: 0,
			direction: direction || 1
		};

		this.set(properties);

    this.y = y;
    this.width = 50;
    this.height = 30;
    this.color = 'rgba(0, 0, 255, 0.25)';
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

	Enemy.prototype.destroy = function(store, callback) {

    var delta = {};

		this.isHit = true;
    delta['isHit'] = this.isHit;

		this.vy = -200;
    delta['vy'] = this.vy;

    if (typeof callback === 'function') callback(this.uuid, delta);

	};

	Enemy.prototype.drawType = function(client) {
		if(core.debug) {
			if(this.isDestroyed) {
				this.color = 'red';
			}
			// Show hit-area
			client.ctx.fillStyle = this.color;
			client.ctx.fillRect(0,0,this.width, this.height);
			client.ctx.fill();
		}
		this.image.draw(client);
	};

	Enemy.prototype.move = function(store, callback) {

    var delta = {};

		this.x += this.vx * this.direction * time.delta;
    delta['x'] = this.x;

    // missile impact
		if(this.isHit) {
			this.y += this.vy * time.delta;
      delta['y'] = this.y;

			this.rotation += 20 * time.delta;
      delta['rotation'] = this.rotation;

			this.isDestroyed = this.y < -Math.max(this.height, this.width);
		} else {
			if(this.x > this.origin.x + this.range) {
				this.direction = -1;
			} else if (this.x < this.origin.x - this.range) {
				this.direction = 1;
			}

      delta['direction'] = this.direction;
		}

    if (typeof callback === 'function') callback(this.uuid, delta);

	};

  Enemy.prototype.interpolate = function() {
    // entity interpolation
    var dx = Math.abs(this.sx - this.x);
    var dy = Math.abs(this.sy - this.y);
    var difference = Math.max(dx, dy);

    // return if no server updates to process
    if (!this.queue.server.length || difference < 0.1) return;

    // snap if large difference
    if (difference > 200) {
      // TODO: how is it that NPCs are drifting out to x = 80000?
      console.log(difference);
      this.x = this.sx;
      this.y = this.sy;
      return;
    }

    var x;
    var y;

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
    if (current.x && target.x) {
      x = core.lerp(current.x, target.x, timePoint);
      this.x = core.lerp(this.x, x, time.delta * core.smoothing);
    }

    if (current.y && target.y) {
      y = core.lerp(current.y, target.y, timePoint);
      this.y = core.lerp(this.y, y, time.delta * core.smoothing);
    }
  };

  Enemy.prototype.getState = function() {
    return this.state;
  };

  return Enemy;

});
