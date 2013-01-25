(function(root, factory) {
  if (typeof exports === 'object') {
    // Node.js
    module.exports = factory(
      require('./npcs.js'),
      require('./levels.js')
    );
  }
})(this, function(npcs, levels) {

  var init = function(store) {
    setInterval((function() {
      loop(store);
    }).bind(this), 1000);

    return this;
  };

  var loop = function(store) {

    // if no active npcs, attempt to set lock and loadEnemies
    if (!npcs.local.length) {
      // set lock to prevent thundering herd
      store.setnx('lock:npc', Date.now() + 1000, function(err, res) {
        if (res) {
          // no lock previously set, lock acquired
          levels.loadEnemies();
        } else {
          store.getset('lock:npc', Date.now() + 1000, function(err, res) {
            if (res < Date.now()) {
              // timestamp expired, lock acquired
              levels.loadEnemies();
            }
          });
        }
      });
    }

  };

  return {
    init: init
  };

});
