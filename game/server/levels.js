(function(root, factory) {
  if (typeof exports === 'object') {
    // Node.js
    module.exports = factory(
      require('./npcs'),
      require('../core/types/Enemy.js'),
      require('async')
    );
  }
})(this, function(npcs, Enemy, async) {

  var loadEnemies = function() {

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

    var npc;
    var uuid;

    for (var i = 0; i < length; i++) {
      npc = enemies[i];
      uuid = npc.uuid;

      npcs.global[uuid] = npc;
      npcs.local.push(uuid);
    }

  };

  return {
    loadEnemies: loadEnemies
  };

});
