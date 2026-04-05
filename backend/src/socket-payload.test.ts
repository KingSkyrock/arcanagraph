import assert from "node:assert/strict";
import test from "node:test";
import {
  requireLobbyId,
  requireReadyValue,
  requireTargetUserId,
} from "./socket-payload";

test("requireLobbyId trims valid ids", () => {
  assert.equal(
    requireLobbyId(" 550e8400-e29b-41d4-a716-446655440000 "),
    "550e8400-e29b-41d4-a716-446655440000",
  );
});

test("requireLobbyId rejects missing values with an informative message", () => {
  assert.throws(
    () => requireLobbyId("   "),
    /Lobby id is required\./,
  );
});

test("requireReadyValue only accepts booleans", () => {
  assert.equal(requireReadyValue(true), true);
  assert.equal(requireReadyValue(false), false);
  assert.throws(
    () => requireReadyValue("yes"),
    /Ready state must be true or false\./,
  );
});

test("requireTargetUserId trims ids and rejects blanks", () => {
  assert.equal(requireTargetUserId("  player-2 "), "player-2");
  assert.throws(
    () => requireTargetUserId(""),
    /Target player id is required\./,
  );
});
