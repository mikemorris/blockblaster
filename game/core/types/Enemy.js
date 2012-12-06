(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js
    module.exports = factory({
      'core': require('../core'),
      'time': require('../time'),
      'Entity': require('./Entity')
    });
  } else if (typeof define === 'function' && define.amd) {
    // AMD
    define(factory);
  } else {
    // browser globals (root is window)
    root.GAME.Enemy = factory(root.GAME || {});
  }
})(this, function(game) {

	game.Enemy = function(x, y, direction) {
		var properties = {
      image: (game.Image ? new game.Image('images/enemy.png') : false),
			color: 'rgba(0, 0, 255, 0.25)',
			direction: direction || 1,
			height: 30,
			maxMissiles: 5,
			missiles: [],
			range: 50,
			speed: 100,
			vx: 100,
			width: 50,
			x: x + game.core.getRandomNumber(-25, 25),
			y: y,
			origin: {
				x: x,
				y: y
			}
		};

		this.set(properties);

    // interpolation queue
    this.queue = {};
    this.queue.server = [];
	};

	game.Enemy.prototype = new game.Entity();

	game.Enemy.prototype.destroy = function() {
		this.isHit = true;
		this.vy = -200;
		// this.isDestroyed = true;
	};

	game.Enemy.prototype.drawType = function() {
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

	game.Enemy.prototype.move = function(callback) {

		this.x += this.vx * this.direction * game.time.delta;

    // missile impact
		if(this.isHit) {
			this.y += this.vy * game.time.delta;
			this.rotation += 20 * game.time.delta;
			this.isDestroyed = this.y < -this.height;
		} else {
			if(this.x > this.origin.x + this.range) {
				this.direction = -1;
			} else if (this.x < this.origin.x - this.range) {
				this.direction = 1;
			}
		}

    if (typeof callback === 'function') callback();

	};

  game.Enemy.prototype.interpolate = function() {
    // entity interpolation
    var difference = Math.abs(this.sx - this.x);

    // return if no server updates to process
    if (!this.queue.server.length || difference < 0.1) return;

    var x;
    var vx;

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
    var time_point = 0;

    if (target.time !== current.time) {
      var difference = target.time - game.time.client;
      var spread = target.time - current.time;
      time_point = difference / spread;
    }

    // interpolated position
    // TODO: jump to position if large delta
    x = game.core.lerp(current.x, target.x, time_point);

    // apply smoothing
    this.x = game.core.lerp(this.x, x, game.time.delta * game.smoothing);
  };

  return game.Enemy;

});
