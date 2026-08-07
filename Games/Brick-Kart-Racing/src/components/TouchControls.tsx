import type {ReactNode} from 'react';
import {useCallback, useState} from 'react';

export type ControlKey = 'left' | 'right' | 'throttle' | 'brake' | 'drift' | 'item';

interface Props {
  onHold: (key: ControlKey, down: boolean) => void;
  showItem?: boolean;
}

function Pad({
  label,
  ariaLabel,
  onHold,
  keyName,
  className = '',
}: {
  label: ReactNode;
  ariaLabel: string;
  onHold: Props['onHold'];
  keyName: ControlKey;
  className?: string;
}) {
  const [pressed, setPressed] = useState(false);

  const setDown = useCallback(
    (down: boolean) => {
      setPressed(down);
      onHold(keyName, down);
    },
    [keyName, onHold],
  );

  const down = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDown(true);
  };
  const up = () => setDown(false);

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={pressed}
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={up}
      onLostPointerCapture={up}
      onContextMenu={(e) => e.preventDefault()}
      className={`grid select-none place-items-center rounded-2xl border-2 font-black backdrop-blur-sm transition-[transform,background-color,border-color,box-shadow] duration-75 ${
        pressed
          ? 'scale-95 border-amber-300 bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/40'
          : 'border-white/30 bg-slate-950/55 text-white'
      } ${className}`}
      style={{touchAction: 'none', minWidth: 56, minHeight: 56}}
    >
      {label}
    </button>
  );
}

/** On-screen driving controls; shown on coarse-pointer devices. */
export function TouchControls({onHold, showItem = true}: Props) {
  return (
    <div className="pointer-events-none absolute inset-0 lg:hidden">
      <div className="pointer-events-auto absolute bottom-5 left-4 flex gap-4">
        <Pad
          label="◀"
          ariaLabel="左轉"
          keyName="left"
          onHold={onHold}
          className="h-24 w-24 text-3xl"
        />
        <Pad
          label="▶"
          ariaLabel="右轉"
          keyName="right"
          onHold={onHold}
          className="h-24 w-24 text-3xl"
        />
      </div>
      <div className="pointer-events-auto absolute bottom-5 right-4 flex items-end gap-3">
        <div className="flex flex-col gap-3">
          {showItem && (
            <Pad
              label="道具"
              ariaLabel="使用道具"
              keyName="item"
              onHold={onHold}
              className="h-16 w-[4.5rem] text-sm"
            />
          )}
          <Pad
            label="煞車"
            ariaLabel="煞車"
            keyName="brake"
            onHold={onHold}
            className="h-16 w-[4.5rem] text-sm"
          />
        </div>
        <div className="flex flex-col gap-3">
          <Pad
            label="飄移"
            ariaLabel="飄移"
            keyName="drift"
            onHold={onHold}
            className="h-[4.5rem] w-24 text-base"
          />
          <Pad
            label="加速"
            ariaLabel="加速"
            keyName="throttle"
            onHold={onHold}
            className="h-24 w-24 text-lg"
          />
        </div>
      </div>
    </div>
  );
}
