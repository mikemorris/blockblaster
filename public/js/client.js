var game = {} || game;

(function() {
  // constants
  // physics loop time step constant (milliseconds)
  var TIME_STEP = game.timestep || 15;

  // entity interpolation time offset constant (seconds)
  var OFFSET = (game.offset || 100) / 1000;

  // entity interpolation buffer size, frames * seconds
  var BUFFER_SIZE = game.buffersize || 120;

  // variables
  var socket;

  // authoritative from server
  var state = {
    x: 0,
    y: 0
  };

  // client prediction
  // TODO: array of positions? splice to update?
  var client = {
    x: 0,
    y: 0
  };

  // track time.server and time.client
  var time = {};

  var id = 0;

  var queue = {};
  queue.input = [];
  queue.move = [];
  queue.server = [];

  // linear interpolation
  var lerp = function(prev, next, time) {
    var _prev = Number(prev);
    var _next = Number(next);
    var _time = Number(time);

    _time = (Math.max(0, Math.min(1, _time)));
    var position = parseInt(_prev + (_time * (_next - _prev)));

    return position;
  };

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

  // server reconciliation
  var reconcile = function(data) {
    var vector;
    var dx = 0;
    var dy = 0;

    // remove most recent processed move and all older moves from queue
    queue.move = queue.move.filter(function(el, index, array) {
      return el.id > data.ack;
    });

    for (var i = 0; i < queue.move.length; i++) {
      vector = queue.move[i].data;
      dx += vector.dx;
      dy += vector.dy;
    }

    // update client position with reconciled prediction
    client.x = parseInt(state.x) + dx;
    client.y = parseInt(state.y) + dy;
  };

  // TODO: replace with physics logic using dependency injection pattern
  // TODO: check for collisions and cheating (moving too quickly) here
  // TODO: pass in game object/player (with defined acceleration) instead of just deltas?
  var valid = function(dx, dy) {
    // set dx and dy to max value allowed
    return {
      dx: dx,
      dy: dy
    };
  };

  // takes array of inputs and returns a velocity vector
  var velocity = function(input) {
    // return change as vector, delta x and delta y
    var dx = 0;
    var dy = 0;

    var length = input.length;
    for (var i = 0; i < length; i++) {
      switch(input[i].data) {
        case 'forward':
          dx++;
          break;
        case 'reverse':
          dx--;
          break;
        case 'left':
          dy++;
          break;
        case 'right':
          dy--;
          break;
      }
    }

    return valid(dx, dy);
  };

  // physics loop
  var physics = function() {
    // process input
    if (queue.input.length) {
      // get velocity vector from input in queue, then clear queue
      var vector = velocity(queue.input);
      queue.input = [];

      var dx = vector.dx;
      var dy = vector.dy;

      if (dx || dy) {
        // create move object
        var move = {
          time: Date.now(),
          id: id++,
          data: vector
        };

        // update client position with predicted state
        client.x += dx;
        client.y += dy;

        // add move to queue, then send to server
        queue.move.push(move);
        socket.emit('command:send', move);
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

      // process server updates
      // interpolate position of other players
      interpolate();

      // TODO: add delta time interpolation
      render(client);
    }
  };

  this.init = function() {
    socket = io.connect();

    socket.on('chat:update', function (username, data) {
      $('#conversation').append('<p><strong>' + username + ':</strong> ' + data + '</p>');
    });

    socket.on('state:update', function (data) {
      time.server = data.time;
      time.client = time.server - OFFSET;

      if (data.state) {
        // authoritatively set internal state
        state.x = parseInt(data.state.x);
        state.y = parseInt(data.state.y);

        // queue server updates for entity interpolation
        queue.server.push(data);
        
        // splice array, keeping BUFFER_SIZE most recent items
        if (queue.server.length >= BUFFER_SIZE) {
          queue.server.splice(-BUFFER_SIZE);
        }
      }

      // reconcile client prediction
      if (data.ack) {
        reconcile(data);
      }
    });

    socket.emit('user:add', 'You');

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

    // init physics loop, fixed time step in milliseconds
    setInterval(physics, TIME_STEP);

    // init animation loop, variable time step
    animation(new Clock());
  };
}).apply(game);

$(document).ready(function() {
  game.init();
});
