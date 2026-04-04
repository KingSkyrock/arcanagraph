import { Pool } from "pg";
import { config } from "./config";

const pool = new Pool({
  connectionString: config.databaseUrl,
});

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

type UpsertUserInput = {
  firebaseUid: string;
  email: string | null;
  displayName: string | null;
};

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

export async function pingDatabase() {
  await pool.query("SELECT 1");
}

export async function ensureDatabaseSchema() {
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
}

export async function upsertUser(input: UpsertUserInput) {
  const result = await pool.query(
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
  );

  return mapUser(result.rows[0]);
}

export async function getUserByFirebaseUid(firebaseUid: string) {
  const result = await pool.query("SELECT * FROM users WHERE firebase_uid = $1", [
    firebaseUid,
  ]);

  if (!result.rows[0]) {
    return null;
  }

  return mapUser(result.rows[0]);
}

export async function getLeaderboard(limit = 10) {
  const result = await pool.query(
    `
      SELECT *
      FROM users
      ORDER BY wins DESC, level DESC, xp DESC, losses ASC, games_played DESC, created_at ASC
      LIMIT $1
    `,
    [limit],
  );

  return result.rows.map(mapUser);
}
