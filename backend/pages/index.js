import Head from 'next/head';

export default function Home() {
  return (
    <div>
      <Head>
        <title>ArcanaGraph - Multiplayer Game Lobby</title>
        <meta name="description" content="Real-time multiplayer game lobby system" />
      </Head>

      <main style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
        <h1>ArcanaGraph</h1>
        <p>Welcome to the multiplayer game lobby system!</p>

        <div style={{ marginTop: '2rem' }}>
          <h2>Create Lobby</h2>
          <button id="createLobbyBtn">Create New Lobby</button>
          <p id="lobbyInfo"></p>
        </div>

        <div style={{ marginTop: '2rem' }}>
          <h2>Join Lobby</h2>
          <input type="text" id="inviteCode" placeholder="Enter invite code" />
          <button id="joinLobbyBtn">Join Lobby</button>
        </div>

        <div id="lobbyView" style={{ display: 'none', marginTop: '2rem' }}>
          <h2>Lobby</h2>
          <div id="players"></div>
          <button id="readyBtn">Ready</button>
          <button id="startGameBtn" style={{ display: 'none' }}>Start Game</button>
        </div>
      </main>

      <script src="/socket.io/socket.io.js"></script>
      <script dangerouslySetInnerHTML={{
        __html: `
          const socket = io();
          console.log('Connecting to socket...');
          socket.on('connect', () => {
            console.log('Connected to socket:', socket.id);
          });
          let currentLobby = null;
          let playerId = 'player_' + Math.random().toString(36).substr(2, 9);
          console.log('Player ID:', playerId);

          document.getElementById('createLobbyBtn').onclick = async () => {
            const response = await fetch('/api/lobby', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ hostId: playerId, settings: {} })
            });
            const data = await response.json();
            if (response.ok) {
              currentLobby = data.lobby;
              document.getElementById('lobbyInfo').textContent = 'Lobby created! Invite code: ' + data.lobby.inviteCode;
              // Host joins the Socket.io room to get real-time updates
              socket.emit('join_lobby', { inviteCode: data.lobby.inviteCode, playerId });
            }
          };

          document.getElementById('joinLobbyBtn').onclick = () => {
            const inviteCode = document.getElementById('inviteCode').value;
            socket.emit('join_lobby', { inviteCode, playerId });
          };

          document.getElementById('readyBtn').onclick = () => {
            const ready = !document.getElementById('readyBtn').classList.contains('ready');
            socket.emit('player_ready', { lobbyId: currentLobby.id, playerId, ready });
          };

          document.getElementById('startGameBtn').onclick = () => {
            socket.emit('start_game', { lobbyId: currentLobby.id, playerId });
          };

          socket.on('joined_lobby', (data) => {
            console.log('Joined lobby:', data);
            currentLobby = data.lobby;
            showLobby(data.lobby);
          });

          socket.on('lobby_update', (data) => {
            console.log('Lobby update:', data);
            currentLobby = data.lobby;
            updateLobby(data.lobby);
          });

          socket.on('game_starting', (data) => {
            document.getElementById('lobbyView').innerHTML = '<h2>Game Starting...</h2>';
          });

          socket.on('game_started', (data) => {
            document.getElementById('lobbyView').innerHTML = '<h2>Game Started! Connecting to ' + data.gameServerUrl + '</h2>';
          });

          socket.on('error', (data) => {
            alert('Error: ' + data.message);
          });

          function showLobby(lobby) {
            document.getElementById('lobbyView').style.display = 'block';
            updateLobby(lobby);
          }

          function updateLobby(lobby) {
            const playersDiv = document.getElementById('players');
            if (playersDiv) {
              playersDiv.innerHTML = '<h3>Players:</h3>';
              lobby.players.forEach(player => {
                playersDiv.innerHTML += '<div>' + player.player_id + (player.ready ? ' (Ready)' : ' (Not Ready)') + (player.is_host ? ' (Host)' : '') + '</div>';
              });
            } else {
              console.error('Players div not found');
            }

            const readyBtn = document.getElementById('readyBtn');
            const currentPlayer = lobby.players.find(p => p.player_id === playerId);
            if (currentPlayer) {
              readyBtn.textContent = currentPlayer.ready ? 'Not Ready' : 'Ready';
              readyBtn.classList.toggle('ready', currentPlayer.ready);
            }

            const startBtn = document.getElementById('startGameBtn');
            if (lobby.hostId === playerId) {
              startBtn.style.display = 'inline';
            } else {
              startBtn.style.display = 'none';
            }
          }
        `
      }} />
    </div>
  );
}