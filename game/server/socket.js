(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js
    module.exports = factory(
      {
        'physics': require('./physics'),
        'levels': require('./levels'),
        'Player': require('../core/types/Player')
      },
      require('async'),
      require('redis'),
      require('socket.io'),
      require('../../config')
    );
  }
})(this, function(game, async, redis, sio, config) {

  var init = function(app, channel) {
    var RedisStore = sio.RedisStore;
    var io = sio.listen(app);

    // turn off websocket debug spam
    io.set('log level', 1);

    // socket.io config
    io.configure(function() {
      io.set('store', new RedisStore({
        redis: redis,
        redisPub: channel.pub,
        redisSub: channel.sub,
        redisClient: channel.store
      }));
    });

    // TODO: scale this correctly to only remove players from offline servers
    // delete active player and NPC set
    // remove players who were still connected when server shut down
    channel.store.del('players', function(err, res) {});

    this.listen(io);

    return {
      io: io
    };
  };

  var listen = function(io) {

    // socket.io client event listeners
    io.sockets.on('connection', function(socket) {
      var player;

      // TODO: use permanent id if available (facebook/twitter user id, etc)
      var id = socket.id;

      // init redis client
      var rc = redis.createClient(config.redis.port, config.redis.host);
      rc.auth(config.redis.password, function(err) { if (err) throw err; });

      // check if user already exists
      // TODO: irrelevant without permanent id
      rc.get('uid:' + id, function(err, res) {
        if (err) { throw err; }

        if (res !== null) {
          rc.get('player:' + res, function(err, uid) {
            initPlayer(io, socket, rc, uid);
          });
        } else {
          rc.incr('players:uid:next', function(err, uid) {
            rc.multi()
              .set('player:' + uid, id)
              .set('uid:' + id, uid)
              .exec(function(err, res) {
                initPlayer(io, socket, rc, uid);
              });
          });
        }
      });

      socket.on('command:send', function (command) {
        // add to server physics queue instead of immeadiately publishing
        game.levels.players[socket.uid].queue.push(command);
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

  var addPlayer = function(io, socket, rc, uid, player) {

    // add player to server object
    game.levels.players[uid] = player;

    // init data object and attach player uid
    var data = {};
    data.uid = uid;

    // init player
    data.player = player.getState();

    // only send new player to existing connections
    io.sockets.emit('players:add', data);

    var players = {};
    var keys = Object.keys(game.levels.players);
    var key;
    var player;

    for (var i = 0; i < keys.length; i++) {
      key = keys[i];
      player = game.levels.players[key];
      players[key] = player.getState();
    }

    // send full player list to new connection
    io.sockets.socket(socket.id).emit('players', players);
    io.sockets.socket(socket.id).emit('npcs', game.levels.npcs);

  };

  var initPlayer = function(io, socket, rc, uid) {

    // init player
    var player = new game.Player();

    // store uid in the socket session for this client
    socket.uid = uid;
    
    // send uid to client
    io.sockets.socket(socket.id).emit('uid', uid.toString());

    // add player to redis set
    // and init npc redis state hash
    rc.sadd('players', uid, function(err, res) {

      // check previous state for returning players
      rc.hgetall('player:' + uid + ':ship', function(err, res) {

        if (res === null) {
          // init state if not in redis already
          rc.hmset(
            'player:' + uid + ':ship', 
            'x', player.ship.x,
            'y', player.ship.y,
            'speed', player.ship.speed,
            'vx', player.ship.vx,
            function(err, res) {
              addPlayer(io, socket, rc, uid, player);
            }
          );
        } else {
          // otherwise, set state from redis
          player.ship.state = res;
          addPlayer(io, socket, rc, uid, player);
        }
      });

    });

  };

  return {
    listen: listen,
    addPlayer: addPlayer,
    initPlayer: initPlayer,
    init: init
  };

});
