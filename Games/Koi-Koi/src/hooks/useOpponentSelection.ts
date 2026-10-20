import { useCallback, useEffect, useState } from 'react';
import { ANIMAL_CHARACTERS, getCharacterById } from '../characters';
import {
  DEFAULT_OPPONENT_ID,
  OPPONENT_STORAGE_KEY,
  getPersonality,
  resolveOpponentId,
} from '../utils/personalities';

export function useOpponentSelection() {
  const [opponentId, setOpponentIdState] = useState(DEFAULT_OPPONENT_ID);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(OPPONENT_STORAGE_KEY);
      setOpponentIdState(resolveOpponentId(saved));
    } catch {
      setOpponentIdState(DEFAULT_OPPONENT_ID);
    }
  }, []);

  const setOpponentId = useCallback((id: string) => {
    if (!ANIMAL_CHARACTERS.some(c => c.id === id)) return;
    setOpponentIdState(id);
    try {
      localStorage.setItem(OPPONENT_STORAGE_KEY, id);
    } catch {
      // private mode — keep in-memory only
    }
  }, []);

  const opponent = getCharacterById(opponentId);
  const personality = getPersonality(opponentId);

  return { opponentId, opponent, personality, setOpponentId };
}
