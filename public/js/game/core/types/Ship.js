(function(root, factory) {
  if (typeof exports === 'object') {
    // Node.js
    module.exports = factory(
      require('../core'),
      require('../time'),
      require('../../client/input'),
      require('./Entity'),
      require('./Missile'),
      undefined,
      require('node-uuid')
    );
  } else if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../core', '../time', '../../client/input', './Entity', './Missile', './Image'], factory);
  }
})(this, function(core, time, input, Entity, Missile, Image, uuid) {

	var Ship = function(properties) {
    this.uuid = uuid ? uuid.v4() : false;

    // WARN: state must be initialized on entity, NOT prototype chain
    this.state = {};
    this.state.private = {};
    this.state.public = {};

		this.set(properties);

		this.setDefaults();
		this.loadMissiles();

    // input sequence id
    this.seq = 0;

    // interpolation queue
    this.queue = {};
    this.queue.input = [];
    this.queue.server = [];
	};

	Ship.prototype = new Entity();

	Ship.prototype.setDefaults = function() {
		this.fireButtonReleased = true;
		this.image = Image ? new Image('images/ship.png') : false,
		this.missiles = [];
		this.now = 0;
		this.then = 0;
		this.height = 50;
		this.width = 50;
    this.maxMissiles = 3;
    this.repeatRate = 30;

		var properties = {
      x: 20,
      y: 380,
      vx: 0,
      vy: 0,
      speed: 300,
      rotation: 0,
      scale: 1
    };

    this.set(properties);
	};

	Ship.prototype.respondToInput = function(pressed, callback) {

    var vector = core.getVelocity(pressed);
    var fireButtonChanged = false;
    var input;

    this.state.private.vx = parseInt(this.state.private.speed * time.delta * vector.dx);

		if(pressed.spacebar) {
			this.fire();
		} else {
      if (!this.fireButtonReleased) {
        fireButtonChanged = true;
      }

			this.fireButtonReleased = true;
		}

    if (this.state.private.vx || pressed.spacebar || fireButtonChanged) {
      // create input object
      input = {
        time: Date.now(),
        seq: this.seq++,
        input: pressed,
        data: {
          speed: this.state.private.speed,
          vector: vector
        }
      };

      // add input to queue, then send to server
      this.queue.input.push(input);

      if (typeof callback === 'function') callback(input);
    }

	};

	Ship.prototype.processInput = function(move) {

    process.nextTick((function() {
      // calculate delta time vector
      var vector = core.getVelocity(move.input);

      var vx = parseInt(this.state.private.speed * time.delta * vector.dx);
      var vy = parseInt(this.state.private.speed * time.delta * vector.dy);

      this.state.private.x += vx;
      this.state.private.y += vy;

      if(move.input.spacebar) {
        this.fire();
      } else {
        this.fireButtonReleased = true;
      }

      // if queue empty, stop looping
      if (!this.queue.input.length) return;

      this.processInput(this.queue.input.shift());
    }).bind(this));

  };

	Ship.prototype.move = function() {

    this.state.private.x += this.state.private.vx;

	};

  Ship.prototype.reconcile = function(client, player) {

    var x;
    var y;

    // server reconciliation
    var dx = 0;
    var dy = 0;

    // bind this inside filter to Ship
    // remove most recent processed move and all older moves from queue
    var queue = this.queue.input = this.queue.input.filter((function(el, index, array) {
      return el.seq > this.ack;
    }).bind(this));

    // update reconciled position with client prediction
    // server position plus delta of unprocessed input
    for (var i = 0; i < queue.length; i++) {
      dx += parseInt(queue[i].data.speed * queue[i].data.vector.dx * time.delta);
      dy += parseInt(queue[i].data.speed * queue[i].data.vector.dy * time.delta);
    }

    // reconciled prediction
    x = parseInt(player.ship.state.x) + dx;
    y = parseInt(player.ship.state.y) + dy;

    // set reconciled position
    this.state.private.x = core.lerp(this.state.private.x, x, time.delta * core.smoothing);
    this.state.private.y = core.lerp(this.state.private.y, y, time.delta * core.smoothing);

  };

  Ship.prototype.interpolate = function() {

    // entity interpolation
    var dx = Math.abs(this.state.public.x - this.state.private.x);
    var dy = Math.abs(this.state.public.y - this.state.private.y);

    var difference = Math.max(dx, dy);

    // return if no server updates to process
    if (!this.queue.server.length || difference < 0.1) return;

    var x;
    var y;

    var count = this.queue.server.length - 1;

    var prev;
    var next;

    for(var i = 0; i < count; i++) {
      prev = this.queue.server[i];
      next = this.queue.server[i + 1];

      // if client offset time is between points, break
      if(time.client > prev.time && time.client < next.time) break;
    }

    if (prev) {
      // calculate client time percentage between points
      var timePoint = 0;
      var difference = prev.time - time.client;
      var spread = prev.time - time.server;
      timePoint = difference / spread;

      // interpolated position
      x = core.lerp(prev.state.x, this.state.public.x, timePoint);
      y = core.lerp(prev.state.y, this.state.public.y, timePoint);

      if (dx < 100) {
        // apply smoothing
        this.state.private.x = core.lerp(this.state.private.x, x, time.delta * core.smoothing);
      } else {
        // apply smooth snap
        this.state.private.x = core.lerp(prev.state.x, x, time.delta * core.smoothing);
      }

      if (dy < 100) {
        // apply smoothing
        this.state.private.y = core.lerp(this.state.private.y, y, time.delta * core.smoothing);
      } else {
        // apply smooth snap
        this.state.private.y = core.lerp(prev.state.y, y, time.delta * core.smoothing);
      }
    }

  };

	Ship.prototype.loadMissiles = function() {
		for (var i = 0; i < this.maxMissiles; i++) {
			this.missiles.push(new Missile(this));
		}
	};

	Ship.prototype.fire = function() {

		this.now = time.now;
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

      if (!missile.state.private.isLive) {
        missiles.push(missile);
      }
    }

		var missilesLoaded = missiles.length > 0;
		var gunIsCool = fireDelta > 1 / this.repeatRate;
		var readyToFire = gunIsCool && missilesLoaded && this.fireButtonReleased;

		if(readyToFire) {
			this.fireButtonReleased = false;
			missiles[0].fire();
			this.then = this.now;
		}

	};

	Ship.prototype.drawType = function(client) {
		if(core.debug) {
			// Show hit-area
			client.ctx.fillStyle = 'rgba(0, 0, 255, 0.25)';
			client.ctx.fillRect(0,0,this.width, this.height);
			client.ctx.fill();
		}
		this.image.draw(client);
	},

	Ship.prototype.die = function() {
		console.log('die!');
	};

	Ship.prototype.getState = function() {
    // init missiles
    var missiles = {};
    var missile;
    var uuid;

    // iterate over missiles
    for (var i = 0; i < this.missiles.length; i++) {
      missile = this.missiles[i];
      uuid = missile.uuid;

      missiles[uuid] = missile.getState();
    }

    return {
      uuid: this.uuid,
      state: this.state.private,
      missiles: missiles
    };
  };

  return Ship;

});
