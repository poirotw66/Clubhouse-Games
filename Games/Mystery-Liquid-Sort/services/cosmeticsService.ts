/**
 * Coin-unlockable bottle frames and liquid surface styles.
 */
import type { BottleSkinId, LiquidSkinId } from '../types.ts';

const COSMETICS_STORAGE_KEY = 'mls-cosmetics-v1';

export type CosmeticCatalogEntry<T extends string> = {
  id: T;
  name: string;
  blurb: string;
  cost: number;
};

export const BOTTLE_SKINS: readonly CosmeticCatalogEntry<BottleSkinId>[] = [
  { id: 'classic', name: '經典玻璃', blurb: '預設瓶身', cost: 0 },
  { id: 'amber', name: '琥珀瓶', blurb: '暖色瓶緣', cost: 200 },
  { id: 'frost', name: '霧面冰瓶', blurb: '柔白霜感', cost: 320 },
  { id: 'obsidian', name: '曜石瓶', blurb: '深色內凹', cost: 450 },
];

export const LIQUID_SKINS: readonly CosmeticCatalogEntry<LiquidSkinId>[] = [
  { id: 'plain', name: '平光液面', blurb: '預設液面', cost: 0 },
  { id: 'shimmer', name: '微光波紋', blurb: '緩慢高光掃過', cost: 250 },
  { id: 'prism', name: '稜鏡折射', blurb: '邊緣色散', cost: 380 },
];

export type CosmeticsState = {
  unlockedBottles: BottleSkinId[];
  unlockedLiquids: LiquidSkinId[];
  equippedBottle: BottleSkinId;
  equippedLiquid: LiquidSkinId;
};

export const DEFAULT_COSMETICS: CosmeticsState = {
  unlockedBottles: ['classic'],
  unlockedLiquids: ['plain'],
  equippedBottle: 'classic',
  equippedLiquid: 'plain',
};

function isBottleId(v: unknown): v is BottleSkinId {
  return BOTTLE_SKINS.some((s) => s.id === v);
}

function isLiquidId(v: unknown): v is LiquidSkinId {
  return LIQUID_SKINS.some((s) => s.id === v);
}

export function loadCosmetics(): CosmeticsState {
  try {
    const raw = localStorage.getItem(COSMETICS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_COSMETICS, unlockedBottles: ['classic'], unlockedLiquids: ['plain'] };
    const parsed = JSON.parse(raw) as Partial<CosmeticsState>;
    const unlockedBottles: BottleSkinId[] = Array.isArray(parsed.unlockedBottles)
      ? parsed.unlockedBottles.filter(isBottleId)
      : (['classic'] as BottleSkinId[]);
    const unlockedLiquids: LiquidSkinId[] = Array.isArray(parsed.unlockedLiquids)
      ? parsed.unlockedLiquids.filter(isLiquidId)
      : (['plain'] as LiquidSkinId[]);
    if (!unlockedBottles.includes('classic')) unlockedBottles.unshift('classic');
    if (!unlockedLiquids.includes('plain')) unlockedLiquids.unshift('plain');
    const equippedBottle: BottleSkinId =
      isBottleId(parsed.equippedBottle) && unlockedBottles.includes(parsed.equippedBottle)
        ? parsed.equippedBottle
        : 'classic';
    const equippedLiquid: LiquidSkinId =
      isLiquidId(parsed.equippedLiquid) && unlockedLiquids.includes(parsed.equippedLiquid)
        ? parsed.equippedLiquid
        : 'plain';
    return { unlockedBottles, unlockedLiquids, equippedBottle, equippedLiquid };
  } catch {
    return {
      ...DEFAULT_COSMETICS,
      unlockedBottles: ['classic'] as BottleSkinId[],
      unlockedLiquids: ['plain'] as LiquidSkinId[],
    };
  }
}

export function saveCosmetics(state: CosmeticsState): void {
  try {
    localStorage.setItem(COSMETICS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* private mode */
  }
}

export type UnlockResult = {
  state: CosmeticsState;
  coins: number;
  ok: boolean;
  reason?: string;
};

export function unlockBottleSkin(state: CosmeticsState, id: BottleSkinId, coins: number): UnlockResult {
  const entry = BOTTLE_SKINS.find((s) => s.id === id);
  if (!entry) return { state, coins, ok: false, reason: 'unknown' };
  if (state.unlockedBottles.includes(id)) {
    return { state: { ...state, equippedBottle: id }, coins, ok: true };
  }
  if (coins < entry.cost) return { state, coins, ok: false, reason: 'funds' };
  const next: CosmeticsState = {
    ...state,
    unlockedBottles: [...state.unlockedBottles, id],
    equippedBottle: id,
  };
  saveCosmetics(next);
  return { state: next, coins: coins - entry.cost, ok: true };
}

export function unlockLiquidSkin(state: CosmeticsState, id: LiquidSkinId, coins: number): UnlockResult {
  const entry = LIQUID_SKINS.find((s) => s.id === id);
  if (!entry) return { state, coins, ok: false, reason: 'unknown' };
  if (state.unlockedLiquids.includes(id)) {
    return { state: { ...state, equippedLiquid: id }, coins, ok: true };
  }
  if (coins < entry.cost) return { state, coins, ok: false, reason: 'funds' };
  const next: CosmeticsState = {
    ...state,
    unlockedLiquids: [...state.unlockedLiquids, id],
    equippedLiquid: id,
  };
  saveCosmetics(next);
  return { state: next, coins: coins - entry.cost, ok: true };
}

export function equipBottleSkin(state: CosmeticsState, id: BottleSkinId): CosmeticsState {
  if (!state.unlockedBottles.includes(id)) return state;
  const next = { ...state, equippedBottle: id };
  saveCosmetics(next);
  return next;
}

export function equipLiquidSkin(state: CosmeticsState, id: LiquidSkinId): CosmeticsState {
  if (!state.unlockedLiquids.includes(id)) return state;
  const next = { ...state, equippedLiquid: id };
  saveCosmetics(next);
  return next;
}
