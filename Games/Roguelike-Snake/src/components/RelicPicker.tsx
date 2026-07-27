import { Dices, HeartPulse } from 'lucide-react';
import { HEAL_COST, REROLL_COST } from '../game/config';
import { RARITY_CLASS, RARITY_LABEL, RELIC_BY_ID } from '../game/relics';
import type { RelicId } from '../game/types';

interface RelicPickerProps {
  floor: number;
  choices: RelicId[];
  coins: number;
  hp: number;
  maxHp: number;
  picksLeft: number;
  onChoose: (id: RelicId) => void;
  onReroll: () => void;
  onHeal: () => void;
}

export function RelicPicker({
  floor,
  choices,
  coins,
  hp,
  maxHp,
  picksLeft,
  onChoose,
  onReroll,
  onHeal,
}: RelicPickerProps) {
  const canReroll = coins >= REROLL_COST;
  const canHeal = coins >= HEAL_COST && hp < maxHp;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="選擇遺物"
    >
      <div className="w-full max-w-2xl my-auto">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-amber-300 mb-1">
          第 {floor} 層通過
        </p>
        <h2 className="text-center text-2xl sm:text-3xl font-bold mb-1">選擇一件遺物</h2>
        <p className="text-center text-sm text-slate-400 mb-5">
          {picksLeft > 1 ? `還可挑選 ${picksLeft} 次 · ` : ''}遺物永久生效並可疊加
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          {choices.map((id) => {
            const relic = RELIC_BY_ID[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => onChoose(id)}
                className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-4 text-center transition-transform hover:-translate-y-1 hover:brightness-110 ${RARITY_CLASS[relic.rarity]}`}
              >
                <span className="text-3xl" aria-hidden>
                  {relic.icon}
                </span>
                <span className="text-base font-bold">{relic.name}</span>
                <span className="text-[11px] uppercase tracking-wider opacity-70">
                  {RARITY_LABEL[relic.rarity]}
                </span>
                <span className="text-xs leading-relaxed opacity-90">{relic.text}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <span className="text-sm text-amber-300">金幣 {coins}</span>
          <button
            type="button"
            onClick={onReroll}
            disabled={!canReroll}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800"
          >
            <Dices className="w-4 h-4" />
            重抽（{REROLL_COST} 金幣）
          </button>
          <button
            type="button"
            onClick={onHeal}
            disabled={!canHeal}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-700/70 bg-rose-950/60 px-4 py-2 text-sm font-semibold hover:bg-rose-900/60 disabled:opacity-40 disabled:hover:bg-rose-950/60"
          >
            <HeartPulse className="w-4 h-4" />
            治療 1 HP（{HEAL_COST} 金幣）
          </button>
        </div>
      </div>
    </div>
  );
}
