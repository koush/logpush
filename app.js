
/**
 * Module dependencies.
 */

var express = require('express');
var url = require('url');
var http = require('http');
var https = require('https');

var app = module.exports = express.createServer();

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
});

var post = function(options, callback) {
  var urlStr = options.url;
  var data = options.data;
  var module = options.module;
  if (!module)
    module = http;
  var dataString = '';
  for (var key in data) {
    var value = data[key];
    dataString += encodeURIComponent(key) + "=" + encodeURIComponent(value) + "&";
  }
  
  var headers = { 'Accept': '*/*', 'User-Agent': 'curl', 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': dataString.length };
  var providedHeaders = options.headers;
  if (providedHeaders) {
    for (var k in providedHeaders) {
      headers[k] = providedHeaders[k];
    }
  }

  var u = url.parse(urlStr);
  var req = module.request({ method: 'POST', host: u.host, port: u.port, path: u.pathname + (u.search ? u.search : ''), headers: headers },
   function(res) {
     var data = '';
     res.on('data', function(chunk) {
       data += chunk;
     }).on('end', function() {
       callback(null, data);
     });
   }).on('error', function(error){
     console.log('error during ajax');
     console.log(error);
     callback(error);
   });
   
   req.write(dataString);
   req.end();
}

// Routes

var registrations = {};

app.get('/:registration_id', function(req, res){
  var registrationId = req.params.registration_id;
  var now = Date.now();
  var entry = registrations[registrationId];
  if (!entry) {
    registrations[registrationId] = entry = {}
  }
  
  var cleanup = function() {
    try {
      console.log('cleaning up');
      delete entry[now];
      res.end();
    }
    catch (e) {
    }
  }
  
  req.on('close', function() {
    cleanup();
  });
  
  var username = req.query.username;
  var password = req.query.password;
  
  var listener = {
    data: function(data) {
      res.write(data);
    },
    end: function() {
      cleanup();
    }    
  }
  
  entry[now] = listener;

  var data = {
      "accountType": "HOSTED_OR_GOOGLE",
      "Email": username,
      "Passwd": password,
      "source": "logmonkey",
      "service": "ac2dm"
  };
  post({module: https, url: 'https://www.google.com/accounts/ClientLogin', data: data }, function(err, data) {
    if (err) {
      res.send(err);
      cleanup();
      return;
    }
    
    var auth;
    var lines = data.split('\n');
    for (var line in lines) {
      line = lines[line];
      var pair = line.split('=');
      if (pair.length != 2)
        continue;
      if (pair[0] == 'Auth')
        auth = pair[1];
    }
    
    if (!auth) {
      res.send('no auth received');
      cleanup();
      return;
    }
    
    var data = {
      'collapse_key': now,
      'registration_id': registrationId
    };
    
    data['data.type'] = 'log';
    post({ url: 'http://android.apis.google.com/c2dm/send', data: data, headers: { Authorization: 'GoogleLogin auth=' + auth } }, function(err, data) {
      if (err) {
        res.send(err);
        cleanup();
        return;
      }
    });
  });
});

app.post('/:registration_id', function(req, res) {
  console.log('post received');
  var registrationId = req.params.registration_id;
  
  req.on('data', function(data) {
    var entry = registrations[registrationId];
    if (!entry || Object.keys(entry).length == 0) {
      delete registrations[registrationId];
      delete registrations[registrationId];
      req.connection.destroy();
      console.log('unregistering');
      return;
    }
    
    for (var listener in entry) {
      listener = entry[listener];
      listener.data(data);
    }
    
    console.log(data);
  });
});


var listenPort = process.env.PORT == null ? 3000 : parseInt(process.env.PORT);
app.listen(listenPort);
console.log('Express app started on port ' + listenPort);
