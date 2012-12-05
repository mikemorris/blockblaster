window.GAME = window.GAME || {};

(function(game) {

	game.init = function() {
		// game.debug = true;
		game.core.createCanvas(800, 450);
		game.core.initGlobalVariables();
		game.input.init();
		game.client.init();
		game.client.play();
	};

})(window.GAME);
