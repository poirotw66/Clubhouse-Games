import React from 'react';

/**
 * Fixed "back to the menu" pill, rendered by every React game.
 *
 * It floats over the page, so on a narrow screen it used to land on top of the
 * game's own left-aligned <h1>. Rather than adjust sixteen headers, the styles
 * below reserve room for it at the top of whatever the app mounts — every game
 * mounts on #root, and Tailwind's preflight makes that padding eat into the
 * content box instead of growing it, so `min-h-screen` layouts are unaffected.
 */
const CLASS = 'clubhouse-back-to-menu';

const CSS = `
.${CLASS} {
  position: fixed;
  top: 12px;
  left: 12px;
  z-index: 10000;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 8px 14px;
  font-size: 14px;
  font-weight: 700;
  font-family: 'Chakra Petch', 'Noto Sans TC', system-ui, sans-serif;
  color: #ecfeff;
  text-decoration: none;
  background: rgba(4, 12, 22, 0.88);
  border: 1px solid rgba(45, 212, 191, 0.45);
  border-radius: 0.45rem;
  box-shadow:
    0 0 0 1px rgba(45, 212, 191, 0.12),
    0 0 22px rgba(45, 212, 191, 0.28),
    inset 0 1px 0 rgba(165, 243, 252, 0.16);
  touch-action: manipulation;
  transition: background-color 140ms ease, border-color 140ms ease, box-shadow 140ms ease;
}
.${CLASS}:hover,
.${CLASS}:focus-visible {
  background: rgba(13, 148, 136, 0.35);
  border-color: rgba(103, 232, 249, 0.75);
  box-shadow:
    0 0 0 1px rgba(45, 212, 191, 0.28),
    0 0 28px rgba(45, 212, 191, 0.45),
    0 0 48px rgba(244, 114, 182, 0.18);
  outline: none;
}
@media (max-width: 640px) {
  /* Keep the game's own content clear of the pill. The pill itself is excluded
     because a game that renders it inside a fragment makes it a #root child. */
  #root > *:not(.${CLASS}) {
    padding-top: 3.25rem;
  }
}
`;

export function BackToMenu(): React.ReactElement {
  return (
    <>
      <style>{CSS}</style>
      <a className={CLASS} href="../../" aria-label="返回總覽">
        <span aria-hidden="true">←</span>
        <span>返回總覽</span>
      </a>
    </>
  );
}
