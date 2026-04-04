const { createLobby, getLobby } = require('../../server');

export default async function handler(req, res) {
  if (req.method === 'POST') {
    // Create lobby
    const { hostId, settings } = req.body;

    if (!hostId) {
      return res.status(400).json({ error: 'Host ID required' });
    }

    const lobby = createLobby(hostId, settings);
    return res.status(201).json({ lobby: {
      id: lobby.id,
      inviteCode: lobby.inviteCode,
      players: Array.from(lobby.players.values()),
      settings: lobby.settings,
      state: lobby.state,
    } });
  }

  if (req.method === 'PUT') {
    // Join or start lobby
    const { action, lobbyId, playerId, inviteCode } = req.body;

    if (action === 'join') {
      // Join logic - but since it's WebSocket, maybe redirect to WS
      return res.status(200).json({ message: 'Use WebSocket to join lobby' });
    }

    if (action === 'start') {
      const lobby = getLobby(lobbyId);
      if (!lobby) {
        return res.status(404).json({ error: 'Lobby not found' });
      }

      if (lobby.hostId !== playerId) {
        return res.status(403).json({ error: 'Only host can start game' });
      }

      // Check all ready
      const allReady = Array.from(lobby.players.values()).every(p => p.ready);
      if (!allReady) {
        return res.status(400).json({ error: 'Not all players ready' });
      }

      lobby.state = 'starting';
      return res.status(200).json({ message: 'Game starting' });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
}