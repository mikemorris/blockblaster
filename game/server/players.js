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

  // TODO: abstract into entities?

  // uuid keys, player object values
  var global = {};

  // array of uuids
  var local = [];

  var set = function(player, uuid, move) {

    // calculate delta time vector
    var vector = core.getVelocity(move.input);

    var vx = parseInt(move.data.speed * time.delta * vector.dx);
    var vy = parseInt(move.data.speed * time.delta * vector.dy);

    player.ship.state.private.x += vx;
    player.ship.state.private.y += vy;

    if(move.input.spacebar) {
      player.ship.fire();
    } else {
      player.ship.fireButtonReleased = true;
    }

    // update ack
    if (move.seq > player.ack) {
      player.state.private.ack = move.seq;
    }

  };

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

        data.players[uuid] = player.getState();

        // notify async.forEach that function has completed
        if (typeof callback === 'function') callback();
      }).bind(this), function() {
        // notify calling function that iterator has completed
        if (typeof callback === 'function') callback();
      }
    );

  };

  var delta = function(store, data, callback) {

    async.forEach(
      this.local,
      (function(uuid, callback) {
        // get delta for all players
        var player = this.global[uuid];

        if (player) {
          getDelta(store, data, this.local, uuid, player, callback);
        } else {
          // add player to global object
          add(store, data, this.global, uuid, callback);
        }
      }).bind(this), function() {
        // notify calling function that iterator has completed
        if (typeof callback === 'function') callback();
      }
    );

  };

  var getDelta = function(store, data, local, uuid, player, callback) {

    var delta = {};

    // PLAYER
    // save reference to old values and update state
    // WARN: clone produces shallow copy
    var prev = player.state.public;
    var next = player.state.public = _.clone(player.state.private);

    // init delta array for changed keys
    var deltaKeys = [];

    // iterate over new values and compare to old
    var keys = Object.keys(next);
    var length = keys.length;
    var key;

    for (var i = 0; i < length; i++) {
      key = keys[i];

      // check for changed values and push key to deltaKeys array
      if (prev[key] !== next[key]) {
        deltaKeys.push(key);
      }
    }

    // set changed values in data object
    if (deltaKeys.length > 0) {
      delta.state = _.pick(next, deltaKeys);
    }

    // SHIP
    // save reference to old values and update state
    // WARN: clone produces shallow copy
    prev = player.ship.state.public;
    next = player.ship.state.public = _.clone(player.ship.state.private);

    // init delta array for changed keys
    deltaKeys = [];

    // iterate over new values and compare to old
    keys = Object.keys(next);
    length = keys.length;
    key;

    for (var j = 0; j < length; j++) {
      key = keys[j];

      // check for changed values and push key to deltaKeys array
      if (prev[key] !== next[key]) {
        deltaKeys.push(key);
      }
    }

    // set changed values in data object
    if (deltaKeys.length) {
      delta.ship = {};
      delta.ship.state = _.pick(next, deltaKeys);
    }

    // MISSILES
    // init missiles
    var missiles = {};

    // iterate over missiles
    async.forEach(
      player.ship.missiles,
      function(missile, callback) {
        // save reference to old values and update state
        // WARN: clone produces shallow copy
        var prev = missile.state.public;
        var next = missile.state.public = _.clone(missile.state.private);

        // init delta array for changed keys
        var deltaKeys = [];

        // iterate over new values and compare to old
        var keys = Object.keys(next);
        var length = keys.length;
        var key;

        for (var k = 0; k < length; k++) {
          key = keys[k];

          // check for changed values and push key to deltaKeys array
          if (prev[key] !== next[key]) {
            deltaKeys.push(key);
          }
        }

        // set changed values in data object
        if (deltaKeys.length) {
          var deltaMissile = {};
          deltaMissile.state = _.pick(next, deltaKeys);
          missiles[missile.uuid] = deltaMissile;
        }

        // notify async.forEach that iterator has completed
        if (typeof callback === 'function') callback();
      },
      function() {
        if (Object.keys(missiles).length) {
          delta.ship = delta.ship || {};
          delta.ship.missiles = missiles;
        }

        // set changed values in data object
        if (Object.keys(delta).length) {
          delta.time = Date.now();
          data.players[uuid] = delta;
        }

        // notify async that iterator has completed
        if (typeof callback === 'function') callback();
      }
    );
  };

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

  return {
    global: global,
    local: local,
    add: add,
    remove: remove,
    state: state,
    delta: delta,
    getDelta: getDelta
  };

});
