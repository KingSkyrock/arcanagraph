import { readFileSync } from "node:fs";
import path from "node:path";
import {
  filterByCategory,
  generateEquationWithDescriptor,
  parseEquationCsv,
  type EquationConfig,
  type EquationFamily,
  type SerializableEquation,
} from "../../shared/graph-scoring";

let families: EquationFamily[] = [];

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

// lobbyId → userId → { config, descriptor }
const assignments = new Map<
  string,
  Map<string, { config: EquationConfig; descriptor: SerializableEquation }>
>();

// lobbyId → shuffled sequence of families (shared order for all players)
const lobbySequences = new Map<string, EquationFamily[]>();

// lobbyId → userId → current index in the sequence
const playerIndices = new Map<string, Map<string, number>>();

export function loadEquations() {
  const csvPath = path.resolve(__dirname, "../../data/advanced_equations.csv");
  const text = readFileSync(csvPath, "utf-8");
  families = parseEquationCsv(text);
  console.log(`Loaded ${families.length} equation families for server-side scoring`);
}

/** Initialize a shuffled family sequence for a lobby. Call when the game starts. */
export function initLobbySequence(lobbyId: string, difficulty?: string) {
  const pool = filterByCategory(families, difficulty);
  if (!pool.length) {
    lobbySequences.set(lobbyId, []);
    return;
  }
  lobbySequences.set(lobbyId, shuffle(pool));
  playerIndices.set(lobbyId, new Map());
}

export function assignEquation(
  lobbyId: string,
  userId: string,
  difficulty?: string,
): SerializableEquation {
  // Ensure sequence exists (lazy init if game:start didn't create one)
  if (!lobbySequences.has(lobbyId)) {
    initLobbySequence(lobbyId, difficulty);
  }

  const sequence = lobbySequences.get(lobbyId)!;

  if (!sequence.length) {
    const fallbackDescriptor: SerializableEquation = {
      type: "explicit", jsExpr: "x", label: "y = x", latex: "y = x", hasTurningPoints: false,
    };
    const fallbackConfig: EquationConfig = {
      type: "explicit", fn: (x: number) => x, label: "y = x", latex: "y = x", hasTurningPoints: false,
    };
    if (!assignments.has(lobbyId)) assignments.set(lobbyId, new Map());
    assignments.get(lobbyId)!.set(userId, { config: fallbackConfig, descriptor: fallbackDescriptor });
    return fallbackDescriptor;
  }

  // Get this player's current index
  if (!playerIndices.has(lobbyId)) {
    playerIndices.set(lobbyId, new Map());
  }
  const indices = playerIndices.get(lobbyId)!;
  const index = indices.get(userId) ?? 0;

  // Pick the family at this index (wrap around)
  const family = sequence[index % sequence.length]!;

  // Generate equation with random params from this family
  const { config, descriptor } = generateEquationWithDescriptor(family);

  if (!assignments.has(lobbyId)) {
    assignments.set(lobbyId, new Map());
  }
  assignments.get(lobbyId)!.set(userId, { config, descriptor });

  return descriptor;
}

/** Advance a player to the next family in the sequence. Call after they submit. */
export function advancePlayer(lobbyId: string, userId: string) {
  const indices = playerIndices.get(lobbyId);
  if (!indices) return;
  const current = indices.get(userId) ?? 0;
  indices.set(userId, current + 1);
}

export function getAssignedConfig(
  lobbyId: string,
  userId: string,
): EquationConfig | null {
  return assignments.get(lobbyId)?.get(userId)?.config ?? null;
}

export function clearAssignment(lobbyId: string, userId: string) {
  assignments.get(lobbyId)?.delete(userId);
}

export function clearLobby(lobbyId: string) {
  assignments.delete(lobbyId);
  lobbySequences.delete(lobbyId);
  playerIndices.delete(lobbyId);
}
