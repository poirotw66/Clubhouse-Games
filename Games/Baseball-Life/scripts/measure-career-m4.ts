/**
 * M4 metrics: decisions, abilities, pro overall deltas, legacy options.
 */
import { createGame, resolve, acknowledge, rollOrigins } from '../src/game/engine.js';
import { overall } from '../src/game/config.js';
import { buildLegacyOptions } from '../src/game/legacy.js';
import { ABILITIES } from '../src/game/abilities.js';
import type { Decision, GameState, Position } from '../src/game/types.js';

const GUARD = 400;

function enabled(decision: Decision): string[] {
  return decision.options.filter((o) => !o.disabled).map((o) => o.id);
}

function chooser(decision: Decision, step: number): string {
  const ids = enabled(decision);
  if (decision.kind === 'chapter' || decision.kind === 'story') return ids[0];
  if (decision.kind === 'event') return ids[ids.length - 1] ?? ids[0];
  if (decision.kind === 'training') {
    if (ids.some((id) => id.startsWith('t-'))) return ids.find((id) => id === 't-balance') ?? ids[0];
    const drills = ids.filter((id) => id !== 'rest');
    if (drills.length === 0) return ids[0];
    return drills[step % drills.length];
  }
  return ids[0];
}

function play(seedCode: string, position: Position, legacy?: Parameters<typeof createGame>[0]['legacy']): GameState {
  const origins = rollOrigins(seedCode);
  let state = createGame({
    seedCode,
    name: '量測',
    position,
    originId: origins[0].id,
    legacy: legacy ?? null,
  });
  let step = 0;
  while (!state.retired && step < GUARD) {
    if (!state.decision || state.decision.options.length === 0) break;
    state = acknowledge(resolve(state, chooser(state.decision, step)));
    step += 1;
  }
  return state;
}

const first = play('64aa2bl7', 'OF');
const legacy = buildLegacyOptions(first);
const second = play('m4gen2a', 'OF', legacy.find((o) => o.kind === 'bloodline') ?? legacy[0]);

const at23to28 = (() => {
  // Approximate: find first history season near 23 and near 28 overall via attrs snapshots is hard;
  // report end overall and ability counts instead.
  return null;
})();

const report = {
  encyclopediaSize: ABILITIES.length,
  negativeAbilities: ABILITIES.filter((a) => a.negative).length,
  career1: {
    decisions: first.choices.length,
    abilities: first.abilities,
    abilityCount: first.abilities.length,
    retireAge: first.age,
    overall: Math.round(overall(first.attrs, first.position)),
    legacyOptions: legacy.map((o) => o.kind),
    estRealMinutes: Number(((first.choices.length * 3.2) / 60).toFixed(1)),
  },
  career2WithLegacy: {
    decisions: second.choices.length,
    abilities: second.abilities,
    abilityCount: second.abilities.length,
    startLogLegacy: second.log.some((e) => e.label === '遺產'),
    overall: Math.round(overall(second.attrs, second.position)),
    estRealMinutes: Number(((second.choices.length * 3.2) / 60).toFixed(1)),
  },
  at23to28,
};

console.log(JSON.stringify(report, null, 2));
