var socket = (function() {
  var module = {

    player: function(io, socket, rc, uid, game) {
      // store uid in the socket session for this client
      socket.uid = uid;
      
      // send uid to client
      io.sockets.socket(socket.id).emit('uid', uid.toString());

      // add player to redis set
      rc.sadd('players', uid, function(err, res) {
        // init player
        player = game.players[uid] = new game.Player(socket, rc);

        // TODO: send full player list to new connection
        // but only send new player to existing connections
        io.sockets.emit('players', game.players);
      });
    },

    init: function(app, redis, config, game) {
      var sio = require('socket.io'),
          RedisStore = sio.RedisStore,
          io = sio.listen(app);

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
              module.player(io, socket, rc, uid, game);
            });
          } else {
            rc.incr('players:uid:next', function(err, uid) {
              rc.multi()
                .set('player:' + uid, id)
                .set('uid:' + id, uid)
                .exec(function(err, res) {
                  module.player(io, socket, rc, uid, game);
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
            delete game.players[uid];

            io.sockets.emit('players:remove', uid);
          });
        });

      });

      return {
        io: io
      };
    },

  }

  return module;
});

module.exports = socket();
