import React, { useEffect, useState } from 'react';
import type { GameLoreDossier, LoreSection } from './originLoreData';

export interface OriginLoreModalProps {
  dossier: GameLoreDossier;
  onClose: () => void;
  initialTab?: 'origin' | 'rules';
  extraTab?: {
    id: string;
    label: string;
    content: React.ReactNode;
  };
  extraFooter?: React.ReactNode;
}

const THEME_STYLES: Record<
  GameLoreDossier['themeColor'],
  {
    border: string;
    glow: string;
    badgeBg: string;
    badgeText: string;
    activeTab: string;
    highlight: string;
    sakuraiBorder: string;
    sakuraiBg: string;
  }
> = {
  emerald: {
    border: 'border-emerald-500/40',
    glow: 'shadow-[0_0_35px_rgba(16,185,129,0.25)]',
    badgeBg: 'bg-emerald-500/15 border-emerald-400/30 text-emerald-300',
    badgeText: 'text-emerald-300',
    activeTab: 'border-emerald-400 bg-emerald-500/20 text-emerald-100 shadow-[0_0_12px_rgba(16,185,129,0.3)]',
    highlight: 'text-emerald-400',
    sakuraiBorder: 'border-emerald-500/50',
    sakuraiBg: 'bg-emerald-950/40',
  },
  amber: {
    border: 'border-amber-500/40',
    glow: 'shadow-[0_0_35px_rgba(245,158,11,0.25)]',
    badgeBg: 'bg-amber-500/15 border-amber-400/30 text-amber-300',
    badgeText: 'text-amber-300',
    activeTab: 'border-amber-400 bg-amber-500/20 text-amber-100 shadow-[0_0_12px_rgba(245,158,11,0.3)]',
    highlight: 'text-amber-400',
    sakuraiBorder: 'border-amber-500/50',
    sakuraiBg: 'bg-amber-950/40',
  },
  indigo: {
    border: 'border-indigo-500/40',
    glow: 'shadow-[0_0_35px_rgba(99,102,241,0.25)]',
    badgeBg: 'bg-indigo-500/15 border-indigo-400/30 text-indigo-300',
    badgeText: 'text-indigo-300',
    activeTab: 'border-indigo-400 bg-indigo-500/20 text-indigo-100 shadow-[0_0_12px_rgba(99,102,241,0.3)]',
    highlight: 'text-indigo-400',
    sakuraiBorder: 'border-indigo-500/50',
    sakuraiBg: 'bg-indigo-950/40',
  },
  purple: {
    border: 'border-purple-500/40',
    glow: 'shadow-[0_0_35px_rgba(168,85,247,0.25)]',
    badgeBg: 'bg-purple-500/15 border-purple-400/30 text-purple-300',
    badgeText: 'text-purple-300',
    activeTab: 'border-purple-400 bg-purple-500/20 text-purple-100 shadow-[0_0_12px_rgba(168,85,247,0.3)]',
    highlight: 'text-purple-400',
    sakuraiBorder: 'border-purple-500/50',
    sakuraiBg: 'bg-purple-950/40',
  },
  rose: {
    border: 'border-rose-500/40',
    glow: 'shadow-[0_0_35px_rgba(244,63,94,0.25)]',
    badgeBg: 'bg-rose-500/15 border-rose-400/30 text-rose-300',
    badgeText: 'text-rose-300',
    activeTab: 'border-rose-400 bg-rose-500/20 text-rose-100 shadow-[0_0_12px_rgba(244,63,94,0.3)]',
    highlight: 'text-rose-400',
    sakuraiBorder: 'border-rose-500/50',
    sakuraiBg: 'bg-rose-950/40',
  },
  cyan: {
    border: 'border-cyan-500/40',
    glow: 'shadow-[0_0_35px_rgba(6,182,212,0.25)]',
    badgeBg: 'bg-cyan-500/15 border-cyan-400/30 text-cyan-300',
    badgeText: 'text-cyan-300',
    activeTab: 'border-cyan-400 bg-cyan-500/20 text-cyan-100 shadow-[0_0_12px_rgba(6,182,212,0.3)]',
    highlight: 'text-cyan-400',
    sakuraiBorder: 'border-cyan-500/50',
    sakuraiBg: 'bg-cyan-950/40',
  },
};

function RenderSection({
  section,
  theme,
}: {
  section: LoreSection;
  theme: typeof THEME_STYLES['amber'];
}): React.ReactElement {
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/75 p-4 sm:p-5 shadow-sm transition-all hover:border-slate-700/80">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-800/80 pb-2">
        <div className="flex items-center gap-2">
          {section.badge && (
            <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wider ${theme.badgeBg}`}>
              {section.badge}
            </span>
          )}
          <h3 className="text-base sm:text-lg font-bold text-slate-100">
            {section.title}
          </h3>
        </div>
        {section.subtitle && (
          <span className="text-xs text-slate-400 font-medium">
            {section.subtitle}
          </span>
        )}
      </header>

      {section.content && (
        <div className="space-y-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
          {Array.isArray(section.content) ? (
            section.content.map((p, idx) => <p key={idx}>{p}</p>)
          ) : (
            <p>{section.content}</p>
          )}
        </div>
      )}

      {section.table && (
        <div className="overflow-x-auto my-1 rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs sm:text-sm text-slate-300 border-collapse">
            <thead className="bg-slate-800/90 text-slate-200 text-xs font-semibold uppercase tracking-wider">
              <tr>
                {section.table.headers.map((h, i) => (
                  <th key={i} className="px-3 sm:px-4 py-2.5 border-b border-slate-700">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
              {section.table.rows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-800/30 transition-colors">
                  {row.map((cell, cIdx) => (
                    <td
                      key={cIdx}
                      className={`px-3 sm:px-4 py-2 sm:py-2.5 ${
                        cIdx === 0 ? 'font-semibold text-slate-200' : ''
                      }`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {section.bullets && section.bullets.length > 0 && (
        <ul className="space-y-2 text-xs sm:text-sm text-slate-300">
          {section.bullets.map((b, bIdx) => (
            <li key={bIdx} className="flex items-start gap-2.5">
              <span className={`shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full ${theme.badgeText} bg-current`} />
              <span className="leading-relaxed">{b}</span>
            </li>
          ))}
        </ul>
      )}

      {section.sakuraiTip && (
        <div
          className={`mt-2 rounded-xl border p-4 ${theme.sakuraiBorder} ${theme.sakuraiBg} relative overflow-hidden`}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-base" role="img" aria-label="心法">💡</span>
            <span className="text-xs sm:text-sm font-bold text-amber-300 tracking-wide uppercase">
              櫻井政博決策心法 · Risk vs. Reward
            </span>
          </div>
          <p className="text-xs sm:text-sm text-amber-100/90 leading-relaxed italic pl-1">
            {section.sakuraiTip}
          </p>
        </div>
      )}
    </article>
  );
}

export function OriginLoreModal({
  dossier,
  onClose,
  initialTab = 'origin',
  extraTab,
  extraFooter,
}: OriginLoreModalProps): React.ReactElement {
  const [activeTab, setActiveTab] = useState<'origin' | 'rules' | string>(initialTab);
  const theme = THEME_STYLES[dossier.themeColor] ?? THEME_STYLES.amber;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-2 sm:p-4 md:p-6 overflow-y-auto animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="origin-lore-title"
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-3xl border bg-slate-950/95 text-slate-100 shadow-2xl overflow-hidden ${theme.border} ${theme.glow}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <header className="shrink-0 flex items-start justify-between gap-3 p-4 sm:p-6 border-b border-slate-800 bg-slate-900/60">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`rounded-full border px-2.5 py-0.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider ${theme.badgeBg}`}>
                {dossier.badge}
              </span>
            </div>
            <h2 id="origin-lore-title" className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <span>{dossier.gameTitle}</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 leading-snug">
              {dossier.gameSubtitle}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="shrink-0 min-h-[44px] min-w-[44px] px-3 py-2 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 hover:text-white text-slate-300 text-xs font-bold flex items-center gap-1.5 touch-manipulation transition-colors shadow-sm"
            aria-label="關閉圖鑑 (Esc)"
          >
            <span>關閉</span>
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-slate-900/90 border border-slate-700 text-[10px] text-slate-400 font-mono">
              Esc
            </kbd>
          </button>
        </header>

        {/* Tab Selector */}
        <div
          className="shrink-0 flex border-b border-slate-800 bg-slate-900/40 px-3 sm:px-6 pt-2 gap-2 overflow-x-auto"
          role="tablist"
          aria-label="圖鑑切換"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'origin'}
            onClick={() => setActiveTab('origin')}
            className={`min-h-[44px] px-4 py-2 rounded-t-xl border-t border-x font-bold text-xs sm:text-sm flex items-center gap-2 touch-manipulation transition-all ${
              activeTab === 'origin'
                ? theme.activeTab
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <span>📜</span>
            <span>文化源流</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'rules'}
            onClick={() => setActiveTab('rules')}
            className={`min-h-[44px] px-4 py-2 rounded-t-xl border-t border-x font-bold text-xs sm:text-sm flex items-center gap-2 touch-manipulation transition-all ${
              activeTab === 'rules'
                ? theme.activeTab
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <span>⚔️</span>
            <span>玩法圖解與決策心法</span>
          </button>

          {extraTab && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === extraTab.id}
              onClick={() => setActiveTab(extraTab.id)}
              className={`min-h-[44px] px-4 py-2 rounded-t-xl border-t border-x font-bold text-xs sm:text-sm flex items-center gap-2 touch-manipulation transition-all ${
                activeTab === extraTab.id
                  ? theme.activeTab
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <span>⚙️</span>
              <span>{extraTab.label}</span>
            </button>
          )}
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
          {activeTab === 'origin' && (
            <div className="space-y-4 sm:space-y-6">
              {dossier.culturalOrigin.sections.map((sec, i) => (
                <RenderSection key={i} section={sec} theme={theme} />
              ))}
            </div>
          )}

          {activeTab === 'rules' && (
            <div className="space-y-4 sm:space-y-6">
              {dossier.rulesAndStrategy.sections.map((sec, i) => (
                <RenderSection key={i} section={sec} theme={theme} />
              ))}
            </div>
          )}

          {extraTab && activeTab === extraTab.id && (
            <div className="space-y-4">
              {extraTab.content}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <footer className="shrink-0 flex items-center justify-between gap-3 p-3 sm:p-4 border-t border-slate-800/80 bg-slate-900/60 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>💡 提示：使用</span>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-slate-300">
              Esc
            </kbd>
            <span>鍵可隨時關閉本面板</span>
          </div>

          <div className="flex items-center gap-2">
            {extraFooter}
            <button
              type="button"
              onClick={() => {
                if (activeTab === 'origin') setActiveTab('rules');
                else if (activeTab === 'rules') setActiveTab('origin');
              }}
              className="min-h-[44px] px-3 py-2 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-semibold touch-manipulation transition-colors"
            >
              {activeTab === 'origin' ? '查看玩法圖解 ➔' : '查看文化源流 ➔'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
