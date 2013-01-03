(function(root, factory) {
  if (typeof exports === 'object') {
    // Node.js
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    // AMD
    define(factory);
  }
})(this, function() {

	var Entity = function(properties) {
    // public state for sync
    this.state = {};

		if(properties) {
			this.set(properties);
		}
	};

	Entity.prototype.set = function(properties) {
		for(var property in properties) {
			this[property] = properties[property];
		}

		this.color = this.color || 'black';
		this.rotation = this.rotation || 0; // radians
		this.scale = this.scale || 1;
	};

	Entity.prototype.draw = function(client) {

    client.ctx.save();

    // Round to whole pixel
    var x = (this.x + 0.5) | 0;
    var y = (this.y + 0.5) | 0;

    // Apply Transformations (scale and rotate from center)
    client.ctx.translate(x + this.width / 2, y + this.height / 2);
    client.ctx.rotate(this.rotation);
    client.ctx.scale(this.scale, this.scale);
    client.ctx.translate(-this.width/2, -this.height/2);

    // Call extended Entity Type's draw method
    this.drawType && this.drawType(client);

    client.ctx.restore();

	};

  return Entity;

});
