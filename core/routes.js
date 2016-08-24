module.exports = new(function() {
  'use strict';

    this._route = {
      "POST": {},
      "GET": {},
      "WS": {}
    },


    this.getRoutes = function() {
      var r = this._route;
      r.layout = this.layout;

      this._route = {
        "POST": {},
        "GET": {},
        "WS": {}
      }
      return r;
    }


  this.post = function(route, callback) {
    var args = Array.prototype.slice.call(arguments);
    var arr = args.slice(0, 2);
    args.push('POST');
    if (arr.length > 2) {
      arr.push(args.slice(2, args.length));
    }
    setRoute.apply(this, args);
  }


  this.get = function(route, callback) {
    var args = Array.prototype.slice.call(arguments);
    var arr = args.slice(0, 2);
    arr.push('GET');
    if (arr.length > 2) {
      arr.push(args.slice(2, args.length));
    }
    setRoute.apply(this, arr);
  }


  this.ws = function(route, callback) {
    this._route['WS'][route] = {
      callback: callback,
      type: 'WS'
    }
  }


  var setRoute = function(route, callback, type, layers) {
    try {
      var fix = route.match(/[A-Za-z0-9]{1,20}/);
      if (fix != null) {
        if ((route.match(/[A-Za-z0-9]{1,20}/).length == route.length) && (route != '/')) {
          throw ('Invalid method"' + route + '"!');
        }
      } else if (route != '/') {
        throw ('Invalid method"' + route + '"!');
      }

      if (layers == undefined) layers = [];

      this._route[type][route] = {
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
