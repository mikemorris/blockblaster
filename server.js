var app = require('http').createServer(handler);

var static = require('node-static');
var _ = require('underscore');

var redis = require('redis');
var sio = require('socket.io'),
    RedisStore = sio.RedisStore,
    io = sio.listen(app);

var state = {
  x: 0,
  y: 0
};

var queue = {};
queue.physics = [];

var config = require('./config');

// http config
var file = new(static.Server)('./public');

app.listen(config.port);
console.log('Server started, listening on port ' + config.port);

function handler (req, res) {
  req.addListener('end', function () {
    file.serve(req, res);
  });
}

// redis client config
var port = config.redis.port,
    host = config.redis.host,
    pass = config.redis.password;

// redis client init
var pub = redis.createClient(port, host);
var sub = redis.createClient(port, host);
var store = redis.createClient(port, host);

// redis auth
pub.auth(pass, function(err) {});
sub.auth(pass, function(err) {});
store.auth(pass, function(err) {});

var publishUsers = function() {
  // publish updated user list
  store.smembers('users', function(err, res) {
    // update the list of users in chat, client-side
    io.sockets.emit('user:update', res);
  });
};

var publishCommand = function(message) {
  store.hgetall(message, function(err, res) {
    console.log(res);
    store.hget('user:' + res.uid, 'name', function(err, username) {
      io.sockets.emit('command:update', username, res.text);
    });
  });
};

var publishChat = function(message) {
  store.hgetall(message, function(err, res) {
    console.log(res);
    store.hget('user:' + res.uid, 'name', function(err, username) {
      io.sockets.emit('chat:update', username, res.text);
    });
  });
};

// socket.io config
io.configure(function() {
  io.set('store', new RedisStore({ redisPub: pub, redisSub: sub, redisClient: store }));
});

store.multi()
  .get('state:x')
  .get('state:y')
  .exec(function(err, res) {
    if(err) { throw err; }

    if(res[0] === null || res[1] === null) {
      var initState = store.multi();

      if(res[0] === null) {
        initState.set('state:x', state.x)
      }

      if(res[1] === null) {
        initState.set('state:y', state.y)
      }

      initState.exec(function(err, res) {
        io.sockets.emit('state:update', state);
      });
    }

    // state exists in redis
    else {
      var x = res[0];
      var y = res[1];

      state.x = x;
      state.y = y;

      console.log('state: ', state);

      io.sockets.emit('state:update', state);
    }
  });

// socket.io client event listeners
io.sockets.on('connection', function (socket) {
  var rc = redis.createClient(port, host);
  rc.auth(pass, function(err) {});

  io.sockets.emit('state:update', state);

  socket.on('user:add', function(username) {
    // add user to redis set
    rc.incr('users:uid:next', function(err, uid) {
      rc.multi()
      .hmset('user:' + uid, { name: username })
      .set('uid:' + username, uid)
      .sadd('users', username)
      .exec(function(err, res) {
        // store the username and uid in the socket session for this client
        socket.username = username;
        socket.uid = uid;

        // echo globally (all clients) that a person has connected
        io.sockets.emit('chat:update', 'SERVER', socket.username + ' has connected');

        publishUsers();
      });
    });
  })
  .on('command:send', function (command) {
    // add to server physics queue instead of immeadiately publishing
    queue.physics.push(command);

    /*
    rc.incr('commands:id:next', function(err, id) {
      console.log('commands:id:next '+ id);
      console.log('socket.uid: ', socket.uid);
      console.log('command.data: ', command.data);

      // TODO: integer.toString() fixes regression in node_redis 0.8.1
      rc.hmset('command:' + id, { uid: socket.uid.toString(), text: command.data }, function(err, res) {
        if(err) { throw err; }

        console.log('command:'+ id + ' '+ res);
      });
    });
    */
  })
  .on('chat:send', function (data) {
    rc.incr('messages:id:next', function(err, id) {
      rc.hmset('message:' + id, { uid: socket.uid, text: data }, function(err, res) {
        publishChat('message:' + id);
      });
    });
  })
  .on('disconnect', function() {
    socket.broadcast.emit('chat:update', 'SERVER', socket.username + ' has disconnected');

    // remove user from redis set
    rc.srem('users', socket.username, function(err, res) {
      publishUsers();
      rc.quit();
    });
  });
});

// TODO: replace with physics logic using dependency injection pattern
var valid = function(command) {
  if(true) {
    return command;
  }
};

// physics loop
var physics = function() {
  (function iterate(command) {
    process.nextTick(function() {
      command = valid(command);

      if (command !== undefined) {
        console.log(command);

        switch(command.data) {
          case 'forward':
            state.x++;
            break;
          case 'reverse':
            state.x--;
            break;
          case 'left':
            state.y++;
            break;
          case 'right':
            state.y--;
            break;
        }
      }

      // queue not empty, keep looping
      if (queue.physics.length) {
        return iterate(queue.physics.shift());
      }
    });
  })(queue.physics.shift());
};

// init physics loop, fixed time step in milliseconds
setInterval(physics, 15);

// update loop
var update = function() {
  store.multi()
    .get('state:x')
    .get('state:y')
    .exec(function(err, res) {
      var x = res[0];
      var y = res[1];

      // publish state if changed
      // TODO: publish delta state
      if(x != state.x || y != state.y) {
        store.multi()
          .set('state:x', state.x)
          .set('state:y', state.y)
          .exec(function(err, res) {
            console.log('state: ', state);
            io.sockets.emit('state:update', state);
          });
      }
    });
};

// init server update loop, fixed time step in milliseconds
setInterval(update, 45);
