import { useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import type { Color } from '../types';
import { colorToCss } from '../colors.mjs';
import { ColorSlider } from './ColorSlider';

interface ChromaWheelDialProps {
  color: Color;
  targetColor?: Color;
  showTarget?: boolean;
  colorBlind?: boolean;
  onChange: (color: Color) => void;
  activeSlider: 'h' | 's' | 'l';
  onSelectSlider: (slider: 'h' | 's' | 'l') => void;
}

const QUICK_ANCHORS = [
  { label: '紅', hue: 0, css: 'hsl(0, 85%, 55%)' },
  { label: '黃', hue: 60, css: 'hsl(60, 85%, 50%)' },
  { label: '綠', hue: 120, css: 'hsl(120, 85%, 45%)' },
  { label: '青', hue: 180, css: 'hsl(180, 85%, 45%)' },
  { label: '藍', hue: 240, css: 'hsl(240, 85%, 55%)' },
  { label: '紫', hue: 300, css: 'hsl(300, 85%, 55%)' },
];

export function ChromaWheelDial({
  color,
  targetColor,
  showTarget = false,
  colorBlind = false,
  onChange,
  activeSlider,
  onSelectSlider,
}: ChromaWheelDialProps) {
  const wheelRef = useRef<HTMLDivElement | null>(null);

  // Handle circular wheel dragging for Hue
  const handleWheelPointer = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!wheelRef.current) return;
      const rect = wheelRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = e.clientX - centerX;
      const dy = e.clientY - centerY;

      // 0° at top (or 0° at right). In CSS hue: 0° is red.
      // If 0° is at top (12 o'clock), angle = atan2(dx, -dy) * 180 / PI
      // Standard CSS conic-gradient(from 0deg, red, yellow, green, cyan, blue, magenta, red):
      // 0deg is top in CSS conic-gradient!
      // Let's use 0deg = top:
      let deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
      if (deg < 0) deg += 360;

      onChange({
        ...color,
        h: Math.round(deg),
      });
      onSelectSlider('h');
    },
    [onChange, color, onSelectSlider],
  );

  // Quick adjust step
  const stepHue = (delta: number) => {
    const nextH = (((color.h + delta) % 360) + 360) % 360;
    onChange({ ...color, h: nextH });
    onSelectSlider('h');
  };

  const stepSat = (delta: number) => {
    const nextS = Math.max(0, Math.min(100, color.s + delta));
    onChange({ ...color, s: nextS });
    onSelectSlider('s');
  };

  const stepLight = (delta: number) => {
    const nextL = Math.max(0, Math.min(100, color.l + delta));
    onChange({ ...color, l: nextL });
    onSelectSlider('l');
  };

  // Thumb position on the circular ring (radius = 95px on a 220px box)
  const thumbRadius = 88;
  const rad = ((color.h - 90) * Math.PI) / 180; // offset if 0° is top, or 0° at right
  // If CSS conic gradient starts at 0deg (top):
  const topRad = (color.h * Math.PI) / 180;
  const thumbX = 110 + thumbRadius * Math.sin(topRad);
  const thumbY = 110 - thumbRadius * Math.cos(topRad);

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      {/* Central Interactive Chromatic Reactor Swatch with Outer Hue Ring */}
      <div
        ref={wheelRef}
        className="relative w-[220px] h-[220px] flex items-center justify-center select-none cursor-pointer touch-manipulation group"
        onPointerDown={handleWheelPointer}
        onPointerMove={(e) => {
          if (e.buttons === 1) handleWheelPointer(e);
        }}
      >
        {/* Outer 360° Conic Hue Gradient Ring */}
        <div
          className="absolute inset-0 rounded-full p-[14px] shadow-2xl transition-all duration-300 group-hover:scale-105"
          style={{
            background:
              'conic-gradient(from 0deg, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
            boxShadow: `0 0 35px hsl(${color.h}, 90%, 50%, 0.35), inset 0 0 15px rgba(0,0,0,0.8)`,
          }}
        >
          {/* Inner masking ring */}
          <div className="w-full h-full rounded-full bg-[#120f0d] p-3 flex items-center justify-center border border-white/10">
            {/* Core Swatch */}
            <motion.div
              animate={{
                backgroundColor: showTarget && targetColor ? colorToCss(targetColor) : colorToCss(color),
                scale: showTarget ? 1.05 : 1,
              }}
              transition={{ type: 'spring', stiffness: 350, damping: 26 }}
              className="w-full h-full rounded-full relative overflow-hidden shadow-inner border border-white/20 flex items-center justify-center"
            >
              {colorBlind && !showTarget && (
                <span className={`cb-pattern cb-pattern-${Math.floor(color.h / 60)}`} aria-hidden />
              )}
              {/* Subtle pulsing core ripple */}
              <div
                className="absolute inset-0 rounded-full pointer-events-none animate-ping opacity-20"
                style={{ backgroundColor: colorToCss(color) }}
              />
            </motion.div>
          </div>
        </div>

        {/* Circular Ring Thumb Marker */}
        <div
          className="absolute w-6 h-6 rounded-full border-2 border-white shadow-lg pointer-events-none transform -translate-x-1/2 -translate-y-1/2 z-20 flex items-center justify-center"
          style={{
            left: `${thumbX}px`,
            top: `${thumbY}px`,
            backgroundColor: `hsl(${color.h}, 100%, 50%)`,
            boxShadow: `0 0 12px #fff, 0 0 20px hsl(${color.h}, 100%, 50%)`,
          }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-white" />
        </div>
      </div>

      {/* Quick Swatch Label */}
      <div className="text-center -mt-2 space-y-1">
        <span className="text-xs font-semibold tracking-wider text-[var(--color-paper)]">
          {showTarget ? '目標色（光學透視提示中）' : '當前調諧猜測色'}
        </span>
        <div className="font-mono text-[11px] text-[var(--color-muted)]">
          {showTarget && targetColor
            ? `目標 H${targetColor.h}° S${targetColor.s}% L${targetColor.l}%`
            : `H${color.h}° S${color.s}% L${color.l}%`}
        </div>
      </div>

      {/* Quick Spectral Anchors (快速光譜靶點) */}
      <div className="flex items-center justify-center gap-1.5 w-full max-w-sm">
        {QUICK_ANCHORS.map((anchor) => (
          <button
            key={anchor.hue}
            type="button"
            onClick={() => {
              onChange({ ...color, h: anchor.hue });
              onSelectSlider('h');
            }}
            className={`flex-1 py-1 px-1.5 rounded-lg border text-xs font-mono font-medium flex items-center justify-center gap-1 transition-all ${
              Math.abs(color.h - anchor.hue) < 15 || Math.abs(color.h - (anchor.hue + 360)) < 15
                ? 'border-white text-white scale-105 bg-white/20 shadow-md'
                : 'border-white/10 text-white/60 hover:border-white/30 hover:bg-white/5'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: anchor.css }} />
            <span>{anchor.label}</span>
          </button>
        ))}
      </div>

      {/* Precision Sliders Panel */}
      <div className="panel p-5 sm:p-6 space-y-5 w-full max-w-md">
        {/* Hue Slider with Steppers */}
        <div
          className={`p-2 rounded-xl transition-all ${
            activeSlider === 'h' ? 'bg-white/5 ring-1 ring-cyan-400/40' : ''
          }`}
          onClick={() => onSelectSlider('h')}
        >
          <ColorSlider
            label="色相 (Hue)"
            min={0}
            max={360}
            value={color.h}
            suffix="°"
            onChange={(h) => onChange({ ...color, h })}
            gradient="linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)"
          />
          <div className="flex justify-between mt-2 font-mono text-[10px]">
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  stepHue(-10);
                }}
                className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white/80"
              >
                -10°
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  stepHue(-1);
                }}
                className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white/80"
              >
                -1°
              </button>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  stepHue(1);
                }}
                className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white/80"
              >
                +1°
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  stepHue(10);
                }}
                className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white/80"
              >
                +10°
              </button>
            </div>
          </div>
        </div>

        {/* Saturation Slider with Steppers */}
        <div
          className={`p-2 rounded-xl transition-all ${
            activeSlider === 's' ? 'bg-white/5 ring-1 ring-cyan-400/40' : ''
          }`}
          onClick={() => onSelectSlider('s')}
        >
          <ColorSlider
            label="飽和度 (Saturation)"
            min={0}
            max={100}
            value={color.s}
            suffix="%"
            onChange={(s) => onChange({ ...color, s })}
            gradient={`linear-gradient(to right, hsl(${color.h}, 0%, ${color.l}%), hsl(${color.h}, 100%, ${color.l}%))`}
          />
          <div className="flex justify-between mt-2 font-mono text-[10px]">
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  stepSat(-10);
                }}
                className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white/80"
              >
                -10%
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  stepSat(-1);
                }}
                className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white/80"
              >
                -1%
              </button>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  stepSat(1);
                }}
                className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white/80"
              >
                +1%
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  stepSat(10);
                }}
                className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white/80"
              >
                +10%
              </button>
            </div>
          </div>
        </div>

        {/* Lightness Slider with Steppers */}
        <div
          className={`p-2 rounded-xl transition-all ${
            activeSlider === 'l' ? 'bg-white/5 ring-1 ring-cyan-400/40' : ''
          }`}
          onClick={() => onSelectSlider('l')}
        >
          <ColorSlider
            label="明度 (Lightness)"
            min={0}
            max={100}
            value={color.l}
            suffix="%"
            onChange={(l) => onChange({ ...color, l })}
            gradient={`linear-gradient(to right, hsl(${color.h}, ${color.s}%, 0%), hsl(${color.h}, ${color.s}%, 50%), hsl(${color.h}, ${color.s}%, 100%))`}
          />
          <div className="flex justify-between mt-2 font-mono text-[10px]">
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  stepLight(-10);
                }}
                className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white/80"
              >
                -10%
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  stepLight(-1);
                }}
                className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white/80"
              >
                -1%
              </button>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  stepLight(1);
                }}
                className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white/80"
              >
                +1%
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  stepLight(10);
                }}
                className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white/80"
              >
                +10%
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
