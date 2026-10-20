import React, { useEffect } from 'react';
import { achievementById } from '../game/achievements';

interface Props {
  ids: string[];
  onDismiss: () => void;
}

/** Brief unlock notice; auto-dismisses so it never blocks the board. */
export function AchievementToast({ ids, onDismiss }: Props): React.ReactElement | null {
  useEffect(() => {
    if (ids.length === 0) return;
    const timer = window.setTimeout(onDismiss, 4200);
    return () => window.clearTimeout(timer);
  }, [ids, onDismiss]);

  if (ids.length === 0) return null;

  const first = achievementById(ids[0]);
  const extra = ids.length - 1;

  return (
    <div
      className="ec-toast"
      role="status"
      aria-live="polite"
      onClick={onDismiss}
    >
      <p className="text-[10px] font-bold tracking-[0.25em] text-amber-300/90">成就解鎖</p>
      <p className="mt-1 text-sm font-black text-slate-50">{first?.name ?? ids[0]}</p>
      <p className="mt-0.5 text-xs text-slate-300">{first?.blurb}</p>
      {extra > 0 && (
        <p className="mt-2 text-[11px] text-slate-400">還有另外 {extra} 項一併解鎖</p>
      )}
    </div>
  );
}
