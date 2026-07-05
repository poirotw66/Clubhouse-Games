import React from 'react';

const buttonStyle: React.CSSProperties = {
  minWidth: 44,
  minHeight: 44,
  padding: '0 14px',
  borderRadius: 12,
  border: 'none',
  background: '#334155',
  color: '#fff',
  fontWeight: 700,
  fontSize: 15,
  touchAction: 'manipulation',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  cursor: 'pointer',
};

const accentStyle: React.CSSProperties = {
  ...buttonStyle,
  background: '#b45309',
};

interface TouchButtonProps {
  label: React.ReactNode;
  ariaLabel: string;
  onPress?: () => void;
  onRelease?: () => void;
  onClick?: () => void;
  accent?: boolean;
  wide?: boolean;
}

/** On-screen control for mobile; supports hold (onPress/onRelease) or tap (onClick). */
export function TouchButton({
  label,
  ariaLabel,
  onPress,
  onRelease,
  onClick,
  accent = false,
  wide = false,
}: TouchButtonProps): React.ReactElement {
  const style = {
    ...(accent ? accentStyle : buttonStyle),
    ...(wide ? { minWidth: 88, flex: 1 } : null),
  };

  const release = () => onRelease?.();

  if (onClick && !onPress) {
    return (
      <button type="button" aria-label={ariaLabel} style={style} onClick={onClick}>
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      style={style}
      onPointerDown={(e) => {
        e.preventDefault();
        onPress?.();
      }}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
    >
      {label}
    </button>
  );
}

export const touchControlsWrapClass =
  'mt-4 md:hidden flex flex-wrap justify-center gap-2 touch-manipulation select-none w-full max-w-md mx-auto';
