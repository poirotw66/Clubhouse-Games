import {useEffect, useRef} from 'react';
import type {Brick} from '../engine/brickModel';
import {renderSheet} from '../engine/brickModel';

interface Props {
  bricks: Brick[];
  /** Pose in turns (0..1). 0 shows the model's back, 0.5 its front. */
  yaw?: number;
  size?: number;
  className?: string;
  /** Slowly rotate the model instead of holding a fixed pose. */
  spin?: boolean;
}

/**
 * Renders a brick model into a canvas for menus, reusing the same renderer the
 * in-race sprites use so the art style stays identical everywhere.
 */
export function BrickPreview({yaw = 0.62, size = 160, className, spin = false, bricks}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const px = Math.round(size * dpr);
    canvas.width = px;
    canvas.height = px;

    const angles = spin ? 32 : 1;
    const sheet = renderSheet(bricks, {
      size: px,
      scale: px * 0.085,
      anchorY: px * 0.86,
      angles,
      yawOffset: yaw * Math.PI * 2,
    });

    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    let frame = 0;

    const draw = () => {
      ctx.clearRect(0, 0, px, px);
      ctx.drawImage(sheet.frames[frame % sheet.frames.length], 0, 0);
    };
    draw();

    if (spin) {
      let last = performance.now();
      let hidden = document.hidden;
      const onVis = () => {
        hidden = document.hidden;
      };
      document.addEventListener('visibilitychange', onVis);
      const tick = (now: number) => {
        if (!hidden && now - last > 70) {
          frame = (frame + 1) % angles;
          last = now;
          draw();
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => {
        cancelAnimationFrame(raf);
        document.removeEventListener('visibilitychange', onVis);
      };
    }
    return () => cancelAnimationFrame(raf);
  }, [bricks, yaw, size, spin]);

  return <canvas ref={ref} className={className} style={{width: size, height: size}} aria-hidden />;
}
