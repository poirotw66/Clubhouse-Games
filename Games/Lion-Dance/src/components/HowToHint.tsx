import type { ReactElement } from 'react';
import type { Strings } from '../i18n';

interface HowToHintProps {
  s: Strings;
  visible: boolean;
  onDismiss: () => void;
}

/** Short animated diagram: which key = which leg + Q+P ↔ W+O rhythm. */
export function HowToHint({ s, visible, onDismiss }: HowToHintProps): ReactElement | null {
  if (!visible) return null;
  return (
    <div className="lion-run-hint" role="status">
      <div className="hint-lion" aria-hidden="true">
        <div className="hint-body">
          <span className="hint-key hint-fl is-a">Q</span>
          <span className="hint-key hint-fr is-b">W</span>
          <span className="hint-key hint-bl is-b">O</span>
          <span className="hint-key hint-br is-a">P</span>
        </div>
        <p className="hint-rhythm">{s.hintRhythm}</p>
      </div>
      <p className="hint-copy">{s.hintCopy}</p>
      <button type="button" className="lion-cta-ghost hint-dismiss" onClick={onDismiss}>
        {s.gotIt}
      </button>
    </div>
  );
}
