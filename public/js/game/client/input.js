(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(factory);
  }
})(this, function(game) {

  var pressed = {};

  var keys = {
    32: 'spacebar',
    37: 'left',
    39: 'right',
    65: 'left',
    68: 'right'
  };

  var keyInteraction = function(event) {
    var code = event.keyCode;
    if(keys[code]) {
      event.preventDefault();
      pressed[keys[code]] = (event.type === 'keydown') ? true : false;
      // Need more info here.
      // - press (initial press)
      // - down (true as long as down)
      // - hold (what counts as a hold? + .5 seconds?)
      // - release (initial release)
    }
  };

  var init = function() {
    window.addEventListener('keyup', keyInteraction);
    window.addEventListener('keydown', keyInteraction);
  };

  return {
    init: init,
    pressed: pressed
  };

});
