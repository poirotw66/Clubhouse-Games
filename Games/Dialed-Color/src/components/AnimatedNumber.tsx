import { useEffect, useState } from 'react';
import { animate } from 'motion/react';

export function AnimatedNumber({ value, duration = 1.35 }: { value: number; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const controls = animate(0, value, {
      duration,
      ease: 'easeOut',
      onUpdate: (latest) => setDisplayValue(Math.round(latest)),
    });
    return () => controls.stop();
  }, [value, duration]);

  return <span>{displayValue}</span>;
}
