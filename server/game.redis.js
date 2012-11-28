var game = {};

game.redis = {

  init: function(redis, config) {
    // redis client config
    var port = config.redis.port;
    var host = config.redis.host;
    var pass = config.redis.password;

    // redis client init
    var pub = redis.createClient(port, host);
    var sub = redis.createClient(port, host);
    var store = redis.createClient(port, host);

    // redis auth
    pub.auth(pass, function(err) {});
    sub.auth(pass, function(err) {});
    store.auth(pass, function(err) {});

    return {
      pub: pub,
      sub: sub,
      store: store
    };
  },

}

module.exports = game.redis;
