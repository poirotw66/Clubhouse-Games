import React from 'react';

export interface BackToMenuProps {
  /**
   * Optional callback to return to the current game's own title / main menu screen.
   * When provided, a dedicated "回到主選單" button is rendered alongside "返回總覽".
   */
  onBackToTitle?: () => void;
  /**
   * Alias for onBackToTitle for games where menu semantics are preferred.
   */
  onBackToMenu?: () => void;
  /** Label for the return-to-title action. Defaults to '回到主選單'. */
  titleLabel?: string;
  /** Label for the return-to-hub portal action. Defaults to '返回總覽'. */
  hubLabel?: string;
  /** Target href for the portal hub. Defaults to '../../'. */
  hubHref?: string;
  className?: string;
}

const CLASS = 'clubhouse-back-to-menu';

const CSS = `
.${CLASS} {
  position: fixed;
  top: 12px;
  left: 12px;
  z-index: 10000;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  pointer-events: none;
}
.${CLASS}__btn {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 8px 14px;
  font-size: 14px;
  font-weight: 700;
  font-family: 'Chakra Petch', 'Noto Sans TC', system-ui, sans-serif;
  border-radius: 0.45rem;
  touch-action: manipulation;
  transition: background-color 140ms ease, border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease;
  text-decoration: none;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
}
.${CLASS}__btn:active {
  transform: scale(0.97);
}
.${CLASS}__btn--title {
  color: #ecfeff;
  background: rgba(4, 12, 22, 0.92);
  border: 1px solid rgba(45, 212, 191, 0.55);
  box-shadow:
    0 0 0 1px rgba(45, 212, 191, 0.15),
    0 0 20px rgba(45, 212, 191, 0.3),
    inset 0 1px 0 rgba(165, 243, 252, 0.2);
}
.${CLASS}__btn--title:hover,
.${CLASS}__btn--title:focus-visible {
  background: rgba(13, 148, 136, 0.45);
  border-color: rgba(103, 232, 249, 0.85);
  box-shadow:
    0 0 0 1px rgba(45, 212, 191, 0.3),
    0 0 26px rgba(45, 212, 191, 0.5);
  outline: none;
}
.${CLASS}__btn--hub {
  color: #cbd5e1;
  background: rgba(4, 12, 22, 0.82);
  border: 1px solid rgba(148, 163, 184, 0.35);
  box-shadow: 0 0 14px rgba(0, 0, 0, 0.35);
}
.${CLASS}__btn--hub:hover,
.${CLASS}__btn--hub:focus-visible {
  color: #f8fafc;
  background: rgba(30, 41, 59, 0.65);
  border-color: rgba(148, 163, 184, 0.65);
  box-shadow: 0 0 20px rgba(148, 163, 184, 0.25);
  outline: none;
}
.${CLASS}__btn--solo {
  color: #ecfeff;
  background: rgba(4, 12, 22, 0.88);
  border: 1px solid rgba(45, 212, 191, 0.45);
  box-shadow:
    0 0 0 1px rgba(45, 212, 191, 0.12),
    0 0 22px rgba(45, 212, 191, 0.28),
    inset 0 1px 0 rgba(165, 243, 252, 0.16);
}
.${CLASS}__btn--solo:hover,
.${CLASS}__btn--solo:focus-visible {
  background: rgba(13, 148, 136, 0.35);
  border-color: rgba(103, 232, 249, 0.75);
  box-shadow:
    0 0 0 1px rgba(45, 212, 191, 0.28),
    0 0 28px rgba(45, 212, 191, 0.45),
    0 0 48px rgba(244, 114, 182, 0.18);
  outline: none;
}
@media (max-width: 640px) {
  #root > *:not(.${CLASS}) {
    padding-top: 3.5rem;
  }
  .${CLASS} {
    gap: 6px;
  }
  .${CLASS}__btn {
    min-height: 42px;
    padding: 6px 11px;
    font-size: 13px;
  }
}
`;

export function BackToMenu({
  onBackToTitle,
  onBackToMenu,
  titleLabel = '回到主選單',
  hubLabel = '返回總覽',
  hubHref = '../../',
  className = '',
}: BackToMenuProps = {}): React.ReactElement {
  const onReturn = onBackToTitle ?? onBackToMenu;

  return (
    <>
      <style>{CSS}</style>
      <nav className={`${CLASS}${className ? ` ${className}` : ''}`} aria-label="導航選單">
        {onReturn && (
          <button
            type="button"
            className={`${CLASS}__btn ${CLASS}__btn--title`}
            onClick={onReturn}
            aria-label={titleLabel}
          >
            <span aria-hidden="true">⌂</span>
            <span>{titleLabel}</span>
          </button>
        )}
        <a
          className={`${CLASS}__btn ${CLASS}__btn--hub${!onReturn ? ` ${CLASS}__btn--solo` : ''}`}
          href={hubHref}
          aria-label={hubLabel}
        >
          <span aria-hidden="true">←</span>
          <span>{hubLabel}</span>
        </a>
      </nav>
    </>
  );
}
