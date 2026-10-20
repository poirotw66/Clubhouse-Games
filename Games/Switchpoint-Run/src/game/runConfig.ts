/**
 * Resolves a RunConfig into the numeric knobs the engine reads each tick.
 * Kept separate from engine.ts so self-checks can assert the default loadout
 * produces exactly the legacy constants.
 */
import {
  HIT_STUN_DURATION,
  LANE_CHANGE_COOLDOWN,
  MAX_BUFFER,
  SCORE_MULT_STEP,
  START_BUFFER,
  SUPPLY_BUFFER_GAIN,
} from './constants';
import { MODIFIERS, type ModifierId } from './modifiers';
import { DEFAULT_RUNNER_ID, runnerById, type RunnerId } from './profiles';
import { DEFAULT_THEME_ID, themeById, type ThemeId } from './themes';
import { DEFAULT_RUN_CONFIG, type RunConfig } from './types';

export interface ResolvedRunParams {
  config: RunConfig;
  startBuffer: number;
  maxBuffer: number;
  speedMul: number;
  hitStunDuration: number;
  laneCooldown: number;
  supplyGain: number;
  trainPaceMul: number;
  densityBias: number;
  scoreRewardStep: number;
  scoreRewardMul: number;
  suppressSupply: boolean;
  modifierBoltBonus: number;
}

export function normalizeRunConfig(partial?: Partial<RunConfig> | null): RunConfig {
  const runnerId: RunnerId =
    partial?.runnerId && runnerById(partial.runnerId) ? partial.runnerId : DEFAULT_RUNNER_ID;
  const themeId: ThemeId =
    partial?.themeId && themeById(partial.themeId) ? partial.themeId : DEFAULT_THEME_ID;
  const modifierIds: ModifierId[] = [];
  if (Array.isArray(partial?.modifierIds)) {
    for (const id of partial.modifierIds) {
      if (MODIFIERS.some((m) => m.id === id) && !modifierIds.includes(id)) modifierIds.push(id);
    }
  }
  return { runnerId, themeId, modifierIds };
}

export function resolveRunParams(partial?: Partial<RunConfig> | null): ResolvedRunParams {
  const config = normalizeRunConfig(partial ?? DEFAULT_RUN_CONFIG);
  const runner = runnerById(config.runnerId) ?? runnerById(DEFAULT_RUNNER_ID)!;
  const theme = themeById(config.themeId) ?? themeById(DEFAULT_THEME_ID)!;
  const mods = config.modifierIds
    .map((id) => MODIFIERS.find((m) => m.id === id))
    .filter((m): m is (typeof MODIFIERS)[number] => Boolean(m));

  let maxBufferMul = runner.maxBufferMul;
  for (const m of mods) maxBufferMul *= m.maxBufferMul;

  let densityBias = theme.densityBias;
  let scoreRewardMul = 1;
  let suppressSupply = false;
  let modifierBoltBonus = 0;
  for (const m of mods) {
    densityBias += m.densityBias;
    scoreRewardMul *= m.scoreRewardMul;
    if (m.suppressSupply) suppressSupply = true;
    modifierBoltBonus += m.boltBonus;
  }

  const maxBuffer = Math.max(80, Math.round(MAX_BUFFER * maxBufferMul));
  const startBuffer = Math.min(
    maxBuffer,
    Math.max(40, Math.round(START_BUFFER * runner.startBufferMul * Math.min(1, maxBufferMul))),
  );

  return {
    config,
    startBuffer,
    maxBuffer,
    speedMul: runner.speedMul,
    hitStunDuration: HIT_STUN_DURATION * runner.hitStunMul,
    laneCooldown: LANE_CHANGE_COOLDOWN * runner.laneCooldownMul,
    supplyGain: SUPPLY_BUFFER_GAIN * runner.supplyMul * theme.supplyMul,
    trainPaceMul: theme.trainPaceMul,
    densityBias,
    scoreRewardStep: SCORE_MULT_STEP,
    scoreRewardMul,
    suppressSupply,
    modifierBoltBonus,
  };
}

/** True when the loadout is the original balance baseline. */
export function isDefaultLoadout(config: RunConfig): boolean {
  return (
    config.runnerId === DEFAULT_RUNNER_ID &&
    config.themeId === DEFAULT_THEME_ID &&
    config.modifierIds.length === 0
  );
}
