(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    // AMD
    define(factory);
  } else {
    // browser globals (root is window)
    root.GAME.client = factory(root.GAME || {});
  }
})(this, function(game) {

  var init = function() {

    // clear players object to purge disconnected ghosts
    game.players = {};
    game.npcs = {};

    // set methods to run every frame
    // TODO: decouple this asynchronously?
    this.actions = [
      this.clearCanvas,
      this.updatePlayers,
      this.updateNPCs
    ];

    var socket = game.socket = io.connect();

    socket.on('clearCanvas', function(data) {
      game.client.clearCanvas();
    });

    socket.on('players', function(data) {
      var players = Object.keys(data);
      var length = players.length;
      var uid;

      // init players using data from server
      for (var i = 0; i < length; i++) {
        uid = players[i];
        game.players[uid] = new game.Player(data[uid]);
      }

      // bind add/remove listeners after init
      socket.on('players:add', function(data) {
        game.players[data.uid] = new game.Player(data.player);
      });

      socket.on('players:remove', function(uid) {
        delete game.players[uid];
      });
    });

    socket.on('npcs', function(data) {
      var npcs = Object.keys(data);
      var length = npcs.length;
      var uuid;
      var npc;

      // init NPCs using data from server
      for (var i = 0; i < length; i++) {
        uuid = npcs[i];
        npc = data[uuid];
        game.npcs[uuid] = new game.Enemy(npc.x, npc.y, npc.direction);
      }

      // bind add/remove listeners after init
      socket.on('npc:add', function(npc) {
        game.npcs[npc.uuid] = new game.Enemy(npc.state.x, npc.state.y, npc.state.direction);
      });

      socket.on('npc:destroy', function(uuid) {
        // TODO: cleanup, remove from canvas
        // delete game.npcs[uuid];
        game.npcs[uuid].destroy();
      });
    });

    // set socket.uid before processing updates
    socket.on('uid', function(data) {
      game.uid = data;

      socket.on('state:update', function(data) {

        // update server time (used for entity interpolation)
        game.time.server = data.time;
        game.time.client = game.time.server - game.offset;

        // update players
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
            client = game.players[uid];

            // update last acknowledged input
            if (player.ack) {
              client.ship.ack = player.ack;
            }

            // TODO: clean this up
            if (client && player.ship) {

              if (player.ship.state) {

                // set server state
                if (player.ship.state.x) {
                  client.ship.sx = parseInt(player.ship.state.x);
                }

                if (player.ship.state.y) {
                  client.ship.sy = parseInt(player.ship.state.y);
                }

                if (uid === game.uid) {

                  // set smoothing coefficient
                  player.smoothing = 1000;

                  // reconcile client prediction with server
                  client.ship.reconcile(player);

                } else {

                  // set interpolation targets
                  client.ship.server.x = client.ship.sx;
                  client.ship.server.y = client.ship.sy;

                  // set smoothing coefficient
                  player.smoothing = game.smoothing;

                  // queue server updates for entity interpolation
                  client.ship.queue.server.push(player);
                  
                  // splice array, keeping BUFFER_SIZE most recent items
                  if (client.ship.queue.server.length >= game.buffersize) {
                    client.ship.queue.server.splice(0, client.ship.queue.server.length - game.buffersize);
                  }
                }

              }

              if (player.ship.missiles) {

                // update missiles
                var missiles = player.ship.missiles;
                var missile;

                for (var j = 0; j < missiles.length; j++) {
                  missile = missiles[j];

                  client.ship.missiles[j].sy = parseInt(missile.state.y);
                  client.ship.missiles[j].x = parseInt(missile.state.x);

                  client.ship.missiles[j].queue.server.push(missile);
                }

              }

            }

          }
        }

        // update npcs
        var npcs = Object.keys(data.npcs);
        var length_npc = npcs.length;

        var uuid;
        var npc;
        var client_npc;

        // update server state, interpolate foreign entities
        if (length_npc) {

          for (var i = 0; i < length_npc; i++) {
            uuid = npcs[i];
            npc = data.npcs[uuid];

            // authoritatively set internal state if player exists on client
            client_npc = game.npcs[uuid];

            if (client_npc) {
              // update last acknowledged input
              if (data.ack) {
                client_npc.ack = data.ack;
              }

              // interpolate destroy animation?
              client_npc.isHit = npc.isHit ? true : false;

              // TODO: clean this up and iterate over properties
              client_npc.sx = typeof(npc.x) !== 'undefined' ? parseInt(npc.x) : client_npc.x;
              client_npc.sy = typeof(npc.y) !== 'undefined' ? parseInt(npc.y) : client_npc.y;

              client_npc.rotation = parseInt(npc.rotation);

              // queue server updates for entity interpolation
              client_npc.queue.server.push(npc);
              
              // splice array, keeping BUFFER_SIZE most recent items
              if (client_npc.queue.server.length >= game.buffersize) {
                client_npc.queue.server.splice(-game.buffersize);
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
  };

  var loop = function() {
    // game.client necessary because of scope change on successive calls
    game.client.animationFrame = window.requestAnimationFrame(game.client.loop);

    game.time.setDelta();
    game.client.runFrameActions();
  };

  var pause = function() {
    window.cancelAnimationFrame(this.animationFrame);
    this.areRunning = false;
  };

  var play = function() {
    if(!this.areRunning) {
      this.then = Date.now();

      // init animation loop, variable time step
      this.loop();

      this.areRunning = true;
    }
  };

  var runFrameActions = function() {
    for (var i = 0; i < this.actions.length; i++) {
      this.actions[i]();
    }
  };

  var clearCanvas = function() {
    game.ctx.clearRect(0, 0, game.canvas.width, game.canvas.height);
  };

  var createCanvas = function(width, height) {
    game.canvas = document.createElement('canvas');
    game.ctx = game.canvas.getContext('2d');
    game.canvas.width = width;
    game.canvas.height = height;
    document.getElementById('canvas-wrapper').appendChild(game.canvas);
  };

  var updatePlayers = function() {
    var players = Object.keys(game.players);
    var length = players.length;
    var uid;
    var player;

    var updateMissiles = function(missiles) {
      for (var i = missiles.length; i--;) {
        var missile = missiles[i];

        // TODO: fix missiles to update isLive properly
        missile.interpolate();
        missile.draw();
      }
    };

    for (var i = 0; i < length; i++) {
      uid = players[i];
      player = game.players[uid];

      // client prediction only for active player
      if (uid === game.uid) {
        player.ship.respondToInput();
        player.ship.move();
        player.ship.interpolate();
      } else {
        // interpolate position of other players
        player.ship.interpolate();
      }

      updateMissiles(player.ship.missiles);

      player.ship.draw();
    }
  };

  var updateNPCs = function() {
    var npcs = Object.keys(game.npcs);
    var length = npcs.length;
    var uuid;
    var npc;

    // TODO: is this loop syntax faster?
    for (var i = length; i--;) {
      uuid = npcs[i];
      npc = game.npcs[uuid];

      npc.interpolate();
      npc.draw();
    }
  };

  return {
    init: init,
    loop: loop,
    pause: pause,
    play: play,
    runFrameActions: runFrameActions,
    clearCanvas: clearCanvas,
    createCanvas: createCanvas,
    updatePlayers: updatePlayers,
    updateNPCs: updateNPCs
  };

});
