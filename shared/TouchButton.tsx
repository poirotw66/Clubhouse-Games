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

/** Base size/touch rules when the caller supplies Tailwind/`className` styling. */
const classedBaseStyle: React.CSSProperties = {
  minWidth: 44,
  minHeight: 44,
  touchAction: 'manipulation',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  cursor: 'pointer',
  transition: 'filter 80ms ease, transform 80ms ease',
};

interface TouchButtonProps {
  label: React.ReactNode;
  ariaLabel: string;
  onPress?: () => void;
  onRelease?: () => void;
  onClick?: () => void;
  accent?: boolean;
  wide?: boolean;
  /** When set, skips the default slate chrome so callers can theme with CSS. */
  className?: string;
  disabled?: boolean;
  title?: string;
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
  className,
  disabled = false,
  title,
}: TouchButtonProps): React.ReactElement {
  const [pressed, setPressed] = useState(false);

  const style: React.CSSProperties = className
    ? {
        ...classedBaseStyle,
        ...(wide ? { minWidth: 88, flex: 1 } : null),
        ...(pressed && !disabled ? pressedStyle : null),
        ...(disabled ? { opacity: 0.4, cursor: 'not-allowed' } : null),
      }
    : {
        ...(accent ? accentStyle : buttonStyle),
        ...(wide ? { minWidth: 88, flex: 1 } : null),
        ...(pressed && !disabled ? pressedStyle : null),
        ...(disabled ? { opacity: 0.4, cursor: 'not-allowed' } : null),
      };

  const setDown = () => {
    if (disabled) return;
    setPressed(true);
  };
  const setUp = () => setPressed(false);
  const release = () => {
    setUp();
    if (!disabled) onRelease?.();
  };

  if (onClick && !onPress) {
    return (
      <button
        type="button"
        aria-label={ariaLabel}
        title={title}
        disabled={disabled}
        className={className}
        style={style}
        onClick={() => {
          if (!disabled) onClick();
        }}
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
      title={title}
      disabled={disabled}
      className={className}
      style={style}
      onPointerDown={(e) => {
        if (disabled) return;
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
