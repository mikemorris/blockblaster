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
      require('node-uuid'),
      require('../../config')
    );
  }
})(this, function(game, async, redis, sio, uuid, config) {

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

      // switch from socketid to Connect sessions?
      // TODO: use permanent id if available (facebook/twitter user id, etc)
      var id;

      // init redis client
      var rc = redis.createClient(config.redis.port, config.redis.host);
      rc.auth(config.redis.password, function(err) { if (err) throw err; });

      // check if user already exists
      // TODO: only set for permanent id, break out into function
      // accepting facebook or twitter logins
      if (id) {
        rc.get('uid:' + id, function(err, res) {
          if (err) { throw err; }

          if (res !== null) {
            rc.get('player:' + res, function(err, res) {
              // get uuid
              socket.uuid = res;

              initPlayer(io, socket, rc);
            });
          } else {
            // set uuid
            socket.uuid = uuid.v4();

            // init player in redis
            rc.multi()
              .set('player:' + socket.uuid, id)
              .set('uid:' + id, socket.uuid)
              .exec(function(err, res) {
                initPlayer(io, socket, rc);
              });
          }
        });
      } else {
        // set uuid
        socket.uuid = uuid.v4();

        // init session player in redis
        rc.set('player:' + socket.uuid, socket.id, function(err, res) {
          initPlayer(io, socket, rc);
        });
      }

      socket.on('command:send', function (command) {
        // add to server physics queue instead of immeadiately publishing
        game.levels.players[socket.uuid].queue.push(command);
      })
      .on('disconnect', function() {
        var uuid = socket.uuid;

        // remove player from redis set (only if session client)
        // TODO: save if permanent login
        rc.srem('players', uuid, function(err, res) {

          // delete player and ship from redis
          rc.del('player:' + uuid, 'player:' + uuid + ':ship', function(err, res) {
            // close redis client
            rc.quit();

            // remove player from server
            delete game.levels.players[uuid];

            io.sockets.emit('players:remove', uuid);
          });

        });

      });

    });

  };

  var addPlayer = function(io, socket, rc, player) {

    // add player to server object
    game.levels.players[socket.uuid] = player;

    // init data object and attach player uid
    var data = {};
    data.uuid = socket.uuid;

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

  var initPlayer = function(io, socket, rc) {

    // init player
    var player = new game.Player();
    
    // send uuid to client
    io.sockets.socket(socket.id).emit('uuid', socket.uuid.toString());

    // add player to redis set
    // and init npc redis state hash
    rc.sadd('players', socket.uuid, function(err, res) {

      // check previous state for returning players
      rc.hgetall('player:' + socket.uuid + ':ship', function(err, res) {

        if (res === null) {
          // init state if not in redis already
          rc.hmset(
            'player:' + socket.uuid + ':ship', 
            'x', player.ship.x,
            'y', player.ship.y,
            'speed', player.ship.speed,
            'vx', player.ship.vx,
            function(err, res) {
              addPlayer(io, socket, rc, player);
            }
          );
        } else {
          // otherwise, set state from redis
          player.ship.state = res;
          addPlayer(io, socket, rc, player);
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
