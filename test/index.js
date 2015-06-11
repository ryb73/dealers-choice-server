"use strict";
/* jshint mocha: true */

var chai           = require("chai"),
    chaiAsPromised = require("chai-as-promised"),
    q              = require("q"),
    io             = require("socket.io-client"),
    Server         = require("../lib/server"),
    MessageType    = require("../lib/message-type"),
    ResponseCode   = require("../lib/response-code"),
    config         = require("../config");

chai.use(chaiAsPromised);
var assert = chai.assert;


function connectClient() {
  var deferred = q.defer();

  var socket = io.connect("http://localhost:" + config.port, {
    transports: ["websocket"],
    multiplex: false
  });

  socket.on("connect", function() {
    deferred.resolve(socket);
  });

  return deferred.promise;
}

var createGame = q.promised(function (socket) {
  var deferred = q.defer();

  socket.emit("action", { cmd: MessageType.CreateGame },
    function ack(gameId) {
      deferred.resolve(gameId);
    }
  );

  return deferred.promise;
});

var joinGame = q.promised(function (socket, gameId) {
  var deferred = q.defer();

  var msg = {
    cmd: MessageType.JoinGame,
    id: gameId
  };

  socket.emit("action", msg, function(result) {
    deferred.resolve(result);
  });

  return deferred.promise;
});

describe("ConnectionHandler", function() {
  var server;

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
    var qSocket = connectClient();
    qSocket.invoke("emit", "action", { cmd: "made-up-cmd" });
    qSocket.invoke("on", "gameError", function() {
      done();
    });
  });

  it("responds appropriately to a \"create\" message", function(done) {
    connectClient()
      .then(createGame)
      .done(function(gameId) {
        assert.ok(gameId);
        done();
      });
  });

  it("doesn't allow a user to create two games", function(done) {
    var qSocket = connectClient();
    qSocket.invoke("on", "gameError", function() {
      done();
    });

    qSocket
      .then(createGame)
      .thenResolve(qSocket)
      .then(createGame);
  });

  it("allows a user to join an existing game", function(done) {
    var qSocket1 = connectClient();
    var qSocket2 = connectClient();

    var qGameId = createGame(qSocket1);

    joinGame(qSocket2, qGameId)
      .done(function(response) {
        assert.equal(response.result, ResponseCode.JoinOk);
        assert.ok(response.id);
        done();
      });
  });

  it("relays chat messages to in-game players", function(done) {
    var qSockets = [];
    for(var i = 0; i < 4; ++i)
      qSockets[i] = connectClient();

    var qGameId = createGame(qSockets[0]);

    var qPlayerId1 = joinGame(qSockets[1], qGameId);
    joinGame(qSockets[2], qGameId);

    var chatMsg = {
      cmd: "chat",
      message: "sup"
    };
    qPlayerId1.thenResolve(qSockets[0])
      .invoke("emit", "action", chatMsg, ack);

    qSockets[1].invoke("on", "chat", gotChat);
    qSockets[2].invoke("on", "chat", gotChat);
    qSockets[3].invoke("on", "chat", didntGetChat);
    qSockets[0].invoke("on", "chat", didntGetChat);

    var responsesReceived = 0;
    function gotChat(msg) {
      assert.eventually.equal(qPlayerId1, msg.playerId);
      assert.equal(msg.message, "sup");
      if(++responsesReceived === 3)
        done();
    }

    function ack(response) {
      assert.equal(response.result, ResponseCode.ChatSent);
      if(++responsesReceived === 3)
        done();
    }

    function didntGetChat() {
      assert.fail();
    }
  });
});

// describe("Attack", function() {
//   describe("canPlay", function() {
//     it("returns true when opponents have cars", function() {
//       var me = { cars: [] }; // and I don't
//       var gameData = {
//         players: [
//           me,
//           { cars: [ "edsel" ] }
//         ]
//       };
//       assert.ok(new Attack().canPlay(me, gameData));
//     });

//     it("returns false when opponents don't have cars", function() {
//       var me = { cars: [ "lincoln" ] }; // but I do
//       var gameData = {
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
//       var victim = new Player(0);
//       var me = new Player(0);

//       var theCar = new Car(1, 1);
//       victim.gain(theCar);

//       var gameData = new GameData([ victim, me ]);

//       var choiceProvider = {
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
//       var carPrice = 100;
//       var victim = new Player(0);
//       var me = new Player(carPrice);

//       var theCar = new Car(1, carPrice);
//       victim.gain(theCar);

//       var gameData = new GameData([ victim, me ]);

//       var choiceProvider = {
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
//       var cost = 100;
//       var me = new Player(cost - 1);
//       var gameData = {
//         carDeck: { remaining: 1 }
//       };

//       var card = new BuyFromAutoExchangeForN(cost);
//       assert.notOk(card.canPlay(me, gameData));
//     });

//     it("can't be played if there are no cars", function() {
//       var me = new Player(1000000);
//       var gameData = {
//         carDeck: { remaining: 0 }
//       };

//       var card = new BuyFromAutoExchangeForN(1);
//       assert.notOk(card.canPlay(me, gameData));
//     });

//     it("can be played with enough money and a car", function() {
//       var cost = 100;
//       var me = new Player(cost);
//       var gameData = {
//         carDeck: { remaining: 1 }
//       };

//       var card = new BuyFromAutoExchangeForN(cost);
//       assert.ok(card.canPlay(me, gameData));
//     });
//   });

//   describe("play", function() {
//     it("gives the player the top car and debit accordingly", function(done) {
//       var cost = 100;
//       var me = new Player(cost);
//       var car = new Car(1, 1);
//       var gameData = {
//         carDeck: {
//           pop: function() { return car; }
//         }
//       };

//       var card = new BuyFromAutoExchangeForN(cost);
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
//       var gameData = {
//         insuranceDeck: { remaining: 0 }
//       };

//       assert.notOk(new Free().canPlay({}, gameData));
//     });

//     it("can be played if there are insurances", function() {
//       var gameData = {
//         insuranceDeck: { remaining: 1 }
//       };

//       assert.ok(new Free().canPlay({}, gameData));
//     });
//   });

//   describe("play", function() {
//     it("gives the player an insurance", function(done) {
//       var me = new Player(0);
//       var insurance = new Insurance();
//       var gameData = {
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
//     var price, plus, me, gameData, car;

//     beforeEach(function() {
//       price = 100;
//       plus = 50;
//       me = new Player(0);
//       gameData = {};

//       car = new Car(1, price);
//       me.gain(car);
//     });

//     it("takes car from player, gives $$$", function(done) {
//       var choiceProvider = {
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
//       var choiceProvider = {
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
//       var me = new Player(0);
//       var car = new Car(1, 1);
//       me.gain(car);
//       assert.ok(new SellForListPlusN(0).canPlay(me, {}));
//     });

//     it("can't be played if the player don't have a car", function() {
//       var me = new Player(0);
//       assert.notOk(new SellForListPlusN(0).canPlay(me, {}));
//     });
//   });
// });

// describe("SellForBlueBookPlusN", function() {
//   describe("play", function() {
//     var price, plus, gameData, car, me;

//     beforeEach(function() {
//       price = 100;
//       plus = 50;

//       gameData = {};
//       car = new Car(1, 999);

//       var carPrices = {};
//       carPrices[car.id] = price;
//       var blueBook = new BlueBook(carPrices);

//       me = new Player(0);
//       me.blueBook = blueBook;
//       me.gain(car);
//     });

//     it("takes car from player, gives $$$", function(done) {
//       var choiceProvider = {
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
//       var choiceProvider = {
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
//       var me = new Player(0);
//       var car = new Car(1, 1);
//       me.gain(car);
//       assert.ok(new SellForBlueBookPlusN(0).canPlay(me, {}));
//     });

//     it("can't be played if the player don't have a car", function() {
//       var me = new Player(0);
//       assert.notOk(new SellForBlueBookPlusN(0).canPlay(me, {}));
//     });
//   });
// });