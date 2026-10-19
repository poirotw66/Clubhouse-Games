/**
 * Career metrics for M3 before/after reporting (decisions, story, chapters).
 */
import { createGame, resolve, acknowledge, rollOrigins } from '../src/game/engine.js';
import { overall } from '../src/game/config.js';
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

function play(seedCode: string, position: Position): GameState {
  const origins = rollOrigins(seedCode);
  let state = createGame({
    seedCode,
    name: '量測',
    position,
    originId: origins[0].id,
  });
  let step = 0;
  while (!state.retired && step < GUARD) {
    if (!state.decision || state.decision.options.length === 0) break;
    state = acknowledge(resolve(state, chooser(state.decision, step)));
    step += 1;
  }
  return state;
}

const seeds = ['64aa2bl7', 'm3seed01', 'm3seed02', 'm3seed03', 'm3seed04', 'm3seed05'];
const rows = seeds.map((seed) => {
  const state = play(seed, seed === '64aa2bl7' ? 'OF' : seed.endsWith('2') ? 'P' : 'IF');
  const kinds = state.handled.reduce(
    (acc, key) => {
      const prefix = key.split(':')[0];
      acc[prefix] = (acc[prefix] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  return {
    seed,
    decisions: state.choices.length,
    chapters: state.chapterHistory.length,
    chapterCards: state.handled.filter((k) => k.startsWith('chapter:')).length,
    storyCards: state.handled.filter((k) => k.startsWith('story:')).length,
    clutchCards: state.handled.filter((k) => k.startsWith('clutch:')).length,
    rivalMeetings: state.rival.meetings,
    storyHighlights: state.storyHighlights.length,
    retireAge: state.age,
    overall: Math.round(overall(state.attrs, state.position)),
    kinds,
  };
});

const avg = (key: keyof (typeof rows)[0]) =>
  rows.reduce((s, r) => s + (r[key] as number), 0) / rows.length;

const report = {
  n: rows.length,
  avgDecisions: Number(avg('decisions').toFixed(1)),
  avgChapters: Number(avg('chapters').toFixed(1)),
  avgChapterCards: Number(avg('chapterCards').toFixed(1)),
  avgStoryCards: Number(avg('storyCards').toFixed(1)),
  avgClutch: Number(avg('clutchCards').toFixed(1)),
  avgRivalMeetings: Number(avg('rivalMeetings').toFixed(1)),
  /** Rough human pace: ~3.2s per decision (read + choose). */
  estRealMinutes: Number(((avg('decisions') * 3.2) / 60).toFixed(1)),
  rows,
};

console.log(JSON.stringify(report, null, 2));
