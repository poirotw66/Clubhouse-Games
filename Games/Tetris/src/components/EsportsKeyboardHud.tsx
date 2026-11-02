interface EsportsKeyboardHudProps {
  pressedKeys: Set<string>;
  className?: string;
}

interface KeycapDef {
  id: string;
  keys: string[];
  label: string;
  action: string;
  wide?: boolean;
  accent?: boolean;
}

const KEY_LAYOUT: KeycapDef[] = [
  { id: 'left', keys: ['ArrowLeft'], label: '←', action: '左移' },
  { id: 'down', keys: ['ArrowDown'], label: '↓', action: '軟降' },
  { id: 'right', keys: ['ArrowRight'], label: '→', action: '右移' },
  { id: 'rotCcw', keys: ['z', 'Z'], label: 'Z', action: '逆轉' },
  { id: 'rotCw', keys: ['x', 'X', 'ArrowUp'], label: 'X / ↑', action: '順轉' },
  { id: 'hardDrop', keys: [' '], label: 'SPACE', action: '瞬間硬降', wide: true, accent: true },
  { id: 'hold', keys: ['c', 'C', 'Shift'], label: 'C', action: '暫存' },
  { id: 'pause', keys: ['p', 'P'], label: 'P', action: '暫停' },
];

export function EsportsKeyboardHud({
  pressedKeys,
  className = '',
}: EsportsKeyboardHudProps) {
  return (
    <div
      className={`hidden md:flex items-center justify-center gap-1.5 p-2 rounded-xl bg-slate-950/70 border border-slate-800 backdrop-blur-sm select-none ${className}`}
      aria-label="電競鍵盤操作 HUD"
    >
      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        {KEY_LAYOUT.map((item) => {
          const isPressed = item.keys.some((k) => pressedKeys.has(k));
          const baseStyle = item.accent
            ? isPressed
              ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.8)] scale-95'
              : 'bg-cyan-950/60 text-cyan-200 border-cyan-700/80 hover:border-cyan-500'
            : isPressed
              ? 'bg-sky-500 text-slate-950 border-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.7)] scale-95'
              : 'bg-slate-900/90 text-slate-300 border-slate-700/80';

          return (
            <div
              key={item.id}
              className={`flex flex-col items-center justify-center px-2 py-1 rounded border transition-all duration-75 min-h-[38px] ${
                item.wide ? 'min-w-[70px]' : 'min-w-[42px]'
              } ${baseStyle}`}
            >
              <span className="font-mono font-bold text-xs leading-none">
                {item.label}
              </span>
              <span className="text-[9px] opacity-75 mt-0.5 leading-none">
                {item.action}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
