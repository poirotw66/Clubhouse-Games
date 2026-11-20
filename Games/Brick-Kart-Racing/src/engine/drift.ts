export interface DriftTier {
  charge: number;
  boost: number;
  label: string;
  color: string;
}

export const DRIFT_LEVELS = [
  {charge: 0.85, boost: 0.55, label: '藍噴', color: '#4fc3ff'},
  {charge: 1.8, boost: 1.0, label: '橘噴', color: '#ff9a2e'},
  {charge: 3.0, boost: 1.7, label: '紫噴', color: '#c56bff'},
] as const;

export function driftLevel(charge: number): number {
  let level = 0;
  for (let i = 0; i < DRIFT_LEVELS.length; i++) {
    if (charge >= DRIFT_LEVELS[i].charge) level = i + 1;
  }
  return level;
}

/** 0–1 fill toward max mini-turbo charge (for HUD meter). */
export function driftFill(charge: number): number {
  const max = DRIFT_LEVELS[DRIFT_LEVELS.length - 1].charge;
  return Math.max(0, Math.min(1, charge / max));
}
