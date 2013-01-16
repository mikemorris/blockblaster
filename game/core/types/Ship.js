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

		this.set(properties);
		this.setDefaults();
		this.loadMissiles();

    // interpolation queue
    this.queue = {};
    this.queue.server = [];

    // interpolation target
    this.server = {};

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

		var properties = {
      x: 20,
      y: 380,
      vx: 0,

      // user defineable settings
      speed: this.speed || 300,
      maxMissiles: this.maxMissiles || 3,
      repeatRate: this.repeatRate || 30
    };

    this.set(properties);
	};

	Ship.prototype.respondToInput = function(client, pressed, callback) {

    var vector = core.getVelocity(pressed);
    var fireButtonChanged = false;
    var input;

    this.vx = parseInt(this.speed * time.delta * vector.dx);

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
        seq: client.seq++,
        input: pressed,
        data: {
          speed: this.speed,
          vector: vector
        }
      };

      if (typeof callback === 'function') callback(input);
    }

	};

	Ship.prototype.move = function() {

    if (this.sx) {
      // update reconciled position
      this.x = core.lerp(this.x, this.sx, time.delta * core.smoothing);
    } else {
      this.x += this.vx * time.delta;
    }

	};

  Ship.prototype.reconcile = function(client, player) {

    // server reconciliation
    var dx = 0;
    var dy = 0;

    // bind this inside filter to Ship
    // remove most recent processed move and all older moves from queue
    var queue = client.queue.input = client.queue.input.filter((function(el, index, array) {

      // loose comparison necessary?
      if (el.seq == this.ack) {
        // TODO: moving average?
        time.latency = (Date.now() - el.time) / 1000;
      }

      return el.seq > this.ack;

    }).bind(this));

    // update reconciled position with client prediction
    // server position plus delta of unprocessed input
    for (var i = 0; i < queue.length; i++) {
      dx += parseInt(queue[i].data.speed * queue[i].data.vector.dx * time.delta);
    }

    // set reconciled position
    this.sx = parseInt(player.ship.state.x) + dx;

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

    var from
    var to;

    var count = this.queue.server.length - 1;

    var prev;
    var next;

    for(var i = 0; i < count; i++) {
      prev = this.queue.server[i];
      next = this.queue.server[i + 1];

      // if client offset time is between points, set from and break
      if(time.client > prev.time && time.client < next.time) {
        from = prev;
        to = next;
        break;
      }
    }

    // no interpolation from found, snap to most recent state
    if(!from) {
      from = to = this.queue.server[this.queue.server.length - 1];
    }

    // calculate client time percentage between to and from points
    var timePoint = 0;

    if (from.time !== to.time) {
      var difference = from.time - time.client;
      var spread = from.time - to.time;
      timePoint = difference / spread;
    }

    // interpolated position
    x = core.lerp(from.state.x, to.state.x, timePoint);

    // apply smoothing
    this.x = core.lerp(this.x, x, time.delta * core.smoothing);

  };

	Ship.prototype.loadMissiles = function() {
		for (var i = 0; i < this.maxMissiles; i++) {
			this.missiles.push(new Missile(this));
		}
	};

	Ship.prototype.fire = function(store, callback) {

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
