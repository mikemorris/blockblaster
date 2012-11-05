var game = {} || game;

var keymap = [
  {
    'keys': {
      'keyCode': 87,
      'altKey': false,
      'ctrlKey': false,
      'shiftKey': false
    },
    'command': 'forward'
  },
  {
    'keys': {
      'keyCode': 65,
      'altKey': false,
      'ctrlKey': false,
      'shiftKey': false
    },
    'command': 'left'
  },
  {
    'keys': {
      'keyCode': 83,
      'altKey': false,
      'ctrlKey': false,
      'shiftKey': false
    },
    'command': 'reverse'
  },
  {
    'keys': {
      'keyCode': 68,
      'altKey': false,
      'ctrlKey': false,
      'shiftKey': false
    },
    'command': 'right'
  }
];

var map = [
  {
    'axis': 'b',
    'positive': true,
    'command': 'forward'
  },
  {
    'axis': 'b',
    'positive': false,
    'command': 'reverse'
  },
  {
    'axis': 'g',
    'positive': false,
    'command': 'left'
  },
  {
    'axis': 'g',
    'positive': true,
    'command': 'right'
  }
];

(function() {
  var socket;

  var state = {
    x: 0,
    y: 0
  };

  var gyroscope;
  var accelerometer;

  var queue = {};
  queue.move = [];
  queue.physics = [];
  queue.animation = [];

  // get command from keybindings
  var binding = function(event) {
    var bind = _.find(keymap, function(keybind) {
      return keybind.keys.keyCode === event.keyCode &&
        keybind.keys.altKey === event.altKey &&
        keybind.keys.ctrlKey === event.ctrlKey &&
        keybind.keys.shiftKey === event.shiftKey;
    });

    if (bind !== undefined) {
      return bind.command;
    }
  };

  // get command from motion bindings
  var motion = function() {
    var last = queue.move.length - 1;
    var now = queue.move[0].gyroscope;
    var old = queue.move[last].gyroscope;

    var delta = [
      {
        key: 'a',
        value: now.alpha - old.alpha
      },
      {
        key: 'b',
        value: now.beta - old.beta
      },
      {
        key: 'g',
        value: now.gamma - old.gamma
      }
    ];

    var max = _.max(delta, function(axis) {
      var abs = Math.abs(axis.value);

      if (abs > 1) {
        return abs;
      }
    });

    if (max !== undefined) {
      var bind = _.find(map, function(binding) {
        return binding.axis === max.key &&
          binding.positive === (max.value > 0);
      });

      if (bind !== undefined) {
        return bind.command;
      }
    }
  };

  // TODO: replace with physics logic using dependency injection pattern
  var valid = function(command) {
    if(true) {
      return command;
    }
  };

  var physics = function() {
    if (gyroscope && accelerometer) {
      // create move object and add to physics queue
      var move = {
        time: Date.now(),
        gyroscope: gyroscope,
        accelerometer: accelerometer,
        state: state
      };

      // add move to queue, then trim queue to max size
      queue.move.unshift(move);
      queue.move = queue.move.slice(0, 10);

      // if motion, send command
      var command = motion();
      if (command !== undefined) {
        queue.physics.push({ data: command });
      }

      // update gyroscope display
      var a = Math.round(gyroscope.alpha);
      var b = Math.round(gyroscope.beta);
      var g = Math.round(gyroscope.gamma);

      // add plus sign to string for positive numbers
      if(a >= 0) { a = '+' + a}
      if(b >= 0) { b = '+' + b}
      if(g >= 0) { g = '+' + g}
      
      $('#gyroscope .alpha .value').text(a);
      $('#gyroscope .beta .value').text(b);
      $('#gyroscope .gamma .value').text(g);

      // update accelerometer display
      var x = Math.round(accelerometer.acceleration.x);
      var y = Math.round(accelerometer.acceleration.y);
      var z = Math.round(accelerometer.acceleration.z);

      // add plus sign to string for positive numbers
      if(x >= 0) { x = '+' + x}
      if(y >= 0) { y = '+' + y}
      if(z >= 0) { z = '+' + z}
      
      $('#accelerometer .x .value').text(x);
      $('#accelerometer .y .value').text(y);
      $('#accelerometer .z .value').text(z);
    }

    while (queue.physics.length) {
      var command = valid(queue.physics.shift());

      if (command !== undefined) {
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

        //queue.animation.push(command);
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

    socket.on('command:update', function (username, data) {
      //queue.animation.push({ data: data, username: username });
    });

    socket.on('state:update', function (data) {
      state = data;
      queue.animation.push(data);
    });

    // keybindings
    // TODO: switch input methods from push to pull?
    $(document).keydown(function(event) {
      // console.log(event);
      var command = binding(event);

      if (command !== undefined) {
        queue.physics.push({ data: command });
      }
    });

    window.ondeviceorientation = function(event) {
      gyroscope = event;
    }

    window.ondevicemotion = function(event) {
      accelerometer = event;
    }

    socket.emit('user:add', 'You');

    // init physics loop, fixed time step in milliseconds
    setInterval(physics, 15);

    // init animation loop, variable time step
    animation(new Clock());
  };
}).apply(game);

$(document).ready(function() {
  game.init();
});
