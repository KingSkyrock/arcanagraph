export type MatchStatus = "active" | "finished";

export type MatchPlayer = {
  userId: string;
  health: number;
};

export type MatchAction = {
  attackerUserId: string;
  targetUserId: string;
  damage: number;
  score: number | null;
  targetDefeated: boolean;
  occurredAt: string;
};

export type LobbyMatch = {
  maxHealth: number;
  damagePerAttack: number;
  status: MatchStatus;
  winnerUserId: string | null;
  players: MatchPlayer[];
  startedAt: string;
  endedAt: string | null;
  lastAction: MatchAction | null;
};

export const defaultMatchHealth = 100;
export const defaultAttackDamage = 20;

export class MatchStateError extends Error {}

type ApplyMatchAttackOptions = {
  occurredAt?: string;
  score?: number | null;
};

export function clampHealth(health: number, maxHealth: number) {
  return Math.max(0, Math.min(maxHealth, Math.round(health)));
}

export function normalizeAttackScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function calculateScoreDamage(score: number, maxDamage: number) {
  const normalizedScore = normalizeAttackScore(score);

  if (normalizedScore <= 50) {
    throw new MatchStateError("You need a score above 50% to deal damage.");
  }

  const normalizedDamage = ((normalizedScore - 50) / 50) * maxDamage;
  return Math.max(1, Math.round(normalizedDamage));
}

export function createInitialMatch(
  playerUserIds: string[],
  options?: {
    maxHealth?: number;
    damagePerAttack?: number;
    startedAt?: string;
  },
): LobbyMatch {
  const maxHealth = options?.maxHealth ?? defaultMatchHealth;
  const damagePerAttack = options?.damagePerAttack ?? defaultAttackDamage;
  const startedAt = options?.startedAt ?? new Date().toISOString();

  return {
    maxHealth,
    damagePerAttack,
    status: "active",
    winnerUserId: null,
    players: playerUserIds.map((userId) => ({
      userId,
      health: maxHealth,
    })),
    startedAt,
    endedAt: null,
    lastAction: null,
  };
}

export function applyMatchAttack(
  match: LobbyMatch,
  attackerUserId: string,
  targetUserId: string,
  occurredAtOrOptions: string | ApplyMatchAttackOptions = new Date().toISOString(),
): LobbyMatch {
  const options =
    typeof occurredAtOrOptions === "string"
      ? { occurredAt: occurredAtOrOptions, score: null }
      : {
          occurredAt: occurredAtOrOptions.occurredAt ?? new Date().toISOString(),
          score: occurredAtOrOptions.score ?? null,
        };

  if (attackerUserId === targetUserId) {
    throw new MatchStateError("Choose another player to attack.");
  }

  if (match.status !== "active") {
    throw new MatchStateError("This match has already ended.");
  }

  const attackerState = match.players.find((player) => player.userId === attackerUserId);

  if (!attackerState || attackerState.health <= 0) {
    throw new MatchStateError("You have already been eliminated from this match.");
  }

  const targetState = match.players.find((player) => player.userId === targetUserId);

  if (!targetState) {
    throw new MatchStateError("That player is missing from this match state.");
  }

  if (targetState.health <= 0) {
    throw new MatchStateError("That player has already been eliminated.");
  }

  const attemptedDamage =
    options.score === null
      ? match.damagePerAttack
      : calculateScoreDamage(options.score, match.damagePerAttack);
  const nextTargetHealth = clampHealth(targetState.health - attemptedDamage, match.maxHealth);
  const damage = targetState.health - nextTargetHealth;
  const players = match.players.map((player) =>
    player.userId === targetUserId
      ? {
          ...player,
          health: nextTargetHealth,
        }
      : player,
  );
  const alivePlayers = players.filter((player) => player.health > 0);
  const finished = alivePlayers.length <= 1;

  return {
    ...match,
    status: finished ? "finished" : "active",
    winnerUserId: finished ? alivePlayers[0]?.userId ?? null : null,
    players,
    endedAt: finished ? options.occurredAt : null,
    lastAction: {
      attackerUserId,
      targetUserId,
      damage,
      score: options.score,
      targetDefeated: nextTargetHealth === 0,
      occurredAt: options.occurredAt,
    },
  };
}

// Attack all alive opponents at once. Returns the updated match.
export function applyMatchAttackAll(
  match: LobbyMatch,
  attackerUserId: string,
  options: { score?: number | null; occurredAt?: string } = {},
): LobbyMatch {
  const occurredAt = options.occurredAt ?? new Date().toISOString();
  const score = options.score ?? null;

  if (match.status !== "active") {
    throw new MatchStateError("This match has already ended.");
  }

  const attackerState = match.players.find((p) => p.userId === attackerUserId);
  if (!attackerState || attackerState.health <= 0) {
    throw new MatchStateError("You have already been eliminated from this match.");
  }

  const attemptedDamage =
    score === null
      ? match.damagePerAttack
      : calculateScoreDamage(score, match.damagePerAttack);

  let totalDamage = 0;
  let defeatedCount = 0;
  const players = match.players.map((player) => {
    if (player.userId === attackerUserId || player.health <= 0) {
      return player;
    }

    const nextHealth = clampHealth(player.health - attemptedDamage, match.maxHealth);
    const damage = player.health - nextHealth;
    totalDamage += damage;
    if (nextHealth === 0) defeatedCount += 1;
    return { ...player, health: nextHealth };
  });

  const alivePlayers = players.filter((p) => p.health > 0);
  const finished = alivePlayers.length <= 1;

  return {
    ...match,
    status: finished ? "finished" : "active",
    winnerUserId: finished ? alivePlayers[0]?.userId ?? null : null,
    players,
    endedAt: finished ? occurredAt : null,
    lastAction: {
      attackerUserId,
      targetUserId: "all",
      damage: totalDamage,
      score,
      targetDefeated: defeatedCount > 0,
      occurredAt,
    },
  };
}
