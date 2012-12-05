(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    // AMD
    define(factory);
  } else {
    // browser globals (root is window)
    root.GAME.returnExports = factory(root.GAME || {});
    // window.GAME.core = factory(window.GAME || {});
  }
})(this, function() {

  this.time = {
    then: Date.now()
  };

  return this.time;

});
