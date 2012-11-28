var physics = (function() {
  var module = {

    // init physics time
    time: {
      then: Date.now()
    },

    // commands to be processed
    queue: [],

    // processed command ids for client ack
    processed: [],

    init: function(game) {
      // init physics loop, fixed time step in milliseconds
      setInterval(function() {
        module.loop(game);
      }, 15);

      return module;
    },
    
    loop: function(game) {
      var store = game.redis.store;

      // TODO: integrate into game.client.setDelta?
      module.time.now = Date.now();
      module.time.delta = (module.time.now - module.time.then) / 1000;
      module.time.then = module.time.now;

      // no input to process
      if (!module.queue.length) return;

      (function iterate(move) {
        process.nextTick(function() {
          var vector;
          var vx;
          var vy;

          // calculate delta time vector
          vector = game.core.getVelocity(move.input);

          vx = parseInt(move.data.speed * module.time.delta * vector.dx);
          vy = parseInt(move.data.speed * module.time.delta * vector.dy);

          // pipe valid commands directly to redis
          // passing a negative value to redis.incrby() decrements
          if (vx !== 0) {
            store.incrby('player:' + move.uid + ':ship:x', vx, function(err, res) {});
          }

          if (vy !== 0) {
            store.incrby('player:' + move.uid + ':ship:y', vy, function(err, res) {});
          }

          // shift ack state to queue
          module.processed.push(move.seq);

          // if queue empty, stop looping
          if (!module.queue.length) return;
          iterate(module.queue.shift());
        });
      })(module.queue.shift());
    }

  }

  return module;
});

module.exports = physics();
