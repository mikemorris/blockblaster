var game = {} || game;

(function() {
  var socket;

  var state = {
    x: 0,
    y: 0
  };

  var id = 0;

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
    while (queue.physics.length) {
      var command = valid(queue.physics.shift());

      // TODO: state is absolute, but events are relative?
      if (command !== undefined) {
        // create move object and add to physics queue
        var move = {
          time: Date.now(),
          id: command.id,
          data: command.data
        };

        switch(command.data) {
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

        // add move to queue, then trim queue to max size
        queue.move.push(move);

        // console.log(command);
        socket.emit('command:send', command);
      }
    }

    queue.animation.push(state);
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

      // TODO: add delta time interpolation
      render(queue.animation.pop());
      queue.animation = [];
    }
  };

  this.init = function() {
    socket = io.connect();

    socket.on('chat:update', function (username, data) {
      $('#conversation').append('<p><strong>' + username + ':</strong> ' + data + '</p>');
    });

    socket.on('state:update', function (data) {
      // TODO: use this value for replay, but dont expose to animation loop yet?
      state = data.state;

      if (data.ack) {
        // remove most recent processed move and all older moves from queue
        queue.move = queue.move.filter(function(el, index, array) {
          return el.id > data.ack;
        });

        for (var i = 0; i < queue.move.length; i++) {
          queue.physics.push(queue.move[i]);
        }
      }
    });

    socket.emit('user:add', 'You');

    document.addEventListener('gyrocopter', function(event) {
      var command = {};
      command.data = event.detail.direction;
      command.id = id++;

      queue.physics.push(command);
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

    // init physics loop, fixed time step in milliseconds
    setInterval(physics, 15);

    // init animation loop, variable time step
    animation(new Clock());
  };
}).apply(game);

$(document).ready(function() {
  game.init();
});
