(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js
    module.exports = factory({
      'Enemy': require('../core/types/Enemy.js')
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
  var npcs = {};

  var init = function(store) {
    this.loadEnemies(store);

    return this;
  };

  var loadEnemies = function(store) {
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
      (function(i, npcs) {
        var npc = enemies[i];
        var uuid = npc.state.uuid;

        npcs[uuid] = npc;

        // add npc to redis set
        store.sadd('npcs', uuid, function(err, res) {

          // TODO: iterate over all attributes of Player?
          var attr = 'npc:' + uuid + ':x';

          // init state in redis
          store.set(attr, npc.state.x, function(err, res) {});
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
