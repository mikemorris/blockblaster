(function(root, factory) {
  if (typeof exports === 'object') {
    // Node.js
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    // AMD
    define(factory);
  }
})(this, function() {

  // Array cleaner removes specfied value from array. In this case,
  // I'm using it to remove 'undefined' objects in the array.
  // http://stackoverflow.com/questions/281264/remove-empty-elements-from-an-array-in-javascript
  Array.prototype.clean = function(deleteValue) {
    for (var i = 0; i < this.length; i++) {
      if (this[i] == deleteValue) {
        this.splice(i, 1);
        i--;
      }
    }
    return this;
  };

  // linear interpolation
  var lerp = function(prev, next, time) {
    var _prev = Number(prev);
    var _next = Number(next);
    var _time = Number(time);
    var position;

    _time = (Math.max(0, Math.min(1, _time)));
    position = (_prev + (_time * (_next - _prev)));

    if (isNaN(position)) debugger;

    return position;
  };

  // TODO: replace with physics logic (using dependency injection pattern?)
  // TODO: pass in game object/player (with defined acceleration) instead of just deltas?
  // TODO: check for valid move or cheating (moving too quickly) here
  var getVector = function(dx, dy) {
    // TODO: set dx and dy to max value allowed
    return {
      dx: dx,
      dy: dy
    };
  };

  // takes an input object and returns a velocity vector
  var getVelocity = function(input) {
    // return change as vector, delta x and delta y
    var dx = 0;
    var dy = 0;

    var keys = Object.keys(input);
    var length = keys.length;
    var value;

    for (var i = 0; i < length; i++) {
      value = keys[i];

      if (input[value]) {
        switch(value) {
          case 'up':
            dy++;
            break;
          case 'down':
            dy--;
            break;
          case 'right':
            dx++;
            break;
          case 'left':
            dx--;
            break;
        }
      }
    }

    return this.getVector(dx, dy);
  };

  var getRandomNumber = function(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  var initGlobalVariables = function() {

    // entity interpolation offset (milliseconds)
    this.offset = 100;

    // entity interpolation buffer size, frames * seconds
    this.buffersize = 120;

    // entity interpolation smoothing factor
    // lower number is slower smoothing
    this.smoothing = 20;

  };

  var isCollision = function(a, b) {
    var ax = parseInt(a.state.public.x);
    var ay = parseInt(a.state.public.y);
    var bx = parseInt(b.state.public.x);
    var by = parseInt(b.state.public.y);

    return  ax <= (bx + b.width) &&
        bx <= (ax + a.width) &&
        ay <= (by + b.height) &&
        by <= (ay + a.height);
  };

  var loadScene = function(name) {
    /*
    game.scene = game.scenes[name];
    game.scene.init();
    */
  };

  return {
    lerp: lerp,
    getVector: getVector,
    getVelocity: getVelocity,
    getRandomNumber: getRandomNumber,
    initGlobalVariables: initGlobalVariables,
    isCollision: isCollision,
    loadScene: loadScene
  };

});
