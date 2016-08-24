var http = require('http');
var fs = require('fs'),
  crypto = require('crypto');
var ws = require('nodejs-websocket');

//  Error options. Error type is determined by the bit mask & 1
module.exports = new(function() {
  'use strict';

  //  Client-level errors
  var APP_REQUEST_ERR = 0x1,
    APP_NOT_FOUND_ERR = 0x3,
    APP_FILE_NOT_FOUND = 0x5,
    //  Server-level errors
    APP_SERVER_LAYER_ERR = 0x2,
    APP_SERVER_TEMPLATE_ERR = 0x4,
    APP_SERVER_VIEW_ERR = 0x6;

  var SERVER;


  var errorReporting = {
    1: {
      description: 'Server error!',
      number: 500,
    },

    5: {
      description: 'File is not found!',
      number: 404,
    },

    3: {
      description: 'Page is not found!',
      number: 404,
    },

    2: {
      description: 'Unexpected server error!',
      number: 500,
    },

    6: {
      description: 'Server error! Error loading view!',
      number: 500,
    },

    4: {
      description: 'Server error! Error loading template!',
      number: 500
    }
  }

  //  The data saved to the built-in templates templating 
  var cacheURI = {},
    cacheTemplate = {
      layouts: {},
      parts: {}
    };

  //  Basic facilities for the routing layer
  var _activeModules = [];

  //  The path to the base directory of layers 
  var _pathToLayouts = 'layouts/';

  var _aliasRoute = {},
    _staticRoute = {},

    // List loaded routing routers
    _routes = {
      'POST': {},
      'GET': {},
      'WS': {}
    },

    /*
      Basic options for application initialization. 
      Choice behavior output errors
    */
    _config = {
      error_reporting: {
        debug_mode: false,
        log_save: true,
        path_log_files: '/log/'
      },

      production: {
        enabled: false,
        path: '',
      },

      session: {
        enabled: false
      }
    },

    // The object after initialization web socket connection
    ws_connect = false;

  // Adding modules middleware
  this.use = function(module) {
    _activeModules.push(module);
  }

  // Jumping on the strata. Call handlers chain synchronously
  var callModules = function(req, res, step) {
    if (step >= _activeModules.length) {
      if (step != _activeModules.length) return;
      _route(req, res);
    } else {
      next(req, res, step);
    }
  }

  // The transition to the next level handlers
  var next = function(req, res, step) {
    _activeModules[step](req, res, step, callModules);
  }


  this.setConfigProperty = function(str, value) {
    var res_str = str.split('.'),
      res_length = res_str.length;

    if (res_length != 2) {
      console.log('Pass an empty key configuration');
    } else if (res_length == 2) {
      try {
        var current_value = _config[res_str[0]][res_str[1]];
        if (typeof value != typeof current_value) {
          console.log('The error does not set the correct type of the value of the configuration key!');
        } else {
          _config[res_str[0]][res_str[1]] = value;
        }
      } catch (e) {
        console.log('Specified parameter does not exist!');
      }
    }
  }


  // Create new config object
  this.setConfigObject = function(k, v) {
    if ((k == undefined || k == '') || typeof v != 'object') {
      console.log('Incorrect settings!');
      return;
    }

    if (_config[k] == undefined) {
      _config[k] = v;
    } else {
      console.log('Such configuration rules already exist!');
    }
  }


  // Error processing. Displays the type of error , routing errors.
  var managerErrors = function(errMsg, res, err_type, req) {
    // If the last bit is one then derive a client-level error
    if (err_type & 1) {
      try {
        /*
          Check the debug mode flag and the existence of a method for outputting an error pattern.
          If the action is not set, and debugging mode turned off derive text messages without a template.
        */
        if (!_routes['GET']['error'][errorReporting[err_type].number]) throw '';
        // If errors are found action to redirect to an error page
        res.redirect('/error/' + errorReporting[err_type].number);
      } catch (e) {
        res.send(errMsg);
      }
    } else {
      /*
        If the server-level error occurred text output or trace. 
        Depending on the debug flag
      */
      try {
        if (err_type == undefined || !errorReporting.hasOwnProperty(err_type))
          throw 'Error Site temporarily unavailable!';

        if (!errorReporting[err_type].hasOwnProperty('description'))
          throw 'Error Site temporarily unavailable!';

        if (_config.error_reporting.debug_mode) {
          res.send(500, errMsg);
        } else {
          //  Outputs only the error text
          res.send(500, errorReporting[err_type]['description']);
        }
      } catch (e) {
        res.send(500, e);
      }
    }

    // If logging is enabled write the text in the trace log file
    try {
      if (_config.error_reporting.log_save) {
        fs.exists(_config.error_reporting.path_log_files, function(e) {
          if (!e) {
            fs.appendFile(
              '.' + _config['error_reporting']['path_log_files'] + 'log_errors.txt',
              new Date + ' ___ ' + errMsg.toString() + ' Code error: ' + err_type + '\n',

              function(e, data) {
                if (e) console.log('Record the log file failed!');
              }
            );
          } else console.log('Within a directory to save the log file specified is not true! Unable to save the report!');
        });
      }
    } catch (e) {
      console.log('Warning! Config is not initialize!');
    }
  }

  /*
    The methods of this object determines the type of the requested file. 
    Determining the required http headers for correct work File Transfer
  */
  var headerInspect = {
    // The list of defined types
    getMIMEtype: function(path) {
      var types = {
        'appcache': 'text/cache-manifest',
        'atom': 'application/atom+xml',
        'bin': 'application/octet-stream',
        'css': 'text/css',
        'gif': 'image/gif',
        'gz': 'application/x-gzip',
        'htm': 'text/html',
        'html': 'text/html;charset=UTF-8',
        'ico': 'image/x-icon',
        'tiff': 'image/tiff',
        'tar': 'application/x-tar',
        'avi': 'video/x-msvideo',
        'mpe': 'video/mpeg',
        'mpg': 'video/mpeg',
        'mpeg': 'video/mpeg',
        'jpeg': 'image/jpeg',
        'jpg': 'image/jpeg',
        'js': 'application/javascript',
        'json': 'application/json',
        'mp3': 'audio/mpeg',
        'mp4': 'video/mp4',
        'ogg': 'audio/ogg',
        'ogv': 'video/ogg',
        'pdf': 'application/pdf',
        'png': 'image/png',
        'rss': 'application/rss+xml',
        'svg': 'image/svg+xml',
        'txt': 'text/plain;charset=UTF-8',
        'webm': 'video/webm',
        'woff': 'application/font-woff',
        'xml': 'application/xml,text/xml',
        'zip': 'application/zip',
      }

      path = path.split('.');
      if (path.length == 2 && path[1] != '') {
        var type = types[path[1]];
        if (type != undefined) {
          return type;
        } else return types['bin'];
      } else return types['bin'];
    },

    /*
      The transfer of the requested file. 
      Determine the type and installation of the http headers
    */
    sendFile: function(path, res, is_asset, req) {
      try {
        var file = path.split('/');
        file = file[file.length - 1];

        if (file == '') {
          throw 'Specified file not found!';
        }
        var type = headerInspect.getMIMEtype(path);
        fs.open(path, 'r', function(e, fd) {
          if (!e) {
            fs.readFile(path, function(e, data) {
              if (e) {
                managerErrors(e, res, APP_FILE_NOT_FOUND, req);
                return;
              }

              res.setHeader('Content-Description', 'File Transfer');
              if (is_asset == undefined) {
                res.setHeader('Content-Disposition', ' attachment; filename=' + file);
              }
              res.setHeader('Content-Type', type);
              res.setHeader('Expires', '0');
              res.setHeader('Cache-Control', 'must-revalidate');
              res.setHeader('Pragma', 'public');
              res.setHeader('Content-Length', data.length);
              res.end(data);
            });
          } else {
            managerErrors(e, res, APP_FILE_NOT_FOUND, req);
          }
        });
      } catch (errMsg) {
        managerErrors(errMsg, res, APP_FILE_NOT_FOUND, req);
      }
    },


    /*
      Defining the data type for method "send". 
      Json serialization and array types definition html format and a simple string
    */
    checkByTypeParam: function(param) {
      var dataType = 'text/plain',
        data;
      //If the data type of the object or function to convert a string
      if (typeof param == 'object' || typeof param == 'function') {
        data = JSON.stringify(param);
      } else {
        if (typeof param == 'string') {
          //If the line check whether it has the HTML tags
          data = param.match(/^<.*>/);
          //get data
          if (data != null) data = data[0];

          //If there is data , and the data was not changed after the filter regular expressions , we have html code
          //or simply take the data and give a title text/plain
          if (data != null && data.length == param.length) {
            dataType = 'text/html';
          } else data = param;
          //If the data is not an object or a string convertible to a string
        } else data = param.toString();
      }
      //Return the data type and data
      return {
        type: dataType,
        body: data
      };
    },


    init: function(param1, param2, res, req) {
      var item;
      try {
        if (!param1 && !param2) throw "The parameters are not defined correctly!";
        if (!param2) {
          item = param1;
        } else item = param2;

        // Get info
        var data = this.checkByTypeParam(item);

        // The session was initialized
        if (_config.session.enabled) {

          if (req.session.dataUploaded == false) {
            var opt = {
              'Content-type': data.type
            };

            for (var i in req.session.httpOptions) {
              opt[i] = req.session.httpOptions[i];
            }

            if ((typeof param1 == 'number' || (typeof param1 == 'string' && param1.toString().match(/\d{3,3}/) != null)) && param2 != undefined) {
              res.writeHeader(param1, opt);
            } else res.writeHeader(202, opt);
            res.end(data.body);

          } else {
            // If you want to wait for the data for the header
            req.session.callback(
              function() {
                var opt = {
                  'Content-type': data.type
                };

                for (var i in req.session.httpOptions) {
                  opt[i] = req.session.httpOptions[i];
                }

                if ((typeof param1 == 'number' || (typeof param1 == 'string' && param1.toString().match(/\d{3,3}/) != null)) && param2 != undefined) {
                  res.writeHeader(param1, opt);
                } else res.writeHeader(202, opt);
                res.end(data.body);
              }
            );
          }
        } else {
          if ((typeof param1 == 'number' || (typeof param1 == 'string' && param1.toString().match(/\d{3,3}/) != null)) && param2 != undefined) {
            res.writeHeader(param1, {
              'Content-type': data.type
            });
          } else res.writeHeader(202, {
            'Content-type': data.type
          });
          res.end(data.body);
        }  
      } catch (errMsg) {
        managerErrors(errMsg, res, APP_SERVER_LAYER_ERR, req);
      }
    }
  }


  /*
    Simple template. Parsing data from the cache, 
    processing lines and replacement of template for the pattern
  */
  var templateManager = {
    renderTemplate: function(res, req, source, options, callback) {
      var arg = source.match(/<\$\?\.?([;'":A-Za-z0-9-_+()*\/\\ ]{1,}).?\?>/i);
      // If there is no match in the pattern comes out of treatment
      if (!arg || !options) {
        callback(res, req, source);
        return;
      }

      var obj_vars = [],
        t, str;

      var val;
      while (!!arg) {
        if (arg.length === 0) break;
        t = arg[0];
        str = '';

        var data = t.match(/<\$\?.?(.*).?\?>/i);
        var val;

        data[0].split('').forEach(function(i, v) {
          if (/[A-Za-z0-9_$]/.test(i)) {
            str += i;
          } else {
            if (options[str] || str == 'root_assets') {
              if (str == 'root_assets' && _config.production.enabled == false) {
                val = '';
              } else val = ((typeof options[str] == 'string') && str !== 'root_assets' ? '"' + options[str] + '"' : options[str]);

              if (('function') == typeof options[str]) {
                val = options[str].toString();
                // remove var from template        
              } else if ('object' == typeof options[str]) {
                val = JSON.stringify(options[str]);
              }

              // List substring to replace
              obj_vars.push({
                value: str,
                data: val
              });
            }
            str = '';
          }
        });

        var ap = t;
        obj_vars.forEach(function(i, v) {
          t = t.replace(i.value, i.data);
        });

        t = t.replace('<$?', '').replace('?>', '');
        source = source.replace(ap, t);
        arg = source.match(/<\$\?.?([;'":A-Za-z0-9_+()*\/\\ ]{1,}).?\?>/i);

        if (arg === null) {
          callback(res, req, source);
        }
      }

      callback(res, req, source);
    },


    sendData: function(res, req, data) {
      if (_config.session.enabled) {

        if (req.session.dataUploaded == false) {
          var t = {
            'Content-type': 'text/html'
          };
          for (var i in req.session.httpOptions) {
            t[i] = req.session.httpOptions[i];
          }
          res.writeHeader(202, t);
          res.end(data);

        } else {
          req.session.callback(
            function() {
              var t = {};
              for (var i in req.session.httpOptions) {
                t[i] = req.session.httpOptions[i];
              }

              res.writeHeader(202, t);
              res.end(data);
            }
          );
        }
      } else {
        //console.log('data images');
        res.writeHeader(202, {
          'Content-type': 'text/html'
        });
        res.end(data);
      }
    },


    send: function(res, req, data) {
      this.sendData(res, req, data);
    },


    checkByRoutes: function(pathToDir, fullPath, res, params, req) {
      var self = this;

      // If params is unspecified create an empty object
      if (!params) params = {};
      if (_config.production.enabled && _config.production.path) {
        params.root_assets = _config.production.path;
      } else params.root_assets = '';

      try {
        fullPath = 'views/' + fullPath.split('/').slice(1, this.length).join('/');
        /*
          If we put out false flag in the render method then give part of the template
        */
        if (res.isPart | res.layout === undefined) {
          var file;

          try {
            file = cacheTemplate.parts[fullPath];
            fs.statSync(fullPath + '.html');

            if (file == undefined) {
              fs.readFile(fullPath + '.html', "utf-8", function(e, data) {
                if (e) {
                  managerErrors(e, res, APP_SERVER_VIEW_ERR, req);
                  return;
                }

                res.renderTemplate(res, req, data.toString(), params, self.sendData);
                cacheTemplate.parts[fullPath] = data.toString();
              });
            } else {
              file = cacheTemplate.parts[fullPath];
              res.renderTemplate(res, req, file, params, self.sendData);
            }

          } catch (e) {
            managerErrors(e, res, APP_SERVER_VIEW_ERR, req);
          }

        } else {
          var layout = cacheTemplate.layouts[res.layout + ':' + fullPath];

          if (layout == undefined) {
            try {
              var path = _pathToLayouts + res['layout'] + '.html';
              fs.statSync(path);
              fs.readFile(path, "utf-8", function(e, template) {
                template = template.toString();

                try {
                  path = fullPath + '.html';
                  fs.statSync(path);
                  fs.readFile(path, "utf-8", function(e, data) {
                    if (e) {
                      managerErrors(false, res, APP_SERVER_VIEW_ERR, req);
                      return;
                    }

                    data = data.toString();
                    // Replace the content of the template block
                    template = template.replace('__content__', data);
                    res.renderTemplate(res, req, template, params, self.sendData);
                    cacheTemplate.layouts[res.layout + ':' + fullPath] = template;
                  });
                } catch (e) {
                  managerErrors(e, res, APP_SERVER_VIEW_ERR, req);
                }

              });
            } catch (e) {
              managerErrors(e, res, APP_SERVER_TEMPLATE_ERR, req);
            }

          } else {
            res.renderTemplate(res, req, layout, params, self.sendData);
          }
        }
      } catch (e) {
        managerErrors(e, res, APP_SERVER_LAYER_ERR, req);
      }
    },


    error: function(path, res) {
      this.checkByRoutes('error', path, res);
    },


    render: function(method, params, c, res, req) {
      try {
        var pathToDir = c[1] == '/' ? '/index' : '/' + c[1],
          pathToTemplate,
          fullPath;
        //  If you pass a path or name view
        //  Parse request
        var pathMethod = method.match(/^\/?((\w*)\/?(\w*))?/);
        if (_staticRoute[pathMethod[0]] == undefined) {
          //If the URL is specified and the method
          //if(tmp_action[1] != '') method = tmp_action[1];
          //If the controller default simply concatenate string
          pathToTemplate = method == '/' ? '/index' : '/' + method;

          //If the regular season and did not return Null 0 array element is equal to the query string , 
          //and one element is not equal to an empty string

          if (pathMethod != null) {
            //If only the name view
            if (!pathMethod[3]) {
              //Concatenating a directory of the current directory of the current controller
              fullPath = '.' + pathToDir + pathToTemplate;
              this.checkByRoutes(c[1], fullPath, res, params, req);
              //console.log(fullPath);
            } else {
              //If you specify a full path, looking for the root
              fullPath = '.' + pathToTemplate;
              this.checkByRoutes(c[1], fullPath, res, params, req);
            }
          } else {
            //console.log('test'+'fsdfsd');
            fullPath = '.' + pathToDir + '/index';
            this.checkByRoutes(c[1], fullPath, res, params, req);
          }
        }

      } catch (e) {
        managerErrors(e, res, APP_SERVER_LAYER_ERR);
      }
    }
  }


  /*
    The basic routing method. 
    Http request parsing and routing the request for processing the layers.
    We hang handlers on the request object
  */
  var _route = function(req, res) {
    var url_asset,
      seg1, seg2,
      method = req.method;

    //cacheURI[urlPathname]=urlSegments;
    var urlSegments = req.url_segments;
    var urlPathname = req.url_pathname;

    seg1 = urlSegments[1];
    seg2 = urlSegments[2];

    res.renderTemplate = function(res, req, s, o, c) {
      templateManager.renderTemplate(res, req, s, o, c);
    }

    res.send = function(p, p2) {
      headerInspect.init(p, p2, res, req);
    }

    res.render = function(path, params, isPart) {
      res.isPart = isPart;
      res.layout = _routes[method][seg1].layout;
      templateManager.render(path, params, urlSegments, res, req);
    }

    res.error = function(path) {
      templateManager.error('.' + path, res, req);
    }

    res.sendFile = function(path, is_asset) {
      headerInspect.sendFile(path, res, is_asset, req);
    }

    res.next = function() {
      if (!res.hasOwnProperty('level')) {
        res.level = _routes[method][seg1][seg2].step;
      }

      var count = _routes[method][seg1][seg2].step;
      var currentCallback = count - res.level;

      if (res.level > 0) {
        res.level--;
        _routes[method][seg1][seg2].layers[currentCallback](req, res);
      } else {
        _routes[method][seg1][seg2].callback(req, res);
      }
    }

    res.redirect = function(url) {
      res.writeHeader(301, {
        Location: url,
        'Cache-Control': 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0',
      });
      res.end();
    }

    try {

      if (!req.isStatic) {
        var controllerRoute = _routes[method][seg1];
        //console.info('controller ',partController);
        //console.info('method ',partMethod);

        if (!controllerRoute && !_routes[method].hasOwnProperty(seg1)) {
          throw ('Controller "' + ((urlPathname == '/' || urlPathname == '//') ? 'index' : urlPathname) + '" is not found!');
        }


        if (!controllerRoute[seg2]) {
          var method = seg2 == '/' ? 'index' : seg2;
          throw ('Method "' + method + '" is not found!');
        }


        //jump by layers
        if (!res.hasOwnProperty('level')) {
          res.level = controllerRoute[seg2].step;


          //console.log('level '+ res.level);
          if (res.level <= 0) {
            //console.log('CALLED');
            controllerRoute[seg2].callback(req, res);
          } else {
            res.level--;
            controllerRoute[seg2].layers[0](req, res);
          }
        }

      } else {
        urlSegments = urlSegments.input.split('/');
        if (!req.partController && !!req.partMethod) {
          url_asset = req.partMethod;
          url_asset += '/' + urlSegments.slice(3, urlSegments.length).join('/');
        } else {
          url_asset = req.partController;
          url_asset += '/' + urlSegments.slice(2, urlSegments.length).join('/');
        }

        res.sendFile(url_asset, res, 1, req);
      }

    } catch (errMsg) {
      managerErrors(errMsg, res, APP_NOT_FOUND_ERR, req);
    }
  }


  /*
    InitMialization and identification of the main routing. 
    Through modules or the layer 0
  */
  this.init = function(port, ip) {
    SERVER = new http.Server();
    SERVER.on('request', function(req, res) {

      //url_parse.parse(req.url).pathname;        
      //  If the request for favicon just give a static file
      if (req.url == '/favicon.ico') {
        headerInspect.sendFile('favicon.ico', res, 1, req);
        return;
      }

      req.url_segments = req.url.match(/\/(\w{1,})\/?(\w{1,})?/);

      // set subdomain
      req.sub_domain = req.headers.host.split('.');
      if (req.sub_domain.length > 2) {
        req.sub_domain = req.sub_domain[0];
      } else {
        req.sub_domain = undefined;
      }

      if (req.url_segments == null) req.url_segments = [0, '/', '/'];
      if (req.url_segments[2] == undefined) req.url_segments[2] = '/';

      req.url_pathname = req.url;

      req.partController = _staticRoute[req.url_segments[1]],
        req.partMethod = _staticRoute[req.url_segments[2]];

      try {
        if (!!req.partController || !!req.partMethod &&
          !_routes[req.method][req.url_segments[1]][req.url_segments[2]]
        ) {
          req.isStatic = true;
        } else req.isStatic = false;

      } catch (e) {
        req.isStatic = false;
      }

      if (!_activeModules.length || req.isStatic) {
        _route(req, res);
      } else {
        callModules(req, res, 0);
      }
    }).listen(port, ip);
  }

  // Initialize the Web routing socket
  this.ws_init = function(port) {
    ws.createServer(function(conn) {
      ws_connect = conn;
      console.log("New connection " + Date.now());

      conn.on('text', function(request) {
        var data = JSON.parse(request);
        if (data['controller'] != undefined && data['action'] != undefined) {
          var param = data['param'] != undefined ? data['param'] : '';
          _routes['WS'][data.controller][data.action].callback(param, ws_connect);
        }
      });

      conn.on("close", function(code, reason) {
        console.log("Connection closed")
      });
    }).listen(port)
  }


  this.setAlias = function(path, alias) {
    _aliasRoute[alias] = path;
  }


  this.post = function(route, subRoute, callback) {
    var args = Array.prototype.slice.call(arguments);
    args.push('POST');
    setRoute.apply(this, args);
  }


  this.get = function(route, subRoute, callback) {
    var args = Array.prototype.slice.call(arguments);
    var arr = args.slice(0, 3);
    arr.push('GET');
    if (arr.length > 3) {
      arr.push(args.slice(3, args.length));
    }
    setRoute.apply(this, arr);
  }


  this.ws = function(route, callback) {
    _routes['WS'][route] = {
      callback: callback,
      type: 'WS'
    }
  }


  //  Defining alias static path
  this.setStaticPath = function(path, alias) {
    _staticRoute[alias] = path;
    _staticRoute[path] = path
  }

  /*
    Adding routing facilities for the POST, GET requests. 
    Defining the types of objects
  */
  this.setRouts = function(path, routes) {
    for (var i in routes) {
      for (var v in routes[i]) {
        if (typeof routes[i] == 'object') {
          if (!_routes[i][path]) {
            _routes[i][path] = {
              access: 1,
              layout: routes.layout
            };
          }
          _routes[i][path][v] = routes[i][v];
        }
      }
    }
  }


  var setRoute = function(route, subRoute, callback, type, layers) {
    if (!_routes[type][route]) {
      _routes[type][route] = {
        access: 1
      };
    }

    //Set route and check
    try {
      var parseRoute = subRoute.match(/[A-Za-z]{1,20}/);
      if (parseRoute != null) {
        if ((parseRoute.length == subRoute.length) && (subRoute != '/')) {
          throw ('Invalid method"' + subRoute + '"!');
        }
      } else if (subRoute != '/') {
        throw ('Invalid method"' + subRoute + '"!');
      }

      if (layers == undefined) layers = [];
      //Binding data for route. Here is data about quantity layers, type request, and callback method
      _routes[type][route][subRoute] = {
        callback: callback,
        type: type,
        layers: layers,
        step: layers.length
      }
    } catch (e) {
      console.log(e);
    }
  }
})();
