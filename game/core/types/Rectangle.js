(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js
    module.exports = factory({
      'Entity': require('./Entity')
    });
  } else if (typeof define === 'function' && define.amd) {
    // AMD
    define(factory);
  } else {
    // browser globals (root is window)
    root.GAME.Rectangle = factory(root.GAME || {});
  }
})(this, function(game) {

	game.Rectangle = function(properties) {
		properties && this.set(properties);
	};

	game.Rectangle.prototype = new game.Entity();

	game.Rectangle.prototype.drawType = function() {
		game.ctx.fillStyle = this.color;
		game.ctx.fillRect(0,0,this.width, this.height);
		game.ctx.fill();
	};

  return game.Rectangle;

});
