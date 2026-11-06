import React, { useEffect, useRef, useState } from 'react';

const buttonStyle: React.CSSProperties = {
  minWidth: 44,
  minHeight: 44,
  padding: '0 14px',
  borderRadius: 8,
  border: '1px solid rgba(165, 243, 252, 0.28)',
  background: '#0f1a2c',
  color: '#ecfeff',
  fontWeight: 700,
  fontSize: 15,
  fontFamily: "'Chakra Petch', 'Noto Sans TC', system-ui, sans-serif",
  boxShadow: '0 0 18px rgba(45, 212, 191, 0.18)',
  touchAction: 'manipulation',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  cursor: 'pointer',
  transition: 'filter 80ms ease, transform 80ms ease, box-shadow 80ms ease',
};

const accentStyle: React.CSSProperties = {
  ...buttonStyle,
  background: '#2dd4bf',
  color: '#042f2e',
  border: '1px solid rgba(165, 243, 252, 0.55)',
  boxShadow: '0 0 24px rgba(45, 212, 191, 0.45)',
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
  const active = useRef(false);
  const releaseCallback = useRef(onRelease);
  releaseCallback.current = onRelease;

  const release = () => {
    setPressed(false);
    if (!active.current) return;
    active.current = false;
    releaseCallback.current?.();
  };

  useEffect(() => {
    const clear = () => {
      setPressed(false);
      if (!active.current) return;
      active.current = false;
      releaseCallback.current?.();
    };
    const visibility = () => { if (document.hidden) clear(); };
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', visibility);
      clear();
    };
  }, []);

  useEffect(() => {
    if (disabled) release();
  }, [disabled]);

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
        if (disabled || active.current || e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        active.current = true;
        setDown();
        onPress?.();
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onBlur={release}
      onKeyDown={(e) => {
        if ((e.key !== ' ' && e.key !== 'Enter') || e.ctrlKey || e.metaKey || e.altKey) return;
        e.preventDefault();
        if (disabled || active.current || e.repeat) return;
        active.current = true;
        setDown();
        onPress?.();
      }}
      onKeyUp={(e) => {
        if (e.key !== ' ' && e.key !== 'Enter') return;
        e.preventDefault();
        release();
      }}
    >
      {label}
    </button>
  );
}

export const touchControlsWrapClass =
  'mt-4 md:hidden flex flex-wrap justify-center gap-2 touch-manipulation select-none w-full max-w-md mx-auto';
