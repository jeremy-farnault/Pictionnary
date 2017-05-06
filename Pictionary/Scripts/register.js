var socket = io.connect();

// Envoi d'un user
function hashAndSend() {

	var userName = document.getElementById('username').value;
	var password = document.getElementById('password').value;
	var confPassword = document.getElementById('confirmPw').value;
	var language = document.getElementById("language").value;

	// Vérifie la correspondance mot de passe / confirmation
	if (password != confPassword) {
		document.getElementById('errorMsg').innerHTML = 'Mot de passe et confirmation non identique.';
		document.getElementById('password').value = '';
		document.getElementById('confirmPw').value = '';
	}
	else {
		// Contrôle l'existence de doublon en base de données
		socket.emit('checkDouble', {
			'username' : userName,
		});

		socket.on('resultDouble', function (result) {
			if (result) {
				document.getElementById('errorMsg').innerHTML = 'Nom d\'utilisateur déja utilisé.';
				document.getElementById('username').value = '';
				document.getElementById('password').value = '';
				document.getElementById('confirmPw').value = '';
			}
			else {
				socket.emit('saveUser', {
					'username' : userName,
					'password' : password,
					'langu' : language
				});		
			}
		});
	}
}

socket.on('error', function (error) {
	if (error != null) {
		document.getElementById('errorMsg').innerHTML = 'Erreur dans la base de données.';
		document.getElementById('username').value = '';
		document.getElementById('password').value = '';
		document.getElementById('confirmPw').value = '';
	}
	else {
		document.location.href = "rooms.html";
	}
});