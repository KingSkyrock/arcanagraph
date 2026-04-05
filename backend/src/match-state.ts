export type MatchStatus = "active" | "finished";

export type MatchPlayer = {
  userId: string;
  health: number;
};

export type MatchAction = {
  attackerUserId: string;
  targetUserId: string;
  damage: number;
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

export function clampHealth(health: number, maxHealth: number) {
  return Math.max(0, Math.min(maxHealth, Math.round(health)));
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
  occurredAt = new Date().toISOString(),
): LobbyMatch {
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

  const nextTargetHealth = clampHealth(
    targetState.health - match.damagePerAttack,
    match.maxHealth,
  );
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
    endedAt: finished ? occurredAt : null,
    lastAction: {
      attackerUserId,
      targetUserId,
      damage,
      targetDefeated: nextTargetHealth === 0,
      occurredAt,
    },
  };
}
