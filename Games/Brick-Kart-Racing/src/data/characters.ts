export interface CharacterDef {
  id: string;
  name: string;
  blurb: string;
  /** Kart chassis colour. */
  body: string;
  /** Torso / helmet accent. */
  accent: string;
  /** Cap or hair piece. */
  cap: string;
  /** Multipliers applied to the base handling model. */
  topSpeed: number;
  accel: number;
  grip: number;
  /** Heavier karts win shunts but turn lazily. */
  weight: number;
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'red',
    name: '紅帽工程師',
    blurb: '各項均衡，最適合新手',
    body: '#d8352a',
    accent: '#f2f3f5',
    cap: '#d8352a',
    topSpeed: 1.0,
    accel: 1.0,
    grip: 1.0,
    weight: 1.0,
  },
  {
    id: 'green',
    name: '綠盔技師',
    blurb: '極速最高，但轉向遲鈍',
    body: '#2fa04a',
    accent: '#173d22',
    cap: '#8bd94f',
    topSpeed: 1.09,
    accel: 0.9,
    grip: 0.9,
    weight: 1.1,
  },
  {
    id: 'yellow',
    name: '黃冠公主',
    blurb: '操控與加速一流，極速略低',
    body: '#f4c024',
    accent: '#ff7ec4',
    cap: '#ffe066',
    topSpeed: 0.94,
    accel: 1.14,
    grip: 1.14,
    weight: 0.85,
  },
  {
    id: 'blue',
    name: '藍鎧武士',
    blurb: '重量級，撞擊佔上風',
    body: '#2f6fd8',
    accent: '#12315f',
    cap: '#9ec4ff',
    topSpeed: 1.03,
    accel: 0.95,
    grip: 0.97,
    weight: 1.25,
  },
];

export const DIFFICULTIES = [
  {id: 'easy', name: '簡單', cpuSpeed: 0.88, cpuSkill: 0.7, cpuItemDelay: 3.2},
  {id: 'normal', name: '普通', cpuSpeed: 0.96, cpuSkill: 0.85, cpuItemDelay: 2.0},
  {id: 'hard', name: '困難', cpuSpeed: 1.02, cpuSkill: 0.97, cpuItemDelay: 1.1},
] as const;

export type DifficultyId = (typeof DIFFICULTIES)[number]['id'];
