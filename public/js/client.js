var game = {} || game;

(function() {
  this.init = function() {
    var socket = io.connect();

    socket.on('user:update', function (data) {
      console.log(data);
      $('#users').empty();
      $.each(data, function(key, value) {
        $('#users').append('<div>' + value + '</div>');
      });
    });

    socket.on('chat:update', function (username, data) {
      $('#conversation').append('<p><strong>' + username + ':</strong> ' + data + '</p>');
    });

    socket.on('disconnect', function () {
      alert('Disconnected');
    });

    $('#data').keypress(function(e) {
      if(e.which == 13) {
        var message = $('#data').val();
        $('#data').val('');

        socket.emit('chat:send', message);
      }
    });

    socket.emit('user:add', prompt("What's your name?"));
  };

  this.physics = function() {
    console.log('PHYSICS');
  };

  this.loop = function(clock) {
    requestAnimationFrame(function() {
      game.loop(clock);
    });

    if(clock) {
      clock.tick();

      // time in milliseconds since last frame
      console.log('dt: ', clock.dt);
    }
  };
}).apply(game);

$(document).ready(function() {
  // physics loop, fixed time step in milliseconds
  setInterval(game.physics, 15);

  // animation loop, variable time step
  game.loop(new Clock());
});
