export interface LoreTable {
  headers: string[];
  rows: string[][];
}

export interface LoreSection {
  title: string;
  subtitle?: string;
  badge?: string;
  content?: string | string[];
  table?: LoreTable;
  bullets?: string[];
  sakuraiTip?: string;
}

export interface GameLoreDossier {
  gameId: string;
  gameTitle: string;
  gameSubtitle: string;
  badge: string;
  themeColor: 'emerald' | 'amber' | 'rose' | 'indigo' | 'cyan' | 'purple';
  culturalOrigin: {
    title: string;
    sections: LoreSection[];
  };
  rulesAndStrategy: {
    title: string;
    sections: LoreSection[];
  };
}
