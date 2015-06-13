"use strict";

const IoServer          = require("socket.io"),
      emitter           = require("component-emitter"),
      ConnectionHandler = require("./connection-handler"),
      config            = require("../config");

function Server() {
  let self = this;
  let io;
  let gameManagers = new Map();
  emitter(this);

  function initialize() {
    if(!config.port) {
      console.error("Port must be specified in DC_PORT environment variable.");
      return;
    }

    io = IoServer.listen(config.port);

    io.on("connection", function(socket) {
      new ConnectionHandler(io, socket, gameManagers);
    });

    io.httpServer.on("listening", function() {
      console.log("listening on *:" + config.port);
      self.emit("listening");
    });

    io.httpServer.on("close", function () {
      console.log("closed connection");
      self.emit("close");
    });
  }

  function destroy() {
    io.close();
  }
  this.destroy = destroy;

  initialize();
}

module.exports = Server;