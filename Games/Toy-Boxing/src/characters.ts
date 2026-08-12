// Toy boxer roster — distinct looks + light stat spreads for matchup feel.

export type CharacterId = 'bot' | 'bear' | 'bunny' | 'dino';

export interface CharacterDef {
  id: CharacterId;
  name: string;
  tagline: string;
  body: string;
  accent: string;
  glove: string;
  head: string;
  /** Multiplies jab/hook damage dealt. */
  power: number;
  /** Multiplies move speed. */
  speed: number;
  /** Starting / max health. */
  health: number;
  /** Stamina regen multiplier. */
  staminaRegen: number;
}

/** Vite base-aware portrait URL for select UI / HUD. */
export function characterPortraitUrl(id: CharacterId): string {
  const base = import.meta.env.BASE_URL ?? '/';
  return `${base}portraits/${id}.jpg`;
}

const ringImageCache = new Map<string, HTMLImageElement>();

function loadRingImage(path: string): HTMLImageElement {
  let img = ringImageCache.get(path);
  if (!img) {
    img = new Image();
    img.decoding = 'async';
    img.src = `${import.meta.env.BASE_URL ?? '/'}${path}`;
    ringImageCache.set(path, img);
  }
  return img;
}

export function ringSkyImage(): HTMLImageElement {
  return loadRingImage('ring-sky.jpg');
}

export function ringFloorImage(): HTMLImageElement {
  return loadRingImage('ring-floor.jpg');
}

export function fighterBodyImage(id: CharacterId): HTMLImageElement {
  return loadRingImage(`fighters/${id}.jpg`);
}

/** Soft full-body plate under procedural gloves / hit FX. */
export function drawFighterBody(
  ctx: CanvasRenderingContext2D,
  id: CharacterId,
  width: number,
  height: number,
): boolean {
  const img = fighterBodyImage(id);
  if (!img.complete || img.naturalWidth === 0) return false;
  ctx.drawImage(img, -width / 2, -height / 2 - 28, width, height + 36);
  return true;
}

/** Kick off fighter plate loads (safe to call often). */
export function preloadFighterBodies(): void {
  for (const id of ['bot', 'bear', 'bunny', 'dino'] as const) fighterBodyImage(id);
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'bot',
    name: '藍拳機器人',
    tagline: '均衡・穩定',
    body: '#3b82f6',
    accent: '#93c5fd',
    glove: '#1d4ed8',
    head: '#e2e8f0',
    power: 1,
    speed: 1,
    health: 100,
    staminaRegen: 1,
  },
  {
    id: 'bear',
    name: '紅絨熊仔',
    tagline: '厚血・重拳',
    body: '#b45309',
    accent: '#fbbf24',
    glove: '#7c2d12',
    head: '#fdba74',
    power: 1.2,
    speed: 0.85,
    health: 120,
    staminaRegen: 0.9,
  },
  {
    id: 'bunny',
    name: '閃電兔',
    tagline: '敏捷・連刺',
    body: '#f472b6',
    accent: '#fbcfe8',
    glove: '#db2777',
    head: '#ffe4e6',
    power: 0.9,
    speed: 1.25,
    health: 85,
    staminaRegen: 1.2,
  },
  {
    id: 'dino',
    name: '鐵拳恐龍',
    tagline: '爆擊・強壓',
    body: '#16a34a',
    accent: '#86efac',
    glove: '#14532d',
    head: '#bbf7d0',
    power: 1.15,
    speed: 0.95,
    health: 105,
    staminaRegen: 0.95,
  },
];

export function getCharacter(id: CharacterId): CharacterDef {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}

/** Pick a CPU opponent different from the player's toy when possible. */
export function pickCpuOpponent(playerId: CharacterId, prefer?: CharacterId): CharacterId {
  if (prefer && prefer !== playerId) return prefer;
  const others = CHARACTERS.filter((c) => c.id !== playerId);
  return others[Math.floor(Math.random() * others.length)]?.id ?? 'bear';
}
