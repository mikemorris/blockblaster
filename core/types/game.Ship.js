(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js
    module.exports = factory({
      'core': require('../game.core'),
      'Object': require('./game.Object'),
      'Missile': require('./game.Missile')
    });
  } else if (typeof define === 'function' && define.amd) {
    // AMD
    define(factory);
  } else {
    // browser globals (root is window)
    root.GAME.Ship = factory(root.GAME || {});
  }
})(this, function(game) {

	game.Ship = function(properties) {
		this.set(properties);
		this.setDefaults();
		this.loadMissiles();

    // interpolation queue
    this.queue = {};
    this.queue.server = [];
	};

	game.Ship.prototype = new game.Object();

	game.Ship.prototype.setDefaults = function() {
		this.fireButtonReleased = true;
		this.missiles = [];
		this.now = 0;
		this.then = 0;
		this.rotation = 0; // radians
		this.scale = 1;
		this.vx = 0;
		this.height = 50;
		this.width = 50;

    // TODO: this should not depend on client side code
    this.x = game.canvas ? game.canvas.width / 2 - this.width / 2 : 0;
    this.y = game.canvas ? game.canvas.height - this.height - 25 : 0;

    // TODO: client side only
    if (typeof module === 'undefined' && !module.exports) {
      this.image = new game.Image('images/ship.png');
    }

		// user defineable settings
		this.speed = this.speed || 300;
		this.maxMissiles = this.maxMissiles || 3;
		this.repeatRate = this.repeatRate || 30;
	};

	game.Ship.prototype.respondToInput = function() {
		var pressed = game.input.pressed;
    var vector = game.core.getVelocity(pressed);
    var input;

    this.vx = parseInt(this.speed * game.client.delta * vector.dx);

		if(pressed.spacebar) {
			this.fire();
		} else {
			this.fireButtonReleased = true;
		}

    if (this.vx) {
      // create input object
      input = {
        time: Date.now(),
        seq: game.seq++,
        input: pressed,
        data: {
          vector: vector,
          speed: this.speed
        }
      };

      // add input to queue, then send to server
      game.queue.input.push(input);
      game.socket.emit('command:send', input);
    }
	};

	game.Ship.prototype.move = function() {
		this.x += this.vx;
	};

  game.Ship.prototype.reconcile = function() {
    // server reconciliation
    var dx = 0;
    var dy = 0;
    var vx;
    var vector;
    var length;

    // bind this inside filter to Ship
    // remove most recent processed move and all older moves from queue
    game.queue.input = game.queue.input.filter((function(el, index, array) {
      return el.seq > this.ack;
    }).bind(this));

    // cache length for replay loop
    length = game.queue.input.length;

    for (var i = 0; i < length; i++) {
      vector = game.queue.input[i].data.vector;
      dx += vector.dx;
      dy += vector.dy;
    }

    // update client position with reconciled prediction
    // server position plus delta of unprocessed input
    vx = this.speed * game.client.delta * dx;
    this.x = this.sx + vx;
  };

	game.Ship.prototype.loadMissiles = function() {
		var i = 0;
		while(i < this.maxMissiles) {
			this.missiles.push(new game.Missile(this));
			i++;
		}
	};

	game.Ship.prototype.fire = function() {
		this.now = game.client.now;
		var fireDelta = (this.now - this.then)/1000;
		var missilesLoaded = this.missiles.length > 0;
		var gunIsCool = fireDelta > 1 / this.repeatRate;
		var readyToFire = gunIsCool && missilesLoaded && this.fireButtonReleased;

		if(readyToFire) {
			this.fireButtonReleased = false;
			this.missiles[0].fire();
			this.then = this.now;
		}
	};

	game.Ship.prototype.drawType = function() {
		if(game.debug) {
			// Show hit-area
			game.ctx.fillStyle = 'rgba(0, 0, 255, 0.25)';
			game.ctx.fillRect(0,0,this.width, this.height);
			game.ctx.fill();
		}
		this.image.draw();
	},

	game.Ship.prototype.die = function() {
		console.log('die!');
	};

  return game.Ship;

});
