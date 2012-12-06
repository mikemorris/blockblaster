(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    // AMD
    define(factory);
  } else {
    // browser globals (root is window)
    // window.GAME.core = factory(window.GAME || {});
    root.GAME.returnExports = factory(root.GAME || {});
  }
})(this, function(game) {

	var module = {

    // linear interpolation
    lerp: function(prev, next, time) {
      var _prev = Number(prev);
      var _next = Number(next);
      var _time = Number(time);
      var position;

      _time = (Math.max(0, Math.min(1, _time)));
      position = (_prev + (_time * (_next - _prev)));

      return position;
    },

    // TODO: replace with physics logic (using dependency injection pattern?)
    // TODO: pass in game object/player (with defined acceleration) instead of just deltas?
    // TODO: check for valid move or cheating (moving too quickly) here
    getVector: function(dx, dy) {
      // TODO: set dx and dy to max value allowed
      return {
        dx: dx,
        dy: dy
      };
    },

    // takes an input object and returns a velocity vector
    getVelocity: function(input) {
      // return change as vector, delta x and delta y
      var dx = 0;
      var dy = 0;

      var keys = Object.keys(input);
      var length = keys.length;
      var value;

      for (var i = 0; i < length; i++) {
        value = keys[i];

        if (input[value]) {
          switch(value) {
            case 'up':
              dy++;
              break;
            case 'down':
              dy--;
              break;
            case 'right':
              dx++;
              break;
            case 'left':
              dx--;
              break;
          }
        }
      }

      return this.getVector(dx, dy);
    },

		getRandomNumber: function(min, max) {
			return Math.floor(Math.random() * (max - min + 1)) + min;
		},

		initGlobalVariables: function() {

      // input
			game.keysDown = [];

      // input sequence id
      game.seq = 0;

      // queue
      game.queue = {};
      game.queue.input = [];
      game.queue.server = [];

      // socket.io
      game.socket;

      // entity interpolation offset (milliseconds)
      game.offset = 100;

      // entity interpolation buffer size, frames * seconds
      game.buffersize = 120;

      // entity interpolation smoothing factor
      // lower number is slower smoothing
      game.smoothing = 25;
		},

		isCollision: function(a, b) {
			return  a.x <= (b.x + b.width) &&
					b.x <= (a.x + a.width) &&
					a.y <= (b.y + b.height) &&
					b.y <= (a.y + a.height);
		},

		loadScene: function(name) {
      /*
			game.scene = game.scenes[name];
			game.scene.init();
      */
		}

	};

  return module;

});
