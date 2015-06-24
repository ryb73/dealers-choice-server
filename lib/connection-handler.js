"use strict";

const _            = require("lodash"),
      log          = require("rpb-logging")("dc-server"),
      GameManager  = require("./game-managers/pending-game-manager"),
      MessageType  = require("./message-type"),
      ResponseCode = require("./response-code");

function ConnectionHandler($io, $socket, $gameManagers) {
  let io = $io;
  let socket = $socket;
  let gameManagers = $gameManagers;

  let player, manager;

  function initialize() {
      log.info("a user connected");

      socket.on("action", function(msg, ack) {
        log.trace("message: " + JSON.stringify(msg));

        if(manager) {
          performInGameCommand(msg, ack);
        } else {
          performLobbyCommand(msg, ack);
        }
      });

      socket.on("disconnect", function () {

      });

      $io = $socket = $gameManagers = null;
  }

  function performLobbyCommand(msg, ack) {
    if(msg.cmd === MessageType.CreateGame) {
      createCmd(socket, ack);
    } else if(msg.cmd === MessageType.JoinGame) {
      joinCmd(msg, socket, ack);
    } else if(msg.cmd === MessageType.ListGames) {
      listCmd(ack);
    } else {
      socket.emit("gameError", "Unexpected command: " + msg.cmd);
    }
  }

  function performInGameCommand(msg, ack) {
    if(msg.cmd === MessageType.Leave) {
      leaveCmd(ack);
    } else {
      // If we didn't handle the command ourselves,
      // delegate to the game manager
      manager.performCommand(player, msg, ack);
    }
  }

  function gameRoom(id) {
    return "gm" + id;
  }

  function createCmd(socket, ack) {
    manager = new GameManager();
    gameManagers.set(manager.id, manager);

    // Assume we won't fail to join the game we just created
    let room = gameRoom(manager.id);
    manager.roomCallback = io.to(room).emit.bind(io.to(room));
    player = manager.addPlayer(generateCallbacks(room));
    socket.join(room);

    ack({
      result: ResponseCode.CreateOk,
      gameId: manager.id,
      playerId: player.id
    });
  }

  function joinCmd(msg, socket, ack) {
    let gameId = msg.id;
    manager = gameManagers.get(gameId);
    if(!manager) {
      ack({ result: ResponseCode.JoinGameNotFound });
      return;
    }

    let room = gameRoom(manager.id);
    player = manager.addPlayer(generateCallbacks(room));
    if(!player) {
      ack({ result: ResponseCode.JoinGameFull });
      return;
    }

    socket.join(room);
    ack({
      result: ResponseCode.JoinOk,
      id: player.id
    });

    notifyJoined();
  }

  function listCmd(ack) {
    let gameArray = [];
    for(let game of gameManagers.values()) {
      gameArray.push(game);
    }

    ack(gameArray);
  }

  function leaveCmd(ack) {
    manager.removePlayer(player);
    if(manager.isEmpty()) {
      gameManagers.delete(manager.id);
    }
    manager = null;

    player = null;
    ack();
  }

  function notifyJoined() {
    socket.broadcast.to(gameRoom(manager.id))
      .emit("playerJoined", redact(player));
  }

  function redact(player) {
    let result = _.cloneDeep(player);
    delete result.money;
    delete result.dcCards;
    delete result.insurances;
    delete result.blueBook;
    return result;
  }

  function generateCallbacks(room) {
    return {
      toYou: socket.emit.bind(socket),
      toOthers: function() {
        // it turns out that "broadcast" is simply
        // a getter that sets a property on the main
        // socket object itself which is then read when
        // emit is called. the programmers apparently
        // didn't entertain the idea that someone would want
        // to save a broadcaster for later use
        let broadcastSock = socket.broadcast.to(room);
        return broadcastSock.emit.apply(broadcastSock, arguments);
      }
    };
  }

  initialize();
}

module.exports = ConnectionHandler;