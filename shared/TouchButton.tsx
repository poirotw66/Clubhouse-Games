import React, { useState } from 'react';

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
  transition: 'filter 80ms ease, transform 80ms ease',
};

const accentStyle: React.CSSProperties = {
  ...buttonStyle,
  background: '#b45309',
};

const pressedStyle: React.CSSProperties = {
  filter: 'brightness(0.82)',
  transform: 'scale(0.96)',
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
  const [pressed, setPressed] = useState(false);

  const style: React.CSSProperties = {
    ...(accent ? accentStyle : buttonStyle),
    ...(wide ? { minWidth: 88, flex: 1 } : null),
    ...(pressed ? pressedStyle : null),
  };

  const setDown = () => setPressed(true);
  const setUp = () => setPressed(false);
  const release = () => {
    setUp();
    onRelease?.();
  };

  if (onClick && !onPress) {
    return (
      <button
        type="button"
        aria-label={ariaLabel}
        style={style}
        onClick={onClick}
        onPointerDown={setDown}
        onPointerUp={setUp}
        onPointerLeave={setUp}
        onPointerCancel={setUp}
      >
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
        setDown();
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
