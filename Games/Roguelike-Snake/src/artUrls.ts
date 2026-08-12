import type { RelicId } from './game/types';

/** Vite base-aware public path for relic icons. */
export function relicImageUrl(id: RelicId): string {
  return `${import.meta.env.BASE_URL}relics/${id}.jpg`;
}

export function enemyImageUrl(kind: 'wisp' | 'stalker' | 'spitter' | 'boss'): string {
  return `${import.meta.env.BASE_URL}enemies/${kind}.jpg`;
}
