"use strict";

var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var port = process.env.DC_PORT;
if(!port) {
  console.error("Port must be specified in DC_PORT environment variable.");
  return;
}

io.on('connection', function(socket){
  console.log("a user connected");
});

http.listen(port, function(){
  console.log("listening on *:" + port);
});