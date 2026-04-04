import { Pool, type PoolClient } from "pg";
import { config } from "./config";

const pool = new Pool({
  connectionString: config.databaseUrl,
});

const inviteAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
let schemaPromise: Promise<void> | null = null;

export type LobbyState = "waiting" | "starting" | "in_game";

export type AppUser = {
  id: string;
  firebaseUid: string;
  email: string | null;
  displayName: string | null;
  xp: number;
  level: number;
  className: string;
  wins: number;
  losses: number;
  gamesPlayed: number;
  createdAt: string;
  updatedAt: string;
};

export type LobbyPlayer = {
  userId: string;
  firebaseUid: string;
  email: string | null;
  displayName: string | null;
  xp: number;
  level: number;
  className: string;
  wins: number;
  losses: number;
  gamesPlayed: number;
  ready: boolean;
  isHost: boolean;
  joinedAt: string;
};

export type Lobby = {
  id: string;
  inviteCode: string;
  hostUserId: string;
  state: LobbyState;
  settings: Record<string, unknown>;
  players: LobbyPlayer[];
  createdAt: string;
  updatedAt: string;
};

type UpsertUserInput = {
  firebaseUid: string;
  email: string | null;
  displayName: string | null;
};

type DatabaseError = Error & { statusCode?: number };

function createDatabaseError(message: string, statusCode: number) {
  const error = new Error(message) as DatabaseError;
  error.statusCode = statusCode;
  return error;
}

function generateInviteCode() {
  return Array.from({ length: 6 }, () => {
    const index = Math.floor(Math.random() * inviteAlphabet.length);
    return inviteAlphabet[index];
  }).join("");
}

function normalizeInviteCode(inviteCode: string) {
  return inviteCode.trim().toUpperCase();
}

export function getClassNameForLevel(level: number) {
  if (level <= 1) {
    return "Spark";
  }

  if (level <= 4) {
    return "Ember";
  }

  if (level <= 9) {
    return "Adept";
  }

  if (level <= 14) {
    return "Enchanter";
  }

  if (level <= 19) {
    return "Spellbinder";
  }

  if (level <= 29) {
    return "Sorcerer";
  }

  return "Warlock";
}

function mapUser(row: Record<string, unknown>): AppUser {
  const level = Number(row.level ?? 1);

  return {
    id: String(row.id),
    firebaseUid: String(row.firebase_uid),
    email: (row.email as string | null) ?? null,
    displayName: (row.display_name as string | null) ?? null,
    xp: Number(row.xp ?? 0),
    level,
    className: getClassNameForLevel(level),
    wins: Number(row.wins),
    losses: Number(row.losses),
    gamesPlayed: Number(row.games_played),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

function mapLobbyPlayer(row: Record<string, unknown>): LobbyPlayer {
  const level = Number(row.player_level ?? 1);

  return {
    userId: String(row.player_user_id),
    firebaseUid: String(row.player_firebase_uid),
    email: (row.player_email as string | null) ?? null,
    displayName: (row.player_display_name as string | null) ?? null,
    xp: Number(row.player_xp ?? 0),
    level,
    className: getClassNameForLevel(level),
    wins: Number(row.player_wins ?? 0),
    losses: Number(row.player_losses ?? 0),
    gamesPlayed: Number(row.player_games_played ?? 0),
    ready: Boolean(row.player_ready),
    isHost: Boolean(row.player_is_host),
    joinedAt: new Date(String(row.player_joined_at)).toISOString(),
  };
}

function mapLobby(rows: Array<Record<string, unknown>>) {
  if (!rows.length) {
    return null;
  }

  const firstRow = rows[0];
  const players = rows
    .filter((row) => row.player_user_id !== null)
    .map(mapLobbyPlayer);
  const settings =
    firstRow.settings && typeof firstRow.settings === "object"
      ? (firstRow.settings as Record<string, unknown>)
      : {};

  return {
    id: String(firstRow.id),
    inviteCode: String(firstRow.invite_code),
    hostUserId: String(firstRow.host_user_id),
    state: String(firstRow.state) as LobbyState,
    settings,
    players,
    createdAt: new Date(String(firstRow.created_at)).toISOString(),
    updatedAt: new Date(String(firstRow.updated_at)).toISOString(),
  } satisfies Lobby;
}

function isMissingRelationError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "42P01"
  );
}

async function withSchemaRetry<T>(operation: () => Promise<T>) {
  await ensureDatabaseSchema();

  try {
    return await operation();
  } catch (error) {
    if (!isMissingRelationError(error)) {
      throw error;
    }

    await ensureDatabaseSchema(true);
    return operation();
  }
}

async function fetchLobbyRows(client: Pool | PoolClient, lobbyId: string) {
  const result = await client.query(
    `
      SELECT
        l.id,
        l.invite_code,
        l.host_user_id,
        l.state,
        l.settings,
        l.created_at,
        l.updated_at,
        lp.user_id AS player_user_id,
        lp.ready AS player_ready,
        lp.is_host AS player_is_host,
        lp.joined_at AS player_joined_at,
        u.firebase_uid AS player_firebase_uid,
        u.email AS player_email,
        u.display_name AS player_display_name,
        u.xp AS player_xp,
        u.level AS player_level,
        u.wins AS player_wins,
        u.losses AS player_losses,
        u.games_played AS player_games_played
      FROM lobbies l
      LEFT JOIN lobby_players lp ON lp.lobby_id = l.id
      LEFT JOIN users u ON u.id = lp.user_id
      WHERE l.id = $1
      ORDER BY lp.joined_at ASC
    `,
    [lobbyId],
  );

  return result.rows as Array<Record<string, unknown>>;
}

async function requireLobbyMembership(
  client: Pool | PoolClient,
  lobbyId: string,
  userId: string,
) {
  const result = await client.query(
    `
      SELECT 1
      FROM lobby_players
      WHERE lobby_id = $1 AND user_id = $2
    `,
    [lobbyId, userId],
  );

  if (!result.rows[0]) {
    throw createDatabaseError("You are not part of this lobby.", 403);
  }
}

async function readLobby(client: Pool | PoolClient, lobbyId: string) {
  const rows = await fetchLobbyRows(client, lobbyId);
  const lobby = mapLobby(rows);

  if (!lobby) {
    throw createDatabaseError("Lobby not found.", 404);
  }

  return lobby;
}

async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function pingDatabase() {
  await pool.query("SELECT 1");
}

async function runSchemaSetup() {
  await pool.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      firebase_uid TEXT NOT NULL UNIQUE,
      email TEXT UNIQUE,
      display_name TEXT,
      xp INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 1,
      wins INTEGER NOT NULL DEFAULT 0,
      losses INTEGER NOT NULL DEFAULT 0,
      games_played INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS xp INTEGER NOT NULL DEFAULT 0
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS level INTEGER NOT NULL DEFAULT 1
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS users_leaderboard_idx
    ON users (wins DESC, level DESC, xp DESC, losses ASC, games_played DESC, created_at ASC)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS lobbies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      invite_code TEXT NOT NULL UNIQUE,
      host_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      settings JSONB NOT NULL DEFAULT '{}'::jsonb,
      state TEXT NOT NULL DEFAULT 'waiting',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS lobby_players (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lobby_id UUID NOT NULL REFERENCES lobbies(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ready BOOLEAN NOT NULL DEFAULT FALSE,
      is_host BOOLEAN NOT NULL DEFAULT FALSE,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (lobby_id, user_id)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS match_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lobby_id UUID REFERENCES lobbies(id) ON DELETE SET NULL,
      winner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      result JSONB NOT NULL DEFAULT '{}'::jsonb,
      ended_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS lobbies_invite_code_idx
    ON lobbies (invite_code)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS lobby_players_lobby_id_idx
    ON lobby_players (lobby_id, joined_at ASC)
  `);
}

export async function ensureDatabaseSchema(force = false) {
  if (!schemaPromise || force) {
    schemaPromise = runSchemaSetup().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }

  await schemaPromise;
}

export async function upsertUser(input: UpsertUserInput) {
  const result = await withSchemaRetry(() =>
    pool.query(
      `
        INSERT INTO users (firebase_uid, email, display_name)
        VALUES ($1, $2, $3)
        ON CONFLICT (firebase_uid) DO UPDATE
        SET
          email = EXCLUDED.email,
          display_name = COALESCE(EXCLUDED.display_name, users.display_name),
          updated_at = NOW()
        RETURNING *
      `,
      [input.firebaseUid, input.email, input.displayName],
    ),
  );

  return mapUser(result.rows[0]);
}

export async function getUserByFirebaseUid(firebaseUid: string) {
  const result = await withSchemaRetry(() =>
    pool.query("SELECT * FROM users WHERE firebase_uid = $1", [firebaseUid]),
  );

  if (!result.rows[0]) {
    return null;
  }

  return mapUser(result.rows[0]);
}

export async function getLeaderboard(limit = 10) {
  const result = await withSchemaRetry(() =>
    pool.query(
      `
        SELECT *
        FROM users
        ORDER BY wins DESC, level DESC, xp DESC, losses ASC, games_played DESC, created_at ASC
        LIMIT $1
      `,
      [limit],
    ),
  );

  return result.rows.map(mapUser);
}

export async function createLobby(
  hostUserId: string,
  settings: Record<string, unknown> = {},
) {
  const lobbyId = await withSchemaRetry(() =>
    withTransaction(async (client) => {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const inviteCode = generateInviteCode();

        try {
          const lobbyResult = await client.query(
            `
              INSERT INTO lobbies (invite_code, host_user_id, settings)
              VALUES ($1, $2, $3::jsonb)
              RETURNING id
            `,
            [inviteCode, hostUserId, JSON.stringify(settings)],
          );

          const lobbyId = String(lobbyResult.rows[0].id);

          await client.query(
            `
              INSERT INTO lobby_players (lobby_id, user_id, ready, is_host)
              VALUES ($1, $2, FALSE, TRUE)
            `,
            [lobbyId, hostUserId],
          );

          return lobbyId;
        } catch (error) {
          const code = (error as { code?: string }).code;

          if (code === "23505") {
            continue;
          }

          throw error;
        }
      }

      throw createDatabaseError("Could not generate a unique invite code.", 500);
    }),
  );

  return readLobby(pool, lobbyId);
}

export async function getLobbyByIdForUser(lobbyId: string, userId: string) {
  return withSchemaRetry(async () => {
    await requireLobbyMembership(pool, lobbyId, userId);
    return readLobby(pool, lobbyId);
  });
}

export async function joinLobbyByInviteCode(inviteCode: string, userId: string) {
  const normalizedCode = normalizeInviteCode(inviteCode);
  const lobbyId = await withSchemaRetry(() =>
    withTransaction(async (client) => {
      const lobbyResult = await client.query(
        `
          SELECT id, state
          FROM lobbies
          WHERE invite_code = $1
          FOR UPDATE
        `,
        [normalizedCode],
      );

      const lobbyRow = lobbyResult.rows[0] as
        | { id: string; state: LobbyState }
        | undefined;

      if (!lobbyRow) {
        throw createDatabaseError("Lobby not found.", 404);
      }

      const membershipResult = await client.query(
        `
          SELECT 1
          FROM lobby_players
          WHERE lobby_id = $1 AND user_id = $2
        `,
        [lobbyRow.id, userId],
      );

      const alreadyJoined = Boolean(membershipResult.rows[0]);

      if (lobbyRow.state !== "waiting" && !alreadyJoined) {
        throw createDatabaseError("This lobby is no longer accepting players.", 409);
      }

      if (!alreadyJoined) {
        await client.query(
          `
            INSERT INTO lobby_players (lobby_id, user_id, ready, is_host)
            VALUES ($1, $2, FALSE, FALSE)
          `,
          [lobbyRow.id, userId],
        );
      }

      return lobbyRow.id;
    }),
  );

  return readLobby(pool, lobbyId);
}

export async function joinLobbyById(lobbyId: string, userId: string) {
  return withSchemaRetry(async () => {
    await requireLobbyMembership(pool, lobbyId, userId);
    return readLobby(pool, lobbyId);
  });
}

export async function updateLobbyPlayerReady(
  lobbyId: string,
  userId: string,
  ready: boolean,
) {
  await withSchemaRetry(() =>
    withTransaction(async (client) => {
      const lobbyResult = await client.query(
        `
          SELECT state
          FROM lobbies
          WHERE id = $1
          FOR UPDATE
        `,
        [lobbyId],
      );

      const lobbyRow = lobbyResult.rows[0] as { state: LobbyState } | undefined;

      if (!lobbyRow) {
        throw createDatabaseError("Lobby not found.", 404);
      }

      if (lobbyRow.state !== "waiting") {
        throw createDatabaseError("Lobby ready state can no longer be changed.", 409);
      }

      const updateResult = await client.query(
        `
          UPDATE lobby_players
          SET ready = $3
          WHERE lobby_id = $1 AND user_id = $2
        `,
        [lobbyId, userId, ready],
      );

      if (!updateResult.rowCount) {
        throw createDatabaseError("You are not part of this lobby.", 403);
      }
    }),
  );

  return readLobby(pool, lobbyId);
}

export async function startLobbyGame(lobbyId: string, hostUserId: string) {
  await withSchemaRetry(() =>
    withTransaction(async (client) => {
      const lobbyResult = await client.query(
        `
          SELECT host_user_id, state
          FROM lobbies
          WHERE id = $1
          FOR UPDATE
        `,
        [lobbyId],
      );

      const lobbyRow = lobbyResult.rows[0] as
        | { host_user_id: string; state: LobbyState }
        | undefined;

      if (!lobbyRow) {
        throw createDatabaseError("Lobby not found.", 404);
      }

      if (lobbyRow.host_user_id !== hostUserId) {
        throw createDatabaseError("Only the host can start the game.", 403);
      }

      if (lobbyRow.state !== "waiting") {
        throw createDatabaseError("This lobby has already started.", 409);
      }

      const playerResult = await client.query(
        `
          SELECT ready
          FROM lobby_players
          WHERE lobby_id = $1
        `,
        [lobbyId],
      );

      if (!playerResult.rows.length) {
        throw createDatabaseError("The lobby has no players.", 400);
      }

      const notReady = playerResult.rows.some(
        (row) => !Boolean((row as { ready: boolean }).ready),
      );

      if (notReady) {
        throw createDatabaseError("All players must be ready before starting.", 409);
      }

      await client.query(
        `
          UPDATE lobbies
          SET state = 'starting', updated_at = NOW()
          WHERE id = $1
        `,
        [lobbyId],
      );
    }),
  );

  return readLobby(pool, lobbyId);
}

export async function markLobbyInGame(lobbyId: string) {
  const result = await withSchemaRetry(() =>
    pool.query(
      `
        UPDATE lobbies
        SET state = 'in_game', updated_at = NOW()
        WHERE id = $1
        RETURNING id
      `,
      [lobbyId],
    ),
  );

  if (!result.rows[0]) {
    throw createDatabaseError("Lobby not found.", 404);
  }

  return readLobby(pool, lobbyId);
}
