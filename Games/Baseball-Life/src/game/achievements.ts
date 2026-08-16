import { TRAITS } from './traits';
import { PITCHES } from './pitches';
import type { GameState, LeagueId, PitchId, Position } from './types';

/**
 * Achievements are the only thing in this game that survives a career. Every
 * run ends with the player back at 16 years old, so without something that
 * accumulates there is no reason to start a second one.
 *
 * They live entirely outside the deterministic sim — nothing here can change
 * how a run plays out, so a seed still rebuilds the same life whether the
 * player has unlocked everything or nothing.
 */
export interface Achievement {
  id: string;
  label: string;
  desc: string;
  /** Set for collection achievements, which show progress as n/goal. */
  goal?: number;
}

/** A pitch counts as mastered at grade A. */
const MASTERY = 82;

export const ACHIEVEMENTS: Achievement[] = [
  // ---- Single-career feats ----
  { id: 'first-ballot', label: '一票入魂', desc: '以「名人堂首輪高票入選」結束一段生涯。' },
  { id: 'draft-first-pick', label: '第一指名', desc: '在中職選秀會上被第一指名。' },
  { id: 'undrafted-hof', label: '沒有人念你的名字', desc: '選秀落選過，最後仍進入名人堂。' },
  { id: 'perfect-game', label: '完全比賽', desc: '投出一場完全比賽。' },
  { id: 'cycle', label: '完全打擊', desc: '達成一次完全打擊。' },
  { id: 'no-hitter', label: '無安打比賽', desc: '投出一場無安打比賽。' },
  { id: 'iron-career', label: '從沒進過傷兵', desc: '整段職業生涯零傷病，並打滿 10 個球季。' },
  { id: 'two-way-hof', label: '二刀流傳說', desc: '以二刀流打進名人堂。' },
  { id: 'hs-dynasty', label: '那三個夏天', desc: '高中拿下 3 座全國冠軍。' },
  { id: 'rich', label: '五億男', desc: '單段生涯總收入突破 5 億。' },
  { id: 'mlb-regular', label: '最高殿堂', desc: '在大聯盟打滿 5 個球季。' },
  { id: 'hits-3000', label: '三千安', desc: '生涯通算 3000 支安打。' },
  { id: 'wins-200', label: '兩百勝', desc: '生涯通算 200 勝。' },
  { id: 'hr-500', label: '五百轟', desc: '生涯通算 500 支全壘打。' },

  // ---- Collections, filled in across runs ----
  { id: 'all-traits', label: '特質全覽', desc: '累計覺醒全部 8 種隱藏特質。', goal: TRAITS.length },
  { id: 'all-pitches', label: '六種武器', desc: '累計把 6 種球路都練到 A 級以上。', goal: PITCHES.length },
  { id: 'all-positions', label: '什麼都打過', desc: '五種守備位置各走完一次生涯。', goal: 5 },
  { id: 'all-leagues', label: '走遍七個聯盟', desc: '累計在 7 個聯盟都出賽過。', goal: 7 },
  { id: 'ten-careers', label: '十段人生', desc: '累計完成 10 段生涯。', goal: 10 },
];

export interface AchievementProgress {
  /** Achievement id → the seed code of the run that unlocked it. */
  unlocked: Record<string, string>;
  traitsSeen: string[];
  pitchesMastered: PitchId[];
  positionsPlayed: Position[];
  leaguesPlayed: LeagueId[];
  careers: number;
  bestHof: number;
}

export const EMPTY_PROGRESS: AchievementProgress = {
  unlocked: {},
  traitsSeen: [],
  pitchesMastered: [],
  positionsPlayed: [],
  leaguesPlayed: [],
  careers: 0,
  bestHof: 0,
};

function union<T>(existing: readonly T[], incoming: readonly T[]): T[] {
  return [...new Set([...existing, ...incoming])];
}

/** Folds one finished career into the running totals. */
function accumulate(state: GameState, prior: AchievementProgress): AchievementProgress {
  const masteredNow = state.arsenal.filter((p) => p.level >= MASTERY).map((p) => p.id);
  const leaguesNow = state.history.map((h) => h.league);
  return {
    unlocked: { ...prior.unlocked },
    traitsSeen: union(prior.traitsSeen, state.traits),
    pitchesMastered: union(prior.pitchesMastered, masteredNow),
    positionsPlayed: union(prior.positionsPlayed, [state.position]),
    leaguesPlayed: union(prior.leaguesPlayed, leaguesNow),
    careers: prior.careers + 1,
    bestHof: Math.max(prior.bestHof, state.summary?.hofScore ?? 0),
  };
}

/** Current count for a collection achievement, or null for a one-off. */
export function progressOf(id: string, progress: AchievementProgress): number | null {
  switch (id) {
    case 'all-traits':
      return progress.traitsSeen.length;
    case 'all-pitches':
      return progress.pitchesMastered.length;
    case 'all-positions':
      return progress.positionsPlayed.length;
    case 'all-leagues':
      return progress.leaguesPlayed.length;
    case 'ten-careers':
      return progress.careers;
    default:
      return null;
  }
}

function satisfied(id: string, state: GameState, next: AchievementProgress): boolean {
  const summary = state.summary;
  if (!summary) return false;
  const totals = summary.totals;
  const feats = state.milestones.filter((m) => m.kind === 'feat').map((m) => m.text);
  const proSeasons = state.history.filter((h) => h.league !== 'hs');

  switch (id) {
    case 'first-ballot':
      return summary.verdict === '名人堂首輪高票入選';
    case 'draft-first-pick':
      // Rank 1 covers both 第一指名 and 第一輪; the log line distinguishes them.
      return state.log.some((entry) => entry.text.includes('第一指名'));
    case 'undrafted-hof':
      return (
        state.log.some((entry) => entry.text.includes('選秀落選')) &&
        summary.verdict.startsWith('名人堂') &&
        summary.verdict !== '名人堂票選邊緣'
      );
    case 'perfect-game':
      return feats.includes('投出完全比賽');
    case 'cycle':
      return feats.includes('達成完全打擊');
    case 'no-hitter':
      return feats.includes('投出無安打比賽');
    case 'iron-career':
      return state.counters.injuries === 0 && totals.seasons >= 10;
    case 'two-way-hof':
      return state.position === 'TW' && summary.verdict.startsWith('名人堂');
    case 'hs-dynasty':
      return state.counters.hsTournamentWins >= 3;
    case 'rich':
      return summary.earnings >= 50000;
    case 'mlb-regular':
      return proSeasons.filter((h) => h.league === 'mlb').length >= 5;
    case 'hits-3000':
      return totals.hits >= 3000;
    case 'wins-200':
      return totals.wins >= 200;
    case 'hr-500':
      return totals.hr >= 500;
    default: {
      const achievement = ACHIEVEMENTS.find((a) => a.id === id);
      const current = progressOf(id, next);
      return achievement?.goal !== undefined && current !== null && current >= achievement.goal;
    }
  }
}

export interface AchievementResult {
  progress: AchievementProgress;
  unlocked: Achievement[];
}

/**
 * Called once when a career ends. Collections are folded in first so that a
 * run which completes a set unlocks that set in the same breath.
 */
export function evaluate(state: GameState, prior: AchievementProgress): AchievementResult {
  const next = accumulate(state, prior);
  const unlocked: Achievement[] = [];

  for (const achievement of ACHIEVEMENTS) {
    if (next.unlocked[achievement.id]) continue;
    if (!satisfied(achievement.id, state, next)) continue;
    next.unlocked[achievement.id] = state.seedCode;
    unlocked.push(achievement);
  }

  return { progress: next, unlocked };
}
