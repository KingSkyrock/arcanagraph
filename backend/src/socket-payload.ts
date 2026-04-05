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
