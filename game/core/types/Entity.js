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
    // https://developer.mozilla.org/en-US/docs/JavaScript/Reference/Reserved_Words#Reserved_word_usage
		if(properties) {
			this.set(properties);
		}
	};

	Entity.prototype.set = function(properties) {
		for(var property in properties) {
			this.state.private[property] = properties[property];
			this.state.public[property] = properties[property];
		}
	};

	Entity.prototype.draw = function(client) {

    client.ctx.save();

    // round to whole pixel
    // interpolated x and y coords
    var x = (this.state.private.x + 0.5) | 0;
    var y = (this.state.private.y + 0.5) | 0;

    // apply transformations (scale and rotate from center)
    // snapped rotation and scale
    client.ctx.translate(x + this.width / 2, y + this.height / 2);
    client.ctx.rotate(this.state.public.rotation);
    client.ctx.scale(this.state.public.scale, this.state.public.scale);
    client.ctx.translate(-this.width/2, -this.height/2);

    // Call extended Entity Type's draw method
    this.drawType && this.drawType(client);

    client.ctx.restore();

	};

  return Entity;

});
