import { useEffect, useRef, type ReactElement } from 'react';

interface SpeedWarpCanvasProps {
  speed: number;
  boosting: boolean;
  dashing: boolean;
  fever: boolean;
  active: boolean;
}

interface Streak {
  x: number;
  y: number;
  angle: number;
  dist: number;
  speed: number;
  length: number;
  hue: string;
}

export function SpeedWarpCanvas({
  speed,
  boosting,
  dashing,
  fever,
  active,
}: SpeedWarpCanvasProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let width = 0;
    let height = 0;
    let centerX = 0;
    let centerY = 0;
    let maxDist = 0;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
      centerX = width * 0.5;
      centerY = height * 0.42; // Match horizon vanishing point
      maxDist = Math.hypot(centerX, centerY) * 1.05;
    };

    resize();
    window.addEventListener('resize', resize);

    const STREAK_COUNT = 36;
    const streaks: Streak[] = [];

    const getStreakColor = (): string => {
      if (fever) return '#f472b6'; // Neon magenta
      if (boosting) return '#facc15'; // Neon yellow / gold
      if (dashing) return '#a3e635'; // Neon lime
      return '#22d3ee'; // Neon cyan
    };

    for (let i = 0; i < STREAK_COUNT; i++) {
      streaks.push({
        x: 0,
        y: 0,
        angle: Math.random() * Math.PI * 2,
        dist: 40 + Math.random() * maxDist,
        speed: 1.5 + Math.random() * 2.2,
        length: 20 + Math.random() * 40,
        hue: getStreakColor(),
      });
    }

    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = Math.min(0.05, (time - lastTime) / 1000);
      lastTime = time;

      ctx.clearRect(0, 0, width, height);

      // Speed intensity factor
      const speedFactor = Math.max(0.6, speed / 30);
      const isHyper = boosting || dashing || fever;
      const speedMult = isHyper ? 3.2 : speedFactor;

      const activeColor = getStreakColor();

      ctx.lineWidth = isHyper ? 2.5 : 1.4;
      ctx.lineCap = 'round';

      for (const s of streaks) {
        s.dist += s.speed * speedMult * 280 * dt;
        if (s.dist > maxDist) {
          s.dist = 40 + Math.random() * 80;
          s.angle = Math.random() * Math.PI * 2;
          s.speed = 1.4 + Math.random() * 2.0;
          s.length = (isHyper ? 45 : 20) + Math.random() * (isHyper ? 75 : 35);
          s.hue = activeColor;
        }

        const cos = Math.cos(s.angle);
        const sin = Math.sin(s.angle);

        // Calculate start and end points of the radial streak
        const startX = centerX + cos * s.dist;
        const startY = centerY + sin * s.dist;
        const streakLen = s.length * (isHyper ? 2.2 : 1.2);
        const endX = centerX + cos * (s.dist + streakLen);
        const endY = centerY + sin * (s.dist + streakLen);

        // Alpha fades near center, peaks mid-flight, fades at outer screen edge
        const norm = s.dist / maxDist;
        const alpha = Math.sin(norm * Math.PI) * (isHyper ? 0.85 : 0.42);

        if (alpha > 0.02) {
          ctx.strokeStyle = s.hue;
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
          ctx.stroke();
        }
      }

      ctx.globalAlpha = 1;
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [active, speed, boosting, dashing, fever]);

  if (!active) return <></>;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[8400]"
      aria-hidden="true"
    />
  );
}
