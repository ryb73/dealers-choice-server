"use strict";

const MessageType  = require("../message-type"),
      ResponseCode = require("../response-code");

function GameManager() {
  let playerCallbacks = new Map();

  function performCommand(player, msg, ack) {
    if(msg.cmd === MessageType.Chat) {
      sendChat(player, msg.message);
      ack({ result: ResponseCode.ChatSent });
    } else {
      cbFor(player).toYou("gameError", "Unexpected command: " + msg.cmd);
    }
  }
  this.performCommand = performCommand;

  function sendChat(player, message) {
    let msg = {
      playerId: player.id,
      message: message
    };
    cbFor(player).toOthers("chat", msg);
  }

  function cbFor(player) {
    return playerCallbacks.get(player);
  }

  Object.defineProperties(this, {
    _playerCallbacks: {
      get: function() {
        return playerCallbacks;
      }
    }
  });
}

module.exports = GameManager;