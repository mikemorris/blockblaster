var app = require('http').createServer(handler);

var async = require('async');
var redis = require('redis');
var sio = require('socket.io');

var static = require('node-static');
var underscore = require('underscore');

var config = require('./config');

// init global game object
var GAME = {};

// TODO: merge this into Player module?
GAME.players = {};

// syncronously augment GAME.prototype
GAME = require('./core/types/game.Object')(GAME);
GAME = require('./core/types/game.Rectangle')(GAME);
GAME = require('./core/types/game.Missile')(GAME);
GAME = require('./core/types/game.Ship')(GAME);
GAME = require('./core/types/game.Player')(GAME);

// require core game modules
// TODO: move core game and type files out of public folder
// TODO: build script to concatenate public js assets
GAME.core = require('./public/js/game.core')(GAME);

// require server game modules, init using dependency injection if required
GAME.redis = require('./server/game.redis').init(redis, config);
GAME.socket = require('./server/game.socket').init(app, async, redis, sio, config, GAME);

// require server loops
GAME.physics = require('./server/game.physics').init(GAME);
GAME.update = require('./server/game.update').init(async, redis, GAME, underscore);

// http config
var file = new (static.Server)('./public');

app.listen(config.port);
console.log('Server started, listening on port ' + config.port);

function handler (req, res) {
  req.addListener('end', function () {
    file.serve(req, res);
  });
}
