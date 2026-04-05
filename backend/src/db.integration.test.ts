import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";
import { Pool } from "pg";
import { config } from "./config";
import {
  attackLobbyPlayer,
  createLobby,
  ensureDatabaseSchema,
  joinLobbyByInviteCode,
  restartLobbyMatch,
  startLobbyGame,
  upsertUser,
  updateLobbyPlayerReady,
} from "./db";

const cleanupPool = new Pool({
  connectionString: config.databaseUrl,
});

after(async () => {
  await cleanupPool.end();
});

type CleanupState = {
  lobbyIds: string[];
  userIds: string[];
};

function createCleanupState(): CleanupState {
  return {
    lobbyIds: [],
    userIds: [],
  };
}

async function cleanupTestData(state: CleanupState) {
  if (state.lobbyIds.length) {
    await cleanupPool.query(
      `
        DELETE FROM match_history
        WHERE lobby_id = ANY($1::uuid[])
      `,
      [state.lobbyIds],
    );

    await cleanupPool.query(
      `
        DELETE FROM lobbies
        WHERE id = ANY($1::uuid[])
      `,
      [state.lobbyIds],
    );
  }

  if (state.userIds.length) {
    await cleanupPool.query(
      `
        DELETE FROM match_history
        WHERE winner_user_id = ANY($1::uuid[])
      `,
      [state.userIds],
    );

    await cleanupPool.query(
      `
        DELETE FROM users
        WHERE id = ANY($1::uuid[])
      `,
      [state.userIds],
    );
  }
}

async function createTestUser(state: CleanupState, label: string) {
  const user = await upsertUser({
    firebaseUid: `test-${label}-${randomUUID()}`,
    email: `${label}-${randomUUID()}@example.com`,
    displayName: label,
  });

  state.userIds.push(user.id);
  return user;
}

async function createStartedLobby(state: CleanupState) {
  await ensureDatabaseSchema();

  const host = await createTestUser(state, "host");
  const guest = await createTestUser(state, "guest");
  let lobby = await createLobby(host.id, {
    mode: "integration-test",
  });

  state.lobbyIds.push(lobby.id);

  lobby = await joinLobbyByInviteCode(lobby.inviteCode, guest.id);
  lobby = await updateLobbyPlayerReady(lobby.id, host.id, true);
  lobby = await updateLobbyPlayerReady(lobby.id, guest.id, true);

  return {
    host,
    guest,
    lobby: await startLobbyGame(lobby.id, host.id),
  };
}

test("startLobbyGame moves the lobby directly into an active match", async (t) => {
  const cleanup = createCleanupState();
  t.after(async () => {
    await cleanupTestData(cleanup);
  });

  const { host, guest, lobby } = await createStartedLobby(cleanup);

  assert.equal(lobby.state, "in_game");
  assert.ok(lobby.match);
  assert.equal(lobby.match?.status, "active");
  assert.equal(lobby.match?.players.length, 2);
  assert.deepEqual(
    lobby.match?.players.map((player) => player.userId).sort(),
    [guest.id, host.id].sort(),
  );
  assert.deepEqual(
    lobby.match?.players.map((player) => player.health),
    [100, 100],
  );
});

test("attackLobbyPlayer persists match completion and player progression", async (t) => {
  const cleanup = createCleanupState();
  t.after(async () => {
    await cleanupTestData(cleanup);
  });

  const { host, guest, lobby } = await createStartedLobby(cleanup);
  let currentLobby = lobby;

  for (let attack = 0; attack < 5; attack += 1) {
    currentLobby = await attackLobbyPlayer(currentLobby.id, host.id, guest.id, 100);
  }

  assert.equal(currentLobby.match?.status, "finished");
  assert.equal(currentLobby.match?.winnerUserId, host.id);

  const hostPlayer = currentLobby.players.find((player) => player.userId === host.id);
  const guestPlayer = currentLobby.players.find((player) => player.userId === guest.id);

  assert.equal(hostPlayer?.wins, 1);
  assert.equal(hostPlayer?.gamesPlayed, 1);
  assert.equal(guestPlayer?.losses, 1);
  assert.equal(guestPlayer?.gamesPlayed, 1);

  const historyResult = await cleanupPool.query(
    `
      SELECT winner_user_id
      FROM match_history
      WHERE lobby_id = $1
    `,
    [currentLobby.id],
  );

  assert.equal(historyResult.rowCount, 1);
  assert.equal(historyResult.rows[0]?.winner_user_id, host.id);
});

test("attackLobbyPlayer stores score-based damage in the live match state", async (t) => {
  const cleanup = createCleanupState();
  t.after(async () => {
    await cleanupTestData(cleanup);
  });

  const { host, guest, lobby } = await createStartedLobby(cleanup);
  const updatedLobby = await attackLobbyPlayer(lobby.id, host.id, guest.id, 75);
  const guestMatchPlayer = updatedLobby.match?.players.find((player) => player.userId === guest.id);

  assert.equal(guestMatchPlayer?.health, 90);
  assert.deepEqual(updatedLobby.match?.lastAction, {
    attackerUserId: host.id,
    targetUserId: guest.id,
    damage: 10,
    score: 75,
    targetDefeated: false,
    occurredAt: updatedLobby.match?.lastAction?.occurredAt,
  });
});

test("restartLobbyMatch returns the same players to a waiting ready-up state", async (t) => {
  const cleanup = createCleanupState();
  t.after(async () => {
    await cleanupTestData(cleanup);
  });

  const { host, guest, lobby } = await createStartedLobby(cleanup);
  let currentLobby = lobby;

  for (let attack = 0; attack < 5; attack += 1) {
    currentLobby = await attackLobbyPlayer(currentLobby.id, host.id, guest.id, 100);
  }

  const restartedLobby = await restartLobbyMatch(currentLobby.id, guest.id);

  assert.equal(restartedLobby.state, "waiting");
  assert.equal(restartedLobby.match, null);
  assert.deepEqual(
    restartedLobby.players.map((player) => player.ready),
    [false, false],
  );
});
