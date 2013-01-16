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

  var remove = function(server, uuid, callback) {
    server.local = _.filter(server.local, function(npc) {
      return npc !== uuid;
    });

    if (server.global && server.global[uuid]) {
      delete server.global[uuid];
    }

    // notify async.forEach that function has completed
    if (typeof callback === 'function') callback();
  };

  var state = function(store, data, callback) {

    // TODO: pass in set name as argument
    store.smembers('npc', (function(err, res) {

      async.forEach(
        _.union(Object.keys(this.global), res),
        (function(uuid, callback) {
          // get delta for all players
          var npc = this.global[uuid];

          if (_.contains(res, uuid) && npc) {
            data.npcs[uuid] = npc.getState();

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
    store.smembers('npc', (function(err, res) {

      async.forEach(
        res,
        (function(uuid, callback) {
          // get delta for all npcs
          var npc = this.global[uuid];

          if (npc) {
            getDelta(store, data, this.local, uuid, npc, callback);
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

  var getDelta = function(store, data, local, uuid, npc, callback) {

    // defer to redis for absolute state, delta compression
    store.hgetall('npc:' + uuid, (function(err, res) {

      // dont update if state is expired
      if (res) {
        // save reference to old values and update state
        var prev = npc.state;

        // some scope issues with iterating over res and updating values individually?
        var next = npc.state = res;

        if (next) {
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
                npc.vy = next[key];
              }

              if (key === 'isHit') {
                npc.isHit = true;
              }
            }
          }

          // set changed values in data object
          if (delta.length) {
            data.npcs[uuid] = _.pick(next, delta);
          }

          // notify async.forEach in updateNPCs that function has completed
          if (typeof callback === 'function') callback();

        }
      }

    }).bind(this));

  };

  var add = function(store, data, global, uuid, callback) {

    store.hgetall('npc:' + uuid, function(err, res) {
      if (res) {
        // init npc and add to global object
        var npc = global[uuid] = new Enemy(parseInt(res.x), parseInt(res.y), parseInt(res.direction), uuid);

        var state = npc.getState();

        // don't pass undefined state
        if (state) {
          data.npcs[uuid] = state;
        }
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
