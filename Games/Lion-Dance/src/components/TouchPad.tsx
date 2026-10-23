import { useCallback, type ReactElement } from 'react';
import { TouchButton } from '@clubhouse/shared/TouchButton';
import {
  LEG_COLOR_CSS,
  LEG_KEY_LABEL,
  type LegId,
  type PlayMode,
} from '../engine/constants';
import type { Strings } from '../i18n';

interface TouchPadProps {
  visible: boolean;
  mode: PlayMode;
  s: Strings;
  held: Record<LegId, boolean>;
  showGetUp: boolean;
  combo: number;
  onBeatRatio: number;
  beatPulse: number;
  onLeg: (id: LegId, held: boolean) => void;
  onGetUp: () => void;
}

const ORDER_1P: readonly LegId[] = ['FL', 'FR', 'BL', 'BR'];
const ORDER_HEAD: readonly LegId[] = ['FL', 'FR'];
const ORDER_TAIL: readonly LegId[] = ['BL', 'BR'];

function legLabel(s: Strings, id: LegId): string {
  if (id === 'FL') return s.frontLeft;
  if (id === 'FR') return s.frontRight;
  if (id === 'BL') return s.backLeft;
  return s.backRight;
}

export function TouchPad({
  visible,
  mode,
  s,
  held,
  showGetUp,
  combo,
  onBeatRatio,
  beatPulse,
  onLeg,
  onGetUp,
}: TouchPadProps): ReactElement | null {
  const bind = useCallback(
    (id: LegId) => ({
      onPress: () => onLeg(id, true),
      onRelease: () => onLeg(id, false),
    }),
    [onLeg],
  );

  if (!visible) return null;

  const renderBtn = (id: LegId) => (
    <TouchButton
      key={id}
      className={`lion-leg-btn lion-leg-${id.toLowerCase()} ${held[id] ? 'is-lit' : ''}`}
      label={
        <span className="lion-leg-inner">
          <span className="lion-leg-key">{LEG_KEY_LABEL[id]}</span>
          <span className="lion-leg-name">{legLabel(s, id)}</span>
        </span>
      }
      ariaLabel={`${legLabel(s, id)} ${LEG_KEY_LABEL[id]}`}
      {...bind(id)}
    />
  );

  return (
    <div className={`touch-pad ${mode === '2p' ? 'touch-pad-2p' : ''}`} aria-label={s.touchAria}>
      <div className="lion-beat-chip" aria-hidden="true">
        <div
          className={`lion-beat-pulse ${beatPulse > 0.55 ? 'is-hot' : ''}`}
          style={{ transform: `scale(${0.85 + beatPulse * 0.35})` }}
        />
        <span className="lion-combo">
          {s.combo} {combo > 0 ? `×${combo}` : '—'}
        </span>
        <span className="lion-onbeat">
          {s.onBeat} {Math.round(onBeatRatio * 100)}%
        </span>
      </div>

      {showGetUp && (
        <TouchButton
          className="lion-touch-up"
          label={s.getUp}
          ariaLabel={s.getUp}
          onClick={onGetUp}
          accent
        />
      )}
      {mode === '2p' ? (
        <>
          <div className="touch-half touch-half-head">
            <p className="touch-half-label">{s.headLabel}</p>
            <div className="touch-half-row">{ORDER_HEAD.map(renderBtn)}</div>
          </div>
          <div className="touch-half touch-half-tail">
            <p className="touch-half-label">{s.tailLabel}</p>
            <div className="touch-half-row">{ORDER_TAIL.map(renderBtn)}</div>
          </div>
        </>
      ) : (
        <div className="touch-row">{ORDER_1P.map(renderBtn)}</div>
      )}
      <style>{`
        .lion-leg-fl { --leg-c: ${LEG_COLOR_CSS.FL}; }
        .lion-leg-fr { --leg-c: ${LEG_COLOR_CSS.FR}; }
        .lion-leg-bl { --leg-c: ${LEG_COLOR_CSS.BL}; }
        .lion-leg-br { --leg-c: ${LEG_COLOR_CSS.BR}; }
      `}</style>
    </div>
  );
}
