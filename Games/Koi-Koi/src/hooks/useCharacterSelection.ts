import {useCallback, useEffect, useState} from 'react';
import {
  ANIMAL_CHARACTERS,
  CHARACTER_STORAGE_KEY,
  DEFAULT_CHARACTER_ID,
  getCharacterById,
} from '../characters';

export function useCharacterSelection() {
  const [characterId, setCharacterIdState] = useState(DEFAULT_CHARACTER_ID);

  useEffect(() => {
    const saved = localStorage.getItem(CHARACTER_STORAGE_KEY);
    if (saved && ANIMAL_CHARACTERS.some(c => c.id === saved)) {
      setCharacterIdState(saved);
    }
  }, []);

  const setCharacterId = useCallback((id: string) => {
    if (!ANIMAL_CHARACTERS.some(c => c.id === id)) return;
    setCharacterIdState(id);
    localStorage.setItem(CHARACTER_STORAGE_KEY, id);
  }, []);

  const character = getCharacterById(characterId);

  return {characterId, character, setCharacterId};
}
