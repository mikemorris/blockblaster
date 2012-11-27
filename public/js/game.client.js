window.GAME = window.GAME || {};

(function(game) {

	var client = game.client = {
		init: function() {
      var socket = game.socket = io.connect();

      socket.on('state:update', function (data) {
        game.time.server = data.time;
        game.time.client = game.time.server - game.offset;

        // update server state
        if (data.state) {
          // authoritatively set internal state
          game.scenes.level_1.ship.sx = parseInt(data.state.x);
          game.scenes.level_1.ship.sy = parseInt(data.state.y);

          // queue server updates for entity interpolation
          game.queue.server.push(data);
          
          // splice array, keeping BUFFER_SIZE most recent items
          if (game.queue.server.length >= game.buffersize) {
            game.queue.server.splice(-game.buffersize);
          }
        }

        // update last acknowledged input
        if (data.ack) {
          game.scenes.level_1.ship.ack = data.ack;
          game.scenes.level_1.ship.reconcile();
        }
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

})(window.GAME);
