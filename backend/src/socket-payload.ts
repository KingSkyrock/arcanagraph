export function requireLobbyId(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Lobby id is required.");
  }

  return value.trim();
}

export function requireReadyValue(value: unknown) {
  if (typeof value !== "boolean") {
    throw new Error("Ready state must be true or false.");
  }

  return value;
}

export function requireTargetUserId(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Target player id is required.");
  }

  return value.trim();
}

export function requireAttackScore(value: unknown) {
  const score = Number(value);

  if (!Number.isFinite(score)) {
    throw new Error("Attack score must be a number between 0 and 100.");
  }

  if (score < 0 || score > 100) {
    throw new Error("Attack score must stay between 0 and 100.");
  }

  return Math.round(score);
}
