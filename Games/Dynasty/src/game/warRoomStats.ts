import {
  BANKRUPTCY,
  EXPECTATIONS,
  LUXURY_RATE,
  SALARY_CAP,
  TRUST_DANGER,
} from './config';
import { humanTeam } from './engine';
import { ability } from './players';
import { farm, lineupStrength, payroll, pitchingStrength, starCount } from './roster';
import type { Expectation, GameState, Player, Position, SeasonRecord, Team } from './types';

export interface LiveDynastyRank {
  score: number;
  verdict: string;
  nextThreshold: number | null;
  pointsToNext: number;
  progressPercent: number;
  badgeColor: string;
}

export function calculateLiveDynastyScore(state: GameState): LiveDynastyRank {
  const titles = state.history.filter((h) => h.playoffResult === '總冠軍').length;
  const playoffs = state.history.filter((h) => h.playoffResult !== '未晉級').length;
  const totalNet = state.ledgers.reduce((sum, l) => sum + l.net, 0);
  const team = humanTeam(state);
  const homegrownStars = team.players.filter((p) => p.homegrown && ability(p) >= 70).length;

  const score = Math.max(
    0,
    Math.round(
      titles * 350 + playoffs * 90 + totalNet / 150 + homegrownStars * 60 + state.heat * 3,
    ),
  );

  let verdict: string;
  let nextThreshold: number | null;
  let pointsToNext = 0;
  let progressPercent = 100;
  let badgeColor = '#34d399';

  if (score >= 2800) {
    verdict = '王朝締造者';
    nextThreshold = null;
    badgeColor = '#f59e0b';
    progressPercent = 100;
  } else if (score >= 1900) {
    verdict = '名總管';
    nextThreshold = 2800;
    pointsToNext = 2800 - score;
    progressPercent = Math.min(100, Math.round(((score - 1900) / (2800 - 1900)) * 100));
    badgeColor = '#38bdf8';
  } else if (score >= 1100) {
    verdict = '稱職的經營者';
    nextThreshold = 1900;
    pointsToNext = 1900 - score;
    progressPercent = Math.min(100, Math.round(((score - 1100) / (1900 - 1100)) * 100));
    badgeColor = '#34d399';
  } else if (score >= 500) {
    verdict = '平淡的十年';
    nextThreshold = 1100;
    pointsToNext = 1100 - score;
    progressPercent = Math.min(100, Math.round(((score - 500) / (1100 - 500)) * 100));
    badgeColor = '#fbbf24';
  } else {
    verdict = '被時代淘汰';
    nextThreshold = 500;
    pointsToNext = 500 - score;
    progressPercent = Math.min(100, Math.round((score / 500) * 100));
    badgeColor = '#94a3b8';
  }

  return {
    score,
    verdict,
    nextThreshold,
    pointsToNext,
    progressPercent,
    badgeColor,
  };
}

export interface SeasonTimelineSlot {
  yearIndex: number;
  year: number;
  status: 'completed' | 'current' | 'future';
  record?: SeasonRecord;
  phaseLabel?: string;
  titles?: number;
}

export function getSeasonPhaseLabel(phase: GameState['phase'], block: number): string {
  switch (phase) {
    case 'board':
      return '季前・期望協商';
    case 'spring':
      return '春訓・預算分配';
    case 'block':
      return `例行賽・第 ${block}/4 區塊`;
    case 'deadline':
      return '季中・交易截止日';
    case 'draft':
      return '季後・新人選秀會';
    case 'contracts':
      return '季後・合約與自由球員';
    case 'budget':
      return '季後・下季預算規劃';
    case 'storyline':
      return '球團情境・球員物語';
    case 'over':
      return '任期屆滿結算';
    default:
      return '進行中';
  }
}

export function getTenureTimeline(state: GameState): SeasonTimelineSlot[] {
  const currentYearIndex = Math.min(state.seasonIndex, 9);
  const slots: SeasonTimelineSlot[] = [];

  for (let i = 0; i < 10; i++) {
    const slotYear = state.year - (state.seasonIndex - i);
    if (i < state.history.length) {
      slots.push({
        yearIndex: i,
        year: state.history[i].year,
        status: 'completed',
        record: state.history[i],
      });
    } else if (i === currentYearIndex && !state.over) {
      slots.push({
        yearIndex: i,
        year: state.year,
        status: 'current',
        phaseLabel: getSeasonPhaseLabel(state.phase, state.block),
      });
    } else {
      slots.push({
        yearIndex: i,
        year: slotYear,
        status: 'future',
      });
    }
  }

  return slots;
}

export interface BoardTrustStatus {
  trust: number;
  dangerYears: number;
  isDanger: boolean;
  threatLevel: 'danger' | 'warning' | 'healthy' | 'secure';
  threatDescription: string;
  expectation: Expectation;
  expectationDemand: string;
}

export function getBoardTrustStatus(state: GameState): BoardTrustStatus {
  const trust = state.board.trust;
  const dangerYears = state.board.dangerYears;
  const isDanger = trust < TRUST_DANGER;

  let threatLevel: BoardTrustStatus['threatLevel'];
  let threatDescription: string;

  if (isDanger) {
    threatLevel = 'danger';
    threatDescription =
      dangerYears > 0
        ? `🚨 解僱防線警報：連續 ${dangerYears + 1} 年信任過低，再低於 20 即遭解僱！`
        : '⚠️ 信任跌入危險區（<20），連續兩年將直接解僱！';
  } else if (trust < 40) {
    threatLevel = 'warning';
    threatDescription = '董事會缺乏耐心，若本季績效不佳恐跌入解僱危險區。';
  } else if (trust < 70) {
    threatLevel = 'healthy';
    threatDescription = '信任度平穩，依既定方針前進即可維持董事會支持。';
  } else {
    threatLevel = 'secure';
    threatDescription = '董事會極度信任，擁有充分的決策主導權與操作空間。';
  }

  const expInfo = EXPECTATIONS[state.board.expectation];

  return {
    trust,
    dangerYears,
    isDanger,
    threatLevel,
    threatDescription,
    expectation: state.board.expectation,
    expectationDemand: expInfo ? expInfo.demand : '',
  };
}

export interface SalaryCapRadar {
  payroll: number;
  cap: number;
  overCap: number;
  luxuryTax: number;
  cash: number;
  bankruptcyBuffer: number;
  usageRatio: number;
  isOverCap: boolean;
}

export function getSalaryCapRadar(state: GameState): SalaryCapRadar {
  const team = humanTeam(state);
  const majorPayroll = payroll(team);
  const cap = SALARY_CAP;
  const overCap = Math.max(0, majorPayroll - cap);
  const luxuryTax = Math.round(overCap * LUXURY_RATE);
  const cash = state.finance.cash;
  const bankruptcyBuffer = cash - BANKRUPTCY;
  const usageRatio = cap > 0 ? majorPayroll / cap : 1;

  return {
    payroll: majorPayroll,
    cap,
    overCap,
    luxuryTax,
    cash,
    bankruptcyBuffer,
    usageRatio,
    isOverCap: overCap > 0,
  };
}

export interface FarmDepthGroup {
  position: Position;
  label: string;
  count: number;
  prospects: Player[];
  averagePotentialHigh: number;
}

export function getFarmDepthChart(team: Team): {
  groups: FarmDepthGroup[];
  totalFarm: number;
  youngProspectsCount: number;
  protectedUnder21Count: number;
  highCeilingCount: number;
} {
  const farmHands = farm(team);
  const positions: Position[] = ['P', 'C', 'IF', 'OF'];
  const posLabels: Record<Position, string> = {
    P: '投手',
    C: '捕手',
    IF: '內野手',
    OF: '外野手',
  };

  const groups: FarmDepthGroup[] = positions.map((pos) => {
    const list = farmHands
      .filter((p) => p.position === pos)
      .sort((a, b) => b.band.high - a.band.high);
    const avgHigh =
      list.length > 0 ? list.reduce((sum, p) => sum + p.band.high, 0) / list.length : 0;
    return {
      position: pos,
      label: posLabels[pos],
      count: list.length,
      prospects: list,
      averagePotentialHigh: Math.round(avgHigh),
    };
  });

  const youngProspects = farmHands.filter((p) => p.age <= 23);
  const protectedUnder21 = farmHands.filter((p) => p.age <= 21);
  const highCeiling = farmHands.filter((p) => p.band.high >= 75);

  return {
    groups,
    totalFarm: farmHands.length,
    youngProspectsCount: youngProspects.length,
    protectedUnder21Count: protectedUnder21.length,
    highCeilingCount: highCeiling.length,
  };
}

export interface RosterStructure {
  youngCore: Player[];
  primeVeterans: Player[];
  experienced: Player[];
  agingRisk: Player[];
  expiringContracts: Player[];
  topStars: Player[];
  totalSalaries: number;
  lineupRating: number;
  pitchingRating: number;
  starTotal: number;
}

export function getRosterStructure(team: Team): RosterStructure {
  const majors = team.players.filter((p) => p.level === 'major');
  const youngCore = majors.filter((p) => p.age <= 23);
  const primeVeterans = majors.filter((p) => p.age >= 24 && p.age <= 28);
  const experienced = majors.filter((p) => p.age >= 29 && p.age <= 31);
  const agingRisk = majors.filter((p) => p.age >= 32);
  const expiringContracts = majors.filter((p) => p.years <= 1);
  const topStars = majors
    .filter((p) => ability(p) >= 70)
    .sort((a, b) => ability(b) - ability(a));

  return {
    youngCore,
    primeVeterans,
    experienced,
    agingRisk,
    expiringContracts,
    topStars,
    totalSalaries: payroll(team),
    lineupRating: lineupStrength(team),
    pitchingRating: pitchingStrength(team),
    starTotal: starCount(team),
  };
}
