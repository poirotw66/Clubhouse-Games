import React from 'react';

const linkStyle: React.CSSProperties = {
  position: 'fixed',
  top: '12px',
  left: '12px',
  zIndex: 10000,
  display: 'inline-flex',
  alignItems: 'center',
  padding: '6px 12px',
  fontSize: '13px',
  fontWeight: 600,
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  color: 'inherit',
  textDecoration: 'none',
  background: 'rgba(128, 128, 128, 0.15)',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  border: '1px solid rgba(128, 128, 128, 0.25)',
  borderRadius: '999px',
  touchAction: 'manipulation',
};

export function BackToMenu(): React.ReactElement {
  return (
    <a href="../../" style={linkStyle} aria-label="Back to menu">
      ← 返回總覽
    </a>
  );
}
