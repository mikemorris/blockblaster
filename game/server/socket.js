(function(root, factory) {
  if (typeof exports === 'object') {
    // Node.js
    module.exports = factory(
      require('./update'),
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
})(this, function(update, players, npcs, Player, async, redis, sio, uuid, config) {

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

      // switch from socket.id to Connect sessions?
      // TODO: use permanent id if available (facebook/twitter user id, etc)
      var facebook;
      var twitter;

      // init redis client
      var rc = redis.createClient(config.redis.port, config.redis.host);
      rc.auth(config.redis.auth, function(err) { if (err) throw err; });

      // check if user already exists
      // accepting facebook or twitter logins
      // TODO: only set for permanent id, break out into function
      // TODO: break out getPlayer function to get existing player
      // TODO: rc.get('twitter:' + twitterID, function(err, res) {});
      if (facebook) {
        /*
        rc.get('facebook:' + FBid, function(err, res) {
          if (err) { throw err; }

          if (res !== null) {
            rc.get('player:' + res, function(err, res) {
              // get uuid
              player.uuid = res;

              initPlayer(socket, rc);
            });
          } else {
            // set uuid
            player.uuid = uuid.v4();

            // init player in redis
            rc.multi()
              .set('player:' + player.uuid, id)
              .set('uid:' + id, player.uuid)
              .exec(function(err, res) {
                initPlayer(socket, rc);
              });
          }
        });
        */
      } else {
        initPlayer(socket, rc);
      }

    });

  };

  var addPlayer = function(socket, rc, player) {

    // add player to server object
    players.global[player.uuid] = player;
    players.local.push(player.uuid);

    // TODO: trigger full state update

    socket.on('command:send', function(command) {
      // add to server physics queue instead of immeadiately publishing
      players.global[player.uuid].queue.push(command);
    });

    socket.on('disconnect', function() {
      // remove player from server
      players.remove(players, player.uuid);
    });

  };

  var initPlayer = function(socket, rc) {

    // init player
    var player = new Player();
    
    // set uuid and send to client
    player.uuid = uuid.v4();
    socket.emit('uuid', player.uuid);

    addPlayer(socket, rc, player);

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
  /*
  var getPlayer = function(io, socket, rc) {

    // init player
    var player = new Player();
    
    // send uuid to client
    io.sockets.socket(socket.id).emit('uuid', player.uuid.toString());

    // add player to redis set
    rc.sadd('player', player.uuid, function(err, res) {

      rc.hgetall('parent', function(err, res) {
        var ships = res;
        var keys = Object.keys(ships);
        var length = keys.length;
        var key;

        for (var i = 0; i < length; i++) {
          key = keys[i];

          if (ships[key] === player.uuid) {

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
                    addPlayer(socket, player);
                  }
                );

              });

            });
            
          }

        }

      });

    });

  };
  */

  return {
    init: init
  };

});
