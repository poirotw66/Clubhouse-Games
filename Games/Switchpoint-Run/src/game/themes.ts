/**
 * Unlockable route themes. Each theme has a distinct visual palette and a
 * small, deterministic hazard bias so unlocking one changes what you face —
 * not just the paint job.
 */

export type ThemeId = 'tunnel' | 'yard' | 'coast' | 'night';

export interface ThemePalette {
  ballastTop: string;
  ballastMid: string;
  ballastBot: string;
  rail: string;
  accent: string;
  hazard: string;
  previewPanel: string;
}

export interface RouteTheme {
  id: ThemeId;
  /** Traditional Chinese display name. */
  name: string;
  /** Short Traditional Chinese blurb. */
  blurb: string;
  /** Rail-bolt cost; 0 = free starter. */
  cost: number;
  palette: ThemePalette;
  /**
   * Extra density tax applied when a junction is placed under this theme.
   * Positive means denser branches (harder); negative means slightly sparser.
   * Applied as a filter preference in placeJunction, never invents new templates.
   */
  densityBias: number;
  /** Multiplier on trainPace — higher = the chase is hungrier. */
  trainPaceMul: number;
  /** Multiplier on SUPPLY_BUFFER_GAIN while on this theme. */
  supplyMul: number;
  /** Preferred obstacle kinds for visual remapping (cosmetic + near-miss juice). */
  preferredKinds: readonly ('hurdle' | 'beam' | 'wall')[];
}

export const DEFAULT_THEME_ID: ThemeId = 'tunnel';

export const THEMES: readonly RouteTheme[] = [
  {
    id: 'tunnel',
    name: '深隧幹線',
    blurb: '標準隧道軌道。熟悉的綠光與枕木節奏。',
    cost: 0,
    densityBias: 0,
    trainPaceMul: 1,
    supplyMul: 1,
    preferredKinds: ['hurdle', 'beam', 'wall'],
    palette: {
      ballastTop: '#0a1610',
      ballastMid: '#10241a',
      ballastBot: '#0c1a14',
      rail: '#e2e8f0',
      accent: '#34d399',
      hazard: '#f87171',
      previewPanel: 'rgba(4, 14, 10, 0.92)',
    },
  },
  {
    id: 'yard',
    name: '貨場岔區',
    blurb: '側牆更常見、列車稍急——扳道與換股道壓力更大。',
    cost: 200,
    densityBias: 1,
    trainPaceMul: 1.03,
    supplyMul: 0.95,
    preferredKinds: ['wall', 'hurdle', 'beam'],
    palette: {
      ballastTop: '#1a1208',
      ballastMid: '#2a1c0c',
      ballastBot: '#120c06',
      rail: '#fcd34d',
      accent: '#f59e0b',
      hazard: '#fb7185',
      previewPanel: 'rgba(20, 12, 4, 0.92)',
    },
  },
  {
    id: 'coast',
    name: '濱海高架',
    blurb: '高架梁較多、補給略豐——滑行節奏是關鍵。',
    cost: 280,
    densityBias: 0,
    trainPaceMul: 1.01,
    supplyMul: 1.15,
    preferredKinds: ['beam', 'hurdle', 'wall'],
    palette: {
      ballastTop: '#071820',
      ballastMid: '#0c2834',
      ballastBot: '#061018',
      rail: '#a5f3fc',
      accent: '#22d3ee',
      hazard: '#38bdf8',
      previewPanel: 'rgba(4, 16, 22, 0.92)',
    },
  },
  {
    id: 'night',
    name: '夜班特急',
    blurb: '夜色路線：列車更急、密度略升——高風險高倍率。',
    cost: 360,
    densityBias: 2,
    trainPaceMul: 1.06,
    supplyMul: 1.05,
    preferredKinds: ['hurdle', 'wall', 'beam'],
    palette: {
      ballastTop: '#080610',
      ballastMid: '#140c22',
      ballastBot: '#05040c',
      rail: '#e9d5ff',
      accent: '#c084fc',
      hazard: '#f472b6',
      previewPanel: 'rgba(10, 6, 18, 0.94)',
    },
  },
];

export function themeById(id: string): RouteTheme | undefined {
  return THEMES.find((t) => t.id === id);
}

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && THEMES.some((t) => t.id === value);
}
