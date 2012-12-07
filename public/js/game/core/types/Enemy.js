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
    root.GAME = root.GAME || {};
    root.GAME.Enemy = factory(root.GAME || {});
  }
})(this, function(game) {

	var Enemy = function(x, y, direction) {
		var properties = {
			color: 'rgba(0, 0, 255, 0.25)',
			direction: direction || 1,
			maxMissiles: 5,
			speed: 100,
			vx: 100,
			x: x + game.core.getRandomNumber(-25, 25),
			y: y
		};

		this.set(properties);

    this.width = 50;
    this.height = 30;

    this.image = game.Image ? new game.Image('images/enemy.png') : false;
    this.missiles = [];

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
		this.state.isHit = true;
		this.state.vy = -200;
		// this.isDestroyed = true;
	};

	Enemy.prototype.drawType = function() {
		if(game.debug) {
			if(this.state.isDestroyed) {
				this.state.color = 'red';
			}
			// Show hit-area
			game.ctx.fillStyle = this.state.color;
			game.ctx.fillRect(0,0,this.width, this.height);
			game.ctx.fill();
		}
		this.image.draw();
	};

	Enemy.prototype.move = function(callback) {

		this.state.x += this.state.vx * this.state.direction * game.time.delta;

    // missile impact
		if(this.state.isHit) {
			this.state.y += this.state.vy * game.time.delta;
			this.state.rotation += 20 * game.time.delta;
			this.state.isDestroyed = this.state.y < -this.height;
		} else {
			if(this.state.x > this.origin.x + this.range) {
				this.state.direction = -1;
			} else if (this.state.x < this.origin.x - this.range) {
				this.state.direction = 1;
			}
		}

    if (typeof callback === 'function') callback();

	};

  Enemy.prototype.interpolate = function() {
    // entity interpolation
    var difference = Math.abs(this.sx - this.state.x);

    // return if no server updates to process
    if (!this.queue.server.length || difference < 0.1) return;

    // snap if large difference
    if (difference > 100) this.state.x = this.sx;

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
    var timePoint = 0;

    if (target.time !== current.time) {
      var difference = target.time - game.time.client;
      var spread = target.time - current.time;
      timePoint = difference / spread;
    }

    // interpolated position
    // TODO: jump to position if large delta
    x = game.core.lerp(current.x, target.x, timePoint);

    // apply smoothing
    this.state.x = game.core.lerp(this.state.x, x, game.time.delta * game.smoothing);
  };

  return Enemy;

});
