import { useMemo } from 'react';
import type { Color } from '../types';
import { colorToCss } from '../colors.mjs';

interface ChromaStarMapProps {
  currentColor: Color;
  dailyColors?: Color[];
  recentScores?: number[];
  onApplyHue?: (hue: number) => void;
  streak?: number;
}

export function ChromaStarMap({
  currentColor,
  dailyColors = [],
  recentScores = [],
  onApplyHue,
  streak = 0,
}: ChromaStarMapProps) {
  // Constellation nodes on polar coordinates
  const constellationNodes = useMemo(() => {
    const list = dailyColors.length > 0 ? dailyColors : [currentColor];
    return list.map((c, i) => {
      const angle = (c.h * Math.PI) / 180;
      const r = 30 + (c.s / 100) * 45;
      const x = 100 + r * Math.cos(angle);
      const y = 100 + r * Math.sin(angle);
      const score = recentScores[i] ?? null;
      return { x, y, color: c, score, index: i };
    });
  }, [dailyColors, currentColor, recentScores]);

  // Harmonies relative to current color
  const harmonies = useMemo(() => {
    const h = currentColor.h;
    return [
      {
        name: '互補色',
        angle: '+180°',
        hue: (h + 180) % 360,
        desc: '視覺對比最強烈的共振波',
      },
      {
        name: '類似色',
        angle: '+30°',
        hue: (h + 30) % 360,
        desc: '相鄰和諧色，平滑自然',
      },
      {
        name: '三等分色',
        angle: '+120°',
        hue: (h + 120) % 360,
        desc: '均勻三角形光譜平衡',
      },
      {
        name: '分裂互補',
        angle: '+150°',
        hue: (h + 150) % 360,
        desc: '高張力同時兼顧柔和過渡',
      },
    ];
  }, [currentColor.h]);

  return (
    <div className="panel p-4 flex flex-col gap-3.5 bg-black/40 border border-white/10 rounded-2xl relative overflow-hidden backdrop-blur-md">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-fuchsia-400 animate-pulse" />
          <span className="font-mono text-xs font-semibold tracking-wider text-fuchsia-300">
            色彩星圖與共振錦囊
          </span>
        </div>
        <span className="font-mono text-[10px] text-white/50 tracking-widest">
          {streak > 0 ? `連勝 ${streak} 天` : 'HARMONY MATRIX'}
        </span>
      </div>

      {/* Constellation Star Map Canvas */}
      <div className="relative flex flex-col items-center">
        <svg viewBox="0 0 200 200" className="w-full max-w-[190px] aspect-square">
          <defs>
            <radialGradient id="starMapBg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#2e1065" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#090514" stopOpacity="0.8" />
            </radialGradient>
          </defs>

          {/* Star chart circular cosmic background */}
          <circle cx="100" cy="100" r="85" fill="url(#starMapBg)" stroke="rgba(217,70,239,0.2)" strokeWidth="1" />
          <circle cx="100" cy="100" r="58" fill="none" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
          <circle cx="100" cy="100" r="30" fill="none" stroke="rgba(255,255,255,0.06)" strokeDasharray="2 2" />

          {/* Subtle star dust background dots */}
          {[
            { x: 35, y: 45 },
            { x: 165, y: 55 },
            { x: 140, y: 150 },
            { x: 60, y: 160 },
            { x: 85, y: 35 },
            { x: 160, y: 120 },
          ].map((st, i) => (
            <circle key={i} cx={st.x} cy={st.y} r="1" fill="rgba(255,255,255,0.3)" />
          ))}

          {/* Constellation connection lines */}
          {constellationNodes.length > 1 && (
            <path
              d={constellationNodes
                .map((n, i) => `${i === 0 ? 'M' : 'L'} ${n.x} ${n.y}`)
                .join(' ') + (constellationNodes.length >= 3 ? ' Z' : '')}
              fill="rgba(217,70,239,0.08)"
              stroke="rgba(217,70,239,0.4)"
              strokeWidth="1.5"
              strokeDasharray="4 2"
            />
          )}

          {/* Stellar Nodes */}
          {constellationNodes.map((node) => (
            <g key={node.index} className="transition-transform duration-300">
              <circle
                cx={node.x}
                cy={node.y}
                r="7"
                fill="none"
                stroke={colorToCss(node.color)}
                strokeWidth="2"
                opacity="0.8"
              />
              <circle
                cx={node.x}
                cy={node.y}
                r="4.5"
                fill={colorToCss(node.color)}
              />
              <text
                x={node.x}
                y={node.y - 9}
                textAnchor="middle"
                fontSize="8"
                fill="#ffffff"
                fontFamily="ui-monospace, monospace"
                opacity="0.8"
              >
                {node.score != null ? `${node.score}分` : `H${node.color.h}`}
              </text>
            </g>
          ))}
        </svg>

        <span className="text-[10px] font-mono text-fuchsia-300/80 -mt-2">
          {dailyColors.length > 0 ? '每日挑戰色譜星圖軌道' : '當前色度引力星圖'}
        </span>
      </div>

      {/* Optical Harmony Resonator Guide */}
      <div className="space-y-1.5 text-left">
        <span className="text-[11px] font-mono font-semibold text-white/70 block">
          光波共振錦囊（點擊快速調諧色相）：
        </span>
        <div className="grid grid-cols-2 gap-2">
          {harmonies.map((harm) => (
            <button
              key={harm.name}
              type="button"
              onClick={() => onApplyHue?.(harm.hue)}
              className="flex items-center gap-2 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-fuchsia-500/30 transition-all text-left group"
              title={`${harm.name} (${harm.desc})`}
            >
              <span
                className="w-5 h-5 rounded-md shrink-0 border border-white/20 group-hover:scale-110 transition-transform"
                style={{ backgroundColor: `hsl(${harm.hue}, 80%, 55%)` }}
              />
              <div className="overflow-hidden">
                <div className="text-[11px] font-medium text-white/90 leading-tight">
                  {harm.name}
                </div>
                <div className="text-[9px] font-mono text-fuchsia-300/70">
                  {harm.hue}° ({harm.angle})
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Tactical Keyboard Guide */}
      <div className="bg-white/5 rounded-xl p-2.5 border border-white/5 text-[11px] font-mono text-left space-y-1 text-white/70">
        <div className="text-[10px] font-semibold text-cyan-300/90 uppercase tracking-wider mb-1 flex items-center justify-between">
          <span>鍵盤戰術控制矩陣</span>
          <span className="text-white/40">READY</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40">A / D 或 ← / →</span>
          <span className="text-white/90">微調滑桿（+Shift 大步進）</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40">W / S 或 ↑ / ↓</span>
          <span className="text-white/90">切換色相 / 飽和 / 明度</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40">Space / Enter</span>
          <span className="text-white/90">確認提交猜測</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40">H / P</span>
          <span className="text-white/90">長按透視目標色</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40">R</span>
          <span className="text-white/90">重新開始 / 刷新題目</span>
        </div>
      </div>
    </div>
  );
}
