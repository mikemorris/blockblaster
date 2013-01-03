(function(root, factory) {
  if (typeof exports === 'object') {
    // Node.js
    module.exports = factory(
      require('../core/types/Enemy.js')
    );
  }
})(this, function(Enemy) {

  var players = {};
  var npcs = {};

  var loadEnemies = function(socket, store) {

    var enemies = [
      new Enemy(100, 25),
      new Enemy(250, 25),
      new Enemy(400, 25),
      new Enemy(550, 25),
      new Enemy(700, 25),
      new Enemy(100, 80, -1),
      new Enemy(250, 80, -1),
      new Enemy(400, 80, -1),
      new Enemy(550, 80, -1),
      new Enemy(700, 80, -1)
    ];

    var length = enemies.length;

    for (var i = 0; i < length; i++) {
      // closure to iterate properly
      (function(i) {
        var npc = enemies[i];
        var uuid = npc.uuid;

        // add npc to redis set
        // and init npc redis state hash
        store.multi()
          .sadd('npc', npc.uuid)
          .hmset(
            'npc:' + npc.uuid, 
            'x', npc.x,
            'y', npc.y,
            'speed', npc.speed,
            'vx', npc.vx,
            'direction', npc.direction
          )
          .zadd('expire', Date.now(), 'npc+' + npc.uuid)
          .exec(function(err, res) {
            console.log(err, res);
            // add npc to server object
            npcs[uuid] = npc;
            socket.io.sockets.emit('npc:add', npc.getState());
          });
      })(i);
    }

    // release lock
    store.del('lock:npc', function(err, res) {
      console.log('lock released');
    });
  };

  return {
    players: players,
    npcs: npcs,
    loadEnemies: loadEnemies
  };

});
