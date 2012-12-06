var game = {} || game;

(function() {
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
