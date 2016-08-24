var crypto = require('crypto');

module.exports = function(expires) {
  'use strict';
  
  this.time_range = expires;
  var context = this;

  this.init = function(req, res, step, callback) {

    //console.log('step session : '+ step);

    var self = context;
    var cb = callback;
    // Create session structure
    req.session = {};
    req.session.data = {};
    // HTTP Response parameters
    req.session.httpOptions = {};

    // Default storage time 
    req.session.time_range = self.time_range;
    req.session.dataUploaded = false;

    req.session.cbComplete = null;

    // Call-back method of return expectations for these sessions
    req.session.callback = function(callback) {
      req.session.cbComplete = callback;
    }

    // Call call-back method for response with special session parameter/ uid
    req.session.successData = function(){
      if(req.session.cbComplete != null) {
        req.session.cbComplete();
      }
    }

    // Set key-value data in current session
    req.session.set = function(v) {
      console.info(v);
      if (req.session.hasOwnProperty('uid')) {
        req.client.hmset(req.session.uid, v);
        Object.keys(v).forEach(function(i, data) {
          req.session.data[i] = v[i];
        });
      }
    }

    // Get data of the current session
    req.session.get = function(attr) {
      return req.session.data.hasOwnProperty(attr) ? req.session.data[attr] : null;
    }

    // Method client authorization. Set data to redis storage
    req.session.authStatus = function(status) {
      var self = this;
      // Get a part of the IP client for secure key-prefix
      var hash = req.connection.remoteAddress.split('.').join('').slice(2, 6);
      hash = '_' + hash + crypto.createHmac('md4', (Date.now() + (Math.random() % 1000).toString())).digest('hex').toString();

      // Checking cookie and create/remove session
      if (this.hasOwnProperty('uid') && !status) {
        req.client.del(this.uid);
        req.session.httpOptions = {
          'Set-Cookie': '_uid='+ this.uid +';expires=' +  new Date(0).toUTCString() + ';Path=/;'
        }
        delete this.uid;
      } else if (status) {
        if(this.hasOwnProperty('uid') && req.session.dataUploaded == false) {
          return false;
        } else {
          req.session.dataUploaded = true;
        } 
        
        // Verifying the exist of this session
        req.client.exists(hash, function(err, reply) {
          if (reply === 1) {
            setOptions(hash, self, req);
          } else {
            upSession(hash, self, req);
          }
        });

        // Create session. Set user id in a redis storage
        function upSession(uid, context, req) {
          req.client.hmset(uid, {
            data: ''
          });

          req.client.expire(uid, self.time_range);
          setOptions(uid, context, req);
        }

        // Set cookie int http options for session update
        function setOptions(uid, context, req) {
          var date = new Date(new Date().getTime() + context.time_range * 1000);
          
          context.httpOptions = {
            'Set-Cookie': '_uid=' + uid + ';expires=' + date.toUTCString() + ';Path=/;'
          }

          if(req.session.cbComplete != null){
            req.session.successData();
          } else {
            req.session.dataUploaded = false;
          }
        }

      }
    }

    // Return the status of state
    req.session.isAuth = function() {
      if (!this.uid) return false;
      return req.client.exists(this.uid) == null ? false : true;
    }

    req.session.getOptions = function() {
      return this.httpOptions;
    }

    req.session.remove = function() {
      self.remove(this, self);
    }


    if (!req.headers.hasOwnProperty('cookie')) {
      if (
        typeof req.headers.cookie != 'string' ||
        !~req.headers.cookie.indexOf('_uid')
      ) {
        // if cookie is empty and session module is enabled
        callback(req, res, ++step);
        return;
      }
    }

    
    var l = req.headers.cookie.match(/(_uid)=([A-Za-z0-9_]{1,})/);
    // If session parameters is undefined call next method of route
    if (l != null) {
      if (l.length > 1) {
        var time = Date.now();
        req.client.hgetall(l[2], function(err, data) {
          // Session data is writen for rewrite to header request
          if (data != null) {
            req.session.uid = l[2];
            updateSession(data, req, self);
          } else {
            callback(req, res, ++step);
          }
        });

        function updateSession(data, req, self) {
          req.client.hmset(req.session.uid, data);
          req.session.data = data;
          req.client.expire(req.session.uid, req.session.time_range);
          var date = new Date(new Date().getTime() + req.session.time_range * 1000);
          req.session.httpOptions = {
            'Set-Cookie': '_uid=' + req.session.uid + ';expires=' + date.toUTCString() + ';Path=/;',
          }
          callback(req, res, ++step);
        }
      } else callback(req, res, ++step);
    } else callback(req, res, ++step);  
  }
}
