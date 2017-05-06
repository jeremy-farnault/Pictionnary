var socket = io.connect();

//////////    TABLEAU DE PARTIES    //////////

// Variables
var choice = false;
var tab = document.getElementById('tabRooms');
tabBody = tab.getElementsByTagName('tbody')[0];

socket.emit('giveRooms');

// Ajoute une ligne dans le tableau de parties
socket.on('fillTabRooms', function (result, rooms) {
	delRows(tab);
	if (result.length > 0) {
		for(var i=0; i<result.length; i++) {
			var line = tabBody.insertRow(-1);
			var col1 = line.insertCell(0);
			var col2 = line.insertCell(1);
			var col3 = line.insertCell(2);
			col1.innerHTML += result[i].nameRoom;
			col2.innerHTML += result[i].languageRoom;
			col3.innerHTML += rooms[i].nbrPlayers;
		}

		// Ajout d'un évènement onclick sur les rows de la table
	    var rows = tab.getElementsByTagName("tr");
	    for (var i = 0; i < rows.length; i++) {
	        var currentRow = tab.rows[i];
	        var createClickHandler =
	            function(row)
	            {
	                return function() {
	                	if (!(choice)) {
		                    var cell = row.getElementsByTagName("td")[0];
		                    var nameRow = cell.innerHTML;
		                    socket.emit('goToRoom', nameRow);
		                    choice = true;
		                }
	                };
	            };
	        currentRow.onclick = createClickHandler(currentRow);
	    }
	}
});

// Remet le tableau à 0
function delRows (tab) {
	while (tabBody.getElementsByTagName('TR').length >= 1) {
		tabBody.deleteRow(0);
	}    
}

function sendRoom () {
	var roomName = document.getElementById('roomName').value;
	var language = document.getElementById("languRoom").value;

	// Contrôle l'existence de doublon en base de données
	socket.emit('checkRoomDouble', {
		'roomName' : roomName
	});

	socket.on('resultRoomDouble', function (result) {
		if (result) {
			document.getElementById('errRooms').innerHTML = 'Nom de partie déja utilisé.';
			document.getElementById('roomName').value = '';
		}
		else {
			socket.emit('saveRoom', {
				'roomName' : roomName,
				'langu' : language
			});
			document.getElementById('roomName').value = '';		
		}
	});
}

function play() {
	document.location.href = "pictionary.html";
}