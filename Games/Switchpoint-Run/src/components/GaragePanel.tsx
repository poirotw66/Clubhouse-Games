import React from 'react';
import { MODIFIERS, type ModifierId } from '../game/modifiers';
import { RUNNERS, type RunnerId } from '../game/profiles';
import type { MetaProgress } from '../game/progress';
import { THEMES, type ThemeId } from '../game/themes';

interface Props {
  meta: MetaProgress;
  onClose: () => void;
  onSelectRunner: (id: RunnerId) => void;
  onBuyRunner: (id: RunnerId) => void;
  onSelectTheme: (id: ThemeId) => void;
  onBuyTheme: (id: ThemeId) => void;
  onToggleModifier: (id: ModifierId) => void;
}

export function GaragePanel({
  meta,
  onClose,
  onSelectRunner,
  onBuyRunner,
  onSelectTheme,
  onBuyTheme,
  onToggleModifier,
}: Props): React.ReactElement {
  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/75 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sr-garage-title"
      onClick={onClose}
    >
      <div
        className="sr-panel flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl p-4 text-left"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="sr-garage-title" className="text-xl font-black text-emerald-300">
              車庫與解鎖
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              鐵道螺栓{' '}
              <strong className="text-amber-300">{meta.bolts.toLocaleString('zh-Hant')}</strong>
              ・解鎖會改變手感或路線壓力
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] shrink-0 rounded-lg border border-slate-600 bg-slate-800 px-3 text-xs font-bold text-slate-200"
          >
            關閉
          </button>
        </div>

        <div className="mt-4 space-y-5 overflow-y-auto pr-1">
          <section aria-label="扳道車">
            <h3 className="mb-2 text-sm font-bold text-slate-200">扳道車</h3>
            <ul className="space-y-2">
              {RUNNERS.map((runner) => {
                const unlocked = meta.unlockedRunners.includes(runner.id);
                const selected = meta.selectedRunnerId === runner.id;
                return (
                  <li key={runner.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (unlocked) onSelectRunner(runner.id);
                        else onBuyRunner(runner.id);
                      }}
                      className="flex min-h-14 w-full flex-col rounded-xl border border-white/10 bg-slate-900/50 px-3 py-2.5 text-left"
                      style={
                        selected
                          ? {
                              borderColor: 'rgba(52,211,153,0.55)',
                              background: 'rgba(6,78,59,0.28)',
                            }
                          : undefined
                      }
                    >
                      <span className="flex w-full items-center justify-between gap-2">
                        <span className="text-sm font-bold text-slate-100">{runner.name}</span>
                        <span className="shrink-0 text-[11px] font-semibold text-slate-400">
                          {selected
                            ? '使用中'
                            : unlocked
                              ? '裝備'
                              : meta.bolts >= runner.cost
                                ? `${runner.cost} 螺栓`
                                : `需 ${runner.cost}`}
                        </span>
                      </span>
                      <span className="mt-1 text-[11px] leading-snug text-slate-400">{runner.blurb}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section aria-label="路線主題">
            <h3 className="mb-2 text-sm font-bold text-slate-200">路線主題</h3>
            <ul className="space-y-2">
              {THEMES.map((theme) => {
                const unlocked = meta.unlockedThemes.includes(theme.id);
                const selected = meta.selectedThemeId === theme.id;
                return (
                  <li key={theme.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (unlocked) onSelectTheme(theme.id);
                        else onBuyTheme(theme.id);
                      }}
                      className="flex min-h-14 w-full flex-col rounded-xl border border-white/10 bg-slate-900/50 px-3 py-2.5 text-left"
                      style={
                        selected
                          ? {
                              borderColor: theme.palette.accent,
                              background: 'rgba(15,23,42,0.65)',
                            }
                          : undefined
                      }
                    >
                      <span className="flex w-full items-center justify-between gap-2">
                        <span className="text-sm font-bold text-slate-100">{theme.name}</span>
                        <span className="shrink-0 text-[11px] font-semibold text-slate-400">
                          {selected
                            ? '使用中'
                            : unlocked
                              ? '裝備'
                              : meta.bolts >= theme.cost
                                ? `${theme.cost} 螺栓`
                                : `需 ${theme.cost}`}
                        </span>
                      </span>
                      <span className="mt-1 text-[11px] leading-snug text-slate-400">{theme.blurb}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section aria-label="修飾規則">
            <h3 className="mb-2 text-sm font-bold text-slate-200">修飾規則</h3>
            <p className="mb-2 text-[11px] text-slate-500">
              以自由遊玩最佳距離解鎖；挑戰種子包不套用修飾。
            </p>
            <ul className="space-y-2">
              {MODIFIERS.map((mod) => {
                const unlocked = meta.unlockedModifiers.includes(mod.id);
                const equipped = meta.equippedModifiers.includes(mod.id);
                return (
                  <li key={mod.id}>
                    <button
                      type="button"
                      disabled={!unlocked}
                      onClick={() => unlocked && onToggleModifier(mod.id)}
                      className="flex min-h-14 w-full flex-col rounded-xl border border-white/10 bg-slate-900/50 px-3 py-2.5 text-left disabled:cursor-not-allowed disabled:opacity-45"
                      style={
                        equipped
                          ? {
                              borderColor: 'rgba(251,191,36,0.55)',
                              background: 'rgba(69,26,3,0.28)',
                            }
                          : undefined
                      }
                    >
                      <span className="flex w-full items-center justify-between gap-2">
                        <span className="text-sm font-bold text-slate-100">{mod.name}</span>
                        <span className="shrink-0 text-[11px] font-semibold text-slate-400">
                          {!unlocked
                            ? `距離 ${mod.unlockBestDistance.toLocaleString('zh-Hant')}`
                            : equipped
                              ? '已啟用'
                              : mod.equipCost > 0
                                ? `啟用（結算 −${mod.equipCost}）`
                                : '啟用'}
                        </span>
                      </span>
                      <span className="mt-1 text-[11px] leading-snug text-slate-400">{mod.blurb}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section aria-label="模式紀錄" className="pb-2">
            <h3 className="mb-2 text-sm font-bold text-slate-200">模式紀錄</h3>
            <div className="grid grid-cols-1 gap-2 text-[11px] text-slate-400 sm:grid-cols-3">
              <div className="rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2">
                <div className="font-semibold text-slate-200">自由遊玩</div>
                <div>距離 {meta.free.bestDistance.toLocaleString('zh-Hant')}</div>
                <div>分數 {meta.free.bestScore.toLocaleString('zh-Hant')}</div>
                <div>場次 {meta.free.runs}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2">
                <div className="font-semibold text-slate-200">每日挑戰</div>
                {meta.daily.date ? (
                  <>
                    <div>{meta.daily.date}</div>
                    <div>距離 {meta.daily.bestDistance.toLocaleString('zh-Hant')}</div>
                    <div>分數 {meta.daily.bestScore.toLocaleString('zh-Hant')}</div>
                  </>
                ) : (
                  <div>尚無紀錄</div>
                )}
              </div>
              <div className="rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2">
                <div className="font-semibold text-slate-200">挑戰包</div>
                <div>距離 {meta.challenge.bestDistance.toLocaleString('zh-Hant')}</div>
                <div>分數 {meta.challenge.bestScore.toLocaleString('zh-Hant')}</div>
                <div>場次 {meta.challenge.runs}</div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
