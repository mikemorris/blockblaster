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
