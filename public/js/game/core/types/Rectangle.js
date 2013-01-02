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
    root.GAME.Rectangle = factory(root.GAME || {});
  }
})(this, function(Entity) {

	var Rectangle = function(properties) {
		properties && this.set(properties);
	};

	Rectangle.prototype = new Entity();

	Rectangle.prototype.drawType = function(client) {
		client.ctx.fillStyle = this.color;
		client.ctx.fillRect(0,0,this.width, this.height);
		client.ctx.fill();
	};

  return Rectangle;

});
