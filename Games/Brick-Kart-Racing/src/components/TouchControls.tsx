import type {ReactNode} from 'react';

export type ControlKey = 'left' | 'right' | 'throttle' | 'brake' | 'drift' | 'item';

interface Props {
  onHold: (key: ControlKey, down: boolean) => void;
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
  const down = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    onHold(keyName, true);
  };
  const up = () => onHold(keyName, false);

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={up}
      onPointerLeave={up}
      onContextMenu={(e) => e.preventDefault()}
      className={`grid select-none place-items-center rounded-2xl border-2 border-white/25 bg-slate-950/45 font-black text-white backdrop-blur-sm active:bg-amber-400/70 active:text-slate-950 ${className}`}
      style={{touchAction: 'none'}}
    >
      {label}
    </button>
  );
}

/** On-screen driving controls; shown on coarse-pointer devices. */
export function TouchControls({onHold}: Props) {
  return (
    <div className="pointer-events-none absolute inset-0 lg:hidden">
      <div className="pointer-events-auto absolute bottom-4 left-4 flex gap-3">
        <Pad label="◀" ariaLabel="左轉" keyName="left" onHold={onHold} className="h-20 w-20 text-2xl" />
        <Pad label="▶" ariaLabel="右轉" keyName="right" onHold={onHold} className="h-20 w-20 text-2xl" />
      </div>
      <div className="pointer-events-auto absolute bottom-4 right-4 flex items-end gap-3">
        <div className="flex flex-col gap-3">
          <Pad label="道具" ariaLabel="使用道具" keyName="item" onHold={onHold} className="h-14 w-16 text-xs" />
          <Pad label="煞車" ariaLabel="煞車" keyName="brake" onHold={onHold} className="h-14 w-16 text-xs" />
        </div>
        <div className="flex flex-col gap-3">
          <Pad label="飄移" ariaLabel="飄移" keyName="drift" onHold={onHold} className="h-16 w-20 text-sm" />
          <Pad
            label="加速"
            ariaLabel="加速"
            keyName="throttle"
            onHold={onHold}
            className="h-20 w-20 text-base"
          />
        </div>
      </div>
    </div>
  );
}
