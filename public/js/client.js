var game = {} || game;

(function() {
  var socket;

  var state = {
    x: 0,
    y: 0
  };

  var queue = {};
  queue.move = [];
  queue.physics = [];
  queue.animation = [];

  // TODO: replace with physics logic using dependency injection pattern
  var valid = function(command) {
    if(true) {
      return command;
    }
  };

  var physics = function() {
    // create move object and add to physics queue
    var move = {
      time: Date.now(),
      state: state
    };

    // add move to queue, then trim queue to max size
    queue.move.unshift(move);
    queue.move = queue.move.slice(0, 10);

    while (queue.physics.length) {
      var command = valid(queue.physics.shift());

      if (command !== undefined) {
        switch(command) {
          case 'forward':
            state.x++;
            break;
          case 'reverse':
            state.x--;
            break;
          case 'left':
            state.y++;
            break;
          case 'right':
            state.y--;
            break;
        }

        queue.animation.push(state);

        // console.log(command);
        socket.emit('command:send', command);
      }
    }
  };

  var render = function(state) {
    if (state) {
      $('#panel').css({transform: 'rotateX('+ state.x +'deg) rotateY('+ state.y +'deg)'});
    }
  };

  var animation = function(clock) {
    requestAnimationFrame(function() {
      animation(clock);
    });

    if(clock) {
      clock.tick();

      // process animation queue
      while (queue.animation.length) {
        render(queue.animation.shift());
      }
    }
  };

  this.init = function() {
    socket = io.connect();

    socket.on('chat:update', function (username, data) {
      $('#conversation').append('<p><strong>' + username + ':</strong> ' + data + '</p>');
    });

    socket.on('state:update', function (data) {
      state = data;
      queue.animation.push(data);
    });

    socket.emit('user:add', 'You');

    document.addEventListener('gyrocopter', function(event) {
      queue.physics.push(event.detail.direction);
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
        'left': [65, 37], // [ A, Left ]
        'right': [68, 39] // [ D, Right ]
      },
      'func': 'keyboard'
    });

    // init physics loop, fixed time step in milliseconds
    setInterval(physics, 15);

    // init animation loop, variable time step
    animation(new Clock());
  };
}).apply(game);

$(document).ready(function() {
  game.init();
});
