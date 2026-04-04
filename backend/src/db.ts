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

function mapUser(row: Record<string, unknown>): AppUser {
  return {
    id: String(row.id),
    firebaseUid: String(row.firebase_uid),
    email: (row.email as string | null) ?? null,
    displayName: (row.display_name as string | null) ?? null,
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
      ORDER BY wins DESC, losses ASC, games_played DESC, created_at ASC
      LIMIT $1
    `,
    [limit],
  );

  return result.rows.map(mapUser);
}
