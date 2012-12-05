(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js
    module.exports = factory({
      'core': require('./game.core'),
      'canvas': require('./game.canvas'),
      'Object': require('./types/game.Object'),
      'Rectangle': require('./types/game.Rectangle'),
      'Missile': require('./types/game.Missile'),
      'Ship': require('./types/game.Ship'),
      'Player': require('./types/game.Player')
    });
  } else if (typeof define === 'function' && define.amd) {
    // AMD
    define([
      'Object',
      'Rectangle',
      'Missile',
      'Ship',
      'Player'
    ], factory);
  } else {
    // browser globals (root is window)
    root.GAME.returnExports = factory(root.GAME || {});
    // window.GAME.core = factory(window.GAME || {});
  }
})(this, function(game) {

	return {
		init: function() {
      var socket = game.socket = io.connect();

      socket.on('players', function(data) {
        var players = Object.keys(data);
        var length = players.length;
        var uid;

        // clear players object to purge disconnected ghosts
        game.scenes.level_1.players = {};

        // init players using data from server
        for (var i = 0; i < length; i++) {
          uid = players[i];
          game.scenes.level_1.players[uid] = new game.Player(data[uid]);
        }

        // bind add/remove listeners after init
        socket.on('players:add', function(data) {
          game.scenes.level_1.players[data.uid] = new game.Player(data.player);
        });

        socket.on('players:remove', function(uid) {
          delete game.scenes.level_1.players[uid];
        });
      });

      // set socket.uid before processing updates
      socket.on('uid', function(data) {
        game.uid = data;

        socket.on('state:update', function(data) {
          // update server time
          game.time.server = data.time;
          game.time.client = game.time.server - game.offset;

          var players = Object.keys(data.players);
          var length = players.length;

          var uid;
          var player;
          var client;

          // update server state, interpolate foreign entities
          if (length) {

            for (var i = 0; i < length; i++) {
              uid = players[i];
              player = data.players[uid];

              // authoritatively set internal state if player exists on client
              client = game.scenes.level_1.players[uid];

              if (client && client.ship) {
                // update last acknowledged input
                if (data.ack) {
                  client.ship.ack = data.ack;
                }

                client.ship.sx = parseInt(player.ship.x);
                client.ship.sy = parseInt(player.ship.y);

                // reconcile client prediction with server
                if (uid === game.uid) {
                  client.ship.reconcile();
                } else {
                  // queue server updates for entity interpolation
                  client.ship.queue.server.push(player);
                  
                  // splice array, keeping BUFFER_SIZE most recent items
                  if (client.ship.queue.server.length >= game.buffersize) {
                    client.ship.queue.server.splice(-game.buffersize);
                  }
                }
              }
            }
          }
        });
      });

      // pause on blur doesnt make sense in multiplayer
      /*
			window.addEventListener('blur', client.pause, false);
			window.addEventListener('focus', client.play, false);
      */
		},

		loop: function() {
			client.animationFrame = window.requestAnimationFrame(client.loop);
			client.setDelta();

      // defined in scene
			client.runFrameActions();
		},

		pause: function() {
			window.cancelAnimationFrame(client.animationFrame);
			client.areRunning = false;
		},

		play: function() {
			if(!client.areRunning) {
				client.then = Date.now();

        // init animation loop, variable time step
				client.loop();

				client.areRunning = true;
			}
		},

		runFrameActions: function() {
			for (var i = 0; i < client.actions.length; i++) {
				client.actions[i]();
			}
		},

		setDelta: function() {
			client.now = Date.now();
			client.delta = (client.now - client.then) / 1000; // seconds since last frame
			client.then = client.now;
		}
	};

});
