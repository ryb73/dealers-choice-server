"use strict";
/* jshint mocha: true */

const chai           = require("chai"),
      chaiAsPromised = require("chai-as-promised"),
      q              = require("q"),
      io             = require("socket.io-client"),
      Server         = require("../lib/server"),
      MessageType    = require("../lib/message-type"),
      ResponseCode   = require("../lib/response-code"),
      config         = require("../config");

chai.use(chaiAsPromised);
const assert = chai.assert;

function makeDeferrals(n) {
  var result = new Array(n);
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

let createGame = q.promised(function(socket) {
  let deferred = q.defer();

  socket.emit("action", { cmd: MessageType.CreateGame },
    function ack(gameId) {
      deferred.resolve(gameId);
    }
  );

  return deferred.promise;
});

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

  it("sends an error if an unrecognized command is sent", function(done) {
    let qSocket = connectClient();
    qSocket.invoke("emit", "action", { cmd: "made-up-cmd" });
    qSocket.invoke("on", "gameError", function() {
      done();
    });
  });

  it("responds appropriately to a \"create\" message", function() {
    return connectClient()
      .then(createGame)
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
      .then(createGame)
      .thenResolve(qSocket)
      .done(createGame);
  });

  it("allows a user to join an existing game", function() {
    let qSockets = prepareNPlayers(2);
    let qGameId = createGame(qSockets[0]).get("gameId");

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

    joinGame(qSockets[1], qGameId)
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

  it("relays chat messages to in-game players", function() {
    let qSockets = prepareNPlayers(4);

    let qCreateResult = createGame(qSockets[0]);
    let qGameId = qCreateResult.get("gameId");
    let qPlayerId1 = qCreateResult.get("playerId");

    let qJoinPlayer2 = joinGame(qSockets[1], qGameId);
    let qJoinPlayer3 = joinGame(qSockets[2], qGameId);

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

    var deferrals = makeDeferrals(4);
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

    var promises = deferrals.map(function(deferred) {
      return deferred.promise;
    });
    return q.all(promises);
  });

  it("only allows 6 players", function(done) {
    let qSockets = prepareNPlayers(7);
    let qGameId = createGame(qSockets[0]).get("gameId");

    // First, we'll allow five players to join
    // for a total of 6 (including the creator)
    let qJoinResponses = [];
    for(let i = 0; i < 5; ++i) {
      qJoinResponses[i] = joinGame(qSockets[i+1], qGameId);
    }

    q.all(qJoinResponses)
      .then(function(joinResponses) {
        // Make sure everyone so far was allowed to join
        for(var response of joinResponses) {
          assert.equal(response.result, ResponseCode.JoinOk);
        }

        // Then, try to add another player, which would
        // put us above the 6 player limit
        joinGame(qSockets[6], qGameId)
          .then(function (response) {
            assert.equal(response.result, ResponseCode.JoinGameFull);
            done();
          });
      });
  });

  it("allows players to leave", function(done) {
    let qSockets = prepareNPlayers(2);
    let qGameId = createGame(qSockets[0]).get("gameId");

    joinGame(qSockets[1], qGameId)
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

    let qGameId1 = createGame(qSockets[0]).get("gameId");
    let qGameId2 = createGame(qSockets[1]).get("gameId");
    let qPlayer3Joined = joinGame(qSockets[2], qGameId1);

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
    let qGameId = createGame(qSockets[0]).get("gameId");
    joinGame(qSockets[1], qGameId)
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

// describe("Attack", function() {
//   describe("canPlay", function() {
//     it("returns true when opponents have cars", function() {
//       let me = { cars: [] }; // and I don't
//       let gameData = {
//         players: [
//           me,
//           { cars: [ "edsel" ] }
//         ]
//       };
//       assert.ok(new Attack().canPlay(me, gameData));
//     });

//     it("returns false when opponents don't have cars", function() {
//       let me = { cars: [ "lincoln" ] }; // but I do
//       let gameData = {
//         players: [
//           me,
//           { cars: [] }
//         ]
//       };
//       assert.notOk(new Attack().canPlay(me, gameData));
//     });
//   });

//   describe("attack", function() {
//     it("revokes the selected car if not blocked", function(done) {
//       let victim = new Player(0);
//       let me = new Player(0);

//       let theCar = new Car(1, 1);
//       victim.gain(theCar);

//       let gameData = new GameData([ victim, me ]);

//       let choiceProvider = {
//         chooseOpponentCar: function() { return q(theCar); },
//         allowBlockAttack: function() { return q(false); }
//       };

//       new Attack().play(me, gameData, choiceProvider)
//         .then(function() {
//           assert.notOk(victim.hasCar(theCar));
//           done();
//         })
//         .catch(done);
//     });

//     it("makes the attacker pay list price if blocked", function(done) {
//       let carPrice = 100;
//       let victim = new Player(0);
//       let me = new Player(carPrice);

//       let theCar = new Car(1, carPrice);
//       victim.gain(theCar);

//       let gameData = new GameData([ victim, me ]);

//       let choiceProvider = {
//         chooseOpponentCar: function() { return q(theCar); },
//         allowBlockAttack: function() { return q(true); }
//       };

//       new Attack().play(me, gameData, choiceProvider)
//         .then(function() {
//           assert.ok(victim.hasCar(theCar));
//           assert.equal(victim.money, carPrice);
//           assert.equal(me.money, 0);
//           done();
//         })
//         .catch(done);
//     });
//   });
// });

// describe("BuyFromAutoExchangeForN", function() {
//   describe("canPlay", function() {
//     it("can't be played without enough money", function() {
//       let cost = 100;
//       let me = new Player(cost - 1);
//       let gameData = {
//         carDeck: { remaining: 1 }
//       };

//       let card = new BuyFromAutoExchangeForN(cost);
//       assert.notOk(card.canPlay(me, gameData));
//     });

//     it("can't be played if there are no cars", function() {
//       let me = new Player(1000000);
//       let gameData = {
//         carDeck: { remaining: 0 }
//       };

//       let card = new BuyFromAutoExchangeForN(1);
//       assert.notOk(card.canPlay(me, gameData));
//     });

//     it("can be played with enough money and a car", function() {
//       let cost = 100;
//       let me = new Player(cost);
//       let gameData = {
//         carDeck: { remaining: 1 }
//       };

//       let card = new BuyFromAutoExchangeForN(cost);
//       assert.ok(card.canPlay(me, gameData));
//     });
//   });

//   describe("play", function() {
//     it("gives the player the top car and debit accordingly", function(done) {
//       let cost = 100;
//       let me = new Player(cost);
//       let car = new Car(1, 1);
//       let gameData = {
//         carDeck: {
//           pop: function() { return car; }
//         }
//       };

//       let card = new BuyFromAutoExchangeForN(cost);
//       card.play(me, gameData, null)
//         .then(function() {
//           assert.ok(me.hasCar(car));
//           assert.equal(me.money, 0);
//           done();
//         })
//         .catch(done);
//     });
//   });
// });

// describe("Free", function() {
//   describe("canPlay", function() {
//     it("can't be played if there are no insurances", function() {
//       let gameData = {
//         insuranceDeck: { remaining: 0 }
//       };

//       assert.notOk(new Free().canPlay({}, gameData));
//     });

//     it("can be played if there are insurances", function() {
//       let gameData = {
//         insuranceDeck: { remaining: 1 }
//       };

//       assert.ok(new Free().canPlay({}, gameData));
//     });
//   });

//   describe("play", function() {
//     it("gives the player an insurance", function(done) {
//       let me = new Player(0);
//       let insurance = new Insurance();
//       let gameData = {
//         insuranceDeck: {
//           pop: function() { return insurance; }
//         }
//       };

//       new Free().play(me, gameData, null)
//         .then(function() {
//           assert.ok(me.hasInsurance(insurance));
//           done();
//         })
//         .catch(done);
//     });
//   });
// });

// describe("SellForListPlusN", function() {
//   describe("play", function() {
//     let price, plus, me, gameData, car;

//     beforeEach(function() {
//       price = 100;
//       plus = 50;
//       me = new Player(0);
//       gameData = {};

//       car = new Car(1, price);
//       me.gain(car);
//     });

//     it("takes car from player, gives $$$", function(done) {
//       let choiceProvider = {
//         chooseOwnCar: function(pGameData, pPlayer) {
//           assert.equal(pGameData, gameData);
//           assert.equal(pPlayer, me);
//           return q(car);
//         }
//       };

//       new SellForListPlusN(plus)
//         .play(me, gameData, choiceProvider)
//         .then(function() {
//           assert.notOk(me.hasCar(car));
//           assert.equal(me.money, price + plus);
//           done();
//         })
//         .catch(done);
//     });

//     it("doesn't take car or give money if I cancel", function(done) {
//       let choiceProvider = {
//         chooseOwnCar: function(pGameData, pPlayer) {
//           assert.equal(pGameData, gameData);
//           assert.equal(pPlayer, me);
//           return q(null);
//         }
//       };

//       new SellForListPlusN(plus)
//         .play(me, gameData, choiceProvider)
//         .then(function() {
//           assert.ok(me.hasCar(car));
//           assert.equal(me.money, 0);
//           done();
//         })
//         .catch(done);
//     });
//   });

//   describe("canPlay", function() {
//     it("can be played if the player has a car", function() {
//       let me = new Player(0);
//       let car = new Car(1, 1);
//       me.gain(car);
//       assert.ok(new SellForListPlusN(0).canPlay(me, {}));
//     });

//     it("can't be played if the player don't have a car", function() {
//       let me = new Player(0);
//       assert.notOk(new SellForListPlusN(0).canPlay(me, {}));
//     });
//   });
// });

// describe("SellForBlueBookPlusN", function() {
//   describe("play", function() {
//     let price, plus, gameData, car, me;

//     beforeEach(function() {
//       price = 100;
//       plus = 50;

//       gameData = {};
//       car = new Car(1, 999);

//       let carPrices = {};
//       carPrices[car.id] = price;
//       let blueBook = new BlueBook(carPrices);

//       me = new Player(0);
//       me.blueBook = blueBook;
//       me.gain(car);
//     });

//     it("takes car from player, gives $$$", function(done) {
//       let choiceProvider = {
//         chooseOwnCar: function(pGameData, pPlayer) {
//           assert.equal(pGameData, gameData);
//           assert.equal(pPlayer, me);
//           return q(car);
//         }
//       };

//       new SellForBlueBookPlusN(plus)
//         .play(me, gameData, choiceProvider)
//         .then(function() {
//           assert.notOk(me.hasCar(car));
//           assert.equal(me.money, price + plus);
//           done();
//         })
//         .catch(done);
//     });

//     it("doesn't take care or pay out if I cancel", function(done) {
//       let choiceProvider = {
//         chooseOwnCar: function(pGameData, pPlayer) {
//           assert.equal(pGameData, gameData);
//           assert.equal(pPlayer, me);
//           return q();
//         }
//       };

//       new SellForBlueBookPlusN(plus)
//         .play(me, gameData, choiceProvider)
//         .then(function() {
//           assert.ok(me.hasCar(car));
//           assert.equal(me.money, 0);
//           done();
//         })
//         .catch(done);
//     });
//   });

//   describe("canPlay", function() {
//     it("can be played if the player has a car", function() {
//       let me = new Player(0);
//       let car = new Car(1, 1);
//       me.gain(car);
//       assert.ok(new SellForBlueBookPlusN(0).canPlay(me, {}));
//     });

//     it("can't be played if the player don't have a car", function() {
//       let me = new Player(0);
//       assert.notOk(new SellForBlueBookPlusN(0).canPlay(me, {}));
//     });
//   });
// });