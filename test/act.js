"use strict";

const q           = require("q"),
      MessageType = require("dc-constants").MessageType;

let act = {};

let createGame = q.promised(function(socket) {
  let deferred = q.defer();

  socket.emit("action", { cmd: MessageType.CreateGame },
    function ack(gameId) {
      deferred.resolve(gameId);
    }
  );

  return deferred.promise;
});
act.createGame = createGame;

let joinGame = q.promised(function(socket, gameId) {
  let deferred = q.defer();

  let msg = {
    cmd: MessageType.JoinGame,
    id: gameId
  };

  socket.emit("action", msg, function(result) {
    deferred.resolve(result);
  });

  return deferred.promise;
});
act.joinGame = joinGame;

let startGame = q.promised(function(socket) {
  let deferred = q.defer();

  let msg = {
    cmd: MessageType.StartGame
  };

  socket.emit("action", msg, function(result) {
    deferred.resolve(result);
  });

  return deferred.promise;
});
act.startGame = startGame;

module.exports = act;