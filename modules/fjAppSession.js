var crypto = require('crypto');

module.exports = function(expires) {
  'use strict';
  
  this.storage = {};
  this.time_range = expires;
  var context = this;

  this.init = function(req, res, step, callback) {
    var self = context;
    var cb = callback;

    req.session = {};
    req.session.data = {};
    req.session.httpOptions = {};

    req.session.set = function(v) {
      var bscope = self;
      var context = this;

      if (typeof v == 'object') {
        Object.keys(v).forEach(function(i) {
          if (i != '_uid') {
            context.data[i] = v[i];
            bscope.storage[context.uid][i] = v[i];
          }
        });
      }
    }

    req.session.authStatus = function(status) {
      var bscope = self;

      if (this.hasOwnProperty('uid') && !status) {
        if (!bscope.storage.hasOwnProperty(this.uid)) return;
        delete bscope.storage[this.uid];
        this.uid = '_';
      } else if (status) {
        if (!bscope.storage.hasOwnProperty(this.uid) ||
          this.uid == '_') {
          var date = new Date;
          var str = '';
          var s = '_' + crypto.createHmac('md4', (Date.now() + (Math.random() % 1000).toString())).digest('hex').toString();

          while (bscope.storage[s] != undefined) {
            s = '_' + crypto.createHmac('md4', (Date.now() + (Math.random() % 1000).toString())).digest('hex').toString();
          }

          bscope.storage[s] = {
            date: Date.now()
          }
          this.uid = s;
        }
        var str = '';

        var date = new Date(new Date().getTime() + self.time_range * 1000);
        this.httpOptions = {
          'Set-Cookie': '_uid=' + this.uid + ';expires=' + date.toUTCString() + ';Path=/;'
        }
      }
    }

    req.session.get = function(attr) {
      return this.data[attr];
    }

    req.session.isAuth = function() {
      var bscope = self;
      if (this.hasOwnProperty('uid')) {
        if (bscope.storage.hasOwnProperty(this.uid)) {
          return Date.now() - bscope.storage[this.uid].date > (bscope.time_range + 10) * 1000 ? false : true;
        }
      }
      return false;
    }

    req.session.getOptions = function() {
      return this.httpOptions;
    }

    req.session.remove = function() {
      self.remove(this, self);
    }

    var time = Date.now();
    if (!req.headers.hasOwnProperty('cookie')) {
      if (
        typeof req.headers.cookie != 'string' ||
        !~req.headers.cookie.indexOf('_uid')
      ) {
        callback(req, res, ++step);
        return;
      }
    }

    var l = req.headers.cookie.match(/(_uid)=([A-Za-z0-9_]{1,})/);
    if (l != null)
      req.session.uid = l[2];

    if (self.storage.hasOwnProperty(req.session.uid)) {
      var session_data = self.storage[req.session.uid];

      if (time - session_data.date > (self.time_range + 10) * 1000) {

        console.log('DELETE SESSION');

        delete self.storage[req.session.uid];
        req.session.uid = '_';
      } else {

        self.storage[req.session.uid].date = time;
        var date = new Date(new Date().getTime() + self.time_range * 1000);
        var str = '_uid=' + req.session.uid;

        Object.keys(session_data).forEach(function(i) {
          req.session.data[i] = session_data[i];
        });

        req.session.httpOptions = {
          'Set-Cookie': str + ';expires=' + date.toUTCString() + ';Path=/;',
        }

        console.info('session data ', req.session.data);
        console.log('UPDATE SESSION');
      }
    }

    callback(req, res, ++step);
  }
}
