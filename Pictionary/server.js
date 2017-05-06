var http  = require("http"), path = require("path"), fs = require("fs"), mysql = require('mysql'), crypto = require('crypto'), 
io = require('socket.io'), extensions = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".png": "image/png",
  ".gif": "image/gif",
  ".jpg": "image/jpeg"
};

// Creation du serveur
var app = http.createServer(function (req, res) {

    var filename = path.basename(req.url) || "index.html",
    dir = path.dirname(req.url).substring(1),
    ext = path.extname(filename),
    localPath = __dirname + "/";
    console.log(req.url);

    if (extensions[ext]) {
        localPath += (dir ? dir + "/" : "") + filename;
        path.exists(localPath, function(exists) {
        if (exists) {
            getFile(localPath, extensions[ext], res);
        } else {
            console.log("Not found");
            res.writeHead(404);
            res.end();
        }
    });

    } else {
        res.writeHead(404);
        res.end();
    }
});

function getFile(localPath, mimeType, res) {
  // Lecture du fichier
  fs.readFile(localPath, function(err, contents) {
    if (!err) {
      res.writeHead(200, {
        "Content-Type": mimeType,
        "Content-Length": contents.length
      });
      res.end(contents);
    } else {
      res.writeHead(500);
      res.end();
    }
  });
}

//////////    CONNEXION BASE DE DONNEES    //////////

var connection = mysql.createConnection({
  host : 'localhost',
  user : 'root',
  password : 'root',
  database : 'pictionary-db'
});

connection.connect(function(error) {
  if (error == null) {
    console.log('--- Database Connected ---');
  }
  else {
    console.log('--- Database Connection ' + error + '---');
  }  
});

// Variables globales
var socketsUsers = [];
var players = [];
var messages = [];
var coord = [];
var count;
var game;
var gameWin;
var gameLost;
var inGame = false;
var userName = 'Invité';
var pseudoAndSocket = [];
var token = false;
var playOrder = 0;
var dictionary;
var currentWord;
var rooms = [];
var firstTime = true;

io = io.listen(app); 

// Supprime les messages de debug de socketio dans la console
io.set('log level', 1);
players.pop();

// Chargement du dictionaire
fs.readFile(__dirname + '/dictionary.txt', function (err, data) {
	dictionary = data.toString('utf-8').split('\r\n');
});

// Evènement connexion
io.sockets.on('connection', function (socket) {

  // Variables
  var index = socketsUsers.indexOf(socket);
  var user = players[index];

//////////   CHAT    //////////
  
  socketsUsers.push(socket);
  
  // Récupération des messages
  socket.emit('getMessages', messages);
  socket.on('newMessage', function (mess) {
    messages.push(mess);
    socket.broadcast.emit('getNewMessages', mess);

    // Test des mots si la partie est en cours
    if (inGame) {
      if (mess.pseudo != game.player) {
        if (mess.message.toLowerCase() == currentWord.toLowerCase()) {
          gameWin = {'player':mess.pseudo, 'word':currentWord};
          io.sockets.emit('wordGuessed', gameWin);
          inGame = false;
          index = socketsUsers.indexOf(socket);
          players[index].score = players[index].score + 1;

          // Contrôle si un joueur a gagné la partie
          if (players[index].score == 10) {
            io.sockets.emit('gameWin', gameWin);
          }

          io.sockets.emit('addLines', players);
        }
      }
    }
  });

  // Récupération et stockage des utilisateurs
  socket.on('newUser', function (score) {
    user = {'pseudo' : userName, 'score' : score.score};
    players.push(user);
  	socketAndPseudo = {'pseudo' : userName, 'socket' : socket.id};
  	pseudoAndSocket.push(socketAndPseudo);
  	socket.emit('setName',userName);
    io.sockets.emit('userAnnouncement', user);
    io.sockets.emit('addLines', players);
  	
  	// Demande une distribution du jeton quand il y a plus de 1 joueur
  	if (pseudoAndSocket.length > 1) {
  		giveToken();
  	}
  });

  // Déconnexion d'un utilisateur
  socket.on('disconnect', function(){
    index = socketsUsers.indexOf(socket);
    user = players[index];
    socketsUsers.splice(index,1);
    players.splice(index,1);
    io.sockets.emit('userQuit', user);
    io.sockets.emit('addLines', players);
  }); 

//////////    CANVA    //////////
  
  // Récupération du canvas
  socket.emit('getCanvas', coord);
  socket.on('drawing', function (data) {
	  coord.push(data);
    socket.broadcast.emit('drawLine', data);
  });
  
  // Remise à 0 du canvas
  socket.on('erase', function (data) {
    for(var i = 0; i < coord.length; i++) {
      coord.pop();
    }
    socket.broadcast.emit('eraseCanvas');
  });

//////////    COMPTEUR    //////////

  socket.on('counting', function (data) {
    count = data;
    socket.broadcast.emit('counter', data);
  });

//////////    PARTIE    //////////
  
  // Bloquage du canvas pour les utilisateurs
  socket.on('lockCanvas', function (data) {
    game = data;
    socket.broadcast.emit('canvasLocked', data);
  });

  // Annonce du début de partie
  socket.on('startGameChat', function (data) {
    io.sockets.emit('gameStart', data);
  });

  // Annonce de perte de partie (temps écoulé)
  socket.on('gameLost', function (data) {
    inGame = false;
    gameLost = {'word':currentWord};
    io.sockets.emit('wordNotGuessed', gameLost);
  });
  
  socket.on('inGame', function () {
    inGame = true;
	token = false;
	
	// Définition du mot à faire deviner
	var randomLine = Math.floor(Math.random() * dictionary.length);
	var line = dictionary[randomLine];
	var word = line.split(',');
	currentWord = word[0];
	
	socket.emit('yourWord', currentWord);
  });
  
  // Vérifie que le token n'ait pas déja été donné et le donne à un joueur
  socket.on('giveToken', function() {
	if (!(token) && !(inGame)) {
		var sock = pseudoAndSocket[playOrder].socket;
		var turn = pseudoAndSocket[playOrder];
		io.sockets.emit('playerTurn', turn);
		playOrder ++;
		token = true;
		if (playOrder >= pseudoAndSocket.length) {
			playOrder = 0;
		}
		io.sockets.socket(sock).emit('yourTurnToPlay');
	}
  });
  
  function giveToken() {
  	if (!(token) && !(inGame)) {
		var sock = pseudoAndSocket[playOrder].socket;
		var turn = pseudoAndSocket[playOrder];
		io.sockets.socket(sock).emit('yourTurnToPlay');
		io.sockets.emit('playerTurn', turn);
		playOrder ++;
		token = true;
		if (playOrder >= pseudoAndSocket.length) {
			playOrder = 0;
		}
	}
  }

//////////    LOGIN    //////////

  socket.on('checkUser', function (data) {	
    // Controle de l'existence de l'utilisateur dans la base données avec protection contre les injections
    var name = data.username;
    var ok;
	  var out = false;
    var query = connection.query('SELECT * FROM users WHERE username = ?', [name], function(err, result) {
      if ((typeof result[0] !== 'undefined') && (validateHash(result[0].password, data.password))) {
    		// Contrôle si l'utilisateur n'est pas déja connecté
    		for (var i = 0; i < players.length; i++) {
    			if (data.username == players[i].pseudo) {
    				i = players.length;
    				socket.emit('alreadyConnected');
    				out = true;
    			}
    		}
    		if (!(out)) {
    			console.log('User connection : ' + data.username);
    			ok = true;
    			userName = data.username;	
    			socket.emit('result', ok);				
    		}
      }
      else {
        ok = false;
    		socket.emit('result', ok);
      }
    });
  });

//////////    ROOMS    //////////

  // Récupère les rooms dans la base de données
  socket.on('giveRooms', function() {
    var query = connection.query('SELECT * FROM rooms', function(err, result) {
      if (firstTime) {
        for (var i = 0; i < result.length; i++) {
          var tempLang = result[i].languageRoom;
          var tempName = result[i].nameRoom;
          var playersByRooms = [];
          rooms[i] = {'roomName' : tempName, 'langu' : tempLang, 'nbrPlayers' : 0, 'namePlayers' : playersByRooms}  
        }
        firstTime = false;
      }
      socket.emit('fillTabRooms', result, rooms);
    });
  });

  // Insertion en base de données avec protection contre les injections
  socket.on('saveRoom', function (data) {
    var post = {nameRoom : data.roomName, languageRoom : data.langu};
    var query = connection.query('INSERT INTO rooms SET ?', [post], function(err, result) {
      console.log('Room insertion : ' + data.roomName + ', ' + data.langu);
      console.log(err);
      socket.emit('error', err);
      var playersByRooms = [];
      rooms.push({'roomName' : data.roomName, 'langu' : data.langu, 'nbrPlayers' : 0, 'namePlayers' : playersByRooms});
    });
    var query = connection.query('SELECT * FROM rooms', function(err, result) {
      io.sockets.emit('fillTabRooms', result, rooms);
    });
  });

  // Contrôle des doublons
  socket.on('checkRoomDouble', function (data) {
    var name = data.roomName;
    var ok;
    var query = connection.query('SELECT * FROM rooms WHERE nameRoom = ?', [name], function(err, result) {
      if (result.length > 0) {
        ok = true;
      }
      else {
        ok = false;
      }
      socket.emit('resultRoomDouble', ok);
    });
  });

  socket.on('goToRoom', function (rowName) {
    for (var i = 0; i < rooms.length; i++) {
      if (rooms[i].roomName == rowName) {
        rooms[i].nbrPlayers++;
        rooms[i].namePlayers.push({'playerName' : userName, 'socket' : socket.id});
        socket.join(rooms[i].roomName);
      }
    }
    var query = connection.query('SELECT * FROM rooms', function(err, result) {
      io.sockets.emit('fillTabRooms', result, rooms);
    });
  });

//////////    REGISTER    //////////

  socket.on('saveUser', function (data) {

    // Hash du password
    var hashedPasswd = createHash(data.password);
	
    // Insertion en base de données avec protection contre les injections
    var post = {username : data.username, password : hashedPasswd, language : data.langu};
    var query = connection.query('INSERT INTO users SET ?', [post], function(err, result) {
      console.log('User insertion : ' + data.username + ', ' + hashedPasswd + ', ' + data.langu);
  	  console.log(err);
  	  socket.emit('error', err);
    });
    userName = data.username;
  });

  // Contrôle des doublons
  socket.on('checkDouble', function (data) {
    var name = data.username;
    var ok;
    var query = connection.query('SELECT * FROM users WHERE username = ?', [name], function(err, result) {
      if (result.length > 0) {
        ok = true;
      }
      else {
        ok = false;
      }
      socket.emit('resultDouble', ok);
    });
  });

//////////    PASSWORD HASH    //////////

  var saltLength = 9;
  
  // Génération d'un mot hashé
  function createHash(password) {
    var salt = generateSalt(saltLength);
    var hash = md5(password + salt);
    return salt + hash;
  }
  
  // Comparaison de mots hashés
  function validateHash(hash, password) {
    var salt = hash.substr(0, saltLength);
    var validHash = salt + md5(password + salt);
    return hash === validHash;
  }
  
  // Génération de caractères aléatoire
  function generateSalt(len) {
    var set = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', setLen = set.length, salt = '';
    for (var i = 0; i < len; i++) {
      var p = Math.floor(Math.random() * setLen);
      salt += set[p];
    }
    return salt;
  }

  function md5(string) {
    return crypto.createHash('md5').update(string).digest('hex');
  }

  module.exports = {
    'hash' : createHash,
    'validate' : validateHash
  }

});

// Ecoute sur le port 1337
app.listen(1337);
console.log('Pictionary running at http://localhost:1337/');