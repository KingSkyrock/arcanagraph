import { readFileSync } from "node:fs";
import path from "node:path";
import {
  generateEquationWithDescriptor,
  parseEquationCsv,
  type EquationConfig,
  type EquationFamily,
  type SerializableEquation,
} from "../../shared/graph-scoring";

let families: EquationFamily[] = [];

const BEGINNER_FAMILIES = ["linear", "quadratic", "absolute_value"];

function filterByCategory(allFamilies: EquationFamily[], category?: string): EquationFamily[] {
  if (!category) return allFamilies;
  if (category === "beginner") {
    return allFamilies.filter(f => f.difficulty === "easy" && BEGINNER_FAMILIES.includes(f.skill_family));
  }
  if (category === "advanced") {
    return allFamilies;
  }
  // Custom: treat as skill_family name
  return allFamilies.filter(f => f.skill_family === category);
}

// lobbyId → userId → { config, descriptor }
const assignments = new Map<
  string,
  Map<string, { config: EquationConfig; descriptor: SerializableEquation }>
>();

// lobbyId → the EquationFamily chosen for the current round
const roundFamilies = new Map<string, EquationFamily>();

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
  // If this lobby already has a round family, reuse it (same family, new params).
  // Otherwise pick one and store it for the round.
  let family = roundFamilies.get(lobbyId);

  if (!family) {
    const pool = filterByCategory(families, difficulty);
    if (!pool.length) {
      // Absolute fallback
      const fallbackConfig: EquationConfig = {
        type: "explicit",
        fn: (x: number) => x,
        label: "y = x",
        latex: "y = x",
        hasTurningPoints: false,
      };
      const fallbackDescriptor: SerializableEquation = {
        type: "explicit",
        jsExpr: "x",
        label: "y = x",
        latex: "y = x",
        hasTurningPoints: false,
      };
      if (!assignments.has(lobbyId)) assignments.set(lobbyId, new Map());
      assignments.get(lobbyId)!.set(userId, { config: fallbackConfig, descriptor: fallbackDescriptor });
      return fallbackDescriptor;
    }
    family = pool[Math.floor(Math.random() * pool.length)]!;
    roundFamilies.set(lobbyId, family);
  }

  // Generate a new equation from the same family (different random params)
  const { config, descriptor } = generateEquationWithDescriptor(family);

  if (!assignments.has(lobbyId)) {
    assignments.set(lobbyId, new Map());
  }

  assignments.get(lobbyId)!.set(userId, { config, descriptor });
  return descriptor;
}

/** Clear the round family so the next request picks a new one. */
export function advanceRound(lobbyId: string) {
  roundFamilies.delete(lobbyId);
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
  roundFamilies.delete(lobbyId);
}
