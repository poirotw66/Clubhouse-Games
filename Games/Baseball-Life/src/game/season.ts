import { IS_PITCHER, IS_TWO_WAY, LEAGUES, halfOveralls, overall } from './config';
import { noise } from './rng';
import type {
  Attributes,
  BatterLine,
  LeagueId,
  Meta,
  PitcherLine,
  Position,
  StatLine,
} from './types';

/** Ballparks and eras differ; this scales home runs so 高中 is not a slugfest. */
const HR_SCALE: Record<LeagueId, number> = {
  hs: 0.5,
  college: 0.7,
  corp: 0.75,
  cpbl: 1,
  milb: 0.9,
  npb: 0.85,
  mlb: 0.95,
};

export interface SeasonInput {
  attrs: Attributes;
  meta: Meta;
  position: Position;
  league: LeagueId;
  /** 0–1: how healthy the player was across the year. */
  health: number;
  clutch: number;
  rng: () => number;
  /**
   * Forces which half to simulate. Only a two-way player needs it — everyone
   * else is unambiguous from their position.
   */
  role?: 'batter' | 'pitcher';
}

export interface SeasonResult {
  line: StatLine;
  awards: string[];
  /** 0–1 quality score, reused for fame, contracts and hall-of-fame credit. */
  quality: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Playing time is the single biggest lever in the sim: a 中職-average player
 * dropped into 大聯盟 does not post bad numbers, they post *no* numbers,
 * because they never leave the bench.
 */
function playingTime(rating: number, baseline: number, meta: Meta, health: number): number {
  const edge = rating - baseline;
  // A logistic curve, not a straight line: a league-average player is a
  // regular, someone a little short is a platoon bat, and someone well short
  // never gets off the bench. A linear ramp made everyone a benchwarmer.
  const base = 1 / (1 + Math.exp(-(edge + 4) / 5));
  const condition = clamp(0.75 + meta.body / 250 - meta.fatigue / 320, 0.5, 1.12);
  return clamp(base * condition * health, 0.02, 1);
}

function simulateBatter(input: SeasonInput, pt: number): SeasonResult {
  const { attrs, league, rng, clutch } = input;
  const info = LEAGUES[league];
  // Playing time is a function of ability alone, so a player whose attributes
  // have plateaued posted byte-identical game and at-bat counts year after
  // year. Rest days, slumps and knocks make that variance real.
  const games = Math.min(info.games, Math.round(info.games * pt * (0.9 + rng() * 0.2)));
  const ab = Math.max(0, Math.round(games * (league === 'hs' ? 3.1 : 3.7)));

  const contactScore = attrs.contact * 0.75 + attrs.eye * 0.25;
  const rawAvg = clamp(
    0.235 + (contactScore - info.baseline) * 0.0038 + noise(rng, 0.028) * (2 - clutch),
    0.135,
    0.402,
  );
  const hits = Math.round(ab * rawAvg);
  const avg = ab > 0 ? hits / ab : 0;

  const hrRate = clamp(
    Math.pow(Math.max(attrs.power, 1) / 100, 2.3) * 0.085 * HR_SCALE[league] * (0.8 + rng() * 0.45),
    0,
    0.13,
  );
  const hr = Math.round(ab * hrRate);
  const rbi = Math.round(hr * 2.1 + hits * 0.42 * (0.85 + rng() * 0.35));
  const sb = Math.round(games * Math.pow(Math.max(attrs.speed, 1) / 100, 2.2) * 0.38 * (0.7 + rng() * 0.6));

  const obp = clamp(avg + 0.028 + attrs.eye * 0.0013, 0, 0.55);
  const slg = ab > 0 ? clamp(avg + (hr / ab) * 2.6 + attrs.power * 0.0011, 0, 0.95) : 0;

  const line: BatterLine = { kind: 'batter', games, ab, hits, hr, rbi, sb, avg, obp, slg };

  const ops = obp + slg;
  const qualified = ab >= info.games * 2.2;
  const quality = clamp((ops - 0.640) / 0.42, 0, 1) * clamp(pt * 1.4, 0, 1);

  const awards: string[] = [];
  if (qualified) {
    if (avg >= 0.330 && rng() < 0.35 + (avg - 0.330) * 6) awards.push('打擊王');
    if (hr >= 24 && rng() < 0.25 + (hr - 24) * 0.035) awards.push('全壘打王');
    if (rbi >= 90 && rng() < 0.22 + (rbi - 90) * 0.006) awards.push('打點王');
    if (sb >= 25 && rng() < 0.3) awards.push('盜壘王');
    if (attrs.fielding >= 78 && rng() < 0.25 + (attrs.fielding - 78) * 0.02) awards.push('金手套');
    if (ops >= 0.930 && rng() < 0.3 + (ops - 0.930) * 1.6) awards.push('年度 MVP');
    else if (ops >= 0.850 && rng() < 0.45) awards.push('最佳十人');
  }

  return { line, awards, quality };
}

function simulatePitcher(input: SeasonInput, pt: number): SeasonResult {
  const { attrs, league, rng, clutch } = input;
  const info = LEAGUES[league];
  const starter = attrs.stamina >= 52;

  const variance = 0.88 + rng() * 0.24;
  const games = starter
    ? Math.round((info.games / 6.4) * pt * variance)
    : Math.round(info.games * 0.45 * pt * variance);
  const ip = starter
    ? Math.round(games * (4.1 + attrs.stamina * 0.028) * 10) / 10
    : Math.round(games * 1.05 * 10) / 10;

  const stuff = attrs.velocity * 0.32 + attrs.control * 0.36 + attrs.breaking * 0.32;
  let era = 5.20 - (stuff - info.baseline) * 0.075 + noise(rng, 0.55) * (2 - clutch);
  if (!starter) era -= 0.35;
  era = clamp(era, 0.85, 9.5);

  const whip = clamp(1.46 - (stuff - info.baseline) * 0.014 + noise(rng, 0.12), 0.72, 2.3);
  const so = Math.round((ip * (5.6 + attrs.velocity * 0.055 + attrs.breaking * 0.045)) / 9);

  let wins = 0;
  let losses = 0;
  let saves = 0;
  if (starter) {
    const decisions = Math.round(games * 0.64);
    const winPct = clamp(0.5 + (4.3 - era) * 0.11 + noise(rng, 0.09), 0.12, 0.85);
    wins = Math.round(decisions * winPct);
    losses = Math.max(0, decisions - wins);
  } else {
    const closer = attrs.control >= 62 && attrs.guts >= 58 && rng() < 0.55;
    if (closer) saves = Math.round(games * (0.42 + rng() * 0.2) * clamp((4.5 - era) / 3, 0.15, 1));
    wins = Math.round(games * 0.09);
    losses = Math.round(games * 0.07);
  }

  const line: PitcherLine = {
    kind: 'pitcher',
    games,
    role: starter ? '先發' : '後援',
    ip,
    wins,
    losses,
    saves,
    so,
    era,
    whip,
  };

  const qualified = starter ? ip >= info.games * 0.85 : games >= info.games * 0.25;
  const quality = clamp((4.9 - era) / 3.4, 0, 1) * clamp(pt * 1.4, 0, 1);

  const awards: string[] = [];
  if (qualified) {
    if (era <= 2.60 && rng() < 0.35 + (2.60 - era) * 0.5) awards.push('防禦率王');
    if (wins >= 14 && rng() < 0.3 + (wins - 14) * 0.05) awards.push('勝投王');
    if (so >= 150 && rng() < 0.28 + (so - 150) * 0.003) awards.push('三振王');
    if (saves >= 25 && rng() < 0.45) awards.push('救援王');
    if (era <= 2.40 && ip >= info.games && rng() < 0.4) awards.push('年度 MVP');
    else if (era <= 3.10 && rng() < 0.4) awards.push('最佳十人');
  }

  return { line, awards, quality };
}

export function simulateSeason(input: SeasonInput): SeasonResult {
  const twoWay = IS_TWO_WAY[input.position];
  // A two-way player has to be told which half to play; defaulting them to
  // pitcher (which IS_PITCHER would do) would silently drop their bat.
  const asPitcher = input.role ? input.role === 'pitcher' : !twoWay && IS_PITCHER[input.position];

  let rating: number;
  if (twoWay) {
    const halves = halfOveralls(input.attrs);
    rating = asPitcher ? halves.pitch : halves.bat;
  } else {
    rating = overall(input.attrs, input.position);
  }

  const pt = playingTime(rating, LEAGUES[input.league].baseline, input.meta, input.health);
  return asPitcher ? simulatePitcher(input, pt) : simulateBatter(input, pt);
}

/**
 * A two-way player's two seasons. Each half is judged on its own rating — a
 * great arm does not get you at-bats — and both run at a reduced workload,
 * because the same body cannot carry a full rotation slot and an everyday
 * lineup spot. That tax is the cost of the route.
 */
export const TWO_WAY_WORKLOAD = 0.72;

export function simulateTwoWay(input: SeasonInput): {
  batting: SeasonResult;
  pitching: SeasonResult;
} {
  const { bat, pitch } = halfOveralls(input.attrs);
  const baseline = LEAGUES[input.league].baseline;
  const batPt = playingTime(bat, baseline, input.meta, input.health) * TWO_WAY_WORKLOAD;
  const pitchPt = playingTime(pitch, baseline, input.meta, input.health) * TWO_WAY_WORKLOAD;
  return {
    batting: simulateBatter({ ...input, role: 'batter' }, batPt),
    pitching: simulatePitcher({ ...input, role: 'pitcher' }, pitchPt),
  };
}

/**
 * A knockout tournament is a handful of games, and whoever is on the roster
 * plays all of them — so the counting stats are rebuilt from the games played
 * rather than scaled down from a season's playing time. Scaling by playing
 * time instead left high schoolers with four at-bats a summer.
 */
export function simulateTournament(input: SeasonInput, gamesPlayed: number): SeasonResult {
  const result = simulateSeason({ ...input, league: 'hs' });
  const games = Math.max(1, gamesPlayed);

  if (result.line.kind === 'batter') {
    const l = result.line;
    const ab = Math.max(3, Math.round(games * 3.6));
    const hrRate = l.ab > 0 ? l.hr / l.ab : 0;
    const sbRate = l.games > 0 ? l.sb / l.games : 0;
    l.games = games;
    l.ab = ab;
    l.hits = Math.round(ab * l.avg);
    l.avg = l.hits / ab;
    l.hr = Math.round(ab * hrRate);
    l.rbi = Math.round(l.hr * 2.1 + l.hits * 0.42);
    l.sb = Math.round(games * sbRate);
  } else {
    const l = result.line;
    const ip = Math.round(games * (l.role === '先發' ? 6.2 : 2.1) * 10) / 10;
    const kRate = l.ip > 0 ? l.so / l.ip : 0;
    l.games = games;
    l.ip = ip;
    l.so = Math.round(ip * kRate);
    l.wins = Math.round(games * 0.55);
    l.losses = Math.max(0, games - l.wins - Math.round(games * 0.25));
    l.saves = 0;
  }
  result.awards = [];
  return result;
}

export function describeLine(line: StatLine): string {
  if (line.kind === 'batter') {
    return `${line.games} 場 打率 ${line.avg.toFixed(3).replace(/^0/, '')}　${line.hr} 轟　${line.rbi} 打點　${line.sb} 盜`;
  }
  const record = line.role === '先發' ? `${line.wins}勝${line.losses}敗` : `${line.saves} 救援`;
  return `${line.games} 場 ${line.role}　${record}　防禦率 ${line.era.toFixed(2)}　${line.so} K`;
}
