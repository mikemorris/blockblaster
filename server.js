var app = require('http').createServer(handler);
var static = require('node-static');
var config = require('./config');

// require server game modules, init using dependency injection if required
var channel = require('./game/server/redis').init();
var socket = require('./game/server/socket').init(app, channel);

// load scene
// GAME.core.loadScene('levels').loadLevel(1);

// init expire loop
var expire = require('./game/server/expire.js').init(socket, channel.store);

// TODO: init server loops inside levels?
// require server loops
var physics = require('./game/server/physics').init(socket, channel.store);
var update = require('./game/server/update').init(socket, channel.store);

// http config
var file = new (static.Server)('./public');

// server config
app.listen(config.port);
console.log('Server started, listening on port ' + config.port);

function handler (req, res) {
  req.addListener('end', function () {
    file.serve(req, res);
  });
}

// TODO: use cluster for physics calculations
// to not block main thread?
var cluster = require('cluster');
console.log('CPUs:', require('os').cpus().length);
