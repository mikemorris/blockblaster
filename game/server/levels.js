(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js
    module.exports = factory({
      'Enemy': require('../core/types/Enemy.js')
    });
  }
})(this, function(game) {

  var players = {};
  var npcs = {};

  var init = function(store) {
    this.loadEnemies(store);

    return this;
  };

  var loadEnemies = function(store) {
    // TODO: this shouldn't be necessary?
    store.del('npcs', function(err, res) {});

    var enemies = [
      new game.Enemy(100, 25),
      new game.Enemy(250, 25),
      new game.Enemy(400, 25),
      new game.Enemy(550, 25),
      new game.Enemy(700, 25),
      new game.Enemy(100, 80, -1),
      new game.Enemy(250, 80, -1),
      new game.Enemy(400, 80, -1),
      new game.Enemy(550, 80, -1),
      new game.Enemy(700, 80, -1)
    ];

    var length = enemies.length;

    for (var i = 0; i < length; i++) {
      // closure to iterate properly
      (function(i) {
        var npc = enemies[i];
        var uuid = npc.uuid;

        // add npc to server object
        npcs[uuid] = npc;
        console.log('loadEnemies', uuid, npc.y);

        // add npc to redis set
        // and init npc redis state hash
        store.multi()
          .sadd('npcs', npc.uuid)
          .hmset(
            'npc:' + npc.uuid, 
            'x', npc.x,
            'y', npc.y,
            'speed', npc.speed,
            'vx', npc.vx,
            'direction', npc.direction
          )
          .exec(function(err, res) {
            store.hgetall('npc:' + uuid, function(err, res) {
              console.log('redis', uuid, res.y);
            });
          });
      })(i);
    }
  };

  return {
    players: players,
    npcs: npcs,
    init: init,
    loadEnemies: loadEnemies
  };

});
