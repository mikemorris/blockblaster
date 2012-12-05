(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js
    module.exports = factory({
      'core': require('../game.core'),
      'Object': require('./game.Object')
    });
  } else if (typeof define === 'function' && define.amd) {
    // AMD
    define(factory);
  } else {
    // browser globals (root is window)
    // window.GAME.core = factory(window.GAME || {});
    root.GAME.returnExports = factory(root.GAME || {});
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
	};

	game.Enemy.prototype = new game.Object();

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

	game.Enemy.prototype.move = function(time, callback) {

		this.x += this.vx * this.direction * time.delta;

		if(this.isHit) {
			this.y += this.vy * time.delta;
			this.rotation += 20 * time.delta;
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

  return game.Enemy;

});
