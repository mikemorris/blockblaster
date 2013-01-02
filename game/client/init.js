(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../core/core', 'input', 'client'], factory);
  } else {
    // browser globals (root is window)
    root.GAME.init = factory(root.GAME || {});
  }
})(this, function(core, input, client) {

  // game.debug = true;
  core.initGlobalVariables();
  input.init();
  client.createCanvas(800, 450);
  client.init(client);
  client.play();

});
