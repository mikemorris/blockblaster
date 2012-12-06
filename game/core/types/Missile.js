(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js
    module.exports = factory({
      'time': require('../time.js'),
      'Rectangle': require('./Rectangle')
    });
  } else if (typeof define === 'function' && define.amd) {
    // AMD
    define(factory);
  } else {
    // browser globals (root is window)
    root.GAME = root.GAME || {};
    root.GAME.Missile = factory(root.GAME || {});
  }
})(this, function(game) {

	var Missile = function(ship) {
		var properties = {
			width: 10,
			height: 20,
			speed: 300,
			vy: 0,
			y: 0,
			x: 0
		};

		this.set(properties);

    // circular dependency
    // this.ship = ship;
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
		this.y -= this.vy * game.time.delta;
		if(this.y < (0 - this.height)) {
			this.reload();
		}
	};

	Missile.prototype.reload = function() {
		this.x = -this.height;
		this.y = this.ship.y;

    // reload missile
		this.isLive = false;
	};

  return Missile;

});
