var rectangle = (function(game) {

	game.Rectangle = function(properties) {
		properties && this.set(properties);
	};

	game.Rectangle.prototype = new game.Object();

	game.Rectangle.prototype.drawType = function() {
		game.ctx.fillStyle = this.color;
		game.ctx.fillRect(0,0,this.width, this.height);
		game.ctx.fill();
	};

  return game;
});

// export module or attach to window
if (typeof module !== 'undefined' && module.exports) {
  module.exports = rectangle;
} else {
  rectangle(window.GAME || {});
}
