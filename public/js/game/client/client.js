(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    // AMD
    define(factory);
  } else {
    // browser globals (root is window)
    root.GAME = root.GAME || {};
    root.GAME.client = factory(root.GAME || {});
  }
})(this, function(game) {

  this.init = function() {

    // clear players object to purge disconnected ghosts
    game.players = {};
    game.npcs = {};

    // set methods to run every frame
    // TODO: decouple this asynchronously?
    this.actions = [
      this.clearCanvas,
      // this.updatePlayers,
      this.updateNPCs
    ];

    var socket = game.socket = io.connect();

    socket.on('players', function(data) {
      var players = Object.keys(data);
      var length = players.length;
      var uid;

      // init players using data from server
      for (var i = 0; i < length; i++) {
        uid = players[i];
        console.log(data[uid]);
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

      /*
      // bind add/remove listeners after init
      socket.on('npcs:add', function(data) {
        game.npcs[data.index] = new game.Enemy(data.enemy);
      });
      */

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
        // update server time
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

            // update missiles
            var missiles = player.ship.missiles;
            var missile;

            console.log(player.ship.missiles);

            for (var j = 0; j < missiles.length; j++) {
              missile = missiles[j];

              client.ship.missiles[j].sy = parseInt(missile.y);
              client.ship.missiles[j].x = parseInt(missile.x);
              client.ship.missiles[j].isLive = missile.isLive;

              client.ship.missiles[j].queue.server.push(missile);
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

  this.loop = function() {
    this.animationFrame = window.requestAnimationFrame(this.loop);
    game.time.setDelta();

    // defined in scene
    this.runFrameActions();
  };

  this.pause = function() {
    window.cancelAnimationFrame(this.animationFrame);
    this.areRunning = false;
  };

  this.play = function() {
    if(!this.areRunning) {
      this.then = Date.now();

      // init animation loop, variable time step
      this.loop();

      this.areRunning = true;
    }
  };

  this.runFrameActions = function() {
    for (var i = 0; i < this.actions.length; i++) {
      this.actions[i]();
    }
  };

  this.clearCanvas = function() {
    game.ctx.clearRect(0, 0, game.canvas.width, game.canvas.height);
  };

  this.createCanvas = function(width, height) {
    game.canvas = document.createElement('canvas');
    game.ctx = game.canvas.getContext('2d');
    game.canvas.width = width;
    game.canvas.height = height;
    document.getElementById('canvas-wrapper').appendChild(game.canvas);
  };

  this.updatePlayers = function() {
    var players = Object.keys(game.players);
    var length = players.length;
    var uid;
    var player;

    var updateMissiles = function(missiles) {
      for (var i = missiles.length; i--;) {
        var missile = missiles[i];

        if(missile.isLive) {
          missile.interpolate();
          missile.draw();
        }
      }
    };

    for (var i = 0; i < length; i++) {
      uid = players[i];
      player = game.players[uid];

      // client prediction only for active player
      if (uid === game.uid) {
        player.ship.respondToInput();
        player.ship.move();
      } else {
        // interpolate position of other players
        player.ship.interpolate();
      }

      updateMissiles(player.ship.missiles);

      player.ship.draw();
    }
  };

  this.updateNPCs = function() {
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

  return this;

});
