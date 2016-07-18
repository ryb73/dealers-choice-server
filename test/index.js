"use strict";
/* jshint mocha: true */

const config = require("config").get("dc-server"),
      q      = require("q");

const _              = require("lodash"),
      chai           = require("chai"),
      chaiAsPromised = require("chai-as-promised"),
      io             = require("socket.io-client"),
      dcConstants    = require("dc-constants"),
      MessageType    = dcConstants.MessageType,
      ResponseCode   = dcConstants.ResponseCode,
      RpsMoves       = dcConstants.RpsMoves,
      RpsConclusion  = dcConstants.RpsConclusion,
      Server         = require("../lib/server"),
      act            = require("./act");

const debug = require("debug")("rpb");

chai.use(chaiAsPromised);
const assert = chai.assert;

describe("ConnectionHandler", function() {
  let server;

  beforeEach(function(done) {
    server = new Server();
    server.on("listening", done);
  });

  afterEach(function(done) {
    this.timeout(5000);
    // Had this fail once. idk why but too lazy to investigate further
    if(server) {
      debug("closing");
      server.on("close", done);
      server.destroy();
      server = null;
    }
  });

  describe("before the game", function() {
    it("sends an error if an unrecognized command is sent", function(done) {
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
          assert.equal(response.gameState.users.length, 1);
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
      let qGameId = act.createGame(qSockets[0]).get("gameDescription").get("id");

      let promises = [];

      // When the second player joins, the first player
      // will be notified and given the new player's info.
      // For this test, we'll compare the info the first
      // player gets to the info the second player gets.
      promises[0] = q.defer();
      qSockets[0].done(function(socket) {
        socket.on("action", function(action) {
          if(action.cmd !== MessageType.PendingGameUpdated)
            return;

          if(action.gameDescription.users.length > 1)
            promises[0].resolve();
        });
      });

      promises[1] = act.joinGame(qSockets[1], qGameId)
        .then(function(response) {
          assert.equal(response.result, ResponseCode.JoinOk);
          assert.equal(response.gameState.users.length, 2);
        });

      return q.all(promises);
    });

    it("sends an error when joining non-existent game", function() {
      let qSocket = connectClient();
      return act.joinGame(qSocket, "fake-game")
        .then(function(response) {
          assert.equal(response.result, ResponseCode.JoinGameNotFound);
        });
    });

    it("only allows 6 players", function(done) {
      let qSockets = prepareNPlayers(7);
      let qGameId = act.createGame(qSockets[0]).get("gameDescription").get("id");

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

    it("allows players to leave", function() {
      let qSockets = prepareNPlayers(2);
      let qGameId = act.createGame(qSockets[0]).get("gameDescription").get("id");

      let deferreds = _.range(2).map(q.defer);

      act.joinGame(qSockets[1], qGameId)
        .done(function(response) {
          assert.equal(response.result, ResponseCode.JoinOk);

          qSockets[1].invoke("emit", "action", { cmd: MessageType.Leave }, deferreds[0].resolve);
        });

      // The pending game will be updated twice -- once when player 2 joins, and again when player 2
      // leaves. The second time, ensure there's only one player left (player 1)
      let calls = 0;
      qSockets[0].invoke("on", "action", function(action) {
        if(action.cmd !== MessageType.PendingGameUpdated)
          return;

        if(++calls === 2) {
          assert.equal(action.gameDescription.users.length, 1);
          deferreds[1].resolve();
        }
      });

      return q.all(_.map(deferreds, "promise"));
    });

    it("can list the current games", function(done) {
      let qSockets = prepareNPlayers(4);

      let qGameId1 = act.createGame(qSockets[0]).get("gameDescription").get("id");
      let qGameId2 = act.createGame(qSockets[1]).get("gameDescription").get("id");
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
                assert.equal(game.users.length, 2);
              } else if(game.id === gameId2) {
                assert.equal(game.users.length, 1);
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
      let qGameId = act.createGame(qSockets[0]).get("gameDescription").get("id");
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

    it("allows the user to register", function(done) {
      let cmd = { cmd: MessageType.RegisterUser, userId: 1 };
      connectClient()
        .done(function(socket) {
          socket.emit("action", cmd, function() {
            done();
          });
        });
    });
  });

  describe("during the game", function() {
    it("sends state when requested", function() {
      let qSockets = prepareNPlayers(2);
      let qCreateResult = act.createGame(qSockets[0]);
      let qGameId = qCreateResult.get("gameDescription").get("id");

      return act.joinGame(qSockets[1], qGameId)
        .then(function() {
          return act.startGame(qSockets[0]);
        })
        .then(function(response) {
          assert.equal(response.result, ResponseCode.StartOk);

          let deferred = q.defer();
          qSockets[0].invoke("emit", "action", { cmd: MessageType.GetState }, (gameState) => {
            assert.equal(gameState.users.length, 2);
            assert.ok(gameState.users[0].player);
            assert.ok(gameState.users[0].player.cars);
            deferred.resolve();
          });

          return deferred.promise;
        });
    });

    it("starts the game with rock paper scissors", function() {
      let qSockets = prepareNPlayers(3);

      let qCreateResult = act.createGame(qSockets[0]);
      let qGameId = qCreateResult.get("gameDescription").get("id");
      let qPlayerId1 = qCreateResult.get("playerId");

      q.all([ act.joinGame(qSockets[1], qGameId),
              act.joinGame(qSockets[2], qGameId) ])
        .then(function() {
          let response = act.startGame(qSockets[0]);
          return assert.eventually.equal(response.get("result"),
            ResponseCode.StartOk);
        })
        .done(function() {
          qSockets[0].invoke("emit", "action", { cmd: MessageType.ActuallyReady });
        });

      qSockets[0].invoke("on", "action", handleAction.bind(null, 0));
      qSockets[1].invoke("on", "action", handleAction.bind(null, 1));
      qSockets[2].invoke("on", "action", handleAction.bind(null, 2));

      function handleAction(playerIdx, msg) {
        switch(msg.cmd) {
          case MessageType.GameStarted:
            qSockets[playerIdx].invoke("emit", "action", { cmd: MessageType.ActuallyReady });
            break;
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
        qPlayerId1.done((playerId1) => {
          assert.equal(playerId1, msg.winnerId);
          deferrals[playerIdx].resolve();
        });
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

  return qSockets
    .map(function(qSocket, index) {
      return act.registerUser(qSocket, index)
        .thenResolve(qSocket);
    });
}