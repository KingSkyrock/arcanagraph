import type { Server } from "socket.io";
import { randomUUID } from "node:crypto";
import {
  type Powerup,
  type PowerupType,
  type PowerupEvent,
  HEAL_AMOUNT,
  ATTACK_AMOUNT,
  DESPAWN_MS,
  MAX_ACTIVE,
  SPAWN_INTERVAL_MS,
  SPAWN_CHANCE,
  SECOND_SPAWN_WINDOW_MS,
  MIN_CURVE_DISTANCE,
  sampleMultiplier,
} from "../../shared/powerup";
import { sampleCurvePoints, type EquationConfig } from "../../shared/graph-scoring";
import { getAssignedConfig } from "./equation-state";
import { healLobbyPlayer, directDamageAllLobbyPlayers } from "./db";

const MAX_COLLECTS_PER_ROUND = 2;

type LobbyPowerupState = {
  powerups: Powerup[];
  multipliers: Map<string, number>;
  collectCounts: Map<string, number>; // userId → powerups collected since last graph submission
  interval: ReturnType<typeof setInterval> | null;
  playerIds: string[];
};

const lobbyStates = new Map<string, LobbyPowerupState>();

const POWERUP_TYPES: PowerupType[] = ["healing_potion", "multiplier_spell", "attack_spell"];

// grid bounds in math units (visible area)
const GRID_X_MIN = -4;
const GRID_X_MAX = 4;
const GRID_Y_MIN = -3;
const GRID_Y_MAX = 3;

function getCurvePointsForLobby(lobbyId: string, playerIds: string[]): Array<{ mx: number; my: number }> {
  const allPoints: Array<{ mx: number; my: number }> = [];
  for (const userId of playerIds) {
    const config = getAssignedConfig(lobbyId, userId);
    if (config) {
      allPoints.push(...sampleCurvePoints(config, 0.2));
    }
  }
  return allPoints;
}

function findPowerupPosition(lobbyId: string, playerIds: string[]): { mx: number; my: number } {
  const curvePoints = getCurvePointsForLobby(lobbyId, playerIds);

  let bestPos = { mx: 0, my: 0 };
  let bestDist = 0;

  for (let attempt = 0; attempt < 20; attempt++) {
    const mx = GRID_X_MIN + Math.random() * (GRID_X_MAX - GRID_X_MIN);
    const my = GRID_Y_MIN + Math.random() * (GRID_Y_MAX - GRID_Y_MIN);

    if (curvePoints.length === 0) {
      return { mx: Math.round(mx * 10) / 10, my: Math.round(my * 10) / 10 };
    }

    let minDist = Infinity;
    for (const cp of curvePoints) {
      const d = Math.sqrt((mx - cp.mx) ** 2 + (my - cp.my) ** 2);
      if (d < minDist) minDist = d;
    }

    if (minDist >= MIN_CURVE_DISTANCE) {
      return { mx: Math.round(mx * 10) / 10, my: Math.round(my * 10) / 10 };
    }

    if (minDist > bestDist) {
      bestDist = minDist;
      bestPos = { mx: Math.round(mx * 10) / 10, my: Math.round(my * 10) / 10 };
    }
  }

  return bestPos;
}

function spawnPowerup(lobbyId: string, state: LobbyPowerupState, io: Server) {
  const now = Date.now();
  const pos = findPowerupPosition(lobbyId, state.playerIds);
  const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)]!;

  const powerup: Powerup = {
    id: randomUUID(),
    type,
    mx: pos.mx,
    my: pos.my,
    spawnedAt: now,
    despawnAt: now + DESPAWN_MS,
    collectedBy: null,
  };

  state.powerups.push(powerup);
  io.to(`lobby:${lobbyId}`).emit("powerup:spawn", { powerup });
}

function tickPowerups(lobbyId: string, io: Server) {
  const state = lobbyStates.get(lobbyId);
  if (!state) return;

  const now = Date.now();

  // remove expired powerups
  const expired = state.powerups.filter((p) => now >= p.despawnAt);
  for (const p of expired) {
    io.to(`lobby:${lobbyId}`).emit("powerup:despawn", { powerupId: p.id });
  }
  state.powerups = state.powerups.filter((p) => now < p.despawnAt && !p.collectedBy);

  // don't spawn if every player has hit the collect cap
  const anyCanCollect = state.playerIds.some(
    (id) => (state.collectCounts.get(id) ?? 0) < MAX_COLLECTS_PER_ROUND,
  );

  // spawn logic
  if (anyCanCollect && state.powerups.length < MAX_ACTIVE && Math.random() < SPAWN_CHANCE) {
    if (state.powerups.length === 0) {
      spawnPowerup(lobbyId, state, io);
    } else {
      // second powerup: only if first is near expiry
      const firstExpiry = Math.min(...state.powerups.map((p) => p.despawnAt));
      if (firstExpiry - now < SECOND_SPAWN_WINDOW_MS) {
        spawnPowerup(lobbyId, state, io);
      }
    }
  }
}

export function startPowerupLoop(lobbyId: string, playerIds: string[], io: Server) {
  stopPowerupLoop(lobbyId);

  const state: LobbyPowerupState = {
    powerups: [],
    multipliers: new Map(),
    collectCounts: new Map(),
    interval: null,
    playerIds,
  };

  state.interval = setInterval(() => tickPowerups(lobbyId, io), SPAWN_INTERVAL_MS);
  lobbyStates.set(lobbyId, state);
}

export function stopPowerupLoop(lobbyId: string) {
  const state = lobbyStates.get(lobbyId);
  if (state?.interval) {
    clearInterval(state.interval);
  }
  lobbyStates.delete(lobbyId);
}

export async function collectPowerup(
  lobbyId: string,
  userId: string,
  powerupId: string,
  io: Server,
): Promise<{ lobby: any; effectDescription: string; type: PowerupType } | null> {
  const state = lobbyStates.get(lobbyId);
  if (!state) return null;

  // enforce max collects per round
  const collected = state.collectCounts.get(userId) ?? 0;
  if (collected >= MAX_COLLECTS_PER_ROUND) return null;

  const powerup = state.powerups.find((p) => p.id === powerupId);
  if (!powerup || powerup.collectedBy || Date.now() >= powerup.despawnAt) return null;

  powerup.collectedBy = userId;
  state.collectCounts.set(userId, collected + 1);
  // remove from active list
  state.powerups = state.powerups.filter((p) => p.id !== powerupId);

  const occurredAt = new Date().toISOString();
  let effectDescription = "";
  let lobby: any;

  switch (powerup.type) {
    case "healing_potion": {
      const event: PowerupEvent = {
        powerupId, type: powerup.type, userId,
        effect: `+${HEAL_AMOUNT} HP`,
        occurredAt,
      };
      lobby = await healLobbyPlayer(lobbyId, userId, HEAL_AMOUNT, event);
      effectDescription = `+${HEAL_AMOUNT} HP`;
      break;
    }
    case "attack_spell": {
      lobby = await directDamageAllLobbyPlayers(lobbyId, userId, ATTACK_AMOUNT);
      effectDescription = `-${ATTACK_AMOUNT} HP to all`;
      break;
    }
    case "multiplier_spell": {
      const mult = sampleMultiplier();
      state.multipliers.set(userId, mult);
      effectDescription = `${mult}x Next!`;
      // no DB change needed, just return current lobby state
      lobby = null;
      break;
    }
  }

  io.to(`lobby:${lobbyId}`).emit("powerup:collected", {
    powerupId,
    userId,
    type: powerup.type,
    effectDescription,
  });

  if (lobby) {
    io.to(`lobby:${lobbyId}`).emit("lobby:update", { lobby });
  }

  return { lobby, effectDescription, type: powerup.type };
}

export function getAndClearMultiplier(lobbyId: string, userId: string): number {
  const state = lobbyStates.get(lobbyId);
  if (!state) return 1.0;
  const mult = state.multipliers.get(userId) ?? 1.0;
  state.multipliers.delete(userId);
  return mult;
}

// reset collect counter after a player submits a graph
export function resetCollectCount(lobbyId: string, userId: string) {
  const state = lobbyStates.get(lobbyId);
  if (state) state.collectCounts.set(userId, 0);
}
