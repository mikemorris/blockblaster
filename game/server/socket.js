(function(root, factory) {
  if (typeof exports === 'object') {
    // Node.js
    module.exports = factory(
      require('./update'),
      require('./players'),
      require('./npcs'),
      require('../core/types/Player'),
      require('async'),
      require('redis'),
      require('socket.io'),
      require('node-uuid'),
      require('../../config')
    );
  }
})(this, function(update, players, npcs, Player, async, redis, sio, uuid, config) {

  var init = function(app, channel) {
    var io = sio.listen(app);

    // turn off websocket debug spam
    io.set('log level', 1);

    listen(io);

    return {
      io: io
    };

  };

  var listen = function(io) {

    // socket.io client event listeners
    io.sockets.on('connection', function(socket) {

      // switch from socket.id to Connect sessions?
      var player = new Player();
      
      // set uuid and send to client
      player.uuid = uuid.v4();
      socket.emit('uuid', player.uuid);

      addPlayer(socket, player);

    });

  };

  var addPlayer = function(socket, player) {

    // add player to server object
    players.global[player.uuid] = player;
    players.local.push(player.uuid);

    // TODO: trigger full state update

    socket.on('command:send', function(command) {
      // add to server physics queue instead of immeadiately publishing
      players.global[player.uuid].ship.queue.input.push(command);
    });

    socket.on('disconnect', function() {
      // remove player from server
      players.remove(players, player.uuid);
    });

  };

  return {
    init: init
  };

});
