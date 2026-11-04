export type WorkshopTheme = 'royal-velvet' | 'obsidian-gold' | 'cyber-neon';

export interface ThemeConfig {
  id: WorkshopTheme;
  name: string;
  subtitle: string;
  description: string;
  primaryAccent: string;
  borderAccent: string;
  bgClass: string;
  feltStyle: React.CSSProperties;
  slotClass: string;
  cardTrimClass: string;
  cockpitClass: string;
  badgeClass: string;
  telemetryClass: string;
  buttonClass: string;
  activeButtonClass: string;
}

export const WORKSHOP_THEMES: Record<WorkshopTheme, ThemeConfig> = {
  'royal-velvet': {
    id: 'royal-velvet',
    name: '古典宮廷綠絨',
    subtitle: '皇家翡翠 · 燙金紋飾',
    description: '經典歐洲宮廷綠呢絨牌桌，搭配溫潤燙金鑲邊與深林晨露氛圍，沉浸於純粹的接龍藝術。',
    primaryAccent: '#10b981',
    borderAccent: '#d4af37',
    bgClass: 'theme-royal-velvet text-stone-100',
    feltStyle: {
      backgroundColor: '#072b1b',
      backgroundImage: `
        radial-gradient(circle at 50% 25%, rgba(16, 185, 129, 0.16) 0%, transparent 65%),
        radial-gradient(circle at 80% 80%, rgba(212, 175, 55, 0.08) 0%, transparent 50%),
        radial-gradient(circle at 20% 85%, rgba(6, 78, 59, 0.4) 0%, transparent 60%),
        linear-gradient(180deg, #0a3522 0%, #051e13 100%)
      `,
    },
    slotClass: 'border-emerald-600/35 bg-emerald-950/45 text-emerald-300 shadow-[inset_0_2px_6px_rgba(0,0,0,0.5)]',
    cardTrimClass: 'border-amber-200/40 shadow-[0_4px_14px_rgba(0,0,0,0.35)]',
    cockpitClass: 'bg-emerald-950/75 border-emerald-700/40 shadow-[0_8px_32px_rgba(0,0,0,0.45)] text-emerald-100 backdrop-blur-md',
    badgeClass: 'bg-emerald-900/80 text-amber-300 border-amber-500/40',
    telemetryClass: 'bg-emerald-900/60 border-emerald-600/35 text-emerald-200',
    buttonClass: 'bg-emerald-900/60 hover:bg-emerald-800/80 text-emerald-100 border-emerald-700/50',
    activeButtonClass: 'bg-amber-500 text-stone-950 border-amber-400 font-semibold shadow-[0_0_12px_rgba(245,158,11,0.4)]',
  },
  'obsidian-gold': {
    id: 'obsidian-gold',
    name: '黑曜黑金奢華',
    subtitle: '黑曜玄石 · 流金璀璨',
    description: '深邃高貴的黑曜石基調，淬鍊 24K 流光金線與低調奢華霧黑質感，專為接龍大師打造。',
    primaryAccent: '#f59e0b',
    borderAccent: '#fcd34d',
    bgClass: 'theme-obsidian-gold text-amber-50',
    feltStyle: {
      backgroundColor: '#0a0a0d',
      backgroundImage: `
        radial-gradient(circle at 50% 15%, rgba(245, 158, 11, 0.12) 0%, transparent 60%),
        radial-gradient(circle at 15% 75%, rgba(217, 119, 6, 0.08) 0%, transparent 50%),
        radial-gradient(circle at 85% 80%, rgba(251, 191, 36, 0.06) 0%, transparent 55%),
        linear-gradient(180deg, #121318 0%, #08080a 100%)
      `,
    },
    slotClass: 'border-amber-500/30 bg-neutral-900/80 text-amber-400 shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)]',
    cardTrimClass: 'border-amber-400/40 shadow-[0_4px_16px_rgba(0,0,0,0.55)]',
    cockpitClass: 'bg-neutral-950/80 border-amber-500/35 shadow-[0_8px_32px_rgba(0,0,0,0.6)] text-amber-100 backdrop-blur-md',
    badgeClass: 'bg-amber-950/80 text-amber-300 border-amber-500/50 shadow-[0_0_8px_rgba(245,158,11,0.25)]',
    telemetryClass: 'bg-neutral-900/70 border-amber-500/30 text-amber-200',
    buttonClass: 'bg-neutral-900/80 hover:bg-neutral-800/90 text-amber-200 border-amber-600/40',
    activeButtonClass: 'bg-gradient-to-r from-amber-500 to-yellow-400 text-stone-950 border-amber-300 font-bold shadow-[0_0_16px_rgba(251,191,36,0.45)]',
  },
  'cyber-neon': {
    id: 'cyber-neon',
    name: '未來霓虹夜光',
    subtitle: '賽博矩陣 · 電光幻彩',
    description: '賽博未來深夜矩陣，脈衝電光藍與霓虹品紅交相輝映，戰情儀表即時閃爍超能動態。',
    primaryAccent: '#06b6d4',
    borderAccent: '#ec4899',
    bgClass: 'theme-cyber-neon text-cyan-50',
    feltStyle: {
      backgroundColor: '#060714',
      backgroundImage: `
        radial-gradient(circle at 50% 10%, rgba(6, 182, 212, 0.2) 0%, transparent 60%),
        radial-gradient(circle at 10% 85%, rgba(236, 72, 153, 0.15) 0%, transparent 55%),
        radial-gradient(circle at 90% 75%, rgba(139, 92, 246, 0.16) 0%, transparent 55%),
        linear-gradient(180deg, #0b0d21 0%, #050610 100%)
      `,
    },
    slotClass: 'border-cyan-500/40 bg-slate-950/70 text-cyan-300 shadow-[inset_0_0_12px_rgba(6,182,212,0.25)]',
    cardTrimClass: 'border-cyan-400/50 shadow-[0_0_16px_rgba(6,182,212,0.3)]',
    cockpitClass: 'bg-slate-950/80 border-cyan-500/40 shadow-[0_8px_32px_rgba(6,182,212,0.25)] text-cyan-100 backdrop-blur-md',
    badgeClass: 'bg-cyan-950/80 text-cyan-300 border-cyan-400/50 shadow-[0_0_10px_rgba(6,182,212,0.3)]',
    telemetryClass: 'bg-slate-900/75 border-cyan-500/35 text-cyan-200',
    buttonClass: 'bg-slate-900/80 hover:bg-slate-800/90 text-cyan-200 border-cyan-600/40',
    activeButtonClass: 'bg-gradient-to-r from-cyan-400 to-fuchsia-500 text-slate-950 border-cyan-300 font-bold shadow-[0_0_18px_rgba(6,182,212,0.6)]',
  },
};

export const THEME_CYCLE: WorkshopTheme[] = ['royal-velvet', 'obsidian-gold', 'cyber-neon'];

export function getNextTheme(current: WorkshopTheme): WorkshopTheme {
  const idx = THEME_CYCLE.indexOf(current);
  return THEME_CYCLE[(idx + 1) % THEME_CYCLE.length] ?? 'royal-velvet';
}
