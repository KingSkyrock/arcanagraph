import { readFileSync } from "node:fs";
import path from "node:path";
import {
  parseEquationCsv,
  selectRandomEquationWithDescriptor,
  type EquationConfig,
  type EquationFamily,
  type SerializableEquation,
} from "../../shared/graph-scoring";

let families: EquationFamily[] = [];

// lobbyId → userId → { config, descriptor }
const assignments = new Map<
  string,
  Map<string, { config: EquationConfig; descriptor: SerializableEquation }>
>();

export function loadEquations() {
  const csvPath = path.resolve(__dirname, "../../data/advanced_equations.csv");
  const text = readFileSync(csvPath, "utf-8");
  families = parseEquationCsv(text);
  console.log(`Loaded ${families.length} equation families for server-side scoring`);
}

export function assignEquation(
  lobbyId: string,
  userId: string,
  difficulty?: string,
): SerializableEquation {
  const { config, descriptor } = selectRandomEquationWithDescriptor(families, difficulty);

  if (!assignments.has(lobbyId)) {
    assignments.set(lobbyId, new Map());
  }

  assignments.get(lobbyId)!.set(userId, { config, descriptor });
  return descriptor;
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
}
