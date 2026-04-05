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
            showGame(data.gameState);
          });

          socket.on('game_update', (data) => {
            updateGame(data.gameState);
          });

          socket.on('game_over', (data) => {
            showGameOver(data.winner, data.gameState);
          });

          socket.on('game_restarted', (data) => {
            currentLobby = data.lobby;
            showLobby(data.lobby);
          });

          socket.on('player_left', (data) => {
            if (data.playerId === playerId) {
              // We left, go back to main screen
              document.getElementById('lobbyView').style.display = 'none';
              currentLobby = null;
            } else {
              currentLobby = data.lobby;
              updateLobby(data.lobby);
            }
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

          function showGame(gameState) {
            console.log('Showing game with state:', gameState);
            const lobbyView = document.getElementById('lobbyView');
            lobbyView.innerHTML = `
              <h2>Game in Progress</h2>
              <div id="gameState"></div>
              <div id="attackButtons" style="margin-top: 1rem;"></div>
            `;
            updateGame(gameState);
          }

          function updateGame(gameState) {
            console.log('Updating game with state:', gameState);
            const gameStateDiv = document.getElementById('gameState');
            const attackButtonsDiv = document.getElementById('attackButtons');

            if (!gameStateDiv || !attackButtonsDiv) {
              console.error('Game UI elements not found');
              return;
            }

            let healthHtml = '<h3>Player Health:</h3>';
            let attackHtml = '';

            if (gameState.players && Array.isArray(gameState.players)) {
              gameState.players.forEach(player => {
                console.log('Processing player:', player);
                // Health bar
                const healthPercent = Math.max(0, Math.min(100, player.health || 0));
                healthHtml += `
                  <div style="margin: 10px 0; padding: 10px; border: 1px solid #ccc; border-radius: 5px;">
                    <div style="font-weight: bold;">${player.id || 'Unknown'}${player.isHost ? ' (Host)' : ''}</div>
                    <div style="width: 200px; height: 20px; border: 1px solid #000; background: #f0f0f0; margin: 5px 0;">
                      <div style="width: ${healthPercent}%; height: 100%; background: ${healthPercent > 50 ? '#4CAF50' : healthPercent > 25 ? '#FF9800' : '#F44336'}; transition: width 0.3s ease;"></div>
                    </div>
                    <div>${player.health || 0}/100 HP</div>
                  </div>
                `;

                // Attack button (don't show for self)
                if (player.id && player.id !== playerId) {
                  attackHtml += `<button onclick="attackPlayer('${player.id}')" style="margin: 5px; padding: 10px 20px; background: #ff4444; color: white; border: none; border-radius: 5px; cursor: pointer;">Attack ${player.id}</button>`;
                }
              });
            } else {
              console.error('No players array in gameState');
              healthHtml += '<p>Error: No player data available</p>';
            }

            gameStateDiv.innerHTML = healthHtml;
            attackButtonsDiv.innerHTML = attackHtml;
          }

          function showGameOver(winnerId, gameState) {
            const lobbyView = document.getElementById('lobbyView');
            const isWinner = winnerId === playerId;
            const winnerText = isWinner ? 'You won!' : `${winnerId} won!`;

            let buttonsHtml = '';
            // Only host can restart
            if (currentLobby && currentLobby.hostId === playerId) {
              buttonsHtml += '<button id="restartGameBtn" style="margin: 5px; padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer;">Play Again</button>';
            }
            buttonsHtml += '<button id="leaveLobbyBtn" style="margin: 5px; padding: 10px 20px; background: #f44336; color: white; border: none; border-radius: 5px; cursor: pointer;">Leave Lobby</button>';

            lobbyView.innerHTML = `
              <h2>Game Over</h2>
              <p style="font-size: 18px; font-weight: bold; color: ${isWinner ? '#4CAF50' : '#f44336'};">${winnerText}</p>
              ${buttonsHtml}
            `;

            // Re-attach event listeners
            const restartBtn = document.getElementById('restartGameBtn');
            if (restartBtn) {
              restartBtn.onclick = () => {
                socket.emit('restart_game', { lobbyId: currentLobby.id, playerId });
              };
            }

            const leaveBtn = document.getElementById('leaveLobbyBtn');
            if (leaveBtn) {
              leaveBtn.onclick = () => {
                socket.emit('leave_lobby', { lobbyId: currentLobby.id, playerId });
              };
            }
          }

          // Global function for attack button
          window.attackPlayer = function(targetId) {
            socket.emit('attack_player', { lobbyId: currentLobby.id, attackerId: playerId, targetId });
          };
        `
      }} />
    </div>
  );
}