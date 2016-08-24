var app = require('./core/core.js');
var routes = require('./core/routes.js');
var error = require('./routes/error/index.js')(routes);
var index = require('./routes/index/index.js')(routes);
var urlParse  = require('./core/urlParse.js');

//  You can enable session. Cookies is safe because it takes into account the module ip address
/*
  var session = require('./core/fjRedisSession.js');
      session = new session(30);

  var connector = require('./core/fjDBConnector.js');
*/

// includes a detailed error output in the trace file
app.setConfigProperty('error_reporting.debug_mode', true);
app.setConfigProperty('error_reporting.log_save', false);
//app.setConfigProperty('session.enabled', false);

app.init(1114, '127.0.0.1');
app.ws_init(4010);

// you can initialize session
/*
  app.use(connector.init);
  app.use(session.init);
*/
app.use(urlParse);

// You can specify an alias for a path to the static
app.setStaticPath('assets', 'css');

app.setRouts('/', index);
app.setRouts('index', index);
app.setRouts('error', error);


