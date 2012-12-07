(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    // AMD
    define(factory);
  } else {
    // browser globals (root is window)
    root.GAME = root.GAME || {};
    root.GAME.Entity = factory(root.GAME || {});
  }
})(this, function(game) {

	var Entity = function(properties) {
		if(properties) {
			this.set(properties);
		}
	};

	Entity.prototype.set = function(properties){
    this.state = this.state || {};

		for(var property in properties) {
			this.state[property] = properties[property];
		}

		this.state.color = this.state.color || 'black';
		this.state.rotation = this.state.rotation || 0;
		this.state.scale = this.state.scale || 1;
	};

	Entity.prototype.draw = function() {
    game.ctx.save();

    // Round to whole pixel
    var x = (this.state.x + 0.5) | 0;
    var y = (this.state.y + 0.5) | 0;

    // Apply Transformations (scale and rotate from center)
    game.ctx.translate(x + this.width / 2, y + this.height / 2);
    game.ctx.rotate(this.state.rotation);
    game.ctx.scale(this.state.scale, this.state.scale);
    game.ctx.translate(-this.width/2, -this.height/2);

    // Call extended Entity Type's draw method
    this.drawType && this.drawType();

    game.ctx.restore();
	};

  return Entity;

});
