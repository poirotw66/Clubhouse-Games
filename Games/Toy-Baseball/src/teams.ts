/**
 * League teams, ballparks, and named pitcher tendencies.
 * Pitch mix bias is readable over a few at-bats without spoiling each pitch.
 */

import type { PitcherProfile } from './pitching.ts';

export type TeamId = 'tigers' | 'bears' | 'lizards' | 'hares';

export type PitcherStyle = PitcherProfile['style'];

export interface ParkFactors {
  /** Multiplier on default fence distance (1 = standard). */
  fenceMul: number;
  /** Multiplier on gap openness when resolving fair balls. */
  gapMul: number;
  /** Short Traditional Chinese blurb for the park. */
  blurb: string;
}

export type { PitcherProfile };

export interface BatterProfile {
  name: string;
  /** Short scouting note shown on the season card. */
  habit: string;
}

export interface TeamDef {
  id: TeamId;
  name: string;
  shortName: string;
  /** Accent color for standings UI (CSS). */
  accent: string;
  parkName: string;
  park: ParkFactors;
  pitcher: PitcherProfile;
  batter: BatterProfile;
  /** Used when auto-simulating games the player does not play. */
  strength: number;
}

export const PLAYER_TEAM_ID: TeamId = 'tigers';

export const TEAMS: TeamDef[] = [
  {
    id: 'tigers',
    name: '玩具猛虎',
    shortName: '猛虎',
    accent: '#f59e0b',
    parkName: '絨毛本壘',
    park: {
      fenceMul: 1,
      gapMul: 1,
      blurb: '標準外野深度，基準球場',
    },
    pitcher: {
      name: '你（控球手）',
      style: 'balanced',
      weightMul: {
        fastball: 1,
        curve: 1,
        slider: 1,
        changeup: 1,
        sinker: 1,
        forkball: 1,
      },
      cornerBias: 0.35,
      chaseBait: 0.2,
      habit: '由你配球',
    },
    batter: {
      name: '你（打者）',
      habit: '時機與方向決定落點',
    },
    strength: 1,
  },
  {
    id: 'bears',
    name: '棉花熊隊',
    shortName: '熊隊',
    accent: '#f97316',
    parkName: '棉花谷',
    park: {
      fenceMul: 0.94,
      gapMul: 0.95,
      blurb: '外野偏淺，長打容易出牆',
    },
    pitcher: {
      name: '轟隆熊',
      style: 'power',
      weightMul: {
        fastball: 1.55,
        curve: 0.55,
        slider: 0.85,
        changeup: 0.45,
        sinker: 1.45,
        forkball: 0.5,
      },
      cornerBias: 0.25,
      chaseBait: 0.1,
      habit: '速球／伸卡為主，兩好球才偶丟滑球',
    },
    batter: {
      name: '重擊熊',
      habit: '愛追高熱，空檔要打進去才安',
    },
    strength: 1.05,
  },
  {
    id: 'lizards',
    name: '變色龍隊',
    shortName: '龍隊',
    accent: '#34d399',
    parkName: '翡翠灣',
    park: {
      fenceMul: 1.08,
      gapMul: 1.08,
      blurb: '外野深、空檔大，靠時機穿牆',
    },
    pitcher: {
      name: '軟彈蜥',
      style: 'finesse',
      weightMul: {
        fastball: 0.55,
        curve: 1.35,
        slider: 0.9,
        changeup: 1.5,
        sinker: 0.7,
        forkball: 1.4,
      },
      cornerBias: 0.4,
      chaseBait: 0.35,
      habit: '變速／曲／叉為主，很少連續速球',
    },
    batter: {
      name: '甩尾蜥',
      habit: '會等壞球，少追明顯外角',
    },
    strength: 1.0,
  },
  {
    id: 'hares',
    name: '誘敵兔隊',
    shortName: '兔隊',
    accent: '#a78bfa',
    parkName: '草帽丘',
    park: {
      fenceMul: 1.02,
      gapMul: 1.02,
      blurb: '略深右外野，滑球容易釣揮',
    },
    pitcher: {
      name: '假動作兔',
      style: 'trickster',
      weightMul: {
        fastball: 0.85,
        curve: 1.05,
        slider: 1.6,
        changeup: 1.15,
        sinker: 0.75,
        forkball: 0.95,
      },
      cornerBias: 0.62,
      chaseBait: 0.55,
      habit: '滑球＋角落引誘，領先球數常丟外角',
    },
    batter: {
      name: '急跳兔',
      habit: '愛揮第一球，可投壞球誘之',
    },
    strength: 0.98,
  },
];

export function getTeam(id: TeamId): TeamDef {
  return TEAMS.find((t) => t.id === id) ?? TEAMS[0];
}

export function opponentTeams(): TeamDef[] {
  return TEAMS.filter((t) => t.id !== PLAYER_TEAM_ID);
}

export function teamCount(): number {
  return TEAMS.length;
}

export function fenceDistanceForPark(park: ParkFactors, baseFence = 520): number {
  return Math.round(baseFence * park.fenceMul);
}
