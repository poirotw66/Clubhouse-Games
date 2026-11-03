import type { ReactElement } from 'react';
import type { Strings } from '../i18n';

interface EsportsKeyGuideProps {
  s: Strings;
}

export function EsportsKeyGuide({ s }: EsportsKeyGuideProps): ReactElement {
  return (
    <div className="lion-esports-key-guide" aria-label={s.keyboardGuide}>
      <span className="lion-guide-badge">ESPORTS HUD</span>
      <div className="lion-guide-items">
        <span className="lion-guide-item">
          <kbd>Q</kbd>
          <kbd>W</kbd>
          <kbd>O</kbd>
          <kbd>P</kbd>
          <span className="lion-guide-label">控腳</span>
        </span>
        <span className="lion-guide-sep">·</span>
        <span className="lion-guide-item">
          <kbd>Space</kbd>
          <span className="lion-guide-label">躍樁</span>
        </span>
        <span className="lion-guide-sep">·</span>
        <span className="lion-guide-item">
          <kbd>←</kbd>
          <kbd>→</kbd>
          <span className="lion-guide-label">微調</span>
        </span>
        <span className="lion-guide-sep">·</span>
        <span className="lion-guide-item">
          <kbd>B</kbd>
          <span className="lion-guide-label">吐福</span>
        </span>
        <span className="lion-guide-sep">·</span>
        <span className="lion-guide-item">
          <kbd>R</kbd>
          <span className="lion-guide-label">起身</span>
        </span>
      </div>
    </div>
  );
}
