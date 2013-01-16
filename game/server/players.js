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

    // pipe valid commands directly to redis
    // passing a negative value to redis.incrby() decrements
    if (vx !== 0) {
      store.hincrby('ship:' + player.ship.uuid, 'x', vx, function(err, res) {
        player.ship.x = res;
      });
    }

    if (vy !== 0) {
      store.hincrby('ship:' + player.ship.uuid, 'y', vy, function(err, res) {
        player.ship.y = res;
      });
    }

    if(move.input.spacebar) {
      player.ship.fire(store, function(uuid, delta) {
        var keys = Object.keys(delta);
        var length = keys.length;
        var key;

        for (var i = 0; i < length; i++) {
          key = keys[i];
          store.hset('missile:' + uuid, key, delta[key], function(err, res) {});
        }
      });
    } else {
      player.ship.fireButtonReleased = true;
    }

    // update ack
    if (move.seq > player.ack) {
      store.hset('player:' + uuid, 'ack', move.seq, function(err, res) {
        player.ack = res;
      });
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

  var state = function(store, data, callback) {

    // TODO: pass in set name as argument
    store.smembers('player', (function(err, res) {

      async.forEach(
        _.union(Object.keys(this.global), res),
        (function(uuid, callback) {
          // get delta for all players
          var player = this.global[uuid];

          if (_.contains(res, uuid) && player) {
            data.players[uuid] = player.getState();

            // notify async.forEach that function has completed
            if (typeof callback === 'function') callback();
          } else if (_.contains(res, uuid)) {
            // add player to global object
            add(store, data, this.global, uuid, callback);
          } else {
            remove(this, uuid, callback);
          }
        }).bind(this), function() {
          // notify calling function that iterator has completed
          if (typeof callback === 'function') callback();
        }
      );
    }).bind(this));

  };

  var delta = function(store, data, callback) {

    // TODO: pass in set name as argument
    store.smembers('player', (function(err, res) {

      async.forEach(
        res,
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

    }).bind(this));

  };

  var getDelta = function(store, data, local, uuid, player, callback) {

    // TODO: DRY THIS UP!!!
    // TODO: make this recursive????
    // defer to redis for absolute state, delta compression
    store.hgetall('player:' + uuid, function(err, res) {
      
      if (res) {
        var delta = {};

        // save reference to old values and update state
        var prev = player.state;

        // some scope issues with iterating over res and updating values individually?
        var next = player.state = res || {};

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
        
        store.hgetall('ship:' + next.ship, function(err, res) {

          if (res) {
            // save reference to old values and update state
            var prev = player.ship.state;

            // some scope issues with iterating over res and updating values individually?
            var next = player.ship.state = res;

            if (next) {

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
              if (deltaKeys.length) {
                delta.ship = {};
                delta.ship.state = _.pick(next, deltaKeys);
              }

              // init missiles
              var missiles = {};

              // iterate over missiles
              async.forEach(
                player.ship.missiles,
                function(missile, callback) {

                  store.hgetall('missile:' + missile.uuid, function(err, res) {

                    if (res) {
                      // save reference to old values and update state
                      var prev = missile.state;

                      // some scope issues with iterating over res and updating values individually?
                      var next = missile.state = res;

                      if (next) {
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
                        if (deltaKeys.length) {
                          var deltaMissile = {};
                          deltaMissile.state = _.pick(next, deltaKeys);
                          missiles[missile.uuid] = deltaMissile;
                        }
                      }
                    }

                    // notify async.forEach that iterator has completed
                    if (typeof callback === 'function') callback();

                  });

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
            } else {
              // set changed values in data object
              if (Object.keys(delta).length) {
                delta.time = Date.now();
                data.players[uuid] = delta;
              }

              // notify async.forEach that iterator has completed
              if (typeof callback === 'function') callback();
            }
          } else {
            // notify async.forEach that iterator has completed
            if (typeof callback === 'function') callback();
          }

        });
      } else {
        // notify async.forEach that iterator has completed
        if (typeof callback === 'function') callback();
      }

    });

  };

  var add = function(store, data, global, uuid, callback) {

    store.hgetall('player:' + uuid, function(err, res) {
      if (res) {
        // init player and add to global object
        var player = global[uuid] = new Player(res);

        // add player state to data object
        data.players[uuid] = player.getState();
      }

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
