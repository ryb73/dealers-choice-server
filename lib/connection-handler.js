"use strict";

var _            = require("lodash"),
    GameManager  = require("./game-manager"),
    MessageType  = require("./message-type"),
    ResponseCode = require("./response-code");

function ConnectionHandler($io, $socket, $gameManagers) {
  var io = $io;
  var socket = $socket;
  var gameManagers = $gameManagers;
  var player, manager;

  function initialize() {
      console.log("a user connected");

      socket.on("action", function(msg, ack) {
        console.log("message: " + JSON.stringify(msg));
        if(manager) {
          manager.performCommand(player, msg, ack);
        } else {
          performCommand(msg, ack);
        }
      });

      socket.on("disconnect", function () {

      });
  }

  function performCommand(msg, ack) {
    if(msg.cmd === MessageType.CreateGame) {
      createCmd(socket, ack);
    } else if (msg.cmd === MessageType.JoinGame) {
      joinCmd(msg, socket, ack);
    } else {
      socket.emit("gameError", "Unexpected command: " + msg.cmd);
    }
  }

  function gameRoom(id) {
    return "gm" + id;
  }

  function createCmd(socket, ack) {
    manager = new GameManager();
    gameManagers[manager.uuid()] = manager;

    // Assume we won't fail to join the game we just created
    var room = gameRoom(manager.uuid());
    player = manager.addPlayer(generateCallbacks(room));
    socket.join(room);

    ack(manager.uuid());
  }

  function joinCmd(msg, socket, ack) {
    var gameId = msg.id;
    manager = gameManagers[gameId];
    if(!manager) {
      ack({ result: ResponseCode.JoinGameNotFound });
      return;
    }

    var room = gameRoom(manager.uuid());
    player = manager.addPlayer(generateCallbacks(room));
    if(!player) {
      ack({ result: ResponseCode.JoinGameFull });
      return;
    }

    socket.join(room);
    ack({
      result: ResponseCode.JoinOk,
      id: player.hashCode()
    });
  }

  function generateCallbacks(room) {
    var toRoom = io.to(room);
    return {
      toYou: socket.emit.bind(socket),
      toAll: toRoom.emit.bind(toRoom),
      toOthers: function() {
        // it turns out that "broadcast" is simply
        // a getter that sets a property on the main
        // socket object itself which is then read when
        // emit is called. the programmers apparently
        // didn't entertain the idea that someone would want
        // to retrieve a broadcaster for later use
        var broadcastSock = socket.broadcast.to(room);
        return broadcastSock.emit.apply(broadcastSock, arguments);
      }
    };
  }

  initialize();
  _.fill(arguments, null);
}

module.exports = ConnectionHandler;