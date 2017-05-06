var socket = io.connect();

//////////    UTILISATEUR    //////////

// Variables
var score = 0;
var chat = document.getElementById('chatBox');
var userName;
var eraser = false;

// Envoi du score de l'utilisateur au chat et récupération du nom
socket.emit('newUser', {
		'score' : score
});
socket.on('setName', function (getName) {
	userName = getName;
});

//////////    CHAT    //////////

// Récupération des messages sur le serveur
socket.on('getMessages', function (messages) {
	var html = '';
	for (var i = 0; i < messages.length; i++) {
		html += '<div class="line"><b>'+messages[i].pseudo+'</b> : '+messages[i].message+'</div>';
	}
	chat.innerHTML = html;
});

// Récupération des nouveaux messages
socket.on('getNewMessages', function (message) {
	chat.innerHTML += '<div class="line"><b>'+message.pseudo+'</b> : '+message.message+'</div>';
});

// Envoi d'un message
function sendMessage(mess) {
	var message = document.getElementById('message').value;

	// Echappement des caractères pouvant permettre des injections
	var sanitizeMess = message.replace(/(<([^>]+)>)/ig,"");
	socket.emit('newMessage', { 'pseudo' : userName, 'message' : sanitizeMess });
	chat.innerHTML += '<div class="line"><b>'+userName+'</b> : '+sanitizeMess+'</div>';
	document.getElementById('message').value = '';
	chat.scrollTop = 100000000;
	return false;
}

// Notification de connexion dans le chat
socket.on('userAnnouncement', function (player) {
	chat.innerHTML += '<div class="line"><b>'+player.pseudo+'</b> a rejoint la partie.</div>';
	chat.scrollTop = 100000000; 
});

// Notification de déconnexion dans le chat
socket.on('userQuit', function (player) {
	chat.innerHTML += '<div class="line"><b>'+player.pseudo+'</b> a quitté la partie.</div>'; 
});

//////////    CANVAS    //////////

// Variables
var canvas = document.getElementById('paint');
var ctx = canvas.getContext('2d');
var selectElmt = document.getElementById('sizeSelect');
var mouse = {x: 0, y: 0};
var tempMouse = {x: 0, y: 0};
var drawing = false;
var locked = false;

// Changement de la couleur du trait de dessin
function changeColor(color) {
	ctx.beginPath();
	ctx.globalCompositeOperation = "source-over";
	ctx.strokeStyle = color;
	ctx.stroke();
}

// Changement de la taille du trait de dessin
function changeSize() {
	ctx.beginPath();
	ctx.lineWidth = selectElmt.options[selectElmt.selectedIndex].value;
	ctx.stroke();
}

// Evènement pour le bouton de remise à zéro du canvas
document.getElementById('clearCanvas').addEventListener('click', function() {
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	socket.emit('erase', {'erase' : true});
}, false);

// Evènement pour le bouton de la gomme
document.getElementById('clearSquare').addEventListener('click', function() {
	ctx.beginPath();
	ctx.globalCompositeOperation = "destination-out";
	ctx.strokeStyle = "rgba(0,0,0,1.0)";
	ctx.stroke();
}, false);

socket.on('eraseCanvas', function (coord) {
	ctx.clearRect(0, 0, canvas.width, canvas.height);
});

(function() {

	var sketch = document.querySelector('#drawArea');
	var sketch_style = getComputedStyle(sketch);

	canvas.width = parseInt(sketch_style.getPropertyValue('width'));
	canvas.height = parseInt(sketch_style.getPropertyValue('height'));

	// Capture de la souris
	canvas.addEventListener('mousemove', function(e) {	
		mouse.x = e.pageX - this.offsetLeft;
		mouse.y = e.pageY - this.offsetTop;
	}, false);

	ctx.lineJoin = 'round';
	ctx.lineCap = 'round';

	// Capture de l'évènement bouton cliqué
	canvas.addEventListener('mousedown', function(e) {
		if (!(locked)) {
			drawing = true;
			ctx.beginPath();
			ctx.moveTo(mouse.x, mouse.y);
			tempMouse.x = mouse.x;
			tempMouse.y = mouse.y;
			canvas.addEventListener('mousemove', onPaint, false);
		}
	}, false);

	// Capture de l'évènement bouton relaché
	canvas.addEventListener('mouseup', function() {
		if (!(locked)) {
			drawing = false;
			socket.emit('drawing', {
				'x': mouse.x,
				'y': mouse.y,
				'tempX': tempMouse.x,
				'tempY': tempMouse.y,
				'color': ctx.strokeStyle,
				'size': ctx.lineWidth,
				'status': drawing,
				'globCompOp' : ctx.globalCompositeOperation
			});
			canvas.removeEventListener('mousemove', onPaint, false);
		}
	}, false);

	// Dessin sur le canvas et envoi des coordonnées au serveur
	var onPaint = function() {
		ctx.lineTo(mouse.x, mouse.y);
		ctx.stroke();
		if(drawing) {
			socket.emit('drawing', {
				'x': mouse.x,
				'y': mouse.y,
				'tempX': tempMouse.x,
				'tempY': tempMouse.y,
				'color': ctx.strokeStyle,
				'size': ctx.lineWidth,
				'status': drawing,
				'globCompOp' : ctx.globalCompositeOperation
			});
		}
		tempMouse.x = mouse.x;
		tempMouse.y = mouse.y;
	};

	// Dessin du dessin récupéré sur le serveur
	socket.on('drawLine', function (coord) {
		var tempStyle = ctx.strokeStyle;
		var tempWidth = ctx.lineWidth; 
		var tempGlobCompOp = ctx.globalCompositeOperation;

		ctx.strokeStyle = coord.color;
		ctx.lineWidth = coord.size;
		ctx.globalCompositeOperation = coord.globCompOp;
		ctx.beginPath();
		ctx.moveTo(coord.tempX, coord.tempY);
		ctx.lineTo(coord.x, coord.y);
		ctx.stroke();

		ctx.strokeStyle = tempStyle;
		ctx.lineWidth = tempWidth; 
		ctx.globalCompositeOperation = tempGlobCompOp;
	});

	// Récupération du canvas sur le serveur
	socket.on('getCanvas', function (coord) {
		var tempStyle = ctx.strokeStyle;
		var tempWidth = ctx.lineWidth; 
		var tempGlobCompOp = ctx.globalCompositeOperation;

		ctx.moveTo(coord[0].tempX, coord[0].tempY);
		ctx.strokeStyle = coord[0].color;
		ctx.lineWidth = coord[0].size;
		ctx.globalCompositeOperation = coord[0].globCompOp;
		ctx.beginPath();
		for (var i = 1; i < coord.length; i++) {
			if (coord[i].status == true) {
				if (coord[i].color != coord[i-1].color) {
					ctx.strokeStyle = coord[i].color;
					ctx.beginPath();
				}
				if (coord[i].size != coord[i-1].size) {
					ctx.lineWidth = coord[i].size;
					ctx.beginPath();
				}
				if (coord[i].globCompOp != coord[i-1].globCompOp) {
					ctx.globalCompositeOperation = coord[i].globCompOp;
					ctx.beginPath();				
				}
				ctx.lineTo(coord[i].x, coord[i].y);	
				ctx.stroke();
			}
			else {
				ctx.moveTo(coord[i+1].tempX, coord[i+1].tempY);
			}
		}

		ctx.strokeStyle = tempStyle;
		ctx.lineWidth = tempWidth; 
		ctx.globalCompositeOperation = tempGlobCompOp;
	});				
}());

//////////    COMPTEUR    //////////

// Variables
var duration = 120;
var counter=document.getElementById('countdown');
var buttonCounter = document.getElementById('buttonCount');

// Décompte des secondes pour le compteur de temps
function countDown() {
	var seconds = duration;
	var minutes = 0;
		
	if(seconds < 0) {
		counter.innerHTML = "FIN";
		buttonCounter.value = "Départ";
		duration = 120;
		socket.emit('lockCanvas', {
			'lockStatus': false,
			'player': userName,
			'buttonDisabled': true,
			'buttonValue': buttonCounter.value
		});
		if (seconds > -10) {
			socket.emit('gameLost', {});
		}
	}
	else {
		if(seconds > 59) {
			minutes = Math.floor(seconds / 60);
			seconds = seconds - minutes * 60;
		}
		if(seconds < 10) {
			seconds = "0" + seconds;
		}
		if(minutes < 10) {
			minutes = "0" + minutes;
		}
		counter.innerHTML = minutes + " : " + seconds;
		duration = duration - 1;
		window.setTimeout("countDown();",999);
	}
	
	socket.emit('counting', {
		'count': counter.innerHTML,
		'status': buttonCounter.disabled,
		'value': buttonCounter.value
	});
	
	if(seconds < 0) {
		socket.emit('giveToken');
	}
}

// Met à jour le compteur
socket.on('counter', function (data) {
	counter.innerHTML = data.count;
	buttonCounter.disabled = data.status;
	buttonCounter.value = data.value;
});

//////////    PARTIE    //////////

// Réception d'un mot du dictionnaire
socket.on('yourWord', function (word) {
	document.getElementById('chatBox').innerHTML += '<div class="line" style=\'color:red\'><b>VOTRE MOT : '+word+'</b></div>';
	chat.scrollTop = 100000000;
});

function gameStarted() {

	// Remise à zéro du canvas
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	socket.emit('erase', {'erase' : true});

	// Bloquage du canvas pour les autres joueurs
	socket.emit('lockCanvas', {
		'lockStatus': true,
		'player': userName,
	});

	socket.emit('startGameChat', {'player': userName});
	socket.emit('inGame');

	duration = 120;
}

// Bloque le canvas pour les joueurs ne devant pas dessiner
socket.on('canvasLocked', function (data) {
	locked = data.lockStatus;
	buttonCounter.disabled = data.buttonDisabled;
	buttonCounter.value = data.buttonValue;
});

// Annonce qu'un joueur a deviné le mot
socket.on('wordGuessed', function (data) {
	document.getElementById('chatBox').innerHTML += '<div class="line">Le joueur <b>'+data.player+'</b> a deviné le mot <b>'+data.word+'</b>!</div>';
	chat.scrollTop = 100000000;
	duration = -10;
});

// Annonce que personne n'a deviné le mot en cours
socket.on('wordNotGuessed', function (data) {
	document.getElementById('chatBox').innerHTML += '<div class="line">Personne n\'a deviné le mot <b>'+data.word+'</b>. Partie perdue!</div>';
	chat.scrollTop = 100000000;
});

// Annonce le lancement de la partie
socket.on('gameStart', function (data) {
	document.getElementById('chatBox').innerHTML += '<div class="line"><b>'+data.player+'</b> a lancé la partie!</div>';
	chat.scrollTop = 100000000;
});

// Annonce le gagnant de la partie
socket.on('gameWin', function (data) {
	document.getElementById('chatBox').innerHTML += '<div class="line" style=\'color:red\'><b>'+data.player+' a gagné la partie!!!</b></div>';
	chat.scrollTop = 100000000;
	backToRooms();
});

// Chronomètre 10 secondes à la fin de la partie avant de revenir au choix des parties
var iterations = 10;
function backToRooms() {
	document.getElementById('chatBox').innerHTML += '<div class="line" style=\'color:blue\'><b>Retour au choix des parties dans '+iterations+' secondes.</b></div>';
	chat.scrollTop = 100000000;
	iterations --;
	if (iterations == 0) {
		document.location.href = "index.html";
	}
	window.setTimeout("backToRooms();",999);
}

// Enable le bouton de lancement de la partie pour le joueur
socket.on('yourTurnToPlay', function (data) {
	document.getElementById('buttonCount').disabled = false;
});

// Annonce le nom du joueur en cours
socket.on('playerTurn', function (data) {
	document.getElementById('chatBox').innerHTML += '<div class="line" style=\'color:blue\'><b>C\'est à '+data.pseudo+' de jouer.</b></div>';
	chat.scrollTop = 100000000;
});

//////////    TABLEAU DE SCORES    //////////

// Variables
var tab = document.getElementById('tabScore');
var tabBody = tab.getElementsByTagName('tbody')[0];

// Ajoute une ligne dans le tableau de scores
socket.on('addLines', function (data) {
	delRows(tab);
	for(var i=0; i<data.length; i++) {
		var line = tabBody.insertRow(-1);
		var col1 = line.insertCell(0);
		var col2 = line.insertCell(1);
		col1.innerHTML += data[i].pseudo;
		col2.innerHTML += data[i].score;
	}
});

// Remet le tableau à 0
function delRows (tab) {
	while (tabBody.getElementsByTagName('TR').length >= 1) {
		tabBody.deleteRow(0);
	}    
}