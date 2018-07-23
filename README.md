### ForceJS


##### The fastest and flexible framework. You can create simple websites, and websites based on the principles of isomorphism. Monomorphic code that allows to ignore the differences between conventional http and websockets. 
---
##### What can?
Basic routing, layer, middlware, support for Web Sockets.
Support for the concept of building applications isomorphic.

##### Example
###### RUN file
---
```javascript
var app = require('./core/core.js');
var routes = require('./core/routes.js');
var index = require('./routes/index/index.js')(routes);

//Setter to change the kernel configuration flags
app.setConfigProperty('error_reporting.debug_mode', true);
app.setConfigProperty('error_reporting.log_save', true);
//You can download a configuration object
app.setConfigObject('myConfig', {pid:'333'});

// You can specify an alias for a path to the static
app.setStaticPath('assets', 'css');
 
app.setRouts('/', index);
app.setRouts('index', index);

app.init(1112, '127.0.0.1');
// init ws connect
app.ws_init(4010);
```
---
###### File controller(site/index)
---
```javascript
module.exports = function(routes){
  routes.layout = 'basic';
    
    routes.ws('/', function(param, conn){
        conn.sendText( JSON.stringify({ recv_text: 'Hello! ' + param.text,  status: param.status }) });
    
    routes.get('/', function(req, res){
        var uData = {
            table: 'USERS',
            data:[]    
        };
        res.render('index', { page: ' index page ', userData: uData });
    });

    routes.get('auth', function(req, res){
        //req.session.authStatus(true);
        res.redirect('/');
    });

    routes.post('testAjax', function(req, res){
        res.send('hello!');
    });
    
    routes.get('account', function(req, res){
        //req.session.set({//any data});
        res.render('account', {mywork:'data', highload: 'good load is good!'});
    });
    
    return routes.getRoutes();
}

```

##### Methods http responses
###### Methods sendFile automatically detects the type of expansion and gives the correct headings.
---
```javascript
routes.get('page', function(req, res){
	res.sendFile('film.avi'); //content-type response 'video/x-msvideo'
});

```
---
###### The send method determines the type of file. It may take 1 or 2 parameters. Transmit status of the server automatically serializes the data if the parameter passed to the function or array .
---
```javascript
	res.send(202, 'success'); // server response code - 202, content-type - text/plain
	res.send(503, {type_response: 'error'}); // server response code - 503, content type- js/json
	res.send(503, [1,2,3,4,5,6]); //// server response code - 503, content-type - text/plain
	res.send(202); //// server response code - 202, content-type - text/plain
});
```
###### Definitions as the relative path to the presentation and to the absolute ( the root )
---
```javascript
    res.render('index'); // site/index
    res.render('anotherPath/index'); //'anotherPath/index'
});
```

##### Creating layers
---
```javascript
function fileName(req, res){
    res.fileName = 'myvideo';
}

function fileExt(req, res){
    res.fileName += '.avi';
}

routes.get('page', function(req, res){
	res.sendFile(res.fileName); // 'myvideo' + '.avi'
}, fileName, fileExt);
```


##### An example of the interaction with the server means websockets

###### Сode in a file "run.js"
---
```javascript
var app = require('./core/core.js'),
    routes = require('./core/routes.js');
    site  = require('./routes/site/index.js')(routes);
    
app.setRouts('site', site);
app.init(1112, '127.0.0.1');
app.ws_init(4010);
```
###### Сode in a file controller "site"
---
```
var routes = require('./../../core/routes.js');
routes.ws('/', function(param, conn){
	conn.sendText( JSON.stringify({ recv_text: param.text,  status: param.status }) )
});
module.exports = routes;
```

---
###### Code in template
---
```javascript
<script>
	function ws(callback){
		if(typeof callback!='function') return false;
		this.socket=0;
		
		function Init(){
			socket = new WebSocket("ws://127.0.0.1:4010");
			socket.onopen = function(){
			  console.log("Connect");
			};
			socket.onmessage = callback;
			socket.onclose = function(event){
			  if(event.wasClean){
			    console.log('Close connect success');
			  } else {
			  	getMessage();
			   	console.log('Refused connect'); 
			  }
			}
			  		 
			socket.onerror = function(error) {
				getMessage();
			  	console.log("Error " + error.message);
			};
		}
		Init();
		
		this.send=function(v){
			socket.send(v);
		};
		
		this.close=function(){
			socket.close();
			return true;
		}
	}
	var getMessage = function(event){
			if(typeof event['data'] == 'undefined') return false;
			var data = JSON.parse(event.data);
			try{	
				var data_server = data;
				console.info(data_server);
			}catch(e){
				console.info(e);
			}
		}
	
	var wsock = new ws(getMessage);
	setTimeout(function(){
		wsock.send( 
			controller:'site',
				action:'/',
				param:{
					text:"it's site controller",
					status:'success'
				}
		); }, 400);
			
</script>
```
