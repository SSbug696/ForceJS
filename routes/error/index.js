module.exports = function(routes){

  routes.layout = 'basic';

  routes.get('500', function(req, res){
    res.render('500');
  });

  routes.get('404', function(req, res){
    res.render('404');
  });
  
  return routes.getRoutes();
}
