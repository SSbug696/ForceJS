module.exports = function(routes){

  routes.layout = 'basic';

  routes.get('/', function(req, res){
    res.render('index');
  });

  routes.ws('/', function(param, conn){
    conn.sendText( JSON.stringify({ recv_text: param.text,  status: param.status }) )
  });
  
  return routes.getRoutes();
}
