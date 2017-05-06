var socket = io.connect();

function checkAndPlay() {
	var userName = document.getElementById('user').value;
	var password = document.getElementById('pass').value;

	// Vérifie l'existence de l'utilisateur
	socket.emit('checkUser', {
		'username' : userName,
		'password' : password
	});
}

socket.on('result', function (result) {
	if (result) {
		document.location.href = "rooms.html";
	}
	else {
		document.getElementById('user').value = '';
		document.getElementById('pass').value = '';
		document.getElementById('badUser').innerHTML = 'Nom d\'utilisateur ou mot de passe incorrect.';
	}
});

socket.on('alreadyConnected', function() {
	document.getElementById('user').value = '';
	document.getElementById('pass').value = '';
	document.getElementById('badUser').innerHTML = 'Utilisateur déja connecté.';
});