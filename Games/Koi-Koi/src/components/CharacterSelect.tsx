import React from 'react';
import { ANIMAL_CHARACTERS, getCharacterImageUrl } from '../characters';
import { getPersonality } from '../utils/personalities';
import { AvatarImage } from './AvatarImage';

interface CharacterSelectProps {
  selectedId: string;
  onSelect: (id: string) => void;
  compact?: boolean;
  /** Defaults to player cosmetic select; `opponent` shows style tags. */
  mode?: 'player' | 'opponent';
  title?: string;
}

export const CharacterSelect: React.FC<CharacterSelectProps> = ({
  selectedId,
  onSelect,
  compact = false,
  mode = 'player',
  title,
}) => {
  const heading = title ?? (mode === 'opponent' ? '選擇對手' : '選擇你的角色');
  const selectedPersonality = mode === 'opponent' ? getPersonality(selectedId) : null;

  return (
    <div className={compact ? 'w-full' : 'w-full max-w-3xl'}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-base sm:text-lg font-semibold text-gold">{heading}</h2>
        <p className="text-xs text-cream/50">共 {ANIMAL_CHARACTERS.length} 位</p>
      </div>
      <div
        className={`grid gap-2 sm:gap-3 ${
          compact ? 'grid-cols-5 sm:grid-cols-10' : 'grid-cols-2 sm:grid-cols-5'
        }`}
      >
        {ANIMAL_CHARACTERS.map(character => {
          const isSelected = selectedId === character.id;
          const personality = mode === 'opponent' ? getPersonality(character.id) : null;
          const tip =
            mode === 'opponent' && personality
              ? `${personality.styleTag} — ${personality.blurb}`
              : character.description;
          return (
            <button
              key={character.id}
              type="button"
              onClick={() => onSelect(character.id)}
              className={`group rounded-xl p-2 sm:p-3 text-left transition-all duration-200 border-2
                ${
                  isSelected
                    ? 'border-vermillion bg-vermillion/10 shadow-lg shadow-vermillion/20 scale-[1.02]'
                    : 'border-gold/20 bg-indigo-mid/40 hover:border-gold/50 hover:bg-indigo-mid/70'
                }`}
              aria-pressed={isSelected}
              title={tip}
            >
              <div
                className={`mx-auto mb-2 overflow-hidden rounded-full border-2 transition-all
                  ${compact ? 'w-10 h-10 sm:w-12 sm:h-12' : 'w-16 h-16 sm:w-20 sm:h-20'}
                  ${isSelected ? 'border-gold' : 'border-gold/30 group-hover:border-gold/60'}`}
              >
                <AvatarImage src={getCharacterImageUrl(character)} alt={character.name} />
              </div>
              {!compact && (
                <>
                  <p className="font-display text-sm font-semibold text-cream text-center truncate">
                    {character.name}
                  </p>
                  <p className="text-[10px] text-cream/50 text-center truncate">
                    {mode === 'opponent' && personality
                      ? personality.styleTag
                      : character.animal}
                  </p>
                </>
              )}
              {compact && (
                <p className="text-[9px] text-cream/70 text-center truncate hidden sm:block">
                  {character.name}
                </p>
              )}
            </button>
          );
        })}
      </div>
      {mode === 'opponent' && selectedPersonality && (
        <p className="mt-3 text-center text-xs text-gold/75 min-h-[2.5rem]">
          {selectedPersonality.blurb}
        </p>
      )}
    </div>
  );
};
