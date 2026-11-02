import { useEffect, useRef, useState, type ReactElement } from 'react';
import type { HudSnapshot } from '../engine/scoreSystem';

interface HoloFloatiesProps {
  hud: HudSnapshot;
}

interface FloatieItem {
  id: number;
  badge: string;
  title: string;
  kind: string;
  color: string;
  glow: string;
}

const TOAST_INFO: Record<
  Exclude<HudSnapshot['toast'], null>,
  { badge: string; title: string; color: string; glow: string }
> = {
  near: {
    badge: '+150',
    title: '擦身閃避',
    color: '#22d3ee',
    glow: 'rgba(34, 211, 238, 0.85)',
  },
  perfect: {
    badge: '+300',
    title: '完美閃避',
    color: '#a3e635',
    glow: 'rgba(163, 230, 53, 0.95)',
  },
  boost: {
    badge: 'NITRO',
    title: '硝基加速',
    color: '#facc15',
    glow: 'rgba(250, 204, 21, 0.95)',
  },
  fever: {
    badge: 'FEVER ×2',
    title: '連擊狂熱',
    color: '#f472b6',
    glow: 'rgba(244, 114, 182, 1)',
  },
  shield: {
    badge: 'GUARD',
    title: '護盾啟動',
    color: '#38bdf8',
    glow: 'rgba(56, 189, 248, 0.9)',
  },
  magnet: {
    badge: 'MAGNET',
    title: '量子磁場',
    color: '#c084fc',
    glow: 'rgba(192, 132, 252, 0.9)',
  },
  multiplier: {
    badge: 'DOUBLE ×2',
    title: '得分加倍',
    color: '#fb923c',
    glow: 'rgba(251, 146, 60, 0.9)',
  },
  slowmo: {
    badge: 'SLOW-MO',
    title: '時空減速',
    color: '#4ade80',
    glow: 'rgba(74, 222, 128, 0.9)',
  },
  dash: {
    badge: 'WARP',
    title: '空間躍遷',
    color: '#22d3ee',
    glow: 'rgba(34, 211, 238, 0.9)',
  },
  jump: {
    badge: 'AIR',
    title: '凌空躍起',
    color: '#a5f3fc',
    glow: 'rgba(165, 243, 252, 0.8)',
  },
};

export function HoloFloaties({ hud }: HoloFloatiesProps): ReactElement {
  const [floaties, setFloaties] = useState<FloatieItem[]>([]);
  const lastToastRef = useRef<string | null>(null);
  const nextIdRef = useRef(1);

  useEffect(() => {
    if (!hud.toast || hud.toast === lastToastRef.current) return;
    lastToastRef.current = hud.toast;

    const info = TOAST_INFO[hud.toast];
    if (!info) return;

    const newItem: FloatieItem = {
      id: nextIdRef.current++,
      badge: info.badge,
      title: info.title,
      kind: hud.toast,
      color: info.color,
      glow: info.glow,
    };

    setFloaties((prev) => [...prev.slice(-3), newItem]);

    const timer = window.setTimeout(() => {
      setFloaties((prev) => prev.filter((item) => item.id !== newItem.id));
    }, 1200);

    return () => clearTimeout(timer);
  }, [hud.toast]);

  if (floaties.length === 0) return <></>;

  return (
    <div
      className="fixed left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2 z-[8600] pointer-events-none flex flex-col items-center gap-2"
      aria-hidden="true"
    >
      {floaties.map((f) => (
        <div
          key={f.id}
          className="holo-floater"
          style={{
            borderColor: f.color,
            boxShadow: `0 0 24px ${f.glow}, inset 0 0 12px ${f.glow}`,
          }}
        >
          <span
            className="holo-floater-badge font-display"
            style={{ color: f.color, textShadow: `0 0 10px ${f.glow}` }}
          >
            {f.badge}
          </span>
          <span className="holo-floater-title">{f.title}</span>
        </div>
      ))}
    </div>
  );
}
