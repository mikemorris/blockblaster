(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js
    module.exports = factory({});
  } else if (typeof define === 'function' && define.amd) {
    // AMD
    define(factory);
  } else {
    // browser globals (root is window)
    // window.GAME.core = factory(window.GAME || {});
    root.GAME.returnExports = factory(root.GAME || {});
  }
})(this, function(game) {

	game.Object = function(properties) {
		if(properties) {
			this.set(properties);
		}
	};

	game.Object.prototype.set = function(properties){
		for(var property in properties) {
			this[property] = properties[property];
		}
		this.color = this.color || 'black';
		this.rotation = this.rotation || 0;
		this.scale = this.scale || 1;
	};

	game.Object.prototype.draw = function() {
    if (game.canvas) {
      game.canvas.ctx.save();

      // Round to whole pixel
      var x = (this.x + 0.5) | 0;
      var y = (this.y + 0.5) | 0;

      // Apply Transformations (scale and rotate from center)
      game.canvas.ctx.translate(x + this.width / 2, y + this.height / 2);
      game.canvas.ctx.rotate(this.rotation);
      game.canvas.ctx.scale(this.scale, this.scale);
      game.canvas.ctx.translate(-this.width/2, -this.height/2);

      // Call extended Object Type's draw method
      this.drawType && this.drawType();

      game.canvas.ctx.restore();
    }
	};

  return game.Object;

});
