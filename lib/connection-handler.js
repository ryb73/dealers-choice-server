"use strict";

var _           = require("lodash"),
    GameManager = require("./game-manager");

function ConnectionHandler($io, $gameManagers) {
  var io = $io;
  var gameManagers = $gameManagers;
  var player, manager;

  function onConnection(socket) {
      console.log("a user connected");

      socket.on("action", function(msg, ack) {
        var room;

        console.log("message: " + JSON.stringify(msg));
        if(msg.cmd === "create") {
          manager = new GameManager();
          gameManagers[manager.uuid()] = manager;
          room = gameRoom(manager.uuid());
          player = manager.addPlayer(io.to(room).emit);
          ack(manager.uuid());
          socket.join(room);
        } else if (msg.cmd === "join") {
          var gameId = msg.id;
          manager = gameManagers[gameId];
          if(!manager) {
            ack(1);
            return;
          }

          room = gameRoom(manager.uuid());
          player = manager.addPlayer(io.to(room).emit);
          if(!player) {
            ack(2);
            return;
          }

          socket.join(room);
          ack(0);
        }
      });

      socket.on("disconnect", function () {

      });
  }
  this.onConnection = onConnection;

  function gameRoom(id) {
    return "gm" + id;
  }

  _.fill(arguments, null);
}

module.exports = ConnectionHandler;