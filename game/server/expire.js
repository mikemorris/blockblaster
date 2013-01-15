(function(root, factory) {
  if (typeof exports === 'object') {
    // Node.js
    module.exports = factory(
      require('./players.js'),
      require('./levels.js')
    );
  }
})(this, function(players, levels) {

  var init = function(socket, store) {
    setInterval((function() {
      this.loop(socket, store);
    }).bind(this), 1000);

    return this;
  };

  var loop = function(socket, store) {

    // purge expired set members and keys from redis
    store.zrangebyscore('expire', 0, Date.now() - 1000, function(err, res) {
      var items = res;
      var length = items.length;

      var item;
      var target;

      var set;
      var id;

      // iterate and purge!
      for (var i = 0; i < length; i++) {
        item = items[i];
        target = item.split('+');

        set = target[0];
        id = target[1];

        console.log('EXPIRE', set, id);

        // recursively delete all keys on set:member
        (function(set, id) {
          store.multi()
            .srem(set, id)
            .del(set + ':' + id)
            .zrem('expire', item)
            .exec(function(err, res) {
              if (set === 'player') {
                players.remove(id);
                socket.io.sockets.emit('players:remove', id);
              }
              
              socket.destroyChildren(store, id);
            });
        })(set, id);
      }
    });

    store.scard('npc', function(err, res) {
      // if no active npcs, attempt to set lock and loadEnemies
      if (!res) {

        // set lock to prevent thundering herd
        store.setnx('lock:npc', Date.now() + 1000, function(err, res) {
          if (res) {
            // no lock previously set, lock acquired
            levels.loadEnemies(store);
          } else {
            store.getset('lock:npc', Date.now() + 1000, function(err, res) {
              if (res < Date.now()) {
                // timestamp expired, lock acquired
                levels.loadEnemies(store);
              }
            });
          }
        });

      }
    });

  };

  return {
    init: init,
    loop: loop
  };

});
