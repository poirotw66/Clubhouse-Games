
export enum Color {
  RED = '#ef4444',
  BLUE = '#3b82f6',
  GREEN = '#22c55e',
  YELLOW = '#eab308',
  PURPLE = '#a855f7',
  ORANGE = '#f97316',
  CYAN = '#06b6d4',
  GRAY = '#9ca3af', // Placeholder for empty
}

export type GameMode = 'adventure' | 'quick_play';

export interface Layer {
  color: Color;
  isHidden: boolean; // If true, displays '?'
  id: string; // Unique ID for animation keys
}

export interface BottleData {
  id: string;
  layers: Layer[];
  capacity: number;
  isCompleted: boolean; // True if full and single color
}

export interface Order {
  id: string;
  color: Color; // The color required by the customer
  isCompleted: boolean;
  isLocked: boolean; // Only visible orders can be fulfilled
}

export interface GameState {
  mode: GameMode;
  level: number; // In quick play, this represents difficulty tier
  difficultyLabel?: string; // e.g. "Easy", "Hard"
  coins: number;
  bottles: BottleData[];
  orders: Order[]; // Replaces completedBottles. Tracks customer requests.
  selectedBottleId: string | null;
  history: { bottles: BottleData[], orders: Order[] }[];
  isWin: boolean;
  initialBoardState?: { bottles: BottleData[], orders: Order[] }; // To allow consistent restarts
}

// --- NEW: Daily Mission Types ---
export type MissionType = 'POUR' | 'WIN_LEVEL' | 'USE_ITEM';

export interface DailyMission {
  id: string;
  type: MissionType;
  descriptionKey: string;  // i18n key, e.g. 'mission.pour'
  target: number;     // Goal value (e.g., 50 pours)
  progress: number;   // Current value
  reward: number;     // Coins
  isClaimed: boolean;
}
