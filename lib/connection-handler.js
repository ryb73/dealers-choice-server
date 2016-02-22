"use strict";

const config         = require("config").get("dc-server"),
      _              = require("lodash"),
      dcConstants    = require("dc-constants"),
      MessageType    = dcConstants.MessageType,
      ResponseCode   = dcConstants.ResponseCode,
      validateUserId = config.validateUserId || require("./validate-user-id"),
      log            = require("rpb-logging")("dc-server"),
      GameManager    = require("./game-managers/pending-game-manager");

function ConnectionHandler($io, $socket, $serverState) {
  let io = $io;
  let socket = $socket;
  let serverState = $serverState;

  let player, manager, userId;

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
        log.info("user [" + userId + "] disconnected");

        serverState.userIds = _.without(serverState.userIds, userId);
        notifyLeftLobby();
      });

      $io = $socket = $serverState = null;
  }

  // Commands:
  //  CreateGame
  //   Creates (and joins) a new game.
  //   ack: {
  //    result:    CreateOk,
  //    gameId:    game ID,
  //    playerId:  player ID,
  //    gameState: game state obj
  //   }
  //
  //  JoinGame
  //   Joins an existing game.
  //   input: { id: game ID }
  //   ack: {
  //    result: JoinOk | JoinGameNotFound | JoinGameFull,
  //    id:     player ID, if joined
  //    gameState: game state obj
  //   }
  //
  //  ListGames
  //   Lists all games, open or not.
  //   ack: [ GameDescription ]
  //
  //  RegisterUser
  //   Moves the player into the lobby.
  //   input: { userId: user ID }
  //   ack:   [ IDs of other users in lobby ]
  //
  //  Chat
  //   Sends a chat message to the rest of the lobby.
  //   input: { message: chat message }
  //   ack:   { result: ChatSent }
  //
  //  Disconnect
  //   Disconnects the client. This is necessary because
  //   there's no way to disconnect on the client side using
  //   socket.io.
  function performLobbyCommand(msg, ack) {
    /* jshint maxcomplexity: false */
    if(msg.cmd === MessageType.CreateGame) {
      createCmd(socket, ack);
    } else if(msg.cmd === MessageType.JoinGame) {
      joinCmd(msg, socket, ack);
    } else if(msg.cmd === MessageType.ListGames) {
      listCmd(ack);
    } else if(msg.cmd === MessageType.RegisterUser) {
      registerUser(msg, ack);
    } else if(msg.cmd === MessageType.Chat) {
      sendChat(msg, ack);
    } else if(msg.cmd === MessageType.Disconnect) {
      socket.disconnect();
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

  function sendChat(msg, ack) {
    let outMsg = {
      cmd: MessageType.ChatSent,
      userId: userId,
      message: msg.message
    };
    socket.broadcast.emit("action", outMsg);

    ack({ result: ResponseCode.ChatSent });
  }

  function registerUser(msg, ack) {
    // If this connection already registered a user,
    // make sure it's the same one. This can happen
    // if the connection is temporarily lost
    if(userId) {
      if(msg.userId !== userId) {
        socket.emit("gameError", "Reregistering to different user ID");
        log.warn("Reregistering to different user ID");
      } else {
        ack(serverState.userIds);
      }

      return;
    }

    // Don't let the same user log in from two different places
    if(_.includes(serverState.userIds, msg.userId)) {
      socket.emit("gameError", "User already logged in");
      return;
    }

    validateUserId(msg.userId, msg.accessToken)
      .then(registerValidated.bind(null, msg.userId, ack))
      .catch(function(error) {
        log.error(error);
        socket.emit("gameError", "Unable to validate user");
      })
      .done();
  }

  function registerValidated(id, ack) {
    userId = id;
    serverState.userIds.push(userId);

    ack(serverState.userIds);

    notifyEnteredLobby();
  }

  function notifyEnteredLobby() {
    let msg = {
      cmd: MessageType.UserEnteredLobby,
      userId: userId
    };

    socket.broadcast.emit("action", msg);
  }

  function notifyLeftLobby() {
    let msg = {
      cmd: MessageType.UserLeftLobby,
      userId: userId
    };

    socket.broadcast.emit("action", msg);
  }

  function gameRoom(id) {
    return "gm" + id;
  }

  function createCmd(socket, ack) {
    manager = new GameManager();
    serverState.gameManagers.set(manager.id, manager);

    // Assume we won't fail to join the game we just created
    let room = gameRoom(manager.id);
    manager.broadcast = io.to(room).emit.bind(io.to(room));
    player = manager.addPlayer(userId, generateCallbacks(room));
    socket.join(room);

    ack({
      result: ResponseCode.CreateOk,
      gameId: manager.id,
      playerId: player.id,
      gameState: getGameState()
    });

    notifyLeftLobby();
  }

  function joinCmd(msg, socket, ack) {
    let gameId = msg.id;
    manager = serverState.gameManagers.get(gameId);
    if(!manager) {
      ack({ result: ResponseCode.JoinGameNotFound });
      return;
    }

    let room = gameRoom(manager.id);
    player = manager.addPlayer(userId, generateCallbacks(room));
    if(!player) {
      ack({ result: ResponseCode.JoinGameFull });
      return;
    }

    socket.join(room);
    ack({
      result: ResponseCode.JoinOk,
      id: player.id,
      gameState: getGameState()
    });

    notifyLeftLobby();
    notifyJoined();
  }

  function listCmd(ack) {
    let gameArray = [];
    for(let game of serverState.gameManagers.values()) {
      gameArray.push(game);
    }

    ack(gameArray);
  }

  function leaveCmd(ack) {
    manager.removePlayer(player);
    if(manager.isEmpty()) {
      serverState.gameManagers.delete(manager.id);
    }
    manager = null;

    player = null;
    ack();
  }

  function notifyJoined() {
    socket.broadcast.to(gameRoom(manager.id))
      .emit("playerJoined", jsonify(player));
  }

  function jsonify(player, redactDetails) {
    let result = _.cloneDeep(player);

    result.cars = [...result.cars];
    result.dcCards = [...result.dcCards];
    result.insurances = [...result.insurances];

    if(redactDetails) {
      delete result.money;
      delete result.blueBook;
      result.dcCards = result.dcCards.map(_.constant(null));
      result.insurances = result.insurances.map(_.constant(null));
    }

    return result;
  }

  function getGameState() {
    let users = _.reject(manager.users, { id: userId });
    users.forEach(function (user) {
      user.player = jsonify(user.player, true);
    });

    // Add current player to front because of ugly design on the front end
    // Also don't redact details
    users.unshift({ id: 'me', player: jsonify(player) });
    return { users };
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