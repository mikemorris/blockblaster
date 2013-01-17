(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../core/core', '../core/time', './input', '../core/types/Player', '../core/types/Enemy'], factory);
  }
})(this, function(core, time, input, Player, Enemy) {

  var players = {};
  var npcs = {};

  // input sequence id
  var seq = 0;

  // queue
  var queue = {};
  queue.input = [];
  queue.server = [];

  var init = function(client) {

    // set methods to run every frame
    // TODO: decouple this asynchronously?
    this.actions = [
      this.clearCanvas,
      this.updatePlayers,
      this.updateNPCs
    ];

    // socket.io client connection
    var socket = this.socket = io.connect();

    // set client.uuid
    socket.on('uuid', function(data) {
      client.uuid = data;
    });

    // listen for full state updates
    socket.on('state:full', function(data) {

      var uuid;

      // TODO: DRY this up?
      var players = _.union(Object.keys(client.players), Object.keys(data.players));
      var player;

      // iterate over union of client and server players
      for (var i = 0; i < players.length; i++) {
        uuid = players[i];

        player = data.players[uuid];
        if (player && client.players[uuid]) {
          // TODO: if defined on server and client, update state
        } else if (player) {
          // if defined on server but not on client, create new Player on client
          client.players[uuid] = new Player(player);
        } else {
          delete client.players[uuid];
        }
      }

      // TODO: DRY this up?
      var npcs = _.union(Object.keys(client.npcs), Object.keys(data.npcs));
      var npc;

      // iterate over union of client and server players
      for (var j = 0; j < npcs.length; j++) {
        uuid = npcs[j];

        npc = data.npcs[uuid];
        if (npc && client.npcs[uuid]) {
          // TODO: if defined on server and client, update state
        } else if (npc) {
          if (isNaN(npc.x) || isNaN(npc.y) || isNaN(npc.direction)) debugger;

          // if defined on server but not on client, create new NPC on client
          client.npcs[uuid] = new Enemy(parseInt(npc.x), parseInt(npc.y), parseInt(npc.direction), uuid);
          client.npcs[uuid].sx = parseInt(npc.x);
          client.npcs[uuid].sy = parseInt(npc.y);
        } else {
          delete client.npcs[uuid];
        }
      }

    });

    // listen for delta updates
    socket.on('state:update', function(data) {

      // update server time (used for entity interpolation)
      time.server = data.time;
      time.client = time.server - core.offset;

      // update players
      var players = Object.keys(data.players);
      var length = players.length;

      var uuid;
      var player;
      var client_player;

      // update server state, interpolate foreign entities
      if (length) {

        for (var i = 0; i < length; i++) {
          uuid = players[i];
          player = data.players[uuid];

          // authoritatively set internal state if player exists on client
          client_player = client.players[uuid];

          // update last acknowledged input
          if (player.ack) {
            client_player.ship.ack = player.ack;
          }

          // TODO: clean this up
          if (client_player && player) {
            client_player.uuid = uuid;

            if (player.ship) {

              if (player.ship.state) {
                if (player.ship.state.y) {
                  client_player.ship.sy = parseInt(player.ship.state.y);
                }

                if (uuid === client.uuid) {
                  // reconcile client prediction with server
                  client_player.ship.reconcile(client, player);
                } else {
                  // set server state
                  if (player.ship.state.x) {
                    client_player.ship.sx = parseInt(player.ship.state.x);
                  } else {
                    player.ship.state.x = client_player.ship.sx;
                  }

                  if (player.ship.state.y) {
                    client_player.ship.sy = parseInt(player.ship.state.y);
                  } else {
                    player.ship.state.y = client_player.ship.sy;
                  }

                  // set timestamp for interpolation
                  player.ship.time = Date.now();

                  // queue reconciled position for entity interpolation
                  client_player.ship.queue.server.push(player.ship);
                  
                  // remove all updates older than one second from interpolation queue
                  client_player.ship.queue.server = client_player.ship.queue.server.filter(function(el, index, array) {
                    return el.time > (Date.now() - 1000);
                  });

                }

              }

              if (Object.keys(client_player.ship.missiles) && player.ship.missiles) {

                // update missiles
                var missiles = player.ship.missiles;
                var keys = Object.keys(missiles);

                var key;
                var missile;
                var clientMissile;

                // all values passed from redis as strings
                // must be converted to correct type
                for (var j = 0; j < keys.length; j++) {
                  key = keys[j];
                  
                  // set serverMissile to get state
                  serverMissile = missiles[key];

                  // find clientMissile in array
                  clientMissile = _.find(client_player.ship.missiles, function(missile, uuid) {
                    return uuid === key;
                  });

                  // TODO: cleanup
                  if (clientMissile) {
                    if (serverMissile.state.x) {
                      clientMissile.sx = parseInt(serverMissile.state.x);
                    } else {
                      serverMissile.state.x = clientMissile.sx;
                    }

                    if (serverMissile.state.y) {
                      clientMissile.sy = parseInt(serverMissile.state.y);
                    } else {
                      serverMissile.state.y = clientMissile.sy;
                    }

                    if (serverMissile.state.isLive) {
                      clientMissile.isLive = (serverMissile.state.isLive === 'true');
                    }

                    // set timestamp for interpolation
                    serverMissile.time = Date.now();

                    if (client_player.uuid === client.uuid) {
                      // reconcile client prediction with server
                      clientMissile.reconcile(serverMissile);
                    } else {
                      clientMissile.queue.server.push(serverMissile);

                      // remove all updates older than one second from interpolation queue
                      clientMissile.queue.server = clientMissile.queue.server.filter(function(el, index, array) {
                        return el.time > (Date.now() - 1000);
                      });
                    }
                  }
                }

              }

            }

          } else {
            client.players[uuid] = new Player(player);
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
          client_npc = client.npcs[uuid];

          if (client_npc) {
            // interpolate destroy animation?
            client_npc.isHit = npc.isHit ? true : false;

            if (npc.y) {
              client_npc.sy = parseInt(npc.y);
            } else {
              npc.y = client_npc.sy;
            }

            if (npc.x) {
              client_npc.sx = parseInt(npc.x);
            } else {
              npc.x = client_npc.sx;
            }

            client_npc.rotation = parseInt(npc.rotation);

            // set timestamp for interpolation
            npc.time = time.client;

            // queue server updates for entity interpolation
            client_npc.queue.server.push(npc);
            
            // remove all updates older than one second from interpolation queue
            client_npc.queue.server = client_npc.queue.server.filter(function(el, index, array) {
              return el.time > (Date.now() - 1000);
            });
          }
        }
      }

    });

    // pause on blur doesnt make sense in multiplayer
    /*
    window.addEventListener('blur', client.pause, false);
    window.addEventListener('focus', client.play, false);
    */
  };

  var loop = function(client) {
    client = client || this;

    // this bind necessary because of scope change on successive calls
    client.animationFrame = window.requestAnimationFrame((function() {
      loop(client);
    }).bind(client));

    time.setDelta();
    runFrameActions(client);
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

  var runFrameActions = function(client) {
    for (var i = 0; i < client.actions.length; i++) {
      client.actions[i](client);
    }
  };

  var clearCanvas = function(client) {
    client.ctx.clearRect(0, 0, client.canvas.width, client.canvas.height);
  };

  var createCanvas = function(width, height) {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.canvas.width = width;
    this.canvas.height = height;
    document.getElementById('canvas-wrapper').appendChild(this.canvas);
  };

  var updatePlayers = function(client) {
    var players = Object.keys(client.players);
    var length = players.length;
    var uuid;
    var player;
    var interpolate;

    var updateMissiles = function(missiles, interpolate) {
      var keys = Object.keys(missiles);
      var length = keys.length;
      var key;
      var missile;

      for (var i = 0; i < length; i++) {
        key = keys[i];
        missile = missiles[key];

        if (missile.isLive) {
          if (interpolate) {
            missile.interpolate(function() {
              missile.draw(client);
            });
          } else {
            missile.move();
            missile.draw(client);
          }
        }
      }
    };

    for (var i = 0; i < length; i++) {
      uuid = players[i];
      player = client.players[uuid];
      interpolate = (uuid !== client.uuid);

      if (interpolate) {

        // interpolate position of other players
        player.ship.interpolate();

      } else {

        // client prediction only for active player
        player.ship.respondToInput(client, input.pressed, function(input) {
          // add input to queue, then send to server
          client.queue.input.push(input);
          client.socket.emit('command:send', input);
        });

        player.ship.move();

      }

      updateMissiles(player.ship.missiles, interpolate);

      player.ship.draw(client);
    }
  };

  var updateNPCs = function(client) {
    var npcs = Object.keys(client.npcs);
    var length = npcs.length;
    var uuid;
    var npc;

    // TODO: is this loop syntax faster?
    for (var i = length; i--;) {
      uuid = npcs[i];
      npc = client.npcs[uuid];

      npc.interpolate();
      npc.draw(client);
    }
  };

  return {
    players: players,
    npcs: npcs,
    seq: seq,
    queue: queue,
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
