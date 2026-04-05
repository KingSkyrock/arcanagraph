export type PowerupType = "healing_potion" | "multiplier_spell" | "attack_spell";

export type Powerup = {
  id: string;
  type: PowerupType;
  mx: number; // math-unit x position on grid
  my: number; // math-unit y position on grid
  spawnedAt: number; // timestamp ms
  despawnAt: number; // timestamp ms
  collectedBy: string | null; // userId or null
};

export type PowerupEvent = {
  powerupId: string;
  type: PowerupType;
  userId: string;
  effect: string; // display text like "+5 HP", "1.3x Next!"
  occurredAt: string; // ISO string
};

export const HEAL_AMOUNT = 5;
export const ATTACK_AMOUNT = 5;
export const DESPAWN_MS = 12000;
export const MAX_ACTIVE = 2;
export const COLLECT_HOVER_MS = 1000;
export const MIN_CURVE_DISTANCE = 2.0; // math units from any curve point
export const SPAWN_INTERVAL_MS = 2000;
export const SPAWN_CHANCE = 0.1; // per tick when below MAX_ACTIVE
export const SECOND_SPAWN_WINDOW_MS = 4000; // second powerup only when first has < this remaining

// Box-Muller normal distribution for multiplier, centered at 1.3
export function sampleMultiplier(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const value = 1.3 + z * 0.07;
  return Math.round(Math.max(1.1, Math.min(1.5, value)) * 100) / 100;
}
