import { useCallback, useState, type ReactElement } from 'react';

interface TouchControlsProps {
  visible: boolean;
  onLeft: () => void;
  onRight: () => void;
}

type Side = 'left' | 'right' | null;

export function TouchControls({
  visible,
  onLeft,
  onRight,
}: TouchControlsProps): ReactElement | null {
  const [pressed, setPressed] = useState<Side>(null);

  const press = useCallback((side: Side, action: () => void) => {
    setPressed(side);
    action();
  }, []);

  const release = useCallback(() => setPressed(null), []);

  if (!visible) return null;
  return (
    <div className="touch-bar md:hidden" aria-label="觸控變道">
      <button
        type="button"
        className={`touch-btn ${pressed === 'left' ? 'is-pressed' : ''}`}
        aria-label="左切道"
        onPointerDown={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLButtonElement).setPointerCapture?.(e.pointerId);
          press('left', onLeft);
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onPointerLeave={release}
      >
        ←
      </button>
      <button
        type="button"
        className={`touch-btn ${pressed === 'right' ? 'is-pressed' : ''}`}
        aria-label="右切道"
        onPointerDown={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLButtonElement).setPointerCapture?.(e.pointerId);
          press('right', onRight);
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onPointerLeave={release}
      >
        →
      </button>
    </div>
  );
}
