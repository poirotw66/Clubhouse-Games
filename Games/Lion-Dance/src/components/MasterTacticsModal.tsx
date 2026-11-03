import type { ReactElement } from 'react';
import type { Strings } from '../i18n';

interface MasterTacticsModalProps {
  open: boolean;
  onClose: () => void;
  s: Strings;
}

export function MasterTacticsModal({ open, onClose, s }: MasterTacticsModalProps): ReactElement | null {
  if (!open) return null;

  return (
    <div className="lion-tactics-modal" role="dialog" aria-modal="true" aria-label={s.masterTactics}>
      <div className="lion-tactics-card">
        <header className="lion-tactics-header">
          <span className="lion-tactics-tag">Clubhouse Games · Folklore Masterclass</span>
          <h2>{s.masterTactics}</h2>
          <p className="lion-tactics-sub">嶺南醒獅步法・樁上乾坤密傳</p>
        </header>

        <div className="lion-tactics-list">
          <article className="lion-tactic-item">
            <div className="lion-tactic-badge is-step">一 · 步步高升</div>
            <h3>{s.tacticStepHigh}</h3>
            <p className="lion-tactic-text">{s.tacticStepHighDesc}</p>
            <div className="lion-tactic-keys">
              <span className="lion-k-chip">Q + P</span>
              <span className="lion-k-sep">↔</span>
              <span className="lion-k-chip">W + O</span>
              <span className="lion-tactic-tip">鼓點連擊 ≥ 4 踏入「金獅狂熱 ×1.25」</span>
            </div>
          </article>

          <article className="lion-tactic-item">
            <div className="lion-tactic-badge is-balance">二 · 虛實騰挪</div>
            <h3>{s.tacticShift}</h3>
            <p className="lion-tactic-text">{s.tacticShiftDesc}</p>
            <div className="lion-tactic-keys">
              <span className="lion-k-chip">← 左微調</span>
              <span className="lion-k-chip">右微調 →</span>
              <span className="lion-tactic-tip">居中綠圈穩如泰山 · 遇傾斜立時回正</span>
            </div>
          </article>

          <article className="lion-tactic-item">
            <div className="lion-tactic-badge is-ribbon">三 · 採青吐福</div>
            <h3>{s.tacticRibbon}</h3>
            <p className="lion-tactic-text">{s.tacticRibbonDesc}</p>
            <div className="lion-tactic-keys">
              <span className="lion-k-chip">B 鍵</span>
              <span className="lion-tactic-tip">喜氣值滿 100% 慶典福花爆發 · 定身安步</span>
            </div>
          </article>
        </div>

        <button type="button" className="lion-cta lion-tactics-close" onClick={onClose}>
          {s.close}
        </button>
      </div>
    </div>
  );
}
