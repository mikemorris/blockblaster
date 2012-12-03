var ship = (function(game) {

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
		this.image = new game.Image('images/ship.png'),
		this.missiles = [],
		this.now = 0;
		this.then = 0;
		this.rotation = 0; // radians
		this.scale = 1;
		this.vx = 0;
		this.height = 50;
		this.width = 50;
		this.x = game.canvas.width / 2 - this.width / 2;
		this.y = game.canvas.height - this.height - 25;

		// User defineable settings
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
    // TODO: rewind timeline first to determine if reconciliation is necessary
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

  game.Ship.prototype.interpolate = function() {
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
    x = game.core.lerp(current.ship.x, target.ship.x, time_point);

    // apply smoothing
    this.x = game.core.lerp(this.x, x, game.client.delta * game.smoothing);
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

  return game;
});

// export module or attach to window
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ship;
} else {
  ship(window.GAME || {});
}