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

  // uuid keys, npc object values
  var global = {};

  // array of uuids
  var local = [];

  var full = function(data, callback) {

    async.forEach(
      this.local,
      (function(uuid, callback) {
        var npc = this.global[uuid];
        data.npcs[uuid] = npc.getState();

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
        var npc = this.global[uuid];
        getDelta(data, this.local, uuid, npc, callback);
      }).bind(this), function() {
        // notify calling function that iterator has completed
        if (typeof callback === 'function') callback();
      }
    );

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

  var getDelta = function(data, local, uuid, npc, callback) {

    // save reference to old values and update state
    // WARN: clone produces shallow copy
    var prev = npc.state.public;
    var next = npc.state.public = _.clone(npc.state.private);

    // init delta array for changed keys
    var deltaKeys = [];

    // iterate over new values and compare to old
    var keys = Object.keys(next);
    var length = keys.length;
    var key;

    for (var i = 0; i < length; i++) {
      key = keys[i];

      // check for changed values and push key to delta array
      if (prev[key] !== next[key]) {
        deltaKeys.push(key);
      }
    }

    // set changed values in data object
    if (deltaKeys.length) {
      data.npcs[uuid] = {
        uuid: uuid,
        state: _.pick(next, deltaKeys)
      };
    }

    // notify async.forEach in updateNPCs that function has completed
    if (typeof callback === 'function') callback();

  };

  /*
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
  */

  return {
    global: global,
    local: local,
    full: full,
    delta: delta,
    remove: remove,
    getDelta: getDelta
  };

});
