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
  gap: 4px;
  min-height: 44px;
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 600;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  color: inherit;
  text-decoration: none;
  background: rgba(128, 128, 128, 0.15);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(128, 128, 128, 0.25);
  border-radius: 999px;
  touch-action: manipulation;
}
.${CLASS}:hover,
.${CLASS}:focus-visible {
  background: rgba(128, 128, 128, 0.3);
  border-color: rgba(128, 128, 128, 0.5);
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
