var app = require('http').createServer(handler);
var static = require('node-static');
var config = require('./config');

// require server game modules, init using dependency injection if required
var channel = require('./server/game.redis').init();
var socket = require('./server/game.socket').init(app, channel);

// load scene
// GAME.core.loadScene('levels').loadLevel(1);
var levels = require('./core/game.levels.js').init(channel.store);

// TODO: init server loops inside levels?
// require server loops
var physics = require('./server/game.physics').init(channel.store);
var update = require('./server/game.update').init(socket, channel.store);

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
