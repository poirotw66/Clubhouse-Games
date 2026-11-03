import { AlertTriangle, BookOpen, Compass, Layers, ShieldAlert, Sparkles, Zap } from 'lucide-react';
import type { RiskLevel } from '../game/radar';

interface TacticalTickerProps {
  floor: number;
  layoutName: string;
  riskLevel: RiskLevel;
  reachableTiles: number;
  objective: string;
  pulseReady: boolean;
  onPulse: () => void;
  onOpenDossier: () => void;
  endless: boolean;
  ironsnake: boolean;
  daily: boolean;
}

export function TacticalTicker({
  floor,
  layoutName,
  riskLevel,
  reachableTiles,
  objective,
  pulseReady,
  onPulse,
  onOpenDossier,
  endless,
  ironsnake,
  daily,
}: TacticalTickerProps) {
  const riskColor =
    riskLevel === 'safe'
      ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-300'
      : riskLevel === 'warning'
        ? 'border-amber-500/60 bg-amber-950/50 text-amber-300'
        : 'border-rose-500/80 bg-rose-950/70 text-rose-200 animate-pulse';

  const riskLabel =
    riskLevel === 'safe'
      ? '路徑安全'
      : riskLevel === 'warning'
        ? '腹地緊縮'
        : '致命死角！';

  return (
    <div className="w-full max-w-xl mx-auto flex items-center justify-between gap-1.5 rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-xs lg:hidden">
      <div className="flex items-center gap-1.5">
        <span className="font-bold text-slate-100">
          第 {floor} 層
          {endless && <span className="text-amber-300 ml-1">無盡</span>}
          {ironsnake && <span className="text-rose-300 ml-1">鐵蛇</span>}
          {daily && <span className="text-emerald-300 ml-1">每日</span>}
        </span>
        <span className="text-[11px] text-slate-400">· {layoutName}</span>
      </div>

      <div className="flex items-center gap-1.5">
        {/* Risk Pill */}
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${riskColor}`}>
          <Compass className="w-3 h-3" />
          {riskLabel}
        </span>

        {/* Quick Pulse Button */}
        <button
          type="button"
          onClick={onPulse}
          disabled={!pulseReady}
          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 font-mono text-[11px] transition-all ${
            pulseReady
              ? 'border-emerald-500 bg-emerald-950/60 text-emerald-200 hover:bg-emerald-900/70'
              : 'border-slate-800 bg-slate-950 text-slate-600 opacity-50 cursor-not-allowed'
          }`}
          title="猛毒脈衝 (E)"
        >
          <Sparkles className="w-3 h-3 text-emerald-400" />
          <span>脈衝</span>
        </button>

        {/* Open Dossier Modal Button */}
        <button
          type="button"
          onClick={onOpenDossier}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700"
        >
          <BookOpen className="w-3 h-3 text-amber-400" />
          <span>情報</span>
        </button>
      </div>
    </div>
  );
}
