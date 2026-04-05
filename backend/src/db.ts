import { Pool, type PoolClient } from "pg";
import { config } from "./config";
import {
  MatchStateError,
  applyDirectDamageAll,
  applyHeal,
  applyMatchAttack,
  applyMatchAttackAll,
  clampHealth,
  createInitialMatch,
  type LobbyMatch,
  type MatchAction,
  type MatchPlayer,
  type MatchStatus,
} from "./match-state";
import type { PowerupEvent } from "../../shared/powerup";
import {
  defaultProfilePictureId,
  getProfilePictureById,
  isProfilePictureUnlocked,
  normalizeProfilePictureId,
} from "./profile-pictures";

const pool = new Pool({
  connectionString: config.databaseUrl,
});

const inviteAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
let schemaPromise: Promise<void> | null = null;

export type LobbyState = "waiting" | "starting" | "in_game";
export type PrimaryHand = "Left" | "Right";

export type AppUser = {
  id: string;
  firebaseUid: string;
  email: string | null;
  displayName: string | null;
  primaryHand: PrimaryHand | null;
  profilePictureId: string;
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
  match: LobbyMatch | null;
  players: LobbyPlayer[];
  createdAt: string;
  updatedAt: string;
};

type UpsertUserInput = {
  firebaseUid: string;
  email: string | null;
  displayName: string | null;
};

export type { LobbyMatch, MatchAction, MatchPlayer, MatchStatus };

type DatabaseError = Error & { statusCode?: number };
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createDatabaseError(message: string, statusCode: number) {
  const error = new Error(message) as DatabaseError;
  error.statusCode = statusCode;
  return error;
}

function requireValidLobbyId(lobbyId: string) {
  const normalizedLobbyId = lobbyId.trim();

  if (!uuidPattern.test(normalizedLobbyId)) {
    throw createDatabaseError(
      "Lobby id is invalid. Check the lobby link or invite and try again.",
      400,
    );
  }

  return normalizedLobbyId;
}

function normalizePrimaryHand(value: unknown): PrimaryHand | null {
  return value === "Left" || value === "Right" ? value : null;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseMatchAction(value: unknown): MatchAction | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.attackerUserId !== "string" ||
    typeof value.targetUserId !== "string" ||
    typeof value.occurredAt !== "string"
  ) {
    return null;
  }

  const damage = Number(value.damage);
  const score =
    value.score === null || value.score === undefined ? null : Number(value.score);

  if (!Number.isFinite(damage) || damage <= 0) {
    return null;
  }

  if (score !== null && (!Number.isFinite(score) || score < 0 || score > 100)) {
    return null;
  }

  return {
    attackerUserId: value.attackerUserId,
    targetUserId: value.targetUserId,
    damage: Math.round(damage),
    score: score === null ? null : Math.round(score),
    targetDefeated: Boolean(value.targetDefeated),
    occurredAt: value.occurredAt,
  };
}

function parseMatchPlayer(value: unknown, maxHealth: number): MatchPlayer | null {
  if (!isRecord(value) || typeof value.userId !== "string") {
    return null;
  }

  const health = Number(value.health);

  if (!Number.isFinite(health)) {
    return null;
  }

  return {
    userId: value.userId,
    health: clampHealth(health, maxHealth),
  };
}

function parseLobbyMatch(value: unknown): LobbyMatch | null {
  if (!isRecord(value) || !Array.isArray(value.players)) {
    return null;
  }

  const maxHealth = Number(value.maxHealth);
  const damagePerAttack = Number(value.damagePerAttack);

  if (!Number.isFinite(maxHealth) || maxHealth <= 0) {
    return null;
  }

  if (!Number.isFinite(damagePerAttack) || damagePerAttack <= 0) {
    return null;
  }

  const status = value.status === "finished" ? "finished" : "active";
  const players = value.players
    .map((player) => parseMatchPlayer(player, maxHealth))
    .filter((player): player is MatchPlayer => Boolean(player));

  if (!players.length) {
    return null;
  }

  return {
    maxHealth: Math.round(maxHealth),
    damagePerAttack: Math.round(damagePerAttack),
    status,
    winnerUserId: typeof value.winnerUserId === "string" ? value.winnerUserId : null,
    players,
    startedAt:
      typeof value.startedAt === "string" ? value.startedAt : new Date().toISOString(),
    endedAt: typeof value.endedAt === "string" ? value.endedAt : null,
    lastAction: parseMatchAction(value.lastAction),
    lastPowerupEvent: isRecord(value.lastPowerupEvent) ? value.lastPowerupEvent as LobbyMatch["lastPowerupEvent"] : null,
  };
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

export type PublicUser = {
  id: string;
  displayName: string | null;
  xp: number;
  level: number;
  className: string;
  wins: number;
  losses: number;
  gamesPlayed: number;
};

function mapUser(row: Record<string, unknown>): AppUser {
  const level = Number(row.level ?? 1);

  return {
    id: String(row.id),
    firebaseUid: String(row.firebase_uid),
    email: (row.email as string | null) ?? null,
    displayName: (row.display_name as string | null) ?? null,
    primaryHand: normalizePrimaryHand(row.primary_hand),
    profilePictureId: normalizeProfilePictureId(row.profile_picture_id),
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

function mapPublicUser(row: Record<string, unknown>): PublicUser {
  const level = Number(row.level ?? 1);

  return {
    id: String(row.id),
    displayName: (row.display_name as string | null) ?? null,
    xp: Number(row.xp ?? 0),
    level,
    className: getClassNameForLevel(level),
    wins: Number(row.wins),
    losses: Number(row.losses),
    gamesPlayed: Number(row.games_played),
  };
}

function mapLobbyPlayer(row: Record<string, unknown>): LobbyPlayer {
  const level = Number(row.player_level ?? 1);

  return {
    userId: String(row.player_user_id),
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
  const settings = isRecord(firstRow.settings)
    ? (firstRow.settings as Record<string, unknown>)
    : {};
  const match = parseLobbyMatch(settings.match);

  return {
    id: String(firstRow.id),
    inviteCode: String(firstRow.invite_code),
    hostUserId: String(firstRow.host_user_id),
    state: String(firstRow.state) as LobbyState,
    settings,
    match,
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
  const lobbyResult = await client.query(
    `
      SELECT 1
      FROM lobbies
      WHERE id = $1
    `,
    [lobbyId],
  );

  if (!lobbyResult.rows[0]) {
    throw createDatabaseError("Lobby not found.", 404);
  }

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

async function lockLobbyForUpdate(client: PoolClient, lobbyId: string) {
  const result = await client.query(
    `
      SELECT 1
      FROM lobbies
      WHERE id = $1
      FOR UPDATE
    `,
    [lobbyId],
  );

  if (!result.rows[0]) {
    throw createDatabaseError("Lobby not found.", 404);
  }
}

async function recordCompletedMatch(
  client: PoolClient,
  lobby: Lobby,
  match: LobbyMatch,
) {
  await client.query(
    `
      INSERT INTO match_history (lobby_id, winner_user_id, result)
      VALUES ($1, $2, $3::jsonb)
    `,
    [
      lobby.id,
      match.winnerUserId,
      JSON.stringify({
        status: match.status,
        startedAt: match.startedAt,
        endedAt: match.endedAt,
        maxHealth: match.maxHealth,
        damagePerAttack: match.damagePerAttack,
        players: match.players,
        lastAction: match.lastAction,
      }),
    ],
  );

  await client.query(
    `
      UPDATE users
      SET
        wins = wins + CASE WHEN $2::uuid IS NOT NULL AND id = $2::uuid THEN 1 ELSE 0 END,
        losses = losses + CASE WHEN $2::uuid IS NOT NULL AND id <> $2::uuid THEN 1 ELSE 0 END,
        games_played = games_played + 1,
        xp = xp + CASE WHEN $2::uuid IS NOT NULL AND id = $2::uuid THEN 100 ELSE 25 END,
        level = GREATEST(1, FLOOR(SQRT((xp + CASE WHEN $2::uuid IS NOT NULL AND id = $2::uuid THEN 100 ELSE 25 END)::float / 100)) + 1),
        updated_at = NOW()
      WHERE id = ANY($1::uuid[])
    `,
    [lobby.players.map((player) => player.userId), match.winnerUserId],
  );
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
      primary_hand TEXT,
      profile_picture_id TEXT NOT NULL DEFAULT '${defaultProfilePictureId}',
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
    ADD COLUMN IF NOT EXISTS primary_hand TEXT
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS profile_picture_id TEXT NOT NULL DEFAULT '${defaultProfilePictureId}'
  `);

  await pool.query(
    `
      UPDATE users
      SET profile_picture_id = $1
      WHERE profile_picture_id IS NULL OR profile_picture_id = ''
    `,
    [defaultProfilePictureId],
  );

  await pool.query(`
    UPDATE users
    SET primary_hand = NULL
    WHERE primary_hand IS NOT NULL
      AND primary_hand NOT IN ('Left', 'Right')
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_primary_hand_check'
      ) THEN
        ALTER TABLE users
        ADD CONSTRAINT users_primary_hand_check
        CHECK (primary_hand IS NULL OR primary_hand IN ('Left', 'Right'));
      END IF;
    END
    $$;
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
  try {
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
  } catch (error: any) {
    // When the Firebase emulator resets, a returning user gets a new
    // firebase_uid but keeps the same email.  The INSERT above conflicts on
    // the email unique constraint instead of firebase_uid.  Handle this by
    // updating the existing row to adopt the new firebase_uid.
    if (error?.code === "23505" && error?.constraint === "users_email_key") {
      const result = await withSchemaRetry(() =>
        pool.query(
          `
            UPDATE users
            SET
              firebase_uid = $1,
              display_name = COALESCE($3, display_name),
              updated_at = NOW()
            WHERE email = $2
            RETURNING *
          `,
          [input.firebaseUid, input.email, input.displayName],
        ),
      );

      return mapUser(result.rows[0]);
    }

    throw error;
  }
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

export async function updateUserPrimaryHand(userId: string, primaryHand: PrimaryHand) {
  const normalizedPrimaryHand = normalizePrimaryHand(primaryHand);

  if (!normalizedPrimaryHand) {
    throw createDatabaseError(
      "Primary hand must be either Left or Right.",
      400,
    );
  }

  const result = await withSchemaRetry(() =>
    pool.query(
      `
        UPDATE users
        SET
          primary_hand = $2,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [userId, normalizedPrimaryHand],
    ),
  );

  if (!result.rows[0]) {
    throw createDatabaseError("Player profile not found.", 404);
  }

  return mapUser(result.rows[0]);
}

export async function updateUserProfilePicture(
  userId: string,
  profilePictureId: string,
) {
  const selectedPicture = getProfilePictureById(profilePictureId);

  if (!selectedPicture) {
    throw createDatabaseError("Choose a valid profile picture.", 400);
  }

  const currentUserResult = await withSchemaRetry(() =>
    pool.query(
      `
        SELECT *
        FROM users
        WHERE id = $1
      `,
      [userId],
    ),
  );

  if (!currentUserResult.rows[0]) {
    throw createDatabaseError("Player profile not found.", 404);
  }

  const currentUser = mapUser(currentUserResult.rows[0]);

  if (!isProfilePictureUnlocked(currentUser.level, selectedPicture.id)) {
    throw createDatabaseError(
      `${selectedPicture.name} unlocks at Level ${selectedPicture.unlockLevel}.`,
      403,
    );
  }

  const result = await withSchemaRetry(() =>
    pool.query(
      `
        UPDATE users
        SET
          profile_picture_id = $2,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [userId, selectedPicture.id],
    ),
  );

  if (!result.rows[0]) {
    throw createDatabaseError("Player profile not found.", 404);
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

  return result.rows.map(mapPublicUser);
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
    const validLobbyId = requireValidLobbyId(lobbyId);
    await requireLobbyMembership(pool, validLobbyId, userId);
    return readLobby(pool, validLobbyId);
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
        const countResult = await client.query(
          "SELECT count(*)::int AS n FROM lobby_players WHERE lobby_id = $1",
          [lobbyRow.id],
        );
        if ((countResult.rows[0] as { n: number }).n >= 8) {
          throw createDatabaseError("This lobby is full (max 8 players).", 409);
        }
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
    const validLobbyId = requireValidLobbyId(lobbyId);
    await requireLobbyMembership(pool, validLobbyId, userId);
    return readLobby(pool, validLobbyId);
  });
}

export async function updateLobbyPlayerReady(
  lobbyId: string,
  userId: string,
  ready: boolean,
) {
  const validLobbyId = requireValidLobbyId(lobbyId);

  await withSchemaRetry(() =>
    withTransaction(async (client) => {
      const lobbyResult = await client.query(
        `
          SELECT state
          FROM lobbies
          WHERE id = $1
          FOR UPDATE
        `,
        [validLobbyId],
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
        [validLobbyId, userId, ready],
      );

      if (!updateResult.rowCount) {
        throw createDatabaseError("You are not part of this lobby.", 403);
      }
    }),
  );

  return readLobby(pool, validLobbyId);
}

export async function startLobbyGame(lobbyId: string, hostUserId: string) {
  const validLobbyId = requireValidLobbyId(lobbyId);

  return withSchemaRetry(() =>
    withTransaction(async (client) => {
      const lobbyResult = await client.query(
        `
          SELECT host_user_id, state
          FROM lobbies
          WHERE id = $1
          FOR UPDATE
        `,
        [validLobbyId],
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
        [validLobbyId],
      );

      if (!playerResult.rows.length) {
        throw createDatabaseError("The lobby has no players.", 400);
      }

      if (playerResult.rows.length < 2) {
        throw createDatabaseError("At least two players are required to start a match.", 409);
      }

      const notReady = playerResult.rows.some(
        (row) => !Boolean((row as { ready: boolean }).ready),
      );

      if (notReady) {
        throw createDatabaseError("All players must be ready before starting.", 409);
      }

      const lobby = await readLobby(client, validLobbyId);
      const playerCount = lobby.players.length;
      // Scale health: base 40 per opponent so each player survives ~2 full rounds from everyone
      const defaultScaledHealth = Math.max(40, 40 * (playerCount - 1));
      const customMaxHealth = typeof lobby.settings.maxHealth === "number" && lobby.settings.maxHealth > 0
        ? Math.round(lobby.settings.maxHealth)
        : defaultScaledHealth;
      const nextSettings = {
        ...lobby.settings,
        match: createInitialMatch(lobby.players.map((player) => player.userId), {
          maxHealth: customMaxHealth,
        }),
      };

      await client.query(
        `
          UPDATE lobbies
          SET state = 'in_game', settings = $2::jsonb, updated_at = NOW()
          WHERE id = $1
        `,
        [validLobbyId, JSON.stringify(nextSettings)],
      );

      return readLobby(client, validLobbyId);
    }),
  );
}

export async function markLobbyInGame(lobbyId: string) {
  const validLobbyId = requireValidLobbyId(lobbyId);
  return withSchemaRetry(() =>
    withTransaction(async (client) => {
      await lockLobbyForUpdate(client, validLobbyId);
      const lobby = await readLobby(client, validLobbyId);

      if (lobby.state !== "starting") {
        throw createDatabaseError("Lobby is not ready to enter a match yet.", 409);
      }

      if (lobby.players.length < 2) {
        throw createDatabaseError("At least two players are required to enter a match.", 409);
      }

      const nextSettings = {
        ...lobby.settings,
        match: createInitialMatch(lobby.players.map((player) => player.userId)),
      };

      await client.query(
        `
          UPDATE lobbies
          SET state = 'in_game', settings = $2::jsonb, updated_at = NOW()
          WHERE id = $1
        `,
        [validLobbyId, JSON.stringify(nextSettings)],
      );

      return readLobby(client, validLobbyId);
    }),
  );
}

export async function attackLobbyPlayer(
  lobbyId: string,
  attackerUserId: string,
  targetUserId: string,
  score: number,
) {
  const validLobbyId = requireValidLobbyId(lobbyId);
  const normalizedTargetUserId = targetUserId.trim();
  const normalizedScore = Math.max(0, Math.min(100, Math.round(score)));

  if (!normalizedTargetUserId) {
    throw createDatabaseError("Choose a player to attack.", 400);
  }

  if (!Number.isFinite(normalizedScore)) {
    throw createDatabaseError(
      "Graph attack score is required before damage can be applied.",
      400,
    );
  }

  if (attackerUserId === normalizedTargetUserId) {
    throw createDatabaseError("Choose another player to attack.", 400);
  }

  return withSchemaRetry(() =>
    withTransaction(async (client) => {
      await lockLobbyForUpdate(client, validLobbyId);
      const lobby = await readLobby(client, validLobbyId);

      if (lobby.state !== "in_game") {
        throw createDatabaseError("The match is not live yet.", 409);
      }

      const match = lobby.match;

      if (!match) {
        throw createDatabaseError("The match is still loading. Try again in a moment.", 409);
      }

      if (match.status !== "active") {
        throw createDatabaseError("This match has already ended.", 409);
      }

      const attacker = lobby.players.find((player) => player.userId === attackerUserId);

      if (!attacker) {
        throw createDatabaseError("You are not part of this lobby.", 403);
      }

      const target = lobby.players.find((player) => player.userId === normalizedTargetUserId);

      if (!target) {
        throw createDatabaseError("That player is not part of this match.", 404);
      }

      const attackerState = match.players.find((player) => player.userId === attackerUserId);

      if (!attackerState || attackerState.health <= 0) {
        throw createDatabaseError("You have already been eliminated from this match.", 409);
      }

      const targetState = match.players.find((player) => player.userId === normalizedTargetUserId);

      if (!targetState) {
        throw createDatabaseError("That player is missing from this match state.", 409);
      }

      if (targetState.health <= 0) {
        throw createDatabaseError("That player has already been eliminated.", 409);
      }

      let nextMatch: LobbyMatch;

      try {
        nextMatch = applyMatchAttack(match, attackerUserId, normalizedTargetUserId, {
          score: normalizedScore,
        });
      } catch (error) {
        if (error instanceof MatchStateError) {
          throw createDatabaseError(error.message, 409);
        }

        throw error;
      }

      const matchFinished = nextMatch.status === "finished";
      const nextSettings = {
        ...lobby.settings,
        match: nextMatch,
      };

      await client.query(
        `
          UPDATE lobbies
          SET settings = $2::jsonb, updated_at = NOW()
          WHERE id = $1
        `,
        [validLobbyId, JSON.stringify(nextSettings)],
      );

      if (matchFinished) {
        await recordCompletedMatch(client, lobby, nextMatch);
      }

      return readLobby(client, validLobbyId);
    }),
  );
}

export async function attackAllLobbyPlayers(
  lobbyId: string,
  attackerUserId: string,
  score: number,
) {
  const validLobbyId = requireValidLobbyId(lobbyId);
  const normalizedScore = Math.max(0, Math.min(100, Math.round(score)));

  return withSchemaRetry(() =>
    withTransaction(async (client) => {
      await lockLobbyForUpdate(client, validLobbyId);
      const lobby = await readLobby(client, validLobbyId);

      if (lobby.state !== "in_game") {
        throw createDatabaseError("The match is not live yet.", 409);
      }

      const match = lobby.match;
      if (!match || match.status !== "active") {
        throw createDatabaseError("This match has already ended.", 409);
      }

      const attacker = lobby.players.find((p) => p.userId === attackerUserId);
      if (!attacker) {
        throw createDatabaseError("You are not part of this lobby.", 403);
      }

      let nextMatch: LobbyMatch;
      try {
        nextMatch = applyMatchAttackAll(match, attackerUserId, {
          score: normalizedScore,
        });
      } catch (error) {
        if (error instanceof MatchStateError) {
          throw createDatabaseError(error.message, 409);
        }
        throw error;
      }

      const matchFinished = nextMatch.status === "finished";
      const nextSettings = { ...lobby.settings, match: nextMatch };

      await client.query(
        "UPDATE lobbies SET settings = $2::jsonb, updated_at = NOW() WHERE id = $1",
        [validLobbyId, JSON.stringify(nextSettings)],
      );

      if (matchFinished) {
        await recordCompletedMatch(client, lobby, nextMatch);
      }

      return readLobby(client, validLobbyId);
    }),
  );
}

export async function restartLobbyMatch(lobbyId: string, userId: string) {
  const validLobbyId = requireValidLobbyId(lobbyId);

  return withSchemaRetry(() =>
    withTransaction(async (client) => {
      await lockLobbyForUpdate(client, validLobbyId);
      const lobby = await readLobby(client, validLobbyId);

      if (!lobby.players.some((player) => player.userId === userId)) {
        throw createDatabaseError("You are not part of this lobby.", 403);
      }

      if (lobby.state !== "in_game" || !lobby.match || lobby.match.status !== "finished") {
        throw createDatabaseError(
          "This match cannot be reset until the winner has been decided.",
          409,
        );
      }

      const nextSettings = {
        ...lobby.settings,
        match: null,
      };

      await client.query(
        `
          UPDATE lobby_players
          SET ready = FALSE
          WHERE lobby_id = $1
        `,
        [validLobbyId],
      );

      await client.query(
        `
          UPDATE lobbies
          SET state = 'waiting', settings = $2::jsonb, updated_at = NOW()
          WHERE id = $1
        `,
        [validLobbyId, JSON.stringify(nextSettings)],
      );

      return readLobby(client, validLobbyId);
    }),
  );
}

export async function healLobbyPlayer(
  lobbyId: string,
  userId: string,
  amount: number,
  powerupEvent: PowerupEvent,
) {
  const validLobbyId = requireValidLobbyId(lobbyId);

  return withSchemaRetry(() =>
    withTransaction(async (client) => {
      await lockLobbyForUpdate(client, validLobbyId);
      const lobby = await readLobby(client, validLobbyId);

      if (lobby.state !== "in_game") {
        throw createDatabaseError("The match is not live yet.", 409);
      }

      const match = lobby.match;
      if (!match || match.status !== "active") {
        throw createDatabaseError("This match has already ended.", 409);
      }

      let nextMatch: LobbyMatch;
      try {
        nextMatch = applyHeal(match, userId, amount, powerupEvent);
      } catch (error) {
        if (error instanceof MatchStateError) {
          throw createDatabaseError(error.message, 409);
        }
        throw error;
      }

      const nextSettings = { ...lobby.settings, match: nextMatch };
      await client.query(
        "UPDATE lobbies SET settings = $2::jsonb, updated_at = NOW() WHERE id = $1",
        [validLobbyId, JSON.stringify(nextSettings)],
      );

      return readLobby(client, validLobbyId);
    }),
  );
}

export async function directDamageAllLobbyPlayers(
  lobbyId: string,
  attackerUserId: string,
  damage: number,
) {
  const validLobbyId = requireValidLobbyId(lobbyId);

  return withSchemaRetry(() =>
    withTransaction(async (client) => {
      await lockLobbyForUpdate(client, validLobbyId);
      const lobby = await readLobby(client, validLobbyId);

      if (lobby.state !== "in_game") {
        throw createDatabaseError("The match is not live yet.", 409);
      }

      const match = lobby.match;
      if (!match || match.status !== "active") {
        throw createDatabaseError("This match has already ended.", 409);
      }

      let nextMatch: LobbyMatch;
      try {
        nextMatch = applyDirectDamageAll(match, attackerUserId, damage);
      } catch (error) {
        if (error instanceof MatchStateError) {
          throw createDatabaseError(error.message, 409);
        }
        throw error;
      }

      const matchFinished = nextMatch.status === "finished";
      const nextSettings = { ...lobby.settings, match: nextMatch };

      await client.query(
        "UPDATE lobbies SET settings = $2::jsonb, updated_at = NOW() WHERE id = $1",
        [validLobbyId, JSON.stringify(nextSettings)],
      );

      if (matchFinished) {
        await recordCompletedMatch(client, lobby, nextMatch);
      }

      return readLobby(client, validLobbyId);
    }),
  );
}
