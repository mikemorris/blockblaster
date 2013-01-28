(function(root, factory) {
  if (typeof exports === 'object') {
    // Node.js
    module.exports = factory(
      require('../core/types/Player'),
      require('async'),
      require('redis'),
      require('underscore')
    );
  }
})(this, function(Player, async, redis, _) {

  // uuid keys, player object values
  var global = {};

  // array of uuids
  var local = [];

  var remove = function(server, uuid, callback) {
    server.local = _.filter(server.local, function(player) {
      return player !== uuid;
    });

    if (server.global && server.global[uuid]) {
      delete server.global[uuid];
    }

    // notify async.forEach that function has completed
    if (typeof callback === 'function') callback();
  };

  var state = function(data, callback) {

    async.forEach(
      this.local,
      (function(uuid, callback) {
        var player = this.global[uuid];
        var state;

        if (player) {
          state = player.getState();
        }

        if (state) {
          data.players[uuid] = state;
        }

        // notify async.forEach that function has completed
        if (typeof callback === 'function') callback();
      }).bind(this), function() {
        // notify calling function that iterator has completed
        if (typeof callback === 'function') callback();
      }
    );

  };

  var delta = function(data, callback) {

    async.forEach(
      this.local,
      (function(uuid, callback) {
        var player = this.global[uuid];
        var delta;

        if (player) {
          delta = player.getDelta(async, _);
        }

        if (delta) {
          data.players[uuid] = delta;
        }

        // notify async.forEach that function has completed
        if (typeof callback === 'function') callback();
      }).bind(this), function() {
        // notify calling function that iterator has completed
        if (typeof callback === 'function') callback();
      }
    );

  };

  /*
  var getMissile = function(store, player, uuid, callback) {

    store.hgetall('missile:' + uuid, function(err, res) {

      if (res) {
        // init missile
        var missile = player.ship.missiles[uuid] = {};
        missile.uuid = uuid;
        missile.state = res;
      }

      // notify async.forEach that iterator has completed
      if (typeof callback === 'function') callback();

    });

  };

  var getShip = function(store, player, uuid, callback) {

    store.hgetall('ship:' + uuid, function(err, res) {
      if (res) {
        // init ship
        var ship = player.ship = {};
        ship.uuid = uuid;
        ship.state = res;
        ship.missiles = {};

        store.hgetall('parent', function(err, res) {
          if (res) {
            var children = res;
            var keys = Object.keys(children);
            var child;

            async.forEach(
              keys,
              function(key, callback) {
                if (children[key].split('+')[1] === uuid) {

                  var child = key.split('+');
                  var childSet = child[0];
                  var childKey = child[1];

                  if (childSet === 'missile') {
                    getMissile(store, player, childKey, callback);
                  }
                } else {
                  // notify async.forEach that recursion has completed
                  if (typeof callback === 'function') callback();
                }
              }, 
              function() {
                if (typeof callback === 'function') callback();
              }
            );
          }
        });

      }
    });

  };

  var getPlayer = function(store, uuid, callback) {

    store.hgetall('player:' + uuid, function(err, res) {
      if (res) {
        var player = res;

        getShip(store, player, player.ship, function() {
          callback(player);
        });
      }
    });

  };

  var add = function(store, data, global, uuid, callback) {

    getPlayer(store, uuid, function(player) {
      // init player and add to global object
      global[uuid] = new Player(player);

      // add player state to data object
      data.players[uuid] = global[uuid].getState();

      // notify async.forEach that function has completed
      if (typeof callback === 'function') callback();
    });

  };
  */

  return {
    global: global,
    local: local,
    state: state,
    delta: delta,
    remove: remove
  };

});
