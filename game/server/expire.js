(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js
    module.exports = factory(
      require('./levels.js')
    );
  }
})(this, function(levels) {

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

        // console.log('EXPIRE', set, id);

        // recursively delete all keys on set:member
        (function(set, id) {
          store.multi()
            .srem(set, id)
            .del(set + ':' + id)
            .zrem('expire', item)
            .exec(function(err, res) {
              socket.destroyChildren(store, id);
            });
        })(set, id);
      }
    });

    // TODO: running twice even on a single drone due to latency
    // could this trigger thundering herd problem with multiple drones?
    // use timestamp lock in redis to guarantee no race condition?
    store.scard('npc', function(err, res) {
      if (!res) {
        levels.loadEnemies(socket, store);
      }
    });

  };

  return {
    init: init,
    loop: loop
  };

});
