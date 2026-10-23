import { useCallback, type ReactElement } from 'react';
import { TouchButton } from '@clubhouse/shared/TouchButton';
import type { LegId, PlayMode } from '../engine/constants';
import type { Strings } from '../i18n';

interface TouchPadProps {
  visible: boolean;
  mode: PlayMode;
  s: Strings;
  onLeg: (id: LegId, held: boolean) => void;
  onGetUp: () => void;
}

export function TouchPad({ visible, mode, s, onLeg, onGetUp }: TouchPadProps): ReactElement | null {
  const bind = useCallback(
    (id: LegId) => ({
      onPress: () => onLeg(id, true),
      onRelease: () => onLeg(id, false),
    }),
    [onLeg],
  );

  if (!visible) return null;

  if (mode === '2p') {
    return (
      <div className="touch-pad touch-pad-2p" aria-label={s.touchAria}>
        <div className="touch-half touch-half-head">
          <p className="touch-half-label">{s.headLabel}</p>
          <div className="touch-half-row">
            <TouchButton className="lion-touch" label={s.frontLeft} ariaLabel={s.frontLeft} {...bind('FL')} />
            <TouchButton className="lion-touch" label={s.frontRight} ariaLabel={s.frontRight} {...bind('FR')} />
          </div>
        </div>
        <TouchButton
          className="lion-touch lion-touch-up"
          label={s.getUp}
          ariaLabel={s.getUp}
          onClick={onGetUp}
          accent
        />
        <div className="touch-half touch-half-tail">
          <p className="touch-half-label">{s.tailLabel}</p>
          <div className="touch-half-row">
            <TouchButton className="lion-touch" label={s.backLeft} ariaLabel={s.backLeft} {...bind('BL')} />
            <TouchButton className="lion-touch" label={s.backRight} ariaLabel={s.backRight} {...bind('BR')} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="touch-pad" aria-label={s.touchAria}>
      <div className="touch-col">
        <TouchButton className="lion-touch" label={s.frontLeft} ariaLabel={s.frontLeft} {...bind('FL')} />
        <TouchButton className="lion-touch" label={s.backLeft} ariaLabel={s.backLeft} {...bind('BL')} />
      </div>
      <TouchButton
        className="lion-touch lion-touch-up"
        label={s.getUp}
        ariaLabel={s.getUp}
        onClick={onGetUp}
        accent
      />
      <div className="touch-col">
        <TouchButton className="lion-touch" label={s.frontRight} ariaLabel={s.frontRight} {...bind('FR')} />
        <TouchButton className="lion-touch" label={s.backRight} ariaLabel={s.backRight} {...bind('BR')} />
      </div>
    </div>
  );
}
