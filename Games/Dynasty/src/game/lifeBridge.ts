/**
 * Read-only bridge from Baseball-Life (棒球人生) graduated careers.
 *
 * Dynasty never writes Baseball-Life keys. Archive rows are parsed
 * defensively — malformed or partial JSON is skipped. Injecting a graduate
 * into the draft pool is opt-in presentation: the seeded draft class RNG is
 * unchanged; the graduate is appended as an extra option so seed-sharing
 * runs without a local archive stay bit-identical.
 */
import { scoutBand, bandWidthFor } from './scouting';
import { generatePlayer, ability } from './players';
import { createRng, hashString } from './rng';
import type { Player, Position } from './types';

const LIFE_ARCHIVE_KEY = 'clubhouse:baseball-life:archive';

export interface LifeGraduate {
  seedCode: string;
  name: string;
  position: Position;
  /** Hall-of-fame style score from Baseball-Life; drives ability/potential. */
  hofScore: number;
  verdict: string;
  traits: string[];
}

const POSITION_LABELS: Record<string, Position> = {
  P: 'P',
  C: 'C',
  IF: 'IF',
  OF: 'OF',
  TW: 'OF', // two-way → outfield body in Dynasty's four-position model
  投手: 'P',
  捕手: 'C',
  內野手: 'IF',
  外野手: 'OF',
  二刀流: 'OF',
};

function mapPosition(raw: unknown, label: unknown): Position {
  if (typeof raw === 'string' && POSITION_LABELS[raw]) return POSITION_LABELS[raw];
  if (typeof label === 'string' && POSITION_LABELS[label]) return POSITION_LABELS[label];
  return 'OF';
}

function sanitize(raw: unknown): LifeGraduate | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.seedCode !== 'string' || typeof row.name !== 'string') return null;
  if (!row.name.trim() || !row.seedCode.trim()) return null;
  const hofScore = Number(row.hofScore);
  if (!Number.isFinite(hofScore) || hofScore < 0) return null;
  return {
    seedCode: row.seedCode.trim().toLowerCase(),
    name: row.name.trim().slice(0, 24),
    position: mapPosition(row.positionId, row.position),
    hofScore: Math.floor(hofScore),
    verdict: typeof row.verdict === 'string' ? row.verdict : '',
    traits: Array.isArray(row.traits)
      ? row.traits.filter((t): t is string => typeof t === 'string').slice(0, 8)
      : [],
  };
}

/**
 * Loads Baseball-Life archive rows from localStorage. Safe in Node / SSR:
 * returns [] when `window` is missing or the key is absent / corrupt.
 */
export function loadLifeGraduates(
  storage?: Pick<Storage, 'getItem'> | null,
): LifeGraduate[] {
  try {
    const store =
      storage ??
      (typeof window !== 'undefined' && window.localStorage ? window.localStorage : null);
    if (!store) return [];
    const raw = store.getItem(LIFE_ARCHIVE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(sanitize)
      .filter((entry): entry is LifeGraduate => entry !== null)
      .slice(0, 20);
  } catch {
    return [];
  }
}

/**
 * Maps a hall-of-fame score onto a prospect-ish ability / potential band.
 * High careers arrive as polished amateurs, not finished stars — Dynasty still
 * has to develop or pay them.
 */
export function ratingsFromHof(hofScore: number): { ability: number; potential: number; age: number } {
  const score = Math.max(0, Math.min(3000, hofScore));
  const ability = Math.round(32 + (score / 3000) * 28);
  const potential = Math.round(48 + (score / 3000) * 40);
  const age = score >= 1800 ? 22 : score >= 900 ? 20 : 19;
  return {
    ability: Math.max(26, Math.min(58, ability)),
    potential: Math.max(40, Math.min(96, potential)),
    age,
  };
}

/** Builds a Dynasty Player from a Baseball-Life archive row. Deterministic per seedCode. */
export function playerFromLifeGraduate(
  graduate: LifeGraduate,
  scoutSpend: number,
): Player {
  const seed = hashString(`life-bridge:${graduate.seedCode}:${graduate.name}`);
  const r = createRng(seed);
  const ratings = ratingsFromHof(graduate.hofScore);
  const player = generatePlayer({
    r,
    teamId: '',
    age: ratings.age,
    ability: ratings.ability,
    potential: ratings.potential,
    level: 'farm',
    homegrown: true,
    position: graduate.position,
    name: graduate.name,
  });
  player.id = `life:${graduate.seedCode}`;
  player.salary = 80;
  player.years = 4;
  player.band = scoutBand(player.potential, bandWidthFor(scoutSpend), r);
  return player;
}

/** Picks the strongest graduate not already on a Dynasty roster / draft pool. */
export function pickLifeBridgeProspect(
  graduates: LifeGraduate[],
  takenIds: Set<string>,
  scoutSpend: number,
): Player | null {
  const available = graduates
    .filter((g) => !takenIds.has(`life:${g.seedCode}`))
    .sort((a, b) => b.hofScore - a.hofScore);
  if (available.length === 0) return null;
  return playerFromLifeGraduate(available[0], scoutSpend);
}

export function describeLifeProspect(player: Player, verdict: string): string[] {
  const lines = [
    `${player.age} 歲・目前能力 ${Math.round(ability(player))}`,
    `球探評估潛力 ${player.band.low}–${player.band.high}`,
    '來自《棒球人生》的畢業生（唯讀橋接）',
  ];
  if (verdict) lines.push(`生涯評價：${verdict}`);
  return lines;
}
