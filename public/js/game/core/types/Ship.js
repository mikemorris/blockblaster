(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js
    module.exports = factory({
      'core': require('../core'),
      'time': require('../time'),
      'Entity': require('./Entity'),
      'Missile': require('./Missile')
    });
  } else if (typeof define === 'function' && define.amd) {
    // AMD
    define(factory);
  } else {
    // browser globals (root is window)
    root.GAME = root.GAME || {};
    root.GAME.Ship = factory(root.GAME || {});
  }
})(this, function(game) {

	var Ship = function(properties) {
		this.set(properties);
		this.setDefaults();
		this.loadMissiles();

    // interpolation queue
    this.queue = {};
    this.queue.server = [];
	};

	Ship.prototype = new game.Entity();

	Ship.prototype.setDefaults = function() {
		this.fireButtonReleased = true;
		this.image = game.Image ? new game.Image('images/ship.png') : false,
		this.missiles = [];
		this.now = 0;
		this.then = 0;
		this.height = 50;
		this.width = 50;

		var properties = {
      vx: 0,

      // TODO: this should not depend on client side code
      x: game.canvas ? game.canvas.width / 2 - this.width / 2 : (800 / 2) - this.width,
      y: game.canvas ? game.canvas.height - this.height - 25 : 450 - this.height - 25,

      // user defineable settings
      speed: this.speed || 300,
      maxMissiles: this.maxMissiles || 3,
      repeatRate: this.repeatRate || 30
    };

    this.set(properties);
	};

	Ship.prototype.respondToInput = function() {
		var pressed = game.input.pressed;
    var vector = game.core.getVelocity(pressed);
    var fireButtonChanged = false;
    var input;

    this.vx = parseInt(this.speed * game.time.delta * vector.dx);

		if(pressed.spacebar) {
			this.fire();
		} else {
      if (!this.fireButtonReleased) {
        fireButtonChanged = true;
      }

			this.fireButtonReleased = true;
		}

    if (this.vx || pressed.spacebar || fireButtonChanged) {
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

	Ship.prototype.move = function() {
		this.x += this.vx;
	};

  Ship.prototype.reconcile = function() {
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
    vx = this.speed * game.time.delta * dx;
    this.x = this.sx + vx;
  };

  Ship.prototype.interpolate = function() {
    // entity interpolation
    var difference = Math.abs(this.sx - this.x);

    // return if no server updates to process
    if (!this.queue.server.length || difference < 0.1) return;

    // snap if large difference
    if (difference > 100) this.x = this.sx;

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
    x = game.core.lerp(current.ship.x, target.ship.x, timePoint);

    // apply smoothing
    this.x = game.core.lerp(this.x, x, game.time.delta * game.smoothing);
  };

	Ship.prototype.loadMissiles = function() {
		var i = 0;
		while(i < this.maxMissiles) {
			this.missiles.push(new game.Missile(this));
			i++;
		}
	};

	Ship.prototype.fire = function() {
		this.now = game.time.now;
		var fireDelta = (this.now - this.then)/1000;

    // filter by isLive
    var missiles = [];
    var missile;

    for (var i = 0; i < this.missiles.length; i++) {
      missile = this.missiles[i];
      if (!missile.state.isLive) {
        missiles.push(missile);
      }
    }

		var missilesLoaded = missiles.length > 0;
		var gunIsCool = fireDelta > 1 / this.repeatRate;
		var readyToFire = gunIsCool && missilesLoaded && this.fireButtonReleased;

		if(readyToFire) {
			this.fireButtonReleased = false;
			missiles[0].fire(this);
			this.then = this.now;
		}
	};

	Ship.prototype.drawType = function() {
		if(game.debug) {
			// Show hit-area
			game.ctx.fillStyle = 'rgba(0, 0, 255, 0.25)';
			game.ctx.fillRect(0,0,this.width, this.height);
			game.ctx.fill();
		}
		this.image.draw();
	},

	Ship.prototype.die = function() {
		console.log('die!');
	};

  return Ship;

});
