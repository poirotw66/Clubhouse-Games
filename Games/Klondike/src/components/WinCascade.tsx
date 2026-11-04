import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { CardType } from '../types';
import { klondikeAudio } from '../utils/klondikeAudio';
import { Sparkles } from 'lucide-react';

interface Props {
  active: boolean;
  foundations: CardType[][];
}

interface BouncingCard {
  suit: string;
  rank: string;
  color: 'red' | 'black';
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  isBouncing: boolean;
}

interface FireworkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  size: number;
}

export const WinCascade: React.FC<Props> = ({ active, foundations }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const [showCelebrationBadge, setShowCelebrationBadge] = useState(false);
  const fireworksRef = useRef<FireworkParticle[]>([]);

  // Spawn firework explosion
  const spawnFirework = useCallback((x: number, y: number) => {
    const colors = [
      '#fbbf24', // Amber gold
      '#f59e0b',
      '#ef4444', // Red
      '#10b981', // Emerald
      '#38bdf8', // Sky
      '#ec4899', // Pink
      '#a855f7', // Purple
      '#ffffff',
    ];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const particleCount = 28 + Math.floor(Math.random() * 20);

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.4;
      const speed = 2 + Math.random() * 5.5;
      fireworksRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        alpha: 1,
        life: 0,
        maxLife: 35 + Math.floor(Math.random() * 25),
        size: 2.5 + Math.random() * 2.5,
      });
    }
    klondikeAudio.playFireworkPop();
  }, []);

  useEffect(() => {
    if (!active) {
      setShowCelebrationBadge(false);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setShowCelebrationBadge(true);
      return;
    }

    // Trigger audio fanfare
    klondikeAudio.playVictoryFanfare();
    setShowCelebrationBadge(true);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle canvas sizing
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Collect all cards from foundation piles (total 52)
    const cardQueue: { suit: string; rank: string; color: 'red' | 'black'; pileIdx: number }[] = [];
    foundations.forEach((pile, pIdx) => {
      pile.forEach((card) => {
        cardQueue.push({
          suit: card.suit,
          rank: card.rank,
          color: card.color,
          pileIdx: pIdx,
        });
      });
    });

    const suitGlyphs: Record<string, string> = {
      hearts: '♥',
      diamonds: '♦',
      clubs: '♣',
      spades: '♠',
    };

    const cardW = Math.min(84, Math.max(54, width * 0.07));
    const cardH = cardW * 1.45;

    let activeBouncers: BouncingCard[] = [];
    let nextCardIndex = 0;
    let cardSpawnTimer = 0;
    let fireworkTimer = 0;

    const gravity = 0.65;
    const bounceRestitution = -0.82;

    const render = () => {
      // Semi-transparent wash for fireworks trails, but cards keep their classic trails
      fireworkTimer++;
      if (fireworkTimer % 45 === 0) {
        spawnFirework(
          width * 0.15 + Math.random() * width * 0.7,
          height * 0.15 + Math.random() * height * 0.35,
        );
      }

      // Spawn next card in cascade
      cardSpawnTimer++;
      if (cardSpawnTimer % 6 === 0 && nextCardIndex < cardQueue.length) {
        const item = cardQueue[nextCardIndex++];
        const startX = width * 0.5 + (item.pileIdx - 1.5) * (cardW + 14);
        const startY = 60;
        const vx = (Math.random() - 0.5) * 8 + (item.pileIdx >= 2 ? 2.5 : -2.5);
        const vy = -3 - Math.random() * 4;

        activeBouncers.push({
          suit: item.suit,
          rank: item.rank,
          color: item.color,
          x: startX,
          y: startY,
          vx,
          vy,
          width: cardW,
          height: cardH,
          isBouncing: true,
        });
      }

      // Update and draw bouncing cards
      for (let i = 0; i < activeBouncers.length; i++) {
        const b = activeBouncers[i];
        if (!b.isBouncing) continue;

        // Draw card stamp on canvas
        ctx.save();
        ctx.translate(b.x, b.y);

        // Gilded card border & shadow
        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 1.5;

        // Card base
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(0, 0, b.width, b.height, 8);
        } else {
          ctx.rect(0, 0, b.width, b.height);
        }
        ctx.fill();
        ctx.stroke();

        // Corner rank and suit
        ctx.fillStyle = b.color === 'red' ? '#dc2626' : '#111827';
        ctx.font = `bold ${Math.round(b.width * 0.22)}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(b.rank, 5, 4);

        const glyph = suitGlyphs[b.suit] || '♠';
        ctx.font = `${Math.round(b.width * 0.2)}px sans-serif`;
        ctx.fillText(glyph, 6, Math.round(b.width * 0.26));

        // Center suit watermark
        ctx.globalAlpha = 0.28;
        ctx.font = `${Math.round(b.width * 0.55)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(glyph, b.width / 2, b.height / 2);

        ctx.restore();

        // Physics step
        b.x += b.vx;
        b.y += b.vy;
        b.vy += gravity;

        // Floor bounce
        if (b.y + b.height >= height) {
          b.y = height - b.height;
          b.vy *= bounceRestitution;
          // Friction on floor
          b.vx *= 0.98;

          // Sound pop on hard bounce
          if (Math.abs(b.vy) > 3) {
            klondikeAudio.playCardSnap();
          }
        }

        // Out of screen bounds horizontally
        if (b.x < -b.width * 2 || b.x > width + b.width * 2) {
          b.isBouncing = false;
        }
      }

      // Draw and update fireworks
      for (let i = fireworksRef.current.length - 1; i >= 0; i--) {
        const p = fireworksRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08; // gravity on sparks
        p.vx *= 0.96;
        p.life++;
        p.alpha = Math.max(0, 1 - p.life / p.maxLife);

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        if (p.life >= p.maxLife) {
          fireworksRef.current.splice(i, 1);
        }
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [active, foundations, spawnFirework]);

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-[65] pointer-events-auto">
      {/* Interactive canvas for solitaire ribbon cascade + fireworks */}
      <canvas
        ref={canvasRef}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          spawnFirework(e.clientX - rect.left, e.clientY - rect.top);
        }}
        className="absolute inset-0 cursor-crosshair touch-manipulation"
      />

      {/* Vegas Neon Victory Ribbon Banner */}
      {showCelebrationBadge && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none flex flex-col items-center">
          <div className="px-5 py-2.5 rounded-2xl bg-black/75 backdrop-blur-md border-2 border-amber-400 shadow-[0_0_30px_rgba(251,191,36,0.65)] flex items-center gap-2.5 animate-bounce">
            <Sparkles className="text-amber-400 animate-spin" size={20} />
            <span className="text-base sm:text-lg font-black tracking-wider bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 bg-clip-text text-transparent font-serif">
              ✦ 維加斯盛典 · 萬牌奔湧 ✦
            </span>
            <Sparkles className="text-amber-400 animate-spin" size={20} />
          </div>
          <p className="text-xs text-amber-200/90 mt-1 font-mono tracking-wide drop-shadow-md">
            點擊螢幕任意處發射慶祝煙火
          </p>
        </div>
      )}
    </div>
  );
};
