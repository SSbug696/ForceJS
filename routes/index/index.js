module.exports = function(routes){
  routes.layout = 'basic';

  routes.get('/', function(req, res){
    res.render('index', { page: ' index page '});
  });

  routes.get('auth', function(req, res){
    req.session.authStatus(true);
    res.redirect('/');
  });


  routes.post('testAjax', function(req, res){
    res.send('hello!');
  });

  routes.get('auth', function(req, res){
    res.send(200, 'success!');
  });


  routes.get('account', function(req, res){
    res.render('account', { highload: 'good load is good!' });
  });


  routes.ws('/', function(param, conn){
    conn.sendText( JSON.stringify({ recv_text: 'Hello! ' + param.text,  status: param.status }) );
  });
  
  return routes.getRoutes();
}

