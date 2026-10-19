/**
 * One-shot career metrics for M1 before/after reporting.
 * Run via the self-check tsc compile path or: npx tsx scripts/measure-career.ts
 */
import { createGame, resolve, acknowledge, rollOrigins } from '../src/game/engine.js';
import { overall } from '../src/game/config.js';
import type { Decision, GameState, Position } from '../src/game/types.js';

const GUARD = 400;

function enabled(decision: Decision): string[] {
  return decision.options.filter((o) => !o.disabled).map((o) => o.id);
}

function play(seedCode: string, position: Position): GameState {
  const origins = rollOrigins(seedCode);
  let state = createGame({
    seedCode,
    name: '量測',
    position,
    originId: origins[0].id,
  });
  let step = 0;
  const trainRotate = (decision: Decision, step: number) => {
    const ids = enabled(decision);
    if (decision.kind === 'event') return ids[ids.length - 1] ?? ids[0];
    if (decision.kind === 'training') {
      if (ids.some((id) => id.startsWith('t-'))) return ids.find((id) => id === 't-allin') ?? ids[0];
      if (ids.includes('stretch') || ids.includes('notebook')) {
        // Secondary: pair growth primary with a real secondary drill half the time.
        if (step % 2 === 0) {
          const drills = ids.filter((id) => !['rest', 'stretch', 'notebook'].includes(id));
          if (drills.length) return drills[step % drills.length];
        }
        return ids.find((id) => id === 'stretch') ?? ids.find((id) => id === 'notebook') ?? ids[0];
      }
      const drills = ids.filter((id) => id !== 'rest');
      return drills.length ? drills[step % drills.length] : ids[0];
    }
    return ids[0];
  };
  while (!state.retired && step < GUARD) {
    const decision = state.decision;
    if (!decision || decision.kind === 'continue' || decision.options.length === 0) break;
    state = resolve(state, trainRotate(decision, step));
    state = acknowledge(state);
    step += 1;
  }
  return state;
}

function hsSnapshot(state: GameState): { age: number; overall: number; abilities: string[] } | null {
  // Approximate: attrs at end of HS are not stored; replay until path fork.
  return null;
}

function playUntilPath(seedCode: string, position: Position): GameState {
  const origins = rollOrigins(seedCode);
  let state = createGame({
    seedCode,
    name: '量測',
    position,
    originId: origins[0].id,
  });
  let step = 0;
  while (state.stage === 'highschool' && state.decision?.kind !== 'path' && step < 80) {
    const decision = state.decision;
    if (!decision || decision.options.length === 0) break;
    const ids = enabled(decision);
    let pick = ids[0];
    if (decision.kind === 'event') pick = ids[ids.length - 1] ?? ids[0];
    else if (decision.kind === 'training') {
      if (ids.some((id) => id.startsWith('t-'))) pick = ids.find((id) => id === 't-balance') ?? ids[0];
      else if (ids.includes('stretch')) {
        const drills = ids.filter((id) => !['rest', 'stretch', 'notebook'].includes(id));
        pick = drills[step % Math.max(1, drills.length)] ?? ids.find((id) => id === 'stretch')!;
      } else {
        const drills = ids.filter((id) => id !== 'rest');
        pick = drills[step % drills.length] ?? ids[0];
      }
    }
    state = acknowledge(resolve(state, pick));
    step += 1;
  }
  return state;
}

const seeds = ['64aa2bl7', 'reach-0', 'reach-1', 'reach-2', 'depth001', 'menu0001', 'hsflow01', 'safe0001'];
const positions: Position[] = ['OF', 'P', 'IF', 'C'];

let totalChoices = 0;
let totalHsChoices = 0;
let totalAbilities = 0;
const curves: { seed: string; hsOverall: number; endOverall: number; retireAge: number; decisions: number; abilities: string[] }[] = [];

for (let i = 0; i < 8; i++) {
  const seed = seeds[i];
  const position = positions[i % positions.length];
  const hs = playUntilPath(seed, position);
  const hsOverall = overall(hs.attrs, position);
  const hsChoices = hs.choices.length;
  const full = play(seed, position);
  totalChoices += full.choices.length;
  totalHsChoices += hsChoices;
  totalAbilities += full.abilities.length;
  curves.push({
    seed,
    hsOverall: Math.round(hsOverall),
    endOverall: Math.round(overall(full.attrs, position)),
    retireAge: full.age,
    decisions: full.choices.length,
    abilities: full.abilities,
  });
}

const avgDecisions = totalChoices / 8;
const avgHs = totalHsChoices / 8;
const report = {
  sample: 8,
  avgDecisionsPerCareer: Number(avgDecisions.toFixed(1)),
  avgHsDecisions: Number(avgHs.toFixed(1)),
  avgAbilities: Number((totalAbilities / 8).toFixed(2)),
  // Report baseline from prior investigation (single-slot era).
  priorBaseline: {
    avgDecisions: 93.1,
    browserCareerDecisions: 89,
    realMinutesEstimate: '4–8',
    hsTurnsTraining: 15,
    note: 'Prior: single-slot HS; growth front-loaded by growthAgeFactor',
  },
  curves,
};

console.log(JSON.stringify(report, null, 2));
void hsSnapshot;
