var game = {} || game;

(function() {
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

  var id = 0;

  var queue = {};
  queue.input = [];
  queue.move = [];
  // queue.animation = [];

  // TODO: replace with physics logic using dependency injection pattern
  // TODO: check for collisions and cheating (moving too quickly) here
  // TODO: pass in game object/player (with defined acceleration) instead of just deltas?
  var valid = function(dx, dy) {
    // set dx and dy to max value allowed
    return {dx: dx, dy: dy};
  };

  // physics loop
  var physics = function() {
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

      // add client prediction to animation queue
      client.x += dx;
      client.y += dy;
      // queue.animation.push(client);

      // add move to queue, then send to server
      queue.move.push(move);
      socket.emit('command:send', move);
    }
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
      render(client);
      // queue.animation = [];
    }
  };

  this.init = function() {
    socket = io.connect();

    socket.on('chat:update', function (username, data) {
      $('#conversation').append('<p><strong>' + username + ':</strong> ' + data + '</p>');
    });

    socket.on('state:update', function (data) {
      var vector;
      var dx = 0;
      var dy = 0;

      // TODO: server reconciliation for MY data,
      // entity interpolation for THEIR data

      // server reconciliation
      // TODO: use this value for replay, but dont expose to animation loop yet?
      state = data.state;

      if (data.ack) {
        // remove most recent processed move and all older moves from queue
        queue.move = queue.move.filter(function(el, index, array) {
          return el.id > data.ack;
        });

        for (var i = 0; i < queue.move.length; i++) {
          vector = queue.move[i].data;
          dx += vector.dx;
          dy += vector.dy;
        }
      }

      // update client position with reconciled prediction
      client.x = parseInt(state.x) + dx;
      client.y = parseInt(state.y) + dy;
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
    setInterval(physics, 15);

    // init animation loop, variable time step
    animation(new Clock());
  };
}).apply(game);

$(document).ready(function() {
  game.init();
});
