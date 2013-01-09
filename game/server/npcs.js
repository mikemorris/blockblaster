(function(root, factory) {
  if (typeof exports === 'object') {
    // Node.js
    module.exports = factory(
      require('../core/types/Enemy'),
      require('async'),
      require('redis'),
      require('underscore')
    );
  }
})(this, function(Enemy, async, redis, _) {

  // TODO: abstract into entities?

  // uuid keys, npc object values
  var global = {};

  // array of uuids
  var local = [];

  var set = function(npc, uuid, move) {

    // calculate delta time vector
    var vector = core.getVelocity(move.input);

    var vx = parseInt(move.data.speed * time.delta * vector.dx);
    var vy = parseInt(move.data.speed * time.delta * vector.dy);

    // pipe valid commands directly to redis
    // passing a negative value to redis.incrby() decrements
    if (vx !== 0) {
      store.hincrby('ship:' + npc.ship.uuid, 'x', vx, function(err, res) {
        npc.ship.x = res;
      });
    }

    if (vy !== 0) {
      store.hincrby('ship:' + npc.ship.uuid, 'y', vy, function(err, res) {
        npc.ship.y = res;
      });
    }

    if(move.input.spacebar) {
      npc.ship.fire(store, function(uuid, delta) {
        var keys = Object.keys(delta);
        var length = keys.length;
        var key;

        for (var i = 0; i < length; i++) {
          key = keys[i];
          store.hset('missile:' + uuid, key, delta[key], function(err, res) {});
        }
      });
    } else {
      npc.ship.fireButtonReleased = true;
    }

    // update ack
    if (move.seq > npc.ack) {
      store.hset('npc:' + uuid, 'ack', move.seq, function(err, res) {
        npc.ack = res;
      });
    }

  };

  var remove = function(uuid) {
    this.local = _.filter(this.local, function(npc) {
      return npc !== uuid;
    });

    delete this.global[uuid];
  };

  var delta = function(store, data, callback) {

    // TODO: pass in set name as argument
    store.smembers('npc', function(err, res) {

      async.forEach(
        res,
        function(uuid, callback) {
          // get delta for all npcs
          var npc = npcs.global[uuid];

          if (npc) {
            getDelta(store, data, uuid, npc, callback);
          } else {
            // TODO: add npc to global set on this server
            add(store, uuid, callback);
          }
        }, function() {
          // notify calling function that iterator has completed
          if (typeof callback === 'function') callback();
        }
      );
    });

  };

  var getDelta = function(store, data, uuid, npc, callback) {

    // defer to redis for absolute state, delta compression
    store.hgetall('npc:' + uuid, (function(err, res) {

      // save reference to old values and update state
      var prev = npc.state;

      // some scope issues with iterating over res and updating values individually?
      var next = npc.state = res;

      // init delta array for changed keys
      var delta = [];

      // iterate over new values and compare to old
      var keys = Object.keys(next);
      var length = keys.length;
      var key;

      for (var i = 0; i < length; i++) {
        key = keys[i];

        // check for changed values and push key to delta array
        if (prev[key] !== next[key]) {
          delta.push(key);

          if (key === 'vy') {
            this.global[uuid].vy = next[key];
          }

          if (key === 'isHit') {
            this.global[uuid].isHit = true;
          }
        }
      }

      // set changed values in data object
      if (delta.length) {
        data.npcs[uuid] = _.pick(next, delta);
      }

      // expire all NPCs to clean redis on server crash
      store.zadd('expire', Date.now(), 'npc+' + uuid, function(err, res) {});

      // notify async.forEach in updateNPCs that function has completed
      if (typeof callback === 'function') callback();

    }).bind(this));

  };

  var add = function(store, uuid, callback) {

    store.hgetall('npc:' + uuid, (function(err, res) {
      if (res) {
        var npc = res;
        var x = parseInt(npc.x);
        var y = parseInt(npc.y);
        var direction = parseInt(npc.direction);

        // init npc and add to global object
        this.global[uuid] = new Enemy(x, y, direction, uuid);
      }

      // notify async.forEach that function has completed
      if (typeof callback === 'function') callback();
    }).bind(this));

  };

  var initEnemy = function(io, socket, rc) {

    // init npc
    var npc = new Enemy();
    
    // send uuid to client
    io.sockets.socket(socket.id).emit('uuid', socket.uuid.toString());

    async.parallel(
      [
        function(callback) {
          // add npc to redis set
          // init npc state in redis
          rc.multi()
            .sadd('npc', socket.uuid)
            .hset('parent', 'ship+' + npc.ship.uuid, 'npc+' + socket.uuid)
            .hmset('ship:' + npc.ship.uuid, 
              'x', npc.ship.x,
              'y', npc.ship.y,
              'speed', npc.ship.speed,
              'vx', npc.ship.vx
            )
            .exec(function(err, res) {
              // notify async.parallel that recursion has completed
              if (typeof callback === 'function') callback();
            });
        },
        function(callback) {
          var missiles = npc.ship.missiles;

          // init missiles
          async.forEach(
            missiles,
            function(missile, callback) {
              rc.multi()
                .hset('parent', 'missile+' + missile.uuid, 'ship+' + npc.ship.uuid)
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
        addEnemy(io, socket, rc, npc);
      }
    );

  };

  // TODO: possible to make this recursive instead of explicit?
  var getEnemy = function(io, socket, rc) {

    // init npc
    var npc = new Enemy();
    
    // send uuid to client
    io.sockets.socket(socket.id).emit('uuid', socket.uuid.toString());

    // add npc to redis set
    rc.sadd('npc', socket.uuid, function(err, res) {

      rc.hgetall('parent', function(err, res) {
        var ships = res;
        var keys = Object.keys(ships);
        var length = keys.length;
        var key;

        for (var i = 0; i < length; i++) {
          key = keys[i];

          if (ships[key] === socket.uuid) {

            // set ship uuid
            npc.ship.uuid = key;

            // get ship from redis
            rc.hgetall('ship:' + key, function(err, res) {

              npc.ship.state = res;

              rc.hgetall('parent', function(err, res) {
                var missiles = res;
                var keys = Object.keys(missiles);
                var length = keys.length;
                var key;

                async.forEach(
                  keys,
                  function(key, callback) {
                    if (missiles[key] === npc.ship.uuid) {

                      // get ship from redis
                      rc.hgetall('missile:' + key, function(err, res) {
                        var missile = res;

                        // set missile uuid
                        npc.ship.missiles[missile.index].uuid = key;
                        npc.ship.missiles[missile.index].state = missile;

                        // notify async.forEach that function has completed
                        if (typeof callback === 'function') callback();
                      });
                      
                    }
                  },
                  function() {
                    addEnemy(io, socket, rc, npc);
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
