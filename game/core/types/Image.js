(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js
    module.exports = factory(
      require('./Entity')
    );
  } else if (typeof define === 'function' && define.amd) {
    // AMD
    define(['./Entity'], factory);
  } else {
    // browser globals (root is window)
    root.GAME = root.GAME || {};
    root.GAME.Enemy = factory(root.GAME || {});
  }
})(this, function(Entity) {

	var Image = function(src) {
		var properties = {
      x: 0,
      y: 0
    };

		this.set(properties);

		this.load(src);
	};

	Image.prototype = new Entity();

	Image.prototype.load = function(src) {
		var thisImage = this;

		thisImage.ready = false;
		thisImage.image = new window.Image();
		thisImage.image.src = src;

		thisImage.image.onload = function () {
			thisImage.ready = true;
		};

	};

	Image.prototype.drawType = function(client) {
		if(this.ready) {
			client.ctx.drawImage(this.image, 0, 0);
		}
	};

  return Image;

});
