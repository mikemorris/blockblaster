(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js
    module.exports = factory({
      'Rectangle': require('./game.Rectangle')
    });
  } else if (typeof define === 'function' && define.amd) {
    // AMD
    define(factory);
  } else {
    // browser globals (root is window)
    root.GAME.Missile = factory(root.GAME || {});
  }
})(this, function(game) {

	game.Missile = function(ship) {
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

	game.Missile.prototype = new game.Rectangle();

	game.Missile.prototype.explode = function() {
		this.vy = 0;
		this.reload();
	};

	game.Missile.prototype.fire = function() {
		this.x = this.ship.x + this.ship.width / 2 - this.width / 2;
		this.y = this.ship.y;
		this.vy = this.speed;
		this.isLive = true;
		this.ship.missiles.shift();
	};

	game.Missile.prototype.move = function(direction) {
		this.y -= this.vy * game.time.delta;
		if(this.y < (0 - this.height)){
			this.reload();
		}
	};

	game.Missile.prototype.reload = function() {
		//fix this duplication
		this.x = -this.height;
		this.y = this.ship.y;
		this.isLive = false;
		this.ship.missiles.push(this);
	};

  return game.Missile;

});
