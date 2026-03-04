const STORAGE_KEY_COINS = 'mls_coins';

export const loadCoins = (fallback: number): number => {
  const saved = localStorage.getItem(STORAGE_KEY_COINS);
  return saved ? parseInt(saved, 10) : fallback;
};

export const saveCoins = (coins: number): void => {
  localStorage.setItem(STORAGE_KEY_COINS, coins.toString());
};
