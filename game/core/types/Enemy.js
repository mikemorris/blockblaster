(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js
    module.exports = factory(
      {
        'core': require('../core'),
        'time': require('../time'),
        'Entity': require('./Entity')
      },
      require('node-uuid')
    );
  } else if (typeof define === 'function' && define.amd) {
    // AMD
    define(factory);
  } else {
    // browser globals (root is window)
    root.GAME = root.GAME || {};
    root.GAME.Enemy = factory(root.GAME || {});
  }
})(this, function(game, uuid) {

	var Enemy = function(x, y, direction) {
    this.uuid = uuid ? uuid.v4() : false;

		var properties = {
			x: x + game.core.getRandomNumber(-25, 25),
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
    this.image = game.Image ? new game.Image('images/enemy.png') : false;

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

	Enemy.prototype = new game.Entity();

	Enemy.prototype.destroy = function() {
		this.isHit = true;
		this.vy = -200;
		// this.isDestroyed = true;
	};

	Enemy.prototype.drawType = function() {
		if(game.debug) {
			if(this.isDestroyed) {
				this.color = 'red';
			}
			// Show hit-area
			game.ctx.fillStyle = this.color;
			game.ctx.fillRect(0,0,this.width, this.height);
			game.ctx.fill();
		}
		this.image.draw();
	};

	Enemy.prototype.move = function(store, callback) {

    var delta = {};

		this.x += this.vx * this.direction * game.time.delta;
    delta['x'] = this.x;

    // missile impact
		if(this.isHit) {
			this.y += this.vy * game.time.delta;
      delta['y'] = this.y;

			this.rotation += 20 * game.time.delta;
      delta['rotation'] = this.rotation;

			this.isDestroyed = this.y < -Math.max(this.height, this.width);
      delta['isDestroyed'] = this.isDestroyed;
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
    if (difference > 150) {
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
    if (current.x && target.x) {
      x = game.core.lerp(current.x, target.x, timePoint);
      this.x = game.core.lerp(this.x, x, game.time.delta * game.smoothing);
    }

    if (current.y && target.y) {
      y = game.core.lerp(current.y, target.y, timePoint);
      this.y = game.core.lerp(this.y, y, game.time.delta * game.smoothing);
    }
  };

  Enemy.prototype.getState = function() {
    return {
      uuid: this.uuid,
      state: {
        x: this.x,
        y: this.y,
        direction: this.direction
      }
    };
  };

  return Enemy;

});
