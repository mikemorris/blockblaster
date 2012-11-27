var game = {} || game;

(function() {
  // entity interpolation
  var interpolate = function() {
    // return if no server updates to process
    if (!queue.server.length) return;

    var target
    var previous;

    var count = queue.server.length - 1;

    var self;
    var next;

    for(var i = 0; i < count; i++) {
      self = queue.server[i];
      next = queue.server[i + 1];

      // if client offset time is between points, set target and break
      if(time.client > self.time && time.client < next.time) {
        target = self;
        previous = next;
        break;
      }
    }

    // no interpolation target found, snap to most recent state
    if(!target) {
      target = previous = queue.server[queue.server.length - 1];
    }

    // calculate client time percentage between previous and target points
    var time_point = 0;

    if (target.time !== previous.time) {
      var difference = target.time - time.client;
      var spread = target.time - previous.time;
      time_point = difference / spread;
    }

    client.x = lerp(previous.state.x, target.state.x, time_point);
    client.y = lerp(previous.state.y, target.state.y, time_point);
  };

  this.init = function() {
    document.addEventListener('gyrocopter', function(event) {
      var command = {};
      command.data = event.detail.direction;
      queue.input.push(command);
    });

    // gyroscope
    var g = Gyrocopter.factory({
      'constructor': 'gyroscope', // module.constructor.gyroscope
      'map': [
        [], // [ alphaPositive, alphaNegative ]
        ['forward', 'reverse'], // [ betaPositive, betaNegative ]
        ['left', 'right'] // [ gammaPositive, gammaNegative ]
      ],
      'func': 'motion' // module.motion
    });

    // keyboard
    var k = Gyrocopter.factory({
      'constructor': 'keyboard', // module.constructor.keyboard
      'map': {
        'forward': [87, 38], // [ W, Up ]
        'reverse': [83, 40], // [ S, Down ]
        'left': [68, 39], // [ D, Right ]
        'right': [65, 37] // [ A, Left ]
      },
      'func': 'keyboard'
    });
  };
}).apply(game);

$(document).ready(function() {
  game.init();
});
