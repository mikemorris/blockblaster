(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../core/core', '../core/time', './input', '../core/types/Player', '../core/types/Enemy'], factory);
  }
})(this, function(core, time, input, Player, Enemy) {

  var players = {};
  var npcs = {};

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
          // if defined on server but not on client, create new NPC on client
          client.npcs[uuid] = new Enemy(parseInt(npc.state.x), parseInt(npc.state.y), parseInt(npc.state.direction), uuid);
        } else {
          delete client.npcs[uuid];
        }
      }

    });

    // listen for delta updates
    socket.on('state:delta', function(data) {
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
          if (player.state && player.state.ack) {
            client_player.ship.ack = player.state.ack;
          }

          // TODO: clean this up
          if (client_player && player) {
            client_player.uuid = uuid;

            if (player.ship) {

              if (player.ship.state) {

                // set server state
                if (player.ship.state.x) {
                  client_player.ship.state.public.x = parseInt(player.ship.state.x);
                } else {
                  player.ship.state.x = client_player.ship.state.public.x;
                }

                if (player.ship.state.y) {
                  client_player.ship.state.public.y = parseInt(player.ship.state.y);
                } else {
                  player.ship.state.y = client_player.ship.state.public.y;
                }

                if (uuid === client.uuid) {
                  // reconcile client prediction with server
                  client_player.ship.reconcile(client, player);
                } else {
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
                  clientMissile = _.find(client_player.ship.missiles, function(missile) {
                    return missile.uuid === key;
                  });

                  // TODO: cleanup
                  if (clientMissile) {
                    if (_.isNumber(serverMissile.state.x)) {
                      clientMissile.state.public.x = parseInt(serverMissile.state.x);
                    } else {
                      serverMissile.state.x = clientMissile.state.public.x;
                    }

                    if (_.isNumber(serverMissile.state.y)) {
                      clientMissile.state.public.y = parseInt(serverMissile.state.y);
                    } else {
                      serverMissile.state.y = clientMissile.state.public.y;
                    }

                    if (_.isBoolean(serverMissile.state.isLive)) {
                      clientMissile.state.private.isLive = clientMissile.state.public.isLive = serverMissile.state.isLive;
                    } else {
                      serverMissile.state.isLive = clientMissile.state.public.isLive;
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
            if (npc.state.isHit) {
              client_npc.state.public.isHit = parseInt(npc.state.isHit);
            } else {
              npc.state.isHit = client_npc.state.public.isHit;
            }

            if (npc.state.y) {
              client_npc.state.public.y = parseInt(npc.state.y);
            } else {
              npc.state.y = client_npc.state.public.y;
            }

            if (npc.state.x) {
              client_npc.state.public.x = parseInt(npc.state.x);
            } else {
              npc.state.x = client_npc.state.public.x;
            }

            if (npc.state.rotation) {
              client_npc.state.public.rotation = parseInt(npc.state.rotation);
            } else {
              npc.state.rotation = client_npc.state.public.rotation;
            }

            if (npc.state.rotation) {
              client_npc.state.public.rotation = parseInt(npc.state.rotation);
            } else {
              npc.state.rotation = client_npc.state.public.rotation;
            }

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
      var length = missiles.length;
      var uuid;
      var missile;

      for (var i = 0; i < length; i++) {
        uuid = missiles[i].uuid;

        missile = _.find(missiles, function(missile) {
          return missile.uuid === uuid;
        });

        if (missile && missile.state.public.isLive) {
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
        player.ship.respondToInput(input.pressed, function(input) {
          client.socket.emit('command:send', input);
        });

        // console.log(player.ship.state.private);
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
    for (var i = 0; i < length; i++) {
      uuid = npcs[i];
      npc = client.npcs[uuid];

      npc.interpolate();
      npc.draw(client);
    }
  };

  return {
    players: players,
    npcs: npcs,
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
