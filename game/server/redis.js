(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    // Node.js
    module.exports = factory(
      require('redis'),
      require('../../config')
    );
  }
})(this, function(redis, config) {

  var init = function() {

    // redis client config
    var port = config.redis.port;
    var host = config.redis.host;
    var pass = config.redis.password;

    // redis client init
    var pub = redis.createClient(port, host);
    var sub = redis.createClient(port, host);
    var store = redis.createClient(port, host);

    // redis auth
    pub.auth(pass, function(err) { if (err) throw err; });
    sub.auth(pass, function(err) { if (err) throw err; });
    store.auth(pass, function(err) { if (err) throw err; });

    return {
      pub: pub,
      sub: sub,
      store: store
    };
  };

  return {
    init: init
  }

});
