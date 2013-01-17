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

  var remove = function(uuid) {
    this.local = _.filter(this.local, function(player) {
      return player !== uuid;
    });

    delete this.global[uuid];
  };

  var delta = function(store, data, callback) {

    // TODO: pass in set name as argument
    store.smembers('player', function(err, res) {
      var players = res;
      var length = players.length;

      async.forEach(
        players,
        function(uuid, callback) {
          // get delta for all players
          var player = players.global[uuid];

          if (player) {
            getDelta(store, data, uuid, player, callback);
          } else {
            // TODO: add player to global set on this server
            add(data, uuid, callback);
          }
        }, function() {
          // notify calling function that iterator has completed
          if (typeof callback === 'function') callback();
        }
      );
    });

  };

  var getDelta = function(store, data, uuid, player, callback) {

    // TODO: DRY THIS UP!!!
    // TODO: make this recursive????
    // defer to redis for absolute state, delta compression
    store.hgetall('player:' + uuid, function(err, res) {
      
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
      
      store.hgetall('ship:' + player.ship.uuid, function(err, res) {

        // save reference to old values and update state
        var prev = player.ship.state;

        // some scope issues with iterating over res and updating values individually?
        var next = player.ship.state = res;

        // error thrown here if init hasn't finished
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
                // save reference to old values and update state
                var prev = missile.state;

                // some scope issues with iterating over res and updating values individually?
                var next = missile.state = res;

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

              // only expire socket or browser session clients
              store.zadd('expire', Date.now(), 'player+' + uuid, function(err, res) {});
            
              // notify async that iterator has completed
              if (typeof callback === 'function') callback();
              
            }
          );
        }

      });

    });

  };

  var add = function(store, socket, uuid, callback) {

    store.hgetall('player:' + uuid, function(err, res) {
      // init player and add to global object
      this.global[uuid] = new Player(res);

      // notify async.forEach that function has completed
      if (typeof callback === 'function') callback();
    });

  };

  var initPlayer = function(io, socket, rc) {

    // init player
    var player = new Player();
    
    // send uuid to client
    io.sockets.socket(socket.id).emit('uuid', socket.uuid.toString());

    async.parallel(
      [
        function(callback) {
          // add player to redis set
          // init player state in redis
          rc.multi()
            .sadd('player', socket.uuid)
            .hset('parent', 'ship+' + player.ship.uuid, 'player+' + socket.uuid)
            .hmset('ship:' + player.ship.uuid, 
              'x', player.ship.x,
              'y', player.ship.y,
              'speed', player.ship.speed,
              'vx', player.ship.vx
            )
            .exec(function(err, res) {
              // notify async.parallel that recursion has completed
              if (typeof callback === 'function') callback();
            });
        },
        function(callback) {
          var missiles = player.ship.missiles;

          // init missiles
          async.forEach(
            missiles,
            function(missile, callback) {
              rc.multi()
                .hset('parent', 'missile+' + missile.uuid, 'ship+' + player.ship.uuid)
                .hmset('missile:' + missile.uuid,
                  'x', missile.x,
                  'y', missile.y,
                  'speed', missile.speed,
                  'vy', missile.vy,
                  'isLive', missile.isLive
                )
                .exec(
                  function(err, res) {
                    // notify async.forEach that recursion has completed
                    if (typeof callback === 'function') callback();
                  }
                );
            },
            function() {
              // notify async.parallel that recursion has completed
              if (typeof callback === 'function') callback();
            }
          );
        }
      ],
      function() {
        addPlayer(io, socket, rc, player);
      }
    );

  };

  // TODO: possible to make this recursive instead of explicit?
  var getPlayer = function(io, socket, rc) {

    // init player
    var player = new Player();
    
    // send uuid to client
    io.sockets.socket(socket.id).emit('uuid', socket.uuid.toString());

    // add player to redis set
    rc.sadd('player', socket.uuid, function(err, res) {

      rc.hgetall('parent', function(err, res) {
        var ships = res;
        var keys = Object.keys(ships);
        var length = keys.length;
        var key;

        for (var i = 0; i < length; i++) {
          key = keys[i];

          if (ships[key] === socket.uuid) {

            // set ship uuid
            player.ship.uuid = key;

            // get ship from redis
            rc.hgetall('ship:' + key, function(err, res) {

              player.ship.state = res;

              rc.hgetall('parent', function(err, res) {
                var missiles = res;
                var keys = Object.keys(missiles);
                var length = keys.length;
                var key;

                async.forEach(
                  keys,
                  function(key, callback) {
                    if (missiles[key] === player.ship.uuid) {

                      // get ship from redis
                      rc.hgetall('missile:' + key, function(err, res) {
                        var missile = res;

                        // set missile uuid
                        player.ship.missiles[missile.index].uuid = key;
                        player.ship.missiles[missile.index].state = missile;

                        // notify async.forEach that function has completed
                        if (typeof callback === 'function') callback();
                      });
                      
                    }
                  },
                  function() {
                    addPlayer(io, socket, rc, player);
                  }
                );

              });

            });
            
          }

        }

      });

    });

  };

  return {
    global: global,
    local: local,
    add: add,
    remove: remove,
    getDelta: getDelta
  };

});
