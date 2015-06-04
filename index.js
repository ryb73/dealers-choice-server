"use strict";

var app               = require("express")(),
    http              = require("http").Server(app),
    io                = require("socket.io")(http),
    ConnectionHandler = require("./lib/connection-handler");

function Server() {
  var gameManagers = {};

  function initialize() {
    var port = process.env.DC_PORT;
    if(!port) {
      console.error("Port must be specified in DC_PORT environment variable.");
      return;
    }

    io.on("connection", function(socket) {
      new ConnectionHandler(io, gameManagers).onConnection(socket);
    });

    http.listen(port, function(){
      console.log("listening on *:" + port);
    });
  }

  initialize();
}

module.exports = Server;

new Server();