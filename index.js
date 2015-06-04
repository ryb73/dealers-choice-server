"use strict";

var app         = require("express")(),
    http        = require("http").Server(app),
    io          = require("socket.io")(http),
    dcEngine    = require("dc-engine"),
    GameFactory = dcEngine.GameFactory,
    GameManager = require("./lib/game-manager");

function Server() {
  var gameManagers = {};

  function initialize() {
    var port = process.env.DC_PORT;
    if(!port) {
      console.error("Port must be specified in DC_PORT environment variable.");
      return;
    }

    io.on("connection", function(socket){
      var player, manager;

      console.log("a user connected");

      socket.on("action", function(msg, ack) {
        var toRoom;

        console.log("message: " + JSON.stringify(msg));
        if(msg.cmd === "create") {
          manager = new GameManager();
          gameManagers[manager.uuid()] = manager;
          toRoom = io.to(gameRoom(manager.uuid()));
          player = manager.addPlayer(toRoom.emit);
          ack(manager.uuid());
          socket.join(toRoom);
        } else if (msg.cmd === "join") {
          var gameId = msg.id;
          manager = gameManagers[gameId];
          if(!manager) {
            socket.emit("response", "no game");
          } else {
            toRoom = io.to(gameRoom(manager.uuid()));
            player = manager.addPlayer(toRoom.emit);

            socket.emit("response", "joined game");
          }
        }
      });

      socket.on("disconnect", function () {

      });
    });

    http.listen(port, function(){
      console.log("listening on *:" + port);
    });
  }

  function gameRoom(id) {
    return "gm" + id;
  }

  initialize();
}

module.exports = Server;

new Server();