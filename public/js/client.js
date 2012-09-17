var game = {} || game;

var keymap = [
  {
    'keys': {
      'keyCode': 119,
      'altKey': false,
      'ctrlKey': false,
      'shiftKey': false
    },
    'command': 'forward'
  },
  {
    'keys': {
      'keyCode': 97,
      'altKey': false,
      'ctrlKey': false,
      'shiftKey': false
    },
    'command': 'left'
  },
  {
    'keys': {
      'keyCode': 115,
      'altKey': false,
      'ctrlKey': false,
      'shiftKey': false
    },
    'command': 'reverse'
  },
  {
    'keys': {
      'keyCode': 100,
      'altKey': false,
      'ctrlKey': false,
      'shiftKey': false
    },
    'command': 'right'
  }
];

(function() {
  var socket;

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
        console.log('invalid');
      } else {
        console.log(command);
        socket.emit('command:send', command);
        queue.animation.push(command);
      }
    }
  };

  var render = function(action) {
    var username = action.username;
    var data = action.data;

    if (username !== undefined) {
      $('#action').html(username + ': ' + data);
      console.log('server: ', data)
    } else {
      $('#action').html(data);
      console.log('client: ', data)
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

    $(document).keypress(function(event) {
      var command = binding(event);

      if (command !== undefined) {
        queue.physics.push({ data: command });
      }
    });

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
