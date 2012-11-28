var player = (function(game) {

  // constructor
	game.Player = function(socket, rc) {
		this.ship = new game.Ship({
      speed: 300,
      maxMissiles: 3,
      repeatRate: 30
    });

    // TODO: iterate over all attributes of Player
    var player = this;
    var uid = socket.uid;
    var attr = 'player:' + uid + ':ship:x';

    rc.get(attr, function(err, res) {
      if (err) { throw err; }

      // init state if not in redis already
      if (res !== null) {
        player.ship.x = res;
      } else {
        rc.set(attr, player.ship.x, function(err, res) {});
      }
    });
	};

	game.Player.prototype = new game.Object();

  return game;
});

// export module or attach to window
if (typeof module !== 'undefined' && module.exports) {
  module.exports = player;
} else {
  player(window.GAME || {});
}
