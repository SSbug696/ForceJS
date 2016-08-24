var url = require('url');
var query_string = require('querystring');
var parse_form = require('formidable');
//var form = new parse_form;

module.exports = function(req, res, step, callback) {
	if(req.method == 'GET') {
		req.data = {
      fields: query_string.parse( url.parse(req.url).query )
		}

    callback(req, res, ++step);
	} else if(req.method == 'POST') {
    var form = new parse_form.IncomingForm();

  	form.parse(req, function(err, fields, files) { 
      if(err) req.connection.destroy();
      req.data = {
        fields: fields, 
        files: files 
      };
      
      callback(req, res, ++step);
    });	
	}
}