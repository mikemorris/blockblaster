(function(root, factory) {
  if (typeof exports === 'object') {
    // Node.js
    module.exports = factory(
      require('./Entity')
    );
  } else if (typeof define === 'function' && define.amd) {
    // AMD
    define(['./Entity'], factory);
  }
})(this, function(Entity) {

	var Image = function(src) {

    // WARN: state must be initialized on entity, NOT prototype chain
    this.state = {};
    this.state.private = {};
    this.state.public = {};

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
