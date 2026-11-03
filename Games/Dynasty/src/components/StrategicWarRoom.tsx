import React from 'react';
import { EXPECTATIONS, formatMoney, grade, gradeColor } from '../game/config';
import { humanTeam } from '../game/engine';
import { ability } from '../game/players';
import type { GameState } from '../game/types';
import {
  getBoardTrustStatus,
  getFarmDepthChart,
  getSalaryCapRadar,
  getTenureTimeline,
} from '../game/warRoomStats';

interface Props {
  state: GameState;
  className?: string;
}

export function StrategicWarRoom({ state, className = '' }: Props): React.ReactElement {
  const team = humanTeam(state);
  const timeline = getTenureTimeline(state);
  const trustStatus = getBoardTrustStatus(state);
  const capRadar = getSalaryCapRadar(state);
  const farmChart = getFarmDepthChart(team);

  return (
    <aside className={`flex flex-col gap-4 ${className}`} aria-label="球團戰略情報沙盤">
      {/* 1. 十年王朝戰略沙盤 */}
      <section className="dy-card p-4 border border-emerald-500/25 shadow-lg bg-slate-900/85">
        <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className="text-xs font-black tracking-wider uppercase text-emerald-300">
              十年王朝戰略沙盤
            </h2>
          </div>
          <span className="font-mono text-[11px] font-bold text-slate-400">
            {Math.min(state.seasonIndex + 1, 10)} / 10 年
          </span>
        </div>

        <p className="mt-2 text-[11px] text-slate-400">
          全任期戰略軌跡：即時追蹤每季戰績、季後賽戰果與董事會檢核。
        </p>

        {/* 10-Year Timeline Grid */}
        <div className="mt-3 grid grid-cols-5 gap-1.5 sm:grid-cols-5">
          {timeline.map((slot) => {
            const isCompleted = slot.status === 'completed' && slot.record;
            const isCurrent = slot.status === 'current';
            const isFuture = slot.status === 'future';

            let borderClass = 'border-slate-800 bg-slate-900/50 text-slate-600';
            let statusPill = '未開始';
            let pillColor = 'text-slate-600 bg-slate-800/40';

            if (isCompleted && slot.record) {
              const wonTitle = slot.record.playoffResult === '總冠軍';
              const madePlayoffs = slot.record.playoffResult !== '未晉級';
              if (wonTitle) {
                borderClass = 'border-amber-400/80 bg-amber-950/40 text-amber-200';
                statusPill = '🏆 總冠軍';
                pillColor = 'text-amber-300 bg-amber-900/60';
              } else if (madePlayoffs) {
                borderClass = 'border-sky-400/60 bg-sky-950/30 text-sky-200';
                statusPill = slot.record.playoffResult === '總冠軍賽敗' ? '🥈 決賽' : '🥉 準決';
                pillColor = 'text-sky-300 bg-sky-900/50';
              } else {
                borderClass = 'border-slate-700 bg-slate-800/60 text-slate-300';
                statusPill = '例行賽';
                pillColor = 'text-slate-400 bg-slate-800';
              }
            } else if (isCurrent) {
              borderClass = 'border-emerald-400 ring-2 ring-emerald-400/30 bg-emerald-950/40 text-emerald-200';
              statusPill = '進行中';
              pillColor = 'text-emerald-300 bg-emerald-900/70 animate-pulse';
            }

            return (
              <div
                key={slot.yearIndex}
                className={`flex flex-col justify-between rounded-lg border p-1.5 text-center transition-all ${borderClass}`}
              >
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-mono font-bold">第{slot.yearIndex + 1}年</span>
                  <span className="font-mono text-[9px] opacity-70">{slot.year}</span>
                </div>

                <div className="my-1">
                  <span className={`inline-block rounded px-1 py-0.5 text-[9px] font-semibold ${pillColor}`}>
                    {statusPill}
                  </span>
                </div>

                {isCompleted && slot.record ? (
                  <div className="text-[9px] font-mono leading-tight">
                    <p className="text-slate-300 font-bold">{slot.record.wins}勝{slot.record.losses}敗</p>
                    <p className={slot.record.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {slot.record.net >= 0 ? '+' : ''}{formatMoney(slot.record.net)}
                    </p>
                  </div>
                ) : isCurrent ? (
                  <div className="text-[9px] font-mono text-emerald-300">
                    <p className="font-semibold">{slot.phaseLabel?.split('・')[0] ?? '戰事推進'}</p>
                  </div>
                ) : (
                  <div className="text-[9px] text-slate-600 font-mono">
                    <p>規劃中</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 2. 董事會信任與期望值天秤 */}
      <section className="dy-card p-4 border border-slate-700/70 bg-slate-900/85">
        <div className="flex items-baseline justify-between border-b border-slate-700/60 pb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">⚖️</span>
            <h2 className="text-xs font-black tracking-wider uppercase text-slate-200">
              董事會信任與期望值天秤
            </h2>
          </div>
          <span
            className={`font-mono text-sm font-extrabold ${
              trustStatus.isDanger
                ? 'text-rose-400'
                : trustStatus.trust < 40
                ? 'text-amber-400'
                : 'text-emerald-300'
            }`}
          >
            {trustStatus.trust} / 100
          </span>
        </div>

        {/* Visual Trust Meter Scale */}
        <div className="mt-3">
          <div className="flex justify-between text-[10px] text-slate-500 font-mono mb-1">
            <span className="text-rose-400 font-semibold">危險警戒 (&lt;20)</span>
            <span className="text-amber-400">平穩觀察 (20–59)</span>
            <span className="text-emerald-400">充分授權 (≥60)</span>
          </div>
          <div className="relative h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
            {/* Red Danger Threshold marker */}
            <div
              className="absolute top-0 bottom-0 left-[20%] w-0.5 bg-rose-500/80 z-10"
              title="解僱危險門檻 (20)"
            />
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.max(3, trustStatus.trust)}%`,
                background: trustStatus.isDanger
                  ? 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)'
                  : trustStatus.trust < 40
                  ? 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)'
                  : 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
              }}
            />
          </div>
        </div>

        {/* Threat Warning Callout */}
        {trustStatus.isDanger && (
          <div className="mt-2.5 rounded-lg border border-rose-500/60 bg-rose-950/60 p-2 text-rose-200 text-xs">
            <p className="font-bold flex items-center gap-1">
              <span>🚨</span>
              <span>{trustStatus.threatDescription}</span>
            </p>
          </div>
        )}

        {/* Current Expectation Card */}
        <div className="mt-3 rounded-lg bg-slate-950/60 border border-slate-800 p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500">本季董事會承諾目標</span>
            <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-xs font-bold text-emerald-300">
              {EXPECTATIONS[trustStatus.expectation].label}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-300 leading-snug">
            {trustStatus.expectationDemand}
          </p>
        </div>
      </section>

      {/* 3. 薪資空間與豪華稅雷達 */}
      <section className="dy-card p-4 border border-slate-700/70 bg-slate-900/85">
        <div className="flex items-baseline justify-between border-b border-slate-700/60 pb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">📊</span>
            <h2 className="text-xs font-black tracking-wider uppercase text-slate-200">
              薪資空間與豪華稅雷達
            </h2>
          </div>
          <span className="font-mono text-xs text-slate-400">
            上限 {formatMoney(capRadar.cap)}
          </span>
        </div>

        {/* Cap Meter Bar */}
        <div className="mt-3">
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-slate-400">目前一軍薪資總額</span>
            <span className={`font-mono font-bold ${capRadar.isOverCap ? 'text-amber-400' : 'text-slate-200'}`}>
              {formatMoney(capRadar.payroll)}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, Math.round(capRadar.usageRatio * 100))}%`,
                background: capRadar.isOverCap
                  ? 'linear-gradient(90deg, #f59e0b 0%, #ef4444 100%)'
                  : 'linear-gradient(90deg, #38bdf8 0%, #34d399 100%)',
              }}
            />
          </div>
        </div>

        {/* Luxury Tax Details */}
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-slate-950/60 p-2 border border-slate-800/80">
            <p className="text-[10px] text-slate-500">
              {capRadar.isOverCap ? '超過薪資上限' : '剩餘薪資空間'}
            </p>
            <p
              className={`font-mono font-bold mt-0.5 ${
                capRadar.isOverCap ? 'text-amber-400' : 'text-emerald-300'
              }`}
            >
              {capRadar.isOverCap ? `+${formatMoney(capRadar.overCap)}` : formatMoney(capRadar.cap - capRadar.payroll)}
            </p>
          </div>
          <div className="rounded-lg bg-slate-950/60 p-2 border border-slate-800/80">
            <p className="text-[10px] text-slate-500">季末預估豪華稅 (50%)</p>
            <p
              className={`font-mono font-bold mt-0.5 ${
                capRadar.luxuryTax > 0 ? 'text-rose-400' : 'text-slate-400'
              }`}
            >
              {capRadar.luxuryTax > 0 ? `−${formatMoney(capRadar.luxuryTax)}` : '0 萬'}
            </p>
          </div>
        </div>

        {/* Cash Cushion & Bankruptcy Safety */}
        <div className="mt-2.5 rounded-lg bg-slate-950/60 p-2.5 border border-slate-800/80">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400">目前資金儲備</span>
            <span
              className={`font-mono font-bold ${
                capRadar.cash < 0 ? 'text-rose-400' : 'text-emerald-300'
              }`}
            >
              {formatMoney(capRadar.cash)}
            </span>
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-slate-500 font-mono">
            <span>破產防線：−5,000 萬</span>
            <span>安全墊：{formatMoney(capRadar.bankruptcyBuffer)}</span>
          </div>
        </div>
      </section>

      {/* 4. 農場新秀星級潛力熱圖 */}
      <section className="dy-card p-4 border border-slate-700/70 bg-slate-900/85">
        <div className="flex items-baseline justify-between border-b border-slate-700/60 pb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">🌱</span>
            <h2 className="text-xs font-black tracking-wider uppercase text-slate-200">
              農場新秀星級潛力圖
            </h2>
          </div>
          <span className="font-mono text-xs font-bold text-emerald-400">
            農場 Lv.{state.farmLevel}
          </span>
        </div>

        {/* Position Breakdown Pills */}
        <div className="mt-3 grid grid-cols-4 gap-1.5 text-center">
          {farmChart.groups.map((grp) => (
            <div
              key={grp.position}
              className="rounded-lg bg-slate-950/60 p-1.5 border border-slate-800"
            >
              <p className="text-[10px] text-slate-500">{grp.label}</p>
              <p className="font-mono text-xs font-bold text-slate-200 mt-0.5">
                {grp.count} 人
              </p>
              <p
                className="text-[9px] font-mono mt-0.5"
                style={{ color: gradeColor(grp.averagePotentialHigh) }}
              >
                頂級~{grade(grp.averagePotentialHigh)}
              </p>
            </div>
          ))}
        </div>

        {/* Top Prospects Spotlight */}
        <div className="mt-3">
          <p className="text-[10px] text-slate-500 font-semibold tracking-wider">重點潛力新秀梯隊</p>
          <div className="mt-1.5 space-y-1.5">
            {team.players
              .filter((p) => p.level === 'farm')
              .sort((a, b) => b.band.high - a.band.high)
              .slice(0, 3)
              .map((prospect) => {
                const cur = ability(prospect);
                return (
                  <div
                    key={prospect.id}
                    className="flex items-center justify-between rounded bg-slate-950/40 px-2 py-1 text-xs border border-slate-800/60"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-200">{prospect.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {prospect.age}歲
                      </span>
                      {prospect.age <= 21 && (
                        <span className="rounded bg-sky-950/80 px-1 text-[9px] text-sky-300 font-semibold">
                          保護中
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[11px]">
                      <span className="text-slate-400">目前 {grade(cur)}</span>
                      <span className="text-sky-300 font-bold">
                        潛力 {prospect.band.low}–{prospect.band.high}
                      </span>
                    </div>
                  </div>
                );
              })}
            {farmChart.totalFarm === 0 && (
              <p className="text-xs text-slate-600">二軍農場目前無球員。</p>
            )}
          </div>
        </div>

        {/* Protection Guideline Note */}
        <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
          💡 農場鐵律：21 歲以下新秀過早升上一軍，該季成長量將折損 50%。耐心培育才能養成頂尖球星。
        </p>
      </section>
    </aside>
  );
}
