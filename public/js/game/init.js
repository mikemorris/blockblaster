window.GAME = window.GAME || {};

(function(game) {

	game.init = function() {
		// game.debug = true;
		game.core.initGlobalVariables();
		game.input.init();
		game.client.createCanvas(800, 450);
		game.client.init();
		game.client.play();
	};

})(window.GAME);
