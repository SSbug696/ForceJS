/*
var AWS = require('aws-sdk');
AWS.config.region = 'us-west-2';


var s3bucket = new AWS.S3({params: {Bucket: 'shop3dshow'}});
s3bucket.createBucket(function() {
  var params = {Key: 'AKIAJILMTUF3IA53V5WQ', Body: 'Hello!'};
  s3bucket.upload(params, function(err, data) {
    if (err) {
      console.log("Error uploading data: ", err);
    } else {
      console.log("Successfully uploaded data to myBucket/myKey");
    }
  });
});
*/



module.exports = function(routes){

  routes.layout = 'basic';

  routes.get('/', function(req, res){
    
    var uData = {
      table: 'USERS',
      data:[
        {
          name: 'Alex',
          age: '22'
        },

        {
          name: 'Max',
          age: '22'
        },

        {
          name: 'Elena',
          age: '32'
        },          
      ]
    };
    
    res.render('index', { page: ' index page ', userData: uData });
  });

  routes.get('auth', function(req, res){
    req.session.authStatus(true);
    res.redirect('/');
  });


  routes.post('testAjax', function(req, res){
    res.send('hello!');
  });

  routes.get('auth', function(req, res){
    console.log('log')
    res.send(200, 'ok!');
  });


  routes.get('account', function(req, res){
    req.session.set();
    res.render('account', {mywork:'data', highload: 'good load is good!'});
  });


  routes.ws('/', function(param, conn){
    conn.sendText( JSON.stringify({ recv_text: 'Hello! ' + param.text,  status: param.status }) );
  });
  
  return routes.getRoutes();
}

