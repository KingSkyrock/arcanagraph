const express = require('express');
const { createServer } = require('http');
const next = require('next');
const { Server } = require('socket.io');
const { Client } = require('pg');
const path = require('path');
require('dotenv').config();

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev, dir: __dirname });
const handle = app.getRequestHandler();

// Create Express app
const expressApp = express();
const server = createServer(expressApp);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

function getPostgresConfig() {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    const url = new URL(databaseUrl);

    return {
      host: url.hostname,
      port: Number(url.port || 5432),
      database: url.pathname.replace(/^\//, '') || 'arcanagraph',
      user: decodeURIComponent(url.username || 'postgres'),
      password: decodeURIComponent(url.password || 'postgres'),
    };
  }

  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'arcanagraph',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  };
}

// PostgreSQL client
const pgClient = new Client(getPostgresConfig());

//#####################################
// SECTION 1: NEXT.JS SETUP AND WEBSITE SERVING
//#####################################

app.prepare().then(async () => {
  // Connect to PostgreSQL
  try {
    await pgClient.connect();
    console.log('Connected to PostgreSQL');
  } catch (error) {
    console.error('Failed to connect to PostgreSQL:', error);
  }

  // Express middleware
  expressApp.use(express.json());

  // API routes
  expressApp.post('/api/lobby', async (req, res) => {
    const { hostId, settings } = req.body;

    if (!hostId) {
      return res.status(400).json({ error: 'Host ID required' });
    }

    try {
      const inviteCode = generateInviteCode();
      const result = await pgClient.query(
        'INSERT INTO lobbies (host_id, invite_code, settings, state) VALUES ($1, $2, $3, $4) RETURNING *',
        [hostId, inviteCode, JSON.stringify(settings), 'waiting']
      );

      const lobby = result.rows[0];

      // Add host to lobby_players
      await pgClient.query(
        'INSERT INTO lobby_players (lobby_id, player_id, ready, is_host) VALUES ($1, $2, $3, $4)',
        [lobby.id, hostId, false, true]
      );

      return res.status(201).json({
        lobby: {
          id: lobby.id,
          inviteCode: lobby.invite_code,
          players: [{ id: hostId, ready: false, isHost: true }],
          settings: lobby.settings,
          state: lobby.state,
        }
      });
    } catch (error) {
      console.error('Error creating lobby:', error);
      return res.status(500).json({ error: 'Failed to create lobby' });
    }
  });

  expressApp.get('/api/lobby/:id', async (req, res) => {
    try {
      const result = await pgClient.query('SELECT * FROM lobbies WHERE id = $1', [req.params.id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Lobby not found' });
      }

      const lobby = result.rows[0];
      res.json({ lobby: serializeLobby(lobby) });
    } catch (error) {
      console.error('Error fetching lobby:', error);
      return res.status(500).json({ error: 'Failed to fetch lobby' });
    }
  });

  // Next.js catch-all handler for pages
  expressApp.use((req, res) => {
    return handle(req, res);
  });

  //#####################################
  // SECTION 2: SOCKET.IO FOR MULTIPLAYER GAME ROOMS
  //#####################################

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join_lobby', async (data) => {
      const { inviteCode, playerId } = data;

      try {
        // Find lobby by invite code
        const lobbyResult = await pgClient.query('SELECT * FROM lobbies WHERE invite_code = $1', [inviteCode]);

        if (lobbyResult.rows.length === 0) {
          socket.emit('error', { message: 'Lobby not found' });
          return;
        }

        const lobby = lobbyResult.rows[0];

        if (lobby.state !== 'waiting') {
          socket.emit('error', { message: 'Lobby not accepting players' });
          return;
        }

        // Check if player is already in the lobby
        const existingPlayer = await pgClient.query(
          'SELECT * FROM lobby_players WHERE lobby_id = $1 AND player_id = $2',
          [lobby.id, playerId]
        );

        // Only insert if player is not already in the lobby
        if (existingPlayer.rows.length === 0) {
          await pgClient.query(
            'INSERT INTO lobby_players (lobby_id, player_id, ready, is_host) VALUES ($1, $2, $3, $4)',
            [lobby.id, playerId, false, false]
          );
        }

        // Join socket room
        socket.join(`lobby_${lobby.id}`);

        // Broadcast update
        const updatedLobby = await getLobbyWithPlayers(lobby.id);
        io.to(`lobby_${lobby.id}`).emit('lobby_update', { lobby: serializeLobby(updatedLobby) });

        socket.emit('joined_lobby', { lobbyId: lobby.id, lobby: serializeLobby(updatedLobby) });
      } catch (error) {
        console.error('Error joining lobby:', error);
        socket.emit('error', { message: 'Failed to join lobby' });
      }
    });

    socket.on('player_ready', async (data) => {
      const { lobbyId, playerId, ready } = data;

      try {
        await pgClient.query(
          'UPDATE lobby_players SET ready = $1 WHERE lobby_id = $2 AND player_id = $3',
          [ready, lobbyId, playerId]
        );

        const updatedLobby = await getLobbyWithPlayers(lobbyId);
        io.to(`lobby_${lobbyId}`).emit('lobby_update', { lobby: serializeLobby(updatedLobby) });
      } catch (error) {
        console.error('Error updating player ready:', error);
      }
    });

    socket.on('start_game', async (data) => {
      const { lobbyId, playerId } = data;

      try {
        const lobbyResult = await pgClient.query('SELECT * FROM lobbies WHERE id = $1', [lobbyId]);
        const lobby = lobbyResult.rows[0];

        if (lobby.host_id !== playerId) {
          socket.emit('error', { message: 'Only host can start game' });
          return;
        }

        // Check if all players are ready
        const playersResult = await pgClient.query('SELECT * FROM lobby_players WHERE lobby_id = $1', [lobbyId]);
        const allReady = playersResult.rows.every(p => p.ready);

        if (!allReady) {
          socket.emit('error', { message: 'Not all players are ready' });
          return;
        }

        // Update lobby state
        await pgClient.query('UPDATE lobbies SET state = $1 WHERE id = $2', ['starting', lobbyId]);

        io.to(`lobby_${lobbyId}`).emit('game_starting', { lobbyId });

        // Simulate game start
        setTimeout(async () => {
          await pgClient.query('UPDATE lobbies SET state = $1 WHERE id = $2', ['in_game', lobbyId]);
          io.to(`lobby_${lobbyId}`).emit('game_started', { gameServerUrl: 'ws://localhost:3002' });
        }, 2000);
      } catch (error) {
        console.error('Error starting game:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      // Handle disconnect logic
    });
  });

  //#####################################
  // SECTION 3: POSTGRESQL DATABASE OPERATIONS
  //#####################################

  // Helper functions for database operations
  async function getLobbyWithPlayers(lobbyId) {
    const lobbyResult = await pgClient.query('SELECT * FROM lobbies WHERE id = $1', [lobbyId]);
    const playersResult = await pgClient.query('SELECT * FROM lobby_players WHERE lobby_id = $1', [lobbyId]);

    const lobby = lobbyResult.rows[0];
    lobby.players = playersResult.rows;

    return lobby;
  }

  function generateInviteCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  function serializeLobby(lobby) {
    return {
      id: lobby.id,
      inviteCode: lobby.invite_code,
      hostId: lobby.host_id,
      players: lobby.players || [],
      settings: lobby.settings,
      state: lobby.state,
    };
  }

  // Initialize database tables (for development)
  async function initDatabase() {
    try {
      await pgClient.query(`
        CREATE TABLE IF NOT EXISTS lobbies (
          id SERIAL PRIMARY KEY,
          host_id VARCHAR(255) NOT NULL,
          invite_code VARCHAR(10) UNIQUE NOT NULL,
          settings JSONB,
          state VARCHAR(20) DEFAULT 'waiting',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await pgClient.query(`
        CREATE TABLE IF NOT EXISTS lobby_players (
          id SERIAL PRIMARY KEY,
          lobby_id INTEGER REFERENCES lobbies(id) ON DELETE CASCADE,
          player_id VARCHAR(255) NOT NULL,
          ready BOOLEAN DEFAULT FALSE,
          is_host BOOLEAN DEFAULT FALSE,
          joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await pgClient.query(`
        CREATE TABLE IF NOT EXISTS match_history (
          id SERIAL PRIMARY KEY,
          lobby_id INTEGER REFERENCES lobbies(id),
          winner_id VARCHAR(255),
          game_data JSONB,
          ended_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      console.log('Database tables initialized');
    } catch (error) {
      console.error('Error initializing database:', error);
    }
  }

  await initDatabase();

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, '0.0.0.0', (err) => {
    if (err) throw err;
    console.log(`> Ready on http://0.0.0.0:${PORT}`);
    console.log(`> Accessible at http://localhost:${PORT} or http://<your-ip>:${PORT}`);
  });
}).catch((ex) => {
  console.error(ex.stack);
  process.exit(1);
});
