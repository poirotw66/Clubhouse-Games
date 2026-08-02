import type { ReactElement } from 'react';

interface TouchControlsProps {
  visible: boolean;
  onLeft: () => void;
  onRight: () => void;
}

export function TouchControls({
  visible,
  onLeft,
  onRight,
}: TouchControlsProps): ReactElement | null {
  if (!visible) return null;
  return (
    <div className="touch-bar md:hidden" aria-label="觸控變道">
      <button
        type="button"
        className="touch-btn"
        aria-label="左切道"
        onPointerDown={(e) => {
          e.preventDefault();
          onLeft();
        }}
      >
        ←
      </button>
      <button
        type="button"
        className="touch-btn"
        aria-label="右切道"
        onPointerDown={(e) => {
          e.preventDefault();
          onRight();
        }}
      >
        →
      </button>
    </div>
  );
}
