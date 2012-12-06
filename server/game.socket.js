(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js
    module.exports = factory({
      'physics': require('./game.physics'),
      'levels': require('../core/game.levels'),
      'Player': require('../core/types/game.Player')
    });
  } else if (typeof define === 'function' && define.amd) {
    // AMD
    define(factory);
  } else {
    // browser globals (root is window)
    root.GAME.socket = factory(root.GAME || {});
  }
})(this, function(game) {

  var config = function(app, redis, sio, game) {
    var RedisStore = sio.RedisStore;
    var io = sio.listen(app);

    // turn off websocket debug spam
    io.set('log level', 1);

    // socket.io config
    io.configure(function() {
      io.set('store', new RedisStore({
        redisPub: game.redis.pub,
        redisSub: game.redis.sub,
        redisClient: game.redis.store
      }));
    });

    // TODO: scale this correctly to only remove players from offline servers
    // delete active player and NPC set
    // remove players who were still connected when server shut down
    game.redis.store.del('players', function(err, res) {});
    game.redis.store.del('npcs', function(err, res) {});

    return io;
  };

  var listen = function(redis, io, config) {
    // socket.io client event listeners
    io.sockets.on('connection', function(socket) {
      var player;

      // TODO: use permanent id if available (facebook/twitter user id, etc)
      var id = socket.id;

      // init redis client
      var rc = redis.createClient(config.redis.port, config.redis.host);
      rc.auth(config.redis.pass, function(err) {});

      // check if user already exists
      // TODO: irrelevant without permanent id
      rc.get('uid:' + id, function(err, res) {
        if (err) { throw err; }

        if (res !== null) {
          rc.get('player:' + res, function(err, uid) {
            addPlayer(io, socket, rc, uid);
          });
        } else {
          rc.incr('players:uid:next', function(err, uid) {
            rc.multi()
              .set('player:' + uid, id)
              .set('uid:' + id, uid)
              .exec(function(err, res) {
                addPlayer(io, socket, rc, uid);
              });
          });
        }
      });

      socket.on('command:send', function (command) {
        // add to server physics queue instead of immeadiately publishing
        command.uid = socket.uid;
        game.physics.queue.push(command);
      })
      .on('disconnect', function() {
        var uid = socket.uid;

        // remove player from redis set
        rc.srem('players', uid, function(err, res) {
          // close redis client
          rc.quit();

          // remove player from server
          delete game.levels.players[uid];

          io.sockets.emit('players:remove', uid);
        });
      });

    });
  };

  // TODO: entity id for enemies?
  var add = function(io, socket, rc, uid, game) {
    var data = {};
    data.uid = uid;
    data.player = game.levels.players[uid];

    // only send new player to existing connections
    io.sockets.emit('players:add', data);

    // send full player list to new connection
    io.sockets.socket(socket.id).emit('players', game.levels.players);
  };

  var addPlayer = function(io, socket, rc, uid) {
    // store uid in the socket session for this client
    socket.uid = uid;
    
    // send uid to client
    io.sockets.socket(socket.id).emit('uid', uid.toString());

    // add player to redis set
    rc.sadd('players', uid, function(err, res) {
      // init player
      var player = game.levels.players[uid] = new game.Player();

      // TODO: iterate over all attributes of Player?
      var attr = 'player:' + uid + ':ship:x';

      // broadcast players after redis sync
      // sync state to redis
      rc.get(attr, function(err, res) {
        if (err) { throw err; }

        // init state if not in redis already
        if (res !== null) {
          player.ship.x = res;
          add(io, socket, rc, uid, game);
        } else {
          rc.set(attr, player.ship.x, function(err, res) {
            add(io, socket, rc, uid, game);
          });
        }
      });
    });
  };

  var init = function(app, async, redis, sio, config, game) {
    var io = this.config(app, redis, sio, game);
    this.listen(redis, io, config);

    return {
      io: io
    };
  };

  return {
    config: config,
    listen: listen,
    add: add,
    addPlayer: addPlayer,
    init: init
  };

});
