"use strict";

const q           = require("q"),
      MessageType = require("dc-constants").MessageType;

let act = {};

function doEmit(socket, msg) {
  let deferred = q.defer();

  socket.emit("action", msg, function(result) {
    deferred.resolve(result);
  });

  return deferred.promise;
}

let createGame = q.promised(function(socket) {
  return doEmit(socket, { cmd: MessageType.CreateGame });
});
act.createGame = createGame;

let joinGame = q.promised(function(socket, gameId) {
  return doEmit(socket, {
    cmd: MessageType.JoinGame,
    id: gameId
  });
});
act.joinGame = joinGame;

let startGame = q.promised(function(socket) {
  return doEmit(socket, {
    cmd: MessageType.StartGame
  });
});
act.startGame = startGame;

let registerUser = q.promised(function(socket, userId) {
  return doEmit(socket, {
    cmd: MessageType.RegisterUser,
    userId: userId
  });
});
act.registerUser = registerUser;

module.exports = act;