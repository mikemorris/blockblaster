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

(function() {
  var socket;

  var state = {
    x: 0,
    y: 0
  };

  var queue = {};
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

  // TODO: replace with physics logic using dependency injection pattern
  var valid = function(command) {
    if(true) {
      return command;
    }
  };

  var physics = function() {
    while (queue.physics.length > 0) {
      var command = valid(queue.physics.shift());

      if (command === undefined) {
        // console.log('invalid');
      } else {
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
        queue.animation.push({ state: state });

        // console.log(command);
        socket.emit('command:send', command);
      }
    }
  };

  var render = function(action) {
    var username = action.username;
    var data = action.data;
    var state = action.state;

    if (state) {
      $('#panel').css({transform: 'rotateX('+ state.x +'deg) rotateY('+ state.y +'deg)'});
    }

    // authoritative, data from server
    if (username !== undefined) {
      $('#action').html(username + ': ' + data);
      // console.log('server: ', data)
    }

    // prosepctive, data from client
    else {
      $('#action').html(data);
      // console.log('client: ', state)
    }
  };

  var animation = function(clock) {
    requestAnimationFrame(function() {
      animation(clock);
    });

    if(clock) {
      clock.tick();

      // time in milliseconds since last frame
      // console.log('dt: ', clock.dt);

      // process animation queue
      while (queue.animation.length > 0) {
        var action = queue.animation.shift();
        render(action);
      }
    }
  };

  this.init = function() {
    socket = io.connect();

    socket.on('chat:update', function (username, data) {
      $('#conversation').append('<p><strong>' + username + ':</strong> ' + data + '</p>');
    });

    socket.on('command:update', function (username, data) {
      queue.animation.push({ data: data, username: username });
    });

    socket.on('state:update', function (data) {
      // console.log(data);
      state = data;
      queue.animation.push({ state: state });
    });

    // keybindings
    $(document).keydown(function(event) {
      // console.log(event);
      var command = binding(event);

      if (command !== undefined) {
        queue.physics.push({ data: command });
      }
    });

    window.ondeviceorientation = function(event) {
      var a = Math.round(event.alpha);
      var b = Math.round(event.beta);
      var g = Math.round(event.gamma);

      // add plus sign to string for positive numbers
      if(a >= 0) { a = '+' + a}
      if(b >= 0) { b = '+' + b}
      if(g >= 0) { g = '+' + g}
      
      $('#gyroscope .alpha .value').text(a);
      $('#gyroscope .beta .value').text(b);
      $('#gyroscope .gamma .value').text(g);
    }

    window.ondevicemotion = function(event) {
      var x = Math.round(event.acceleration.x);
      var y = Math.round(event.acceleration.y);
      var z = Math.round(event.acceleration.z);

      // add plus sign to string for positive numbers
      if(x >= 0) { x = '+' + x}
      if(y >= 0) { y = '+' + y}
      if(z >= 0) { z = '+' + z}
      
      $('#accelerometer .x .value').text(x);
      $('#accelerometer .y .value').text(y);
      $('#accelerometer .z .value').text(z);
    }

    socket.emit('user:add', prompt("What's your name?"));

    // init physics loop, fixed time step in milliseconds
    setInterval(physics, 15);

    // init animation loop, variable time step
    animation(new Clock());
  };
}).apply(game);

$(document).ready(function() {
  game.init();
});
