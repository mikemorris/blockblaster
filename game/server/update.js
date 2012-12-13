(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js
    module.exports = factory(
      {
        'levels': require('./levels'),
        'physics': require('./physics'),
        'time': require('../core/time')
      },
      require('async'),
      require('redis'),
      require('underscore')
    );
  }
})(this, function(game, async, redis, _) {

  var init = function(socket, store) {

    // init server update loop, fixed time step in milliseconds
    setInterval((function() {
      this.loop(socket, store);
    }).bind(this), 45);

    return this;

  };

  var updatePlayers = function(store, data, callback) {

    store.smembers('players', function(err, res) {
      var players = res;
      var length = players.length;

      async.forEach(
        players,
        function(uid, callback) {
          // only publish updates for players originating from this server
          var player = game.levels.players[uid];

          if (player) {
            updatePlayer(store, data, uid, player, callback);
          } else {
            // notify async.forEach that function has completed
            if (typeof callback === 'function') callback();
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
    store.smembers('npcs', function(err, res) {
      var npcs = res;
      var length = npcs.length;

      // don't return until all updateNPC calls have completed
      async.forEach(
        npcs,
        function(uuid, callback) {
          // only publish updates for NPCs originating from this server
          var npc = game.levels.npcs[uuid];

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

  var updatePlayer = function(store, data, uid, player, callback) {

    var delta = {};

    // acknowledge most recent processed command and clear array
    // TODO: get ack from redis???
    if (player.processed.length) {
      delta.ack = _.max(player.processed);
      player.processed = [];
    }

    // TODO: DRY THIS UP!!!
    // defer to redis for absolute state, delta compression
    store.hgetall('player:' + uid, function(err, res) {

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

      store.hgetall('player:' + uid + ':ship', function(err, res) {

        // save reference to old values and update state
        var prev = player.ship.state;

        // some scope issues with iterating over res and updating values individually?
        var next = player.ship.state = res;

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
        var missiles = [];
        var missile;

        // iterate over missiles
        for (var i = 0; i < player.ship.missiles.length; i++) {
          missile = player.ship.missiles[i].getState();
          missiles.push(missile);
        }

        if (missiles) {
          delta.ship = delta.ship || {};
          delta.ship.missiles = missiles;
          // console.log(delta.ship.missiles);
        }

        // set changed values in data object
        if (Object.keys(delta).length) {
          delta.time = Date.now();
          data.players[uid] = delta;
        }

        // notify async that iterator has completed
        if (typeof callback === 'function') callback();
        
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
      if (data.players[key].ship) {
        console.log(data.players[key].ship);
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
      function(callback) { updatePlayers(store, data, callback) },
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
