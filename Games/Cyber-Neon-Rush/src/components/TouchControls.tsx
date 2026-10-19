import { useCallback, useState, type ReactElement } from 'react';

interface TouchControlsProps {
  visible: boolean;
  onLeft: () => void;
  onRight: () => void;
  onJump: () => void;
  onDash: () => void;
  dashReady: boolean;
}

type Side = 'left' | 'right' | 'jump' | 'dash' | null;

export function TouchControls({
  visible,
  onLeft,
  onRight,
  onJump,
  onDash,
  dashReady,
}: TouchControlsProps): ReactElement | null {
  const [pressed, setPressed] = useState<Side>(null);

  const press = useCallback((side: Side, action: () => void) => {
    setPressed(side);
    action();
  }, []);

  const release = useCallback(() => setPressed(null), []);

  if (!visible) return null;
  return (
    <div className="touch-bar md:hidden" aria-label="觸控操作">
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
      <div className="touch-mid">
        <button
          type="button"
          className={`touch-btn touch-btn-sm ${pressed === 'jump' ? 'is-pressed' : ''}`}
          aria-label="跳躍"
          onPointerDown={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLButtonElement).setPointerCapture?.(e.pointerId);
            press('jump', onJump);
          }}
          onPointerUp={release}
          onPointerCancel={release}
          onPointerLeave={release}
        >
          跳
        </button>
        <button
          type="button"
          className={`touch-btn touch-btn-sm ${pressed === 'dash' ? 'is-pressed' : ''} ${dashReady ? '' : 'is-cooling'}`}
          aria-label="衝刺"
          disabled={!dashReady}
          onPointerDown={(e) => {
            e.preventDefault();
            if (!dashReady) return;
            (e.currentTarget as HTMLButtonElement).setPointerCapture?.(e.pointerId);
            press('dash', onDash);
          }}
          onPointerUp={release}
          onPointerCancel={release}
          onPointerLeave={release}
        >
          衝
        </button>
      </div>
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
