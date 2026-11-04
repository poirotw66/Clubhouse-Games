import { type Move } from '../utils/checkersLogic';

interface TrajectoryOverlayProps {
  size: number;
  activeMove: Move | null;
  previewMoves: Move[];
  is3D: boolean;
}

export function TrajectoryOverlay({
  size,
  activeMove,
  previewMoves,
}: TrajectoryOverlayProps) {
  // If no active move and no preview jumps, do not render
  const capturePreviews = previewMoves.filter((m) => m.path.length > 2);
  const displayMoves = activeMove ? [activeMove] : capturePreviews;

  if (displayMoves.length === 0) return null;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none z-20 overflow-visible"
      viewBox={`0 0 ${size * 100} ${size * 100}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        {/* Glow Filter for Golden Jump Arc */}
        <filter id="ck-arc-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#fbbf24" floodOpacity="0.8" />
        </filter>
        {/* Marker for Jump Arrowhead */}
        <marker
          id="ck-arrow-head"
          viewBox="0 0 10 10"
          refX="6"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 9 5 L 0 9 z" fill="#fde047" />
        </marker>
      </defs>

      {displayMoves.map((m, moveIdx) => {
        const isExecuting = activeMove !== null;
        const strokeColor = isExecuting ? '#fef08a' : '#f59e0b';
        const strokeWidth = isExecuting ? 14 : 9;

        return (
          <g key={moveIdx} opacity={isExecuting ? 0.95 : 0.75}>
            {/* Draw parabolic arcs between hops */}
            {m.path.map((pt, i) => {
              if (i === 0) return null;
              const prev = m.path[i - 1];
              const x1 = (prev[1] + 0.5) * 100;
              const y1 = (prev[0] + 0.5) * 100;
              const x2 = (pt[1] + 0.5) * 100;
              const y2 = (pt[0] + 0.5) * 100;

              // Arc midpoint lifted up for 3D flyover parabolic leap effect
              const midX = (x1 + x2) / 2;
              const midY = (y1 + y2) / 2 - 28;

              const pathData = `M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`;

              // Middle square coordinates where captured enemy piece sits
              const capR = (prev[0] + pt[0]) / 2;
              const capC = (prev[1] + pt[1]) / 2;
              const capX = (capC + 0.5) * 100;
              const capY = (capR + 0.5) * 100;

              return (
                <g key={i}>
                  {/* Glowing Arc Curve */}
                  <path
                    d={pathData}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={isExecuting ? undefined : '12 8'}
                    filter="url(#ck-arc-glow)"
                    markerEnd="url(#ck-arrow-head)"
                  />

                  {/* Crossed Blades Marker on Jumped Piece */}
                  <circle
                    cx={capX}
                    cy={capY}
                    r={18}
                    fill="rgba(225, 29, 72, 0.4)"
                    stroke="#f43f5e"
                    strokeWidth="3"
                  />
                  <text
                    x={capX}
                    y={capY + 6}
                    textAnchor="middle"
                    fill="#ffe4e6"
                    fontSize="18"
                    fontWeight="bold"
                  >
                    ⚔️
                  </text>

                  {/* Hop Step Number Badge (e.g. ①, ②) */}
                  <circle
                    cx={x2}
                    cy={y2}
                    r={16}
                    fill="#ca8a04"
                    stroke="#fef08a"
                    strokeWidth="2.5"
                  />
                  <text
                    x={x2}
                    y={y2 + 5}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="15"
                    fontWeight="800"
                  >
                    {i}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
