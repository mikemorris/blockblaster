var app = require('http').createServer(handler);

var redis = require('redis');
var sio = require('socket.io'),
    RedisStore = sio.RedisStore,
    io = sio.listen(app);

var fs = require('fs');
var config = require('./config');

// http config
app.listen(config.port);
console.log('Server started, listening on port ' + config.port);

function handler(req, res) {
  fs.readFile(__dirname + '/index.html',
  function (err, data) {
    if (err) {
      res.writeHead(500);
      return res.end('Error loading index.html');
    }

    res.writeHead(200);
    res.end(data);
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

// socket.io config
io.configure(function() {
  io.set('store', new RedisStore({ redisPub: pub, redisSub: sub, redisClient: store }));
});

// socket.io client event listeners
io.sockets.on('connection', function (socket) {
  var rc = redis.createClient(port, host);
  rc.auth(pass, function(err) {});

  var publishUsers = function() {
    // publish updated user list
    rc.smembers('users', function(err, res) {
      // update the list of users in chat, client-side
      io.sockets.emit('user:update', res);
    });
  };

  var publishChat = function(message) {
    rc.hgetall(message, function(err, res) {
      console.log(res);
      rc.hget('user:' + res.uid, 'name', function(err, username) {
        io.sockets.emit('chat:update', username, res.text);
      });
    });
  };

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
