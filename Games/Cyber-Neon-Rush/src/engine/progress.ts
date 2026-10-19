/**
 * Persistent meta for Cyber Neon Rush: credits, upgrades, cosmetics, missions.
 * localStorage key `cyber-neon-rush:meta-v1` — validated field-by-field like other games.
 */

export const META_KEY = 'cyber-neon-rush:meta-v1';

export type UpgradeId =
  | 'powerDuration'
  | 'startShield'
  | 'magnetBonus'
  | 'dashCooldown'
  | 'nearMissBonus';

export type UpgradeLevels = Record<UpgradeId, number>;

export type CosmeticId = 'cyan' | 'magenta' | 'lime' | 'gold' | 'ice';

export type MissionKind =
  | 'nearMiss'
  | 'distance'
  | 'credits'
  | 'powerups'
  | 'fever'
  | 'dash'
  | 'score'
  | 'perfect';

export interface MissionDef {
  id: string;
  kind: MissionKind;
  label: string;
  target: number;
  reward: number;
}

export interface MissionProgress {
  id: string;
  kind: MissionKind;
  label: string;
  target: number;
  reward: number;
  progress: number;
  claimed: boolean;
}

export interface MetaSave {
  credits: number;
  upgrades: UpgradeLevels;
  unlockedCosmetics: CosmeticId[];
  equippedCosmetic: CosmeticId;
  missionsDate: string;
  missions: MissionProgress[];
  totalRuns: number;
  lifetimeNearMiss: number;
  lifetimeScore: number;
}

export const UPGRADE_MAX: Record<UpgradeId, number> = {
  powerDuration: 3,
  startShield: 1,
  magnetBonus: 2,
  dashCooldown: 3,
  nearMissBonus: 2,
};

export const UPGRADE_COST: Record<UpgradeId, number[]> = {
  powerDuration: [120, 240, 400],
  startShield: [300],
  magnetBonus: [150, 280],
  dashCooldown: [100, 200, 350],
  nearMissBonus: [140, 260],
};

export const UPGRADE_LABELS: Record<UpgradeId, { name: string; desc: string }> = {
  powerDuration: { name: '道具延時', desc: '護盾／磁鐵／倍率／慢動作持續更久' },
  startShield: { name: '起步護盾', desc: '每局開跑自帶一層護盾' },
  magnetBonus: { name: '磁鐵強化', desc: '磁鐵吸取範圍更大' },
  dashCooldown: { name: '衝刺冷卻', desc: '縮短衝刺冷卻時間' },
  nearMissBonus: { name: '擦身加分', desc: '近距離閃避分數更高' },
};

export const COSMETIC_CATALOG: Record<
  CosmeticId,
  { name: string; cost: number; body: number; emissive: number; trail: number }
> = {
  cyan: { name: '青霓', cost: 0, body: 0xffffff, emissive: 0x22d3ee, trail: 0x22d3ee },
  magenta: { name: '洋紅脈衝', cost: 180, body: 0xffe4f0, emissive: 0xf472b6, trail: 0xf472b6 },
  lime: { name: '酸綠軌跡', cost: 220, body: 0xf7fee7, emissive: 0xa3e635, trail: 0xa3e635 },
  gold: { name: '鎏金夜航', cost: 450, body: 0xfff7ed, emissive: 0xfbbf24, trail: 0xfacc15 },
  ice: { name: '極光冰霜', cost: 380, body: 0xecfeff, emissive: 0x67e8f9, trail: 0xa5f3fc },
};

const MISSION_POOL: MissionDef[] = [
  { id: 'nm10', kind: 'nearMiss', label: '單局擦身閃避 10 次', target: 10, reward: 80 },
  { id: 'nm20', kind: 'nearMiss', label: '單局擦身閃避 20 次', target: 20, reward: 140 },
  { id: 'dist400', kind: 'distance', label: '單局行駛 400 m', target: 400, reward: 90 },
  { id: 'dist700', kind: 'distance', label: '單局行駛 700 m', target: 700, reward: 150 },
  { id: 'cred80', kind: 'credits', label: '單局賺取 80 霓虹幣', target: 80, reward: 100 },
  { id: 'cred150', kind: 'credits', label: '單局賺取 150 霓虹幣', target: 150, reward: 180 },
  { id: 'pu3', kind: 'powerups', label: '單局撿到 3 個道具', target: 3, reward: 100 },
  { id: 'pu5', kind: 'powerups', label: '單局撿到 5 個道具', target: 5, reward: 160 },
  { id: 'fever1', kind: 'fever', label: '單局進入狂熱', target: 1, reward: 70 },
  { id: 'dash5', kind: 'dash', label: '單局衝刺 5 次', target: 5, reward: 90 },
  { id: 'score3k', kind: 'score', label: '單局得分 3,000', target: 3000, reward: 120 },
  { id: 'score6k', kind: 'score', label: '單局得分 6,000', target: 6000, reward: 200 },
  { id: 'perfect5', kind: 'perfect', label: '單局完美閃避 5 次', target: 5, reward: 110 },
];

function emptyUpgrades(): UpgradeLevels {
  return {
    powerDuration: 0,
    startShield: 0,
    magnetBonus: 0,
    dashCooldown: 0,
    nearMissBonus: 0,
  };
}

function todayKey(): string {
  // UTC+8 calendar day for rotating missions (matches other Clubhouse dailies).
  const shifted = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(v)));
}

function isCosmeticId(v: unknown): v is CosmeticId {
  return typeof v === 'string' && v in COSMETIC_CATALOG;
}

function isMissionKind(v: unknown): v is MissionKind {
  return (
    v === 'nearMiss' ||
    v === 'distance' ||
    v === 'credits' ||
    v === 'powerups' ||
    v === 'fever' ||
    v === 'dash' ||
    v === 'score' ||
    v === 'perfect'
  );
}

function hashDay(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickMissionsForDate(date: string): MissionProgress[] {
  const h = hashDay(`cnr-missions:${date}`);
  const pool = MISSION_POOL.slice();
  // Deterministic shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = (h + i * 2654435761) % (i + 1);
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  return pool.slice(0, 3).map((m) => ({
    id: `${date}:${m.id}`,
    kind: m.kind,
    label: m.label,
    target: m.target,
    reward: m.reward,
    progress: 0,
    claimed: false,
  }));
}

function parseMission(raw: unknown): MissionProgress | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  if (typeof m.id !== 'string' || typeof m.label !== 'string') return null;
  if (!isMissionKind(m.kind)) return null;
  return {
    id: m.id,
    kind: m.kind,
    label: m.label,
    target: clampInt(m.target, 1, 1_000_000, 1),
    reward: clampInt(m.reward, 1, 10_000, 50),
    progress: clampInt(m.progress, 0, 1_000_000, 0),
    claimed: Boolean(m.claimed),
  };
}

export function defaultMeta(): MetaSave {
  const date = todayKey();
  return {
    credits: 0,
    upgrades: emptyUpgrades(),
    unlockedCosmetics: ['cyan'],
    equippedCosmetic: 'cyan',
    missionsDate: date,
    missions: pickMissionsForDate(date),
    totalRuns: 0,
    lifetimeNearMiss: 0,
    lifetimeScore: 0,
  };
}

export function loadMeta(): MetaSave {
  const base = defaultMeta();
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return refreshMissionsIfNeeded(base);
    const parsed = JSON.parse(raw) as Partial<MetaSave>;
    const upgrades = emptyUpgrades();
    if (parsed.upgrades && typeof parsed.upgrades === 'object') {
      for (const id of Object.keys(UPGRADE_MAX) as UpgradeId[]) {
        upgrades[id] = clampInt(
          (parsed.upgrades as UpgradeLevels)[id],
          0,
          UPGRADE_MAX[id],
          0,
        );
      }
    }
    const unlocked: CosmeticId[] = ['cyan'];
    if (Array.isArray(parsed.unlockedCosmetics)) {
      for (const c of parsed.unlockedCosmetics) {
        if (isCosmeticId(c) && !unlocked.includes(c)) unlocked.push(c);
      }
    }
    let equipped: CosmeticId = 'cyan';
    if (isCosmeticId(parsed.equippedCosmetic) && unlocked.includes(parsed.equippedCosmetic)) {
      equipped = parsed.equippedCosmetic;
    }
    const missions = Array.isArray(parsed.missions)
      ? parsed.missions.map(parseMission).filter((m): m is MissionProgress => m != null)
      : [];
    const meta: MetaSave = {
      credits: clampInt(parsed.credits, 0, 9_999_999, 0),
      upgrades,
      unlockedCosmetics: unlocked,
      equippedCosmetic: equipped,
      missionsDate: typeof parsed.missionsDate === 'string' ? parsed.missionsDate : '',
      missions,
      totalRuns: clampInt(parsed.totalRuns, 0, 9_999_999, 0),
      lifetimeNearMiss: clampInt(parsed.lifetimeNearMiss, 0, 9_999_999, 0),
      lifetimeScore: clampInt(parsed.lifetimeScore, 0, 9_999_999, 0),
    };
    return refreshMissionsIfNeeded(meta);
  } catch {
    return refreshMissionsIfNeeded(base);
  }
}

export function saveMeta(meta: MetaSave): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    /* private mode */
  }
}

export function refreshMissionsIfNeeded(meta: MetaSave): MetaSave {
  const date = todayKey();
  if (meta.missionsDate === date && meta.missions.length === 3) return meta;
  const next: MetaSave = {
    ...meta,
    missionsDate: date,
    missions: pickMissionsForDate(date),
  };
  saveMeta(next);
  return next;
}

export function powerDurationMul(level: number): number {
  return 1 + level * 0.28;
}

export function dashCooldownSec(level: number): number {
  return Math.max(1.1, 2.6 - level * 0.4);
}

export function magnetRange(level: number, active: boolean): number {
  if (!active) return 0;
  return 3.2 + level * 1.1;
}

export function nearMissScoreMul(level: number): number {
  return 1 + level * 0.22;
}

/** Credits earned from one finished run. */
export function creditsFromRun(input: {
  score: number;
  avoids: number;
  pickups: number;
  powerups: number;
}): number {
  return (
    Math.floor(input.score / 45) +
    input.avoids * 2 +
    input.pickups * 3 +
    input.powerups * 8
  );
}

export interface RunMissionStats {
  nearMiss: number;
  perfect: number;
  distance: number;
  credits: number;
  powerups: number;
  fever: number;
  dash: number;
  score: number;
}

export function applyRunToMissions(meta: MetaSave, stats: RunMissionStats): MetaSave {
  const refreshed = refreshMissionsIfNeeded(meta);
  const missions = refreshed.missions.map((m) => {
    if (m.claimed) return m;
    let add = 0;
    switch (m.kind) {
      case 'nearMiss':
        add = stats.nearMiss;
        break;
      case 'perfect':
        add = stats.perfect;
        break;
      case 'distance':
        add = stats.distance;
        break;
      case 'credits':
        add = stats.credits;
        break;
      case 'powerups':
        add = stats.powerups;
        break;
      case 'fever':
        add = stats.fever;
        break;
      case 'dash':
        add = stats.dash;
        break;
      case 'score':
        add = stats.score;
        break;
      default:
        add = 0;
    }
    // Per-run missions: take the best single-run progress for the day.
    const progress = Math.max(m.progress, Math.min(m.target, add));
    return { ...m, progress };
  });
  const next: MetaSave = { ...refreshed, missions };
  saveMeta(next);
  return next;
}

export function claimMission(meta: MetaSave, missionId: string): MetaSave {
  let gained = 0;
  const missions = meta.missions.map((m) => {
    if (m.id !== missionId || m.claimed || m.progress < m.target) return m;
    gained += m.reward;
    return { ...m, claimed: true };
  });
  if (gained <= 0) return meta;
  const next: MetaSave = {
    ...meta,
    missions,
    credits: meta.credits + gained,
  };
  saveMeta(next);
  return next;
}

export function buyUpgrade(meta: MetaSave, id: UpgradeId): MetaSave | null {
  const level = meta.upgrades[id];
  const max = UPGRADE_MAX[id];
  if (level >= max) return null;
  const cost = UPGRADE_COST[id][level];
  if (meta.credits < cost) return null;
  const upgrades = { ...meta.upgrades, [id]: level + 1 };
  const next: MetaSave = {
    ...meta,
    credits: meta.credits - cost,
    upgrades,
  };
  saveMeta(next);
  return next;
}

export function buyCosmetic(meta: MetaSave, id: CosmeticId): MetaSave | null {
  if (meta.unlockedCosmetics.includes(id)) return null;
  const cost = COSMETIC_CATALOG[id].cost;
  if (meta.credits < cost) return null;
  const next: MetaSave = {
    ...meta,
    credits: meta.credits - cost,
    unlockedCosmetics: [...meta.unlockedCosmetics, id],
    equippedCosmetic: id,
  };
  saveMeta(next);
  return next;
}

export function equipCosmetic(meta: MetaSave, id: CosmeticId): MetaSave | null {
  if (!meta.unlockedCosmetics.includes(id)) return null;
  const next: MetaSave = { ...meta, equippedCosmetic: id };
  saveMeta(next);
  return next;
}

export function recordRunEnd(
  meta: MetaSave,
  result: {
    score: number;
    distance: number;
    avoids: number;
    perfects: number;
    pickups: number;
    powerups: number;
    dashes: number;
    reachedFever: boolean;
    creditsEarned: number;
  },
): MetaSave {
  let next: MetaSave = {
    ...meta,
    credits: meta.credits + result.creditsEarned,
    totalRuns: meta.totalRuns + 1,
    lifetimeNearMiss: meta.lifetimeNearMiss + result.avoids,
    lifetimeScore: meta.lifetimeScore + result.score,
  };
  next = applyRunToMissions(next, {
    nearMiss: result.avoids,
    perfect: result.perfects,
    distance: result.distance,
    credits: result.creditsEarned,
    powerups: result.powerups,
    fever: result.reachedFever ? 1 : 0,
    dash: result.dashes,
    score: result.score,
  });
  saveMeta(next);
  return next;
}
