export type BoardThemeId = 'walnut' | 'obsidian' | 'mahogany';

export interface BoardTheme {
  id: BoardThemeId;
  name: string;
  tagline: string;
  darkSquare: string;
  lightSquare: string;
  darkSquareBorder: string;
  rimBg: string;
  rimBorder: string;
  rimAccent: string;
  blackPiece: {
    bg: string;
    border: string;
    ring: string;
    crown: string;
  };
  whitePiece: {
    bg: string;
    border: string;
    ring: string;
    crown: string;
  };
}

export const BOARD_THEMES: Record<BoardThemeId, BoardTheme> = {
  walnut: {
    id: 'walnut',
    name: '古典胡桃木',
    tagline: '北美胡桃實木 · 暖金楓木嵌格',
    darkSquare: 'linear-gradient(135deg, #78350f 0%, #451a03 100%)',
    lightSquare: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
    darkSquareBorder: 'rgba(120, 53, 15, 0.45)',
    rimBg: 'linear-gradient(180deg, #3d1b09 0%, #200d04 100%)',
    rimBorder: '#92400e',
    rimAccent: '#fbbf24',
    blackPiece: {
      bg: 'radial-gradient(circle at 35% 30%, #44403c 0%, #1c1917 75%, #0c0a09 100%)',
      border: '#78716c',
      ring: '#fbbf24',
      crown: '#fef08a',
    },
    whitePiece: {
      bg: 'radial-gradient(circle at 35% 30%, #ffffff 0%, #fef3c7 70%, #fde68a 100%)',
      border: '#f59e0b',
      ring: '#b45309',
      crown: '#b45309',
    },
  },
  obsidian: {
    id: 'obsidian',
    name: '黑曜象牙石',
    tagline: '極致黑曜石 · 天然象牙白冷調',
    darkSquare: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
    lightSquare: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
    darkSquareBorder: 'rgba(30, 41, 59, 0.5)',
    rimBg: 'linear-gradient(180deg, #18202c 0%, #0a0d14 100%)',
    rimBorder: '#475569',
    rimAccent: '#38bdf8',
    blackPiece: {
      bg: 'radial-gradient(circle at 35% 30%, #334155 0%, #0f172a 75%, #020617 100%)',
      border: '#64748b',
      ring: '#38bdf8',
      crown: '#7dd3fc',
    },
    whitePiece: {
      bg: 'radial-gradient(circle at 35% 30%, #ffffff 0%, #f8fafc 70%, #cbd5e1 100%)',
      border: '#94a3b8',
      ring: '#0284c7',
      crown: '#0369a1',
    },
  },
  mahogany: {
    id: 'mahogany',
    name: '皇室紫檀金',
    tagline: '宮廷深紅紫檀 · 金箔浮雕奢華',
    darkSquare: 'linear-gradient(135deg, #701a1e 0%, #450a0a 100%)',
    lightSquare: 'linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%)',
    darkSquareBorder: 'rgba(127, 29, 29, 0.45)',
    rimBg: 'linear-gradient(180deg, #36070a 0%, #1a0204 100%)',
    rimBorder: '#b91c1c',
    rimAccent: '#facc15',
    blackPiece: {
      bg: 'radial-gradient(circle at 35% 30%, #3f1214 0%, #1f0506 75%, #0c0203 100%)',
      border: '#991b1b',
      ring: '#facc15',
      crown: '#fef08a',
    },
    whitePiece: {
      bg: 'radial-gradient(circle at 35% 30%, #fffbeb 0%, #ffedd5 70%, #fdba74 100%)',
      border: '#ea580c',
      ring: '#c2410c',
      crown: '#9a3412',
    },
  },
};
