import { TETROMINO_COLOR, tetrominoBlockUrl, getTrimmedShape } from '../utils/tetrisLogic';
import type { TetrominoType } from '../utils/tetrisLogic';

interface PieceIconProps {
  type: TetrominoType;
  /** Cell size in px. */
  cell?: number;
}

/**
 * A tetromino drawn as its actual shape. Used by both Hold and Next so the two
 * previews stay identical — Hold used to show the bare letter instead.
 */
export function PieceIcon({ type, cell = 12 }: PieceIconProps) {
  const shape = getTrimmedShape(type);
  const color = TETROMINO_COLOR[type];
  const tile = {
    backgroundImage: `url(${tetrominoBlockUrl(type)})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };

  return (
    <div
      className="grid gap-[2px]"
      style={{ gridTemplateColumns: `repeat(${shape[0]?.length ?? 0}, ${cell}px)` }}
      role="img"
      aria-label={`${type} 方塊`}
    >
      {shape.flatMap((row, r) =>
        row.map((filled, c) => (
          <div
            key={`${r}-${c}`}
            className={`rounded-[2px] ${filled ? color : 'bg-transparent'}`}
            style={filled ? { width: cell, height: cell, ...tile } : { width: cell, height: cell }}
          />
        )),
      )}
    </div>
  );
}
