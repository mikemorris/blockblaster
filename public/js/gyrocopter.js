(function (window, undefined) {
  var Gyrocopter = (function(module) {
    // protected variables
    var document = window.document;
    var init = false;
    var gyroscope;
    var accelerometer;
    var keyboard = [];

    var queue = {};
    queue.motion = [];
    queue.keyboard = [];

    // public variables
    module.TIME_STEP = 15;

    // public functions
    module.motion = function(map) {
      // create input object and add to motion queue
      var input = {
        time: Date.now(),
        gyroscope: gyroscope,
        accelerometer: accelerometer
      };

      // add input to queue, then trim queue to max size
      queue.motion.unshift(input);
      queue.motion = queue.motion.slice(0, 10);

      var last = queue.motion.length - 1;
      var now = queue.motion[0].gyroscope;
      var then = queue.motion[last].gyroscope;

      if (now.alpha !== null) {
        // alpha, beta, gamma
        var delta = [
          now.alpha - then.alpha,
          now.beta - then.beta,
          now.gamma - then.gamma
        ];

        var length = delta.length;
        for (var i = 0; i < length; i++) {
          var value = delta[i];
          if (Math.abs(value) > 1) {
            var index = (value >= 0 ? 0 : 1);
            var event = map[i][index];

            if (event) {
              document.dispatchEvent(new CustomEvent('gyrocopter', {
                detail: {
                  direction: event
                }
              }));
            }
          }
        }
      }
    };

    module.keyboard = function(map) {
      // create input object and add to keyboard queue
      var input = {
        time: Date.now(),
        keyboard: keyboard
      };

      // add input to queue, then trim queue to max size
      queue.keyboard.unshift(input);
      queue.keyboard = queue.keyboard.slice(0, 10);

      var keys = Object.keys(map);
      var length = keys.length;
      for (var i = 0; i < length; i++) {
        var event = keys[i];
        var keydown = (function() {
          var keybind = map[event];
          for (var j = 0; j < keybind.length; j++) {
            var key = keybind[j];
            if (queue.keyboard[0]['keyboard'][key]) {
              return true;
            }
          }
        })();

        if (keydown) {
          document.dispatchEvent(new CustomEvent('gyrocopter', {
            detail: {
              direction: event
            }
          }));
        }
      }
    };

    // constructor
    module.constructor = {};

    module.constructor.gyroscope = function(callback) {
      window.ondeviceorientation = function(event) {
        gyroscope = event;
      };

      window.ondevicemotion = function(event) {
        accelerometer = event;
      };

      if (typeof callback === 'function') {
        callback();
      }
    };

    module.constructor.keyboard = function(callback) {
      window.onkeydown = function(event) {
        var key = event.which || event.keyCode;
        keyboard[key] = true;
      };

      window.onkeyup = function(event) {
        var key = event.which || event.keyCode;
        keyboard[key] = false;
      };

      if (typeof callback === 'function') {
        callback();
      }
    };

    // factory
    module.factory = (function() {
      var Worker = function(options) {
        var self = this;
        self.args = Array.prototype.slice.call(arguments[0]);
        self.options = this.args.shift();

        // options
        self.map = self.options.map;
        self.func = self.options.func;
        self.step = self.options.step || module.TIME_STEP;

        // constructor
        var constructor = module.constructor[self.options.constructor];

        // callback
        var callback = self.options.callback || function() {
          // TODO: do this in a web worker if available?
          // init input loop, fixed time step in milliseconds
          setInterval(function() {
            module[self.func](self.map);
          }, self.step);
        };

        if (constructor) {
          constructor(callback);
        } else if (typeof callback === 'function') {
          callback();
        }

        return self;
      };

      return function() {
        return new Worker(arguments);
      };
    })();

    // return module
    return module;

  // loose augmentation
  })(window.Gyrocopter || {});

  // expose module to global scope
  window.Gyrocopter = Gyrocopter;

  // AMD module support
  if (typeof define === 'function' && define.amd) {
    define('gyrocopter', [], function() { return Gyrocopter; });
  }
})(window);

/*
window.Gyrocopter = (function(module) {
  module.input = function() {};
  return module;
})(window.Gyrocopter || {});
*/
