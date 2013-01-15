(function(root, factory) {
  if (typeof exports === 'object') {
    // Node.js
    module.exports = factory(
      require('./players'),
      require('./npcs'),
      require('../core/types/Player'),
      require('async'),
      require('redis'),
      require('socket.io'),
      require('node-uuid'),
      require('../../config')
    );
  }
})(this, function(players, npcs, Player, async, redis, sio, uuid, config) {

  var init = function(app, channel) {
    var RedisStore = sio.RedisStore;
    var io = sio.listen(app);

    // turn off websocket debug spam
    io.set('log level', 1);

    listen(io);

    return {
      io: io,
      destroyChildren: destroyChildren
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
      rc.auth(config.redis.auth, function(err) { if (err) throw err; });

      // check if user already exists
      // TODO: only set for permanent id, break out into function
      // accepting facebook or twitter logins
      if (id) {
        // TODO: break out getPlayer function to get existing player
        // TODO: rc.get('facebook:' + FBid, function(err, res) {});
        // TODO: rc.get('twitter:' + twitterID, function(err, res) {});
        /*
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
        */
      } else {
        // set uuid
        socket.uuid = uuid.v4();
        initPlayer(io, socket, rc);

        // init session player in redis
        /*
        rc.set('player:' + socket.uuid, socket.id, function(err, res) {
        });
        */
      }

      socket.on('command:send', function (command) {
        // add to server physics queue instead of immeadiately publishing
        players.global[socket.uuid].queue.push(command);
      })
      .on('disconnect', function() {
        var uuid = socket.uuid;

        // remove player and ship from redis set (only if session client)
        // TODO: save if permanent login
        rc.multi()
          .srem('player', uuid)
          .del('player:' + uuid)
          .exec(function(err, res) {

            destroyChildren(rc, uuid, function() {

              // close redis client
              rc.quit();

              // remove player from server
              players.remove(uuid);

              // emit player:destroy event to client
              io.sockets.emit('players:remove', uuid);
              
            });

          });

      });

    });

  };

  var addPlayer = function(io, socket, rc, player) {

    // add player to server object
    players.global[socket.uuid] = player;
    players.local.push(socket.uuid);

    // init data object and attach player uid
    var data = {};
    data.uuid = socket.uuid;

    // init player
    data.player = player.getState();

    // only send new player to existing connections
    io.sockets.emit('players:add', data);

    data = {};

    var keys = Object.keys(players.global);
    var length = keys.length;

    var key;
    var player;

    for (var i = 0; i < length; i++) {
      key = keys[i];
      player = players.global[key];
      data[key] = player.getState();
    }

    // send full player list to new connection
    io.sockets.socket(socket.id).emit('players', data);
    io.sockets.socket(socket.id).emit('npcs', npcs.global);

  };

  var initPlayer = function(io, socket, rc) {

    // init player
    var player = new Player();
    
    // send uuid to client
    io.sockets.socket(socket.id).emit('uuid', socket.uuid.toString());

    async.parallel(
      [
        function(callback) {
          // add player to redis set
          // init player state in redis
          rc.multi()
            .sadd('player', socket.uuid)
            .hset('player:' + socket.uuid, 'ship', player.ship.uuid)
            .hset('parent', 'ship+' + player.ship.uuid, 'player+' + socket.uuid)
            .hmset('ship:' + player.ship.uuid, 
              'x', player.ship.x,
              'y', player.ship.y,
              'speed', player.ship.speed,
              'vx', player.ship.vx
            )
            .exec(function(err, res) {
              // notify async.parallel that recursion has completed
              if (typeof callback === 'function') callback();
            });
        },
        function(callback) {
          var missiles = player.ship.missiles;

          // init missiles
          async.forEach(
            missiles,
            function(missile, callback) {
              rc.multi()
                .hset('parent', 'missile+' + missile.uuid, 'ship+' + player.ship.uuid)
                .hmset('missile:' + missile.uuid,
                  'x', missile.x,
                  'y', missile.y,
                  'speed', missile.speed,
                  'vy', missile.vy,
                  'isLive', missile.isLive
                )
                .exec(
                  function(err, res) {
                    // notify async.forEach that recursion has completed
                    if (typeof callback === 'function') callback();
                  }
                );
            },
            function() {
              // notify async.parallel that recursion has completed
              if (typeof callback === 'function') callback();
            }
          );
        }
      ],
      function() {
        addPlayer(io, socket, rc, player);
      }
    );

  };

  var destroyChildren = function(rc, id, callback) {
    rc.hgetall('parent', function(err, res) {
      if (res) {
        var children = res;
        var keys = Object.keys(children);
        var child;

        async.forEach(
          keys,
          function(key, callback) {

            if (children[key].split('+')[1] === id) {

              var child = key.split('+');
              var childSet = child[0];
              var childKey = child[1];

              // console.log(key);

              // delete reference from hash and set:key from redis
              // recursively destroy children
              rc.multi()
                .hdel('parent', key)
                .del(childSet + ':' + childKey)
                .exec(function(err, res) {
                  destroyChildren(rc, childKey, callback);
                });
              
            } else {
              // notify async.forEach that recursion has completed
              if (typeof callback === 'function') callback();
            }

          },
          function() {
            // notify async.forEach that recursion has completed
            if (typeof callback === 'function') callback();
          }
        );
      } else {
        // notify getChildren that recursion has completed
        if (typeof callback === 'function') callback();
      }
    });
  };

  // TODO: possible to make this recursive instead of explicit?
  var getPlayer = function(io, socket, rc) {

    // init player
    var player = new Player();
    
    // send uuid to client
    io.sockets.socket(socket.id).emit('uuid', socket.uuid.toString());

    // add player to redis set
    rc.sadd('player', socket.uuid, function(err, res) {

      rc.hgetall('parent', function(err, res) {
        var ships = res;
        var keys = Object.keys(ships);
        var length = keys.length;
        var key;

        for (var i = 0; i < length; i++) {
          key = keys[i];

          if (ships[key] === socket.uuid) {

            // set ship uuid
            player.ship.uuid = key;

            // get ship from redis
            rc.hgetall('ship:' + key, function(err, res) {

              player.ship.state = res;

              rc.hgetall('parent', function(err, res) {
                var missiles = res;
                var keys = Object.keys(missiles);
                var length = keys.length;
                var key;

                async.forEach(
                  keys,
                  function(key, callback) {
                    if (missiles[key] === player.ship.uuid) {

                      // get ship from redis
                      rc.hgetall('missile:' + key, function(err, res) {
                        var missile = res;

                        // set missile uuid
                        player.ship.missiles[missile.index].uuid = key;
                        player.ship.missiles[missile.index].state = missile;

                        // notify async.forEach that function has completed
                        if (typeof callback === 'function') callback();
                      });
                      
                    }
                  },
                  function() {
                    addPlayer(io, socket, rc, player);
                  }
                );

              });

            });
            
          }

        }

      });

    });

  };

  return {
    init: init
  };

});
