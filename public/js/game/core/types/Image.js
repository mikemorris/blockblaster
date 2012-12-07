window.GAME = window.GAME || {};

(function(game) {

	game.Image = function(src) {
		var properties = {
      x: 0,
      y: 0
    };

		this.set(properties);

		this.load(src);
	};

	game.Image.prototype = new game.Entity();

	game.Image.prototype.load = function(src) {
		var thisImage = this;

		thisImage.ready = false;
		thisImage.image = new Image();
		thisImage.image.src = src;

		thisImage.image.onload = function () {
			thisImage.ready = true;
		};

	};

	game.Image.prototype.drawType = function() {
		if(this.ready) {
			game.ctx.drawImage(this.image, 0, 0);
		}
	};

})(window.GAME);
