import type { TrailPoint } from "../../shared/graph-scoring";

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

const MAX_TRAIL_POINTS = 10_000;

function isValidTrailPoint(value: unknown): value is TrailPoint {
  if (value === null) {
    return true;
  }

  if (typeof value !== "object" || value === null) {
    return false;
  }

  const point = value as Record<string, unknown>;
  return (
    typeof point.x === "number" &&
    typeof point.y === "number" &&
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    point.x >= -50 &&
    point.x <= 700 &&
    point.y >= -50 &&
    point.y <= 550
  );
}

export function requireTrailData(
  value: unknown,
): Record<"Left" | "Right", TrailPoint[]> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Trail data must include Left and Right hand arrays.");
  }

  const raw = value as Record<string, unknown>;

  if (!Array.isArray(raw.Left) || !Array.isArray(raw.Right)) {
    throw new Error("Trail data must include Left and Right hand arrays.");
  }

  const totalPoints = raw.Left.length + raw.Right.length;

  if (totalPoints > MAX_TRAIL_POINTS) {
    throw new Error(`Trail data exceeds the ${MAX_TRAIL_POINTS} point limit.`);
  }

  const left: TrailPoint[] = [];
  const right: TrailPoint[] = [];

  for (const point of raw.Left) {
    if (!isValidTrailPoint(point)) {
      throw new Error("Trail data contains invalid point coordinates.");
    }

    left.push(point);
  }

  for (const point of raw.Right) {
    if (!isValidTrailPoint(point)) {
      throw new Error("Trail data contains invalid point coordinates.");
    }

    right.push(point);
  }

  return { Left: left, Right: right };
}
