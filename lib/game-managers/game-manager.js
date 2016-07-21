"use strict";

const _               = require("lodash"),
      assert          = require("chai").assert,
      dcConstants     = require("dc-constants"),
      MessageType     = dcConstants.MessageType,
      ResponseCode    = dcConstants.ResponseCode,
      ClientCallbacks = require("./client-callbacks");

function GameManager($createFrom) {
  let callbacks,
      users = {};

  function intialize() {
    if($createFrom) {
      callbacks = $createFrom._callbacks;
      users = $createFrom._users;
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
    },

    users: {
      enumerable: true,
      get: function() {
        return _.clone(users);
      }
    },

    _users: {
      enumerable: true,
      get: function() {
        return users;
      }
    }
  });

  intialize();
}

module.exports = GameManager;