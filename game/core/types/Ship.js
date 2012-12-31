(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js
    module.exports = factory(
      {
        'core': require('../core'),
        'time': require('../time'),
        'Entity': require('./Entity'),
        'Missile': require('./Missile')
      },
      require('node-uuid')
    );
  } else if (typeof define === 'function' && define.amd) {
    // AMD
    define(factory);
  } else {
    // browser globals (root is window)
    root.GAME = root.GAME || {};
    root.GAME.Ship = factory(root.GAME || {});
  }
})(this, function(game, uuid) {

	var Ship = function(properties) {
    this.uuid = uuid ? uuid.v4() : false;

		this.set(properties);
		this.setDefaults();
		this.loadMissiles();

    // interpolation queue
    this.queue = {};
    this.queue.server = [];

    // interpolation target
    this.server = {};
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
      // TODO: pass speed and delta too
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

    if (this.sx) {
      // queue server updates for entity interpolation
      this.queue.server.push(this);
      
      // splice array, keeping BUFFER_SIZE most recent items
      if (this.queue.server.length >= game.buffersize) {
        this.queue.server.splice(0, this.queue.server.length - game.buffersize);
      }
    } else {
      this.x += this.vx;
    }

	};

  Ship.prototype.reconcile = function(player) {

    // server reconciliation
    var dx = 0;
    var dy = 0;
    var vx;
    var vector;
    var length;

    var then;

    // bind this inside filter to Ship
    // remove most recent processed move and all older moves from queue
    var queue = game.queue.input = game.queue.input.filter((function(el, index, array) {
      if (el.seq == this.ack) then = el;
      return el.seq > this.ack;
    }).bind(this));

    if (then) {

      // update client position with reconciled prediction
      // server position plus delta of unprocessed input
      game.time.latency = (Date.now() - then.time) / 1000;

      for (var i = 0; i < queue.length; i++) {
        // TODO: speed and delta from queue
        dx += parseInt(this.speed * queue[i].data.vector.dx * game.time.delta);
      }

      // reconciled position
      this.sx = parseInt(player.ship.state.x) + dx;

    }

  };

  Ship.prototype.interpolate = function() {

    // entity interpolation
    var difference = Math.abs(this.sx - this.x);

    // return if no server updates to process
    if (!this.queue.server.length) return;

    // snap if large difference
    if (difference < 0.1 || difference > 200) {
      this.x = this.sx;
      return;
    }

    var x;
    var vx;

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
    x = game.core.lerp(current.sx, target.sx, timePoint);

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

	Ship.prototype.fire = function(store, callback) {

		this.now = game.time.now;
		var fireDelta = (this.now - this.then) / 1000;

    // filter by isLive
    var keys = Object.keys(this.missiles);
    var length = keys.length;
    var key;

    var missiles = [];
    var missile;

    for (var i = 0; i < length; i++) {
      key = keys[i];
      missile = this.missiles[key];

      if (!missile.isLive) {
        missiles.push(missile);
      }
    }

		var missilesLoaded = missiles.length > 0;
		var gunIsCool = fireDelta > 1 / this.repeatRate;
		var readyToFire = gunIsCool && missilesLoaded && this.fireButtonReleased;

		if(readyToFire) {
			this.fireButtonReleased = false;
			missiles[0].fire(store, callback);
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

	Ship.prototype.getState = function() {
    // init missiles
    var missiles = [];

    // iterate over missiles
    for (var i = 0; i < this.missiles.length; i++) {
      missiles.push(this.missiles[i].getState());
    }

    return {
      uuid: this.uuid,
      state: this.state,
      missiles: missiles
    };
  };

  return Ship;

});
