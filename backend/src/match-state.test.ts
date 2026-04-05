import assert from "node:assert/strict";
import test from "node:test";
import {
  MatchStateError,
  applyMatchAttack,
  createInitialMatch,
} from "./match-state";

test("createInitialMatch gives every player full health", () => {
  const match = createInitialMatch(["mage-a", "mage-b"], {
    startedAt: "2026-04-04T00:00:00.000Z",
  });

  assert.equal(match.status, "active");
  assert.equal(match.maxHealth, 100);
  assert.equal(match.damagePerAttack, 20);
  assert.deepEqual(match.players, [
    { userId: "mage-a", health: 100 },
    { userId: "mage-b", health: 100 },
  ]);
});

test("applyMatchAttack subtracts fixed damage and records the hit", () => {
  const match = createInitialMatch(["mage-a", "mage-b"], {
    startedAt: "2026-04-04T00:00:00.000Z",
  });

  const nextMatch = applyMatchAttack(
    match,
    "mage-a",
    "mage-b",
    "2026-04-04T00:00:01.000Z",
  );

  assert.equal(nextMatch.status, "active");
  assert.equal(nextMatch.players[1]?.health, 80);
  assert.deepEqual(nextMatch.lastAction, {
    attackerUserId: "mage-a",
    targetUserId: "mage-b",
    damage: 20,
    targetDefeated: false,
    occurredAt: "2026-04-04T00:00:01.000Z",
  });
});

test("applyMatchAttack ends the match when the last opponent reaches zero health", () => {
  let match = createInitialMatch(["mage-a", "mage-b"], {
    startedAt: "2026-04-04T00:00:00.000Z",
  });

  for (let attack = 1; attack < 5; attack += 1) {
    match = applyMatchAttack(
      match,
      "mage-a",
      "mage-b",
      `2026-04-04T00:00:0${attack}.000Z`,
    );
  }

  const finishedMatch = applyMatchAttack(
    match,
    "mage-a",
    "mage-b",
    "2026-04-04T00:00:05.000Z",
  );

  assert.equal(finishedMatch.status, "finished");
  assert.equal(finishedMatch.winnerUserId, "mage-a");
  assert.equal(finishedMatch.players[1]?.health, 0);
  assert.equal(finishedMatch.endedAt, "2026-04-04T00:00:05.000Z");
  assert.equal(finishedMatch.lastAction?.targetDefeated, true);
});

test("applyMatchAttack rejects attacks from eliminated players", () => {
  let match = createInitialMatch(["mage-a", "mage-b", "mage-c"], {
    startedAt: "2026-04-04T00:00:00.000Z",
  });

  for (let attack = 1; attack <= 5; attack += 1) {
    match = applyMatchAttack(
      match,
      "mage-b",
      "mage-a",
      `2026-04-04T00:00:0${attack}.000Z`,
    );
  }

  assert.throws(
    () => applyMatchAttack(match, "mage-a", "mage-c", "2026-04-04T00:00:06.000Z"),
    (error: unknown) =>
      error instanceof MatchStateError &&
      error.message === "You have already been eliminated from this match.",
  );
});
