(function(root, factory) {
  if (typeof exports === 'object') {
    // Node.js
    module.exports = factory(
      require('async'),
      require('redis'),
      require('underscore')
    );
  }
})(this, function(async, redis, _) {

	var Collection = function() {
    // uuid keys, object values
    this.global = {};

    // array of uuids
    this.local = [];

    return this;
	};


  Collection.prototype.add = function(entity) {
    this.global[entity.uuid] = entity;
    this.local = entity.uuid;
  };

  Collection.prototype.remove = function(uuid, callback) {
    server.local = _.filter(this.local, function(entity) {
      return entity !== uuid;
    });

    if (this.global && this.global[uuid]) {
      delete this.global[uuid];
    }

    // notify async.forEach that function has completed
    if (typeof callback === 'function') callback();
  };

  Collection.prototype.state = function(data, callback) {
    async.forEach(
      this.local,
      (function(uuid, callback) {
        var entity = this.global[uuid];
        var state;

        if (entity) {
          state = entity.getState();
        }

        if (state) {
          data[uuid] = state;
        }

        // notify async.forEach that function has completed
        if (typeof callback === 'function') callback();
      }).bind(this), function() {
        // notify calling function that iterator has completed
        if (typeof callback === 'function') callback();
      }
    );
  };

  Collection.prototype.delta = function(data, callback) {
    async.forEach(
      this.local,
      (function(uuid, callback) {
        var entity = this.global[uuid];
        var delta;

        if (entity) {
          state = entity.getDelta(async, _);
        }

        if (delta) {
          data[uuid] = delta;
        }

        // notify async.forEach that function has completed
        if (typeof callback === 'function') callback();
      }).bind(this), function() {
        // notify calling function that iterator has completed
        if (typeof callback === 'function') callback();
      }
    );
  };

  return Collection;

});

