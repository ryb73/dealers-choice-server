"use strict";
/* jshint mocha: true */

const config = require("config").get("dc-server");
config.testing = true;
config.logLevel = "warn";

const chai           = require("chai"),
      chaiAsPromised = require("chai-as-promised"),
      q              = require("q"),
      io             = require("socket.io-client"),
      Server         = require("../lib/server"),
      MessageType    = require("../lib/message-type"),
      ResponseCode   = require("../lib/response-code"),
      RpsMoves       = require("../lib/game-managers/choice-provider/rock-paper-scissors/rps-moves"),
      RpsConclusion  = require("../lib/game-managers/choice-provider/rock-paper-scissors/rps-conclusion"),
      act            = require("./act");

chai.use(chaiAsPromised);
const assert = chai.assert;

describe("ConnectionHandler", function() {
  let server;

  beforeEach(function(done) {
    server = new Server();
    server.on("listening", done);
  });

  afterEach(function(done) {
    server.destroy();
    server.on("close", done);
    server = null;
  });

  describe("before the game", function() {
    it.only("sends an error if an unrecognized command is sent", function(done) {
      debugger;
      let qSocket = connectClient();
      qSocket.invoke("emit", "action", { cmd: "made-up-cmd" });
      qSocket.invoke("on", "gameError", function() {
        done();
      });
    });

    it("responds appropriately to a \"create\" message", function() {
      return connectClient()
        .then(act.createGame)
        .then(function(response) {
          assert.equal(response.result, ResponseCode.CreateOk);
        });
    });

    it("doesn't allow a user to create two games", function(done) {
      let qSocket = connectClient();
      qSocket.invoke("on", "gameError", function() {
        done();
      });

      qSocket
        .then(act.createGame)
        .thenResolve(qSocket)
        .done(act.createGame);
    });

    it("allows a user to join an existing game", function() {
      let qSockets = prepareNPlayers(2);
      let qGameId = act.createGame(qSockets[0]).get("gameId");

      // When the second player joins, the first player
      // will be notified and given the new player's info.
      // For this test, we'll compare the info the first
      // player gets to the info the second player gets.
      let defPlayerId1 = q.defer();
      let defPlayerId2 = q.defer();
      qSockets[0].done(function(socket) {
        socket.on("playerJoined", function(player) {
          defPlayerId1.resolve(player.id);

          // Make sure no secret info was sent
          assert.isUndefined(player.money ||
                       player.dcCards ||
                       player.insurances ||
                       player.blueBook, "secret info sent");
        });
      });

      act.joinGame(qSockets[1], qGameId)
        .done(function(response) {
          assert.equal(response.result, ResponseCode.JoinOk, "join not ok");
          assert.ok(response.id, "no ID");
          defPlayerId2.resolve(response.id);
        });

      return q.all([ defPlayerId1.promise, defPlayerId2.promise ])
        .spread(function(playerId1, playerId2) {
          assert.equal(playerId1, playerId2, "IDs not equal");
        });
    });

    it("sends an error when joining non-existent game", function() {
      let qSocket = connectClient();
      return act.joinGame(qSocket, "fake-game")
        .then(function(response) {
          assert.equal(response.result, ResponseCode.JoinGameNotFound);
        });
    });

    it("relays chat messages to in-game players", function() {
      let qSockets = prepareNPlayers(4);

      let qCreateResult = act.createGame(qSockets[0]);
      let qGameId = qCreateResult.get("gameId");
      let qPlayerId1 = qCreateResult.get("playerId");

      let qJoinPlayer2 = act.joinGame(qSockets[1], qGameId);
      let qJoinPlayer3 = act.joinGame(qSockets[2], qGameId);

      // Once all players have joined, send chat
      let chatMsg = {
        cmd: "chat",
        message: "sup"
      };
      q.all([ qJoinPlayer2, qJoinPlayer3 ])
        .thenResolve(qSockets[0])
        .invoke("emit", "action", chatMsg, ack);

      // The player that sent the chat and the player
      // that's not even in the game should not get the
      // chat; the other players should.
      qSockets[0].invoke("on", "chat", didntGetChat);
      qSockets[1].invoke("on", "chat", gotChat.bind(null, 0));
      qSockets[2].invoke("on", "chat", gotChat.bind(null, 1));
      qSockets[3].invoke("on", "chat", didntGetChat);

      let deferrals = makeDeferrals(4);
      function gotChat(defferedIdx, msg) {
        assert.eventually.equal(qPlayerId1, msg.playerId)
          .then(deferrals[2].resolve)
          .catch(deferrals[2].reject);

        assert.equal(msg.message, "sup");
        deferrals[defferedIdx].resolve();
      }

      // Make sure the player that sent the chat gets
      // an acknowledgement.
      function ack(response) {
        assert.equal(response.result, ResponseCode.ChatSent);
        deferrals[3].resolve();
      }

      function didntGetChat() {
        assert.fail();
      }

      let promises = deferrals.map(function(deferred) {
        return deferred.promise;
      });
      return q.all(promises);
    });

    it("only allows 6 players", function(done) {
      let qSockets = prepareNPlayers(7);
      let qGameId = act.createGame(qSockets[0]).get("gameId");

      // First, we'll allow five players to join
      // for a total of 6 (including the creator)
      let qJoinResponses = [];
      for(let i = 0; i < 5; ++i) {
        qJoinResponses[i] = act.joinGame(qSockets[i+1], qGameId);
      }

      q.all(qJoinResponses)
        .then(function(joinResponses) {
          // Make sure everyone so far was allowed to join
          for(let response of joinResponses) {
            assert.equal(response.result, ResponseCode.JoinOk);
          }

          // Then, try to add another player, which would
          // put us above the 6 player limit
          act.joinGame(qSockets[6], qGameId)
            .then(function (response) {
              assert.equal(response.result, ResponseCode.JoinGameFull);
              done();
            });
        });
    });

    it("allows players to leave", function(done) {
      let qSockets = prepareNPlayers(2);
      let qGameId = act.createGame(qSockets[0]).get("gameId");

      act.joinGame(qSockets[1], qGameId)
        .done(function(response) {
          assert.equal(response.result, ResponseCode.JoinOk);

          qSockets[1].invoke("emit", "action",
            { cmd: MessageType.Leave }, ack);
        });

      function ack() {
        done();
      }
    });

    it("can list the current games", function(done) {
      let qSockets = prepareNPlayers(4);

      let qGameId1 = act.createGame(qSockets[0]).get("gameId");
      let qGameId2 = act.createGame(qSockets[1]).get("gameId");
      let qPlayer3Joined = act.joinGame(qSockets[2], qGameId1);

      q.all([ qGameId1, qGameId2, qPlayer3Joined ])
        .thenResolve(qSockets[3])
        .invoke("emit", "action", { cmd: MessageType.ListGames }, ack)
        .done();

      function ack(gameList) {
        assert.equal(gameList.length, 2);

        // The game IDs should match and the player
        // counts should be correct
        q.all([ qGameId1, qGameId2 ])
          .spread(function(gameId1, gameId2) {
            for(let game of gameList) {
              if(game.id === gameId1) {
                assert.equal(game.playerCount, 2);
              } else if(game.id === gameId2) {
                assert.equal(game.playerCount, 1);
              } else {
                assert.fail();
              }
            }

            done();
          })
          .done();
      }
    });

    it("deletes the game if the last player leaves", function(done) {
      let qSockets = prepareNPlayers(2);
      let qGameId = act.createGame(qSockets[0]).get("gameId");
      act.joinGame(qSockets[1], qGameId)
        .thenResolve(qSockets[0])
        .invoke("emit", "action", { cmd: MessageType.Leave }, leaveAck)
        .thenResolve(qSockets[1])
        .invoke("emit", "action", { cmd: MessageType.Leave }, leaveAck);

      let left = 0;
      function leaveAck() {
        if(++left === 2) {
          qSockets[0].invoke("emit", "action",
            { cmd: MessageType.ListGames }, listAck);
        }
      }

      function listAck(gameList) {
        assert.equal(gameList.length, 0);
        done();
      }
    });
  });

  describe("during the game", function() {
    it("starts the game with rock paper scissors", function() {
      let qSockets = prepareNPlayers(3);

      let qCreateResult = act.createGame(qSockets[0]);
      let qGameId = qCreateResult.get("gameId");
      let qPlayerId1 = qCreateResult.get("playerId");

      q.all([ act.joinGame(qSockets[1], qGameId),
              act.joinGame(qSockets[2], qGameId) ])
        .then(function() {
          let response = act.startGame(qSockets[0]);
          assert.eventually.equal(response.get("result"),
            ResponseCode.StartOk);
        });

      qSockets[0].invoke("on", "action", handleAction.bind(null, 0));
      qSockets[1].invoke("on", "action", handleAction.bind(null, 1));
      qSockets[2].invoke("on", "action", handleAction.bind(null, 2));

      function handleAction(playerIdx, msg) {
        switch(msg.cmd) {
          case MessageType.RockPaperScissors:
            handleRps(playerIdx, msg);
            break;
          case MessageType.RpsConclusion:
            handleConclusion(playerIdx, msg);
        }
      }

      function handleRps(playerIdx, msg) {
        let outMsg = {
          cmd: MessageType.Choice,
          answer: { handlerId: msg.handlerId }
        };

        if(playerIdx === 0) {
          outMsg.answer.move = RpsMoves.Rock;
        } else {
          outMsg.answer.move = RpsMoves.Scissors;
        }
        qSockets[playerIdx].invoke("emit", "action", outMsg);
      }

      let deferrals = makeDeferrals(3);

      function handleConclusion(playerIdx, msg) {
        assert.equal(msg.conclusion, RpsConclusion.Winner);
        assert.eventually.equal(qPlayerId1, msg.winnerId);
        deferrals[playerIdx].resolve();
      }

      let promises = deferrals.map(function(deferred) {
        return deferred.promise;
      });
      return q.all(promises);
    });
  });
});

function makeDeferrals(n) {
  let result = new Array(n);
  for(let i = 0; i < n; ++i) {
    result[i] = q.defer();
  }
  return result;
}

function connectClient() {
  let deferred = q.defer();

  let socket = io.connect("http://localhost:" + config.port, {
    transports: ["websocket"],
    multiplex: false
  });

  socket.on("connect", function() {
    deferred.resolve(socket);
  });

  return deferred.promise;
}

function prepareNPlayers(n) {
  let qSockets = [];
  for(let i = 0; i < n; ++i)
    qSockets[i] = connectClient();
  return qSockets;
}