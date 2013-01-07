(function(root, factory) {
  if (typeof exports === 'object') {
    // Node.js
    module.exports = factory(
      require('./players'),
      require('./levels'),
      require('async'),
      require('redis'),
      require('underscore')
    );
  }
})(this, function(players, levels, async, redis, _) {

  var init = function(socket, store) {

    // init server update loop, fixed time step in milliseconds
    setInterval((function() {
      this.loop(socket, store);
    }).bind(this), 45);

    return this;

  };

  var updatePlayers = function(socket, store, data, callback) {

    store.smembers('player', function(err, res) {
      async.forEach(
        res,
        function(uuid, callback) {
          // publish delta updates for all players
          // to all players connected to this server
          var player = players.global[uuid];

          if (player) {
            players.getDelta(store, data, uuid, player, callback);
          } else {
            // TODO: add player to global set
            console.log('players.add', uuid, Date.now());
            players.add(store, socket, uuid, callback);
          }
        }, function() {
          // notify async that iterator has completed
          if (typeof callback === 'function') callback();
        }
      );
    });

  };

  var updateNPCs = function(store, data, callback) {

    // iterate over all npcs in redis
    // TODO: should this just iterate over server NPCs instead?
    store.smembers('npc', function(err, res) {
      var npcs = res;
      var length = npcs.length;

      // don't return until all updateNPC calls have completed
      async.forEach(
        npcs,
        function(uuid, callback) {
          // only publish updates for NPCs originating from this server
          var npc = levels.npcs[uuid];

          if (npc) {
            updateNPC(store, data, npc, uuid, callback);
          } else {
            // notify async.forEach that function has completed
            if (typeof callback === 'function') callback();
          }
        }, function() {
          // notify async.parallel in loop that iterator has completed
          if (typeof callback === 'function') callback();
        }
      );
    });

  };

  var updatePlayer = function(store, data, uuid, player, callback) {

    var delta = {};

    // acknowledge most recent processed command and clear array
    // TODO: get ack from redis???
    if (player.processed.length) {
      delta.ack = _.max(player.processed);
      player.processed = [];
    }

    // TODO: DRY THIS UP!!!
    // TODO: make this recursive????
    // defer to redis for absolute state, delta compression
    store.hgetall('player:' + uuid, function(err, res) {

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
              // TODO: get missile state from redis
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

  var updateNPC = function(store, data, npc, uuid, callback) {

    // defer to redis for absolute state, delta compression
    store.hgetall('npc:' + uuid, function(err, res) {

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

    });

  };

  var update = function(socket, data) {

    // server time stamp
    data.time = Date.now();

    console.log(data);

    /*
    var keys = Object.keys(data.players);
    var key;

    for (var i = 0; i < keys.length; i++) {
      key = keys[i];
      if (data.players[key].ship && data.players[key].ship.missiles) {
        console.log(data.players[key].ship.missiles);
      }
    }
    */

    // return delta object to client
    socket.io.sockets.emit('state:update', data);

  };

  var loop = function(socket, store) {

    // create data object containing
    // authoritative state and last processed input id
    var data = {};
    data.players = {};
    data.npcs = {};

    // get updated states from redis, then return delta object to client
    async.parallel([
      function(callback) { updatePlayers(socket, store, data, callback) },
      function(callback) { updateNPCs(store, data, callback) }
    ], function() {
      update(socket, data);
    });

  };

  return {
    init: init,
    updatePlayers: updatePlayers,
    updateNPCs: updateNPCs,
    loop: loop
  };

});
