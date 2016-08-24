var pg = require('pg'),
    redis = require('redis');
var pg_client, pg_options,
    redis_client;


pg_options = process.env.ELEPHANTSQL_URL ||  'connect string ..';
redis_client = redis.createClient();

pg.connect(pg_options, function(err, client, done) {
  if(!err){
    pg_client = client;
  } else {
    pg_client = false;
    console.error('Error connecting to pg database!', err);
  }
});

module.exports = new function(options){
  this.init = function(req, res, step, callback){
    
    req.db      = pg_client;
    req.redis   = redis;
    callback(req, res, ++step);
  }
}
