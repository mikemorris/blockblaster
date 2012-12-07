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
			speed: 300,
			vy: 0,
			y: 0,
			x: 0
		};

		this.set(properties);

    this.width = 10;
    this.height = 20;

    // circular dependency
    this.ship = ship;
	};

	Missile.prototype = new game.Rectangle();

	Missile.prototype.explode = function() {
		this.state.vy = 0;
		this.reload();
	};

	Missile.prototype.fire = function() {
		this.state.x = this.ship.state.x + this.ship.width / 2 - this.width / 2;
		this.state.y = this.ship.state.y;
		this.state.vy = this.state.speed;

    // switch missile to active state
		this.state.isLive = true;
	};

	Missile.prototype.move = function(direction) {
		this.state.y -= this.state.vy * game.time.delta;
		if(this.state.y < (0 - this.height)) {
			this.reload();
		}
	};

	Missile.prototype.reload = function() {
		this.state.x = -this.height;
		this.state.y = this.ship.state.y;

    // reload missile
		this.state.isLive = false;
	};

  return Missile;

});
