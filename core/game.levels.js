(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js
    module.exports = factory({
      'Enemy': require('./types/game.Enemy.js')
    });
  } else if (typeof define === 'function' && define.amd) {
    // AMD
    define(factory);
  } else {
    // browser globals (root is window)
    root.GAME.returnExports = factory(root.GAME || {});
    // window.GAME.core = factory(window.GAME || {});
  }
})(this, function(game) {

  var players = {};

  // TODO: object by uuid instead of array?
  var npcs = [];

  var init = function(store) {
    this.loadEnemies(store);

    // TODO: init npcs in redis

    return this;
  };

  var loadEnemies = function(store) {
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
      (function(i, npcs) {
        var npc = enemies[i];
        var index = npcs.length;

        npcs.push(npc);

        // add npc to redis set
        store.rpush('npcs', index, function(err, res) {

          // TODO: iterate over all attributes of Player?
          var attr = 'npc:' + index + ':x';

          // init state in redis
          store.set(attr, npc.x, function(err, res) {});
        });
      })(i, this.npcs);
    }
  };

  return {
    players: players,
    npcs: npcs,
    init: init,
    loadEnemies: loadEnemies
  };

});
