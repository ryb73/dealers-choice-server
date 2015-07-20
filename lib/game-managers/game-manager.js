"use strict";

const assert          = require("chai").assert,
      MessageType     = require("../message-type"),
      ResponseCode    = require("../response-code"),
      ClientCallbacks = require("./client-callbacks");

function GameManager($createFrom) {
  let callbacks;

  function intialize() {
    if($createFrom) {
      callbacks = $createFrom._callbacks;
    } else {
      callbacks = new ClientCallbacks();
    }
  }

  function performCommand(player, msg, ack) {
    if(msg.cmd === MessageType.Chat) {
      sendChat(player, msg.message);
      ack({ result: ResponseCode.ChatSent });
    } else {
      callbacks.toYou(player, "gameError", "Unexpected command: " + msg.cmd);
    }
  }
  this.performCommand = performCommand;

  function sendChat(player, message) {
    let msg = {
      playerId: player.id,
      message: message
    };
    callbacks.toOthers(player, "chat", msg);
  }

  Object.defineProperties(this, {
    _callbacks: {
      get: function() {
        return callbacks;
      }
    },

    broadcast: {
      enumerable: true,
      configurable: true,
      set: function(val) {
        assert.notOk(callbacks.broadcast); // only set once
        callbacks.broadcast = val;
      }
    }
  });

  intialize();
}

module.exports = GameManager;