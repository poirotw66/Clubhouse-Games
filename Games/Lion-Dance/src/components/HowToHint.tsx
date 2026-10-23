import type { ReactElement } from 'react';
import type { Strings } from '../i18n';

interface HowToHintProps {
  s: Strings;
  visible: boolean;
}

/** Non-blocking bottom hint that fades after first successful steps. */
export function HowToHint({ s, visible }: HowToHintProps): ReactElement | null {
  if (!visible) return null;
  return (
    <p className="lion-bottom-hint" role="status">
      {s.hintCopy}
    </p>
  );
}
