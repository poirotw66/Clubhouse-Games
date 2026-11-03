import type { ReactElement, ReactNode } from 'react';
import type { HudSnapshot } from '../engine/LionWorld';
import { formatDistance, formatTime, type Strings } from '../i18n';
import type { Lang } from '../engine/storage';
import { MobileTacticalBar } from './MobileTacticalBar';
import { PavilionCockpit } from './PavilionCockpit';

interface HudProps {
  hud: HudSnapshot;
  s: Strings;
  lang: Lang;
  /** Mute / help icons — top-left under the back button (never overlapping HUD cards). */
  tools?: ReactNode;
  onSpitRibbon?: () => void;
  onTrimLeft?: () => void;
  onTrimRight?: () => void;
  onLeap?: () => void;
  onOpenTactics?: () => void;
}

export function Hud({
  hud,
  s,
  lang,
  tools,
  onSpitRibbon,
  onTrimLeft,
  onTrimRight,
  onLeap,
  onOpenTactics,
}: HudProps): ReactElement {
  const dummyFn = () => {};
  return (
    <header className="lion-hud" aria-live="polite">
      <div className="lion-hud-left-col">
        {tools ? (
          <div className="lion-icon-tools" data-testid="lion-icon-tools">
            {tools}
          </div>
        ) : null}
        <div className="lion-hud-card lion-hud-left" data-testid="lion-hud-left">
          <span className="lion-stat-label">{s.distanceToGoal}</span>
          <span className="lion-stat-value">{formatDistance(hud.distanceToGoal, lang)}</span>
        </div>
      </div>
      <div className="lion-hud-card lion-hud-right" data-testid="lion-hud-right">
        <div className="lion-hud-stack">
          <span className="lion-stat-label">{s.time}</span>
          <span className={`lion-stat-value ${hud.elapsed > 75 ? 'is-urgent' : ''}`}>
            {formatTime(hud.elapsed)}
          </span>
        </div>
        <div className="lion-hud-stack lion-hud-falls">
          <span className="lion-stat-label">{s.falls}</span>
          <span className="lion-stat-value">{hud.fallCount}</span>
        </div>
      </div>

      {/* Mobile Top Tactical Bar */}
      <MobileTacticalBar
        hud={hud}
        s={s}
        onSpitRibbon={onSpitRibbon ?? dummyFn}
        onOpenTactics={onOpenTactics ?? dummyFn}
      />

      {/* Dual-wing Festival Pavilion Cockpit */}
      <PavilionCockpit
        hud={hud}
        s={s}
        lang={lang}
        onSpitRibbon={onSpitRibbon ?? dummyFn}
        onTrimLeft={onTrimLeft ?? dummyFn}
        onTrimRight={onTrimRight ?? dummyFn}
        onLeap={onLeap ?? dummyFn}
        onOpenTactics={onOpenTactics ?? dummyFn}
      />

      {hud.tipping && !hud.fallen && !hud.finished && (
        <p className="lion-tipping" aria-live="assertive">
          {s.tipping}
        </p>
      )}
      {hud.perfectFlash > 0.2 && (
        <p className="lion-perfect" aria-live="assertive">
          {s.perfect}
        </p>
      )}
      {hud.finished && <p className="lion-banner is-win">{s.finishHint}</p>}
    </header>
  );
}
