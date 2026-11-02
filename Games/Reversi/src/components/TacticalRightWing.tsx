import { useState, type ReactElement } from 'react';
import { BookOpen, ChevronDown, ChevronUp, Keyboard, Shield, Trophy, UserCheck } from 'lucide-react';
import type { SeriesMatch } from '../utils/match';
import { seriesLabel } from '../utils/match';
import type { OpponentDef } from '../utils/opponents';
import type { PuzzleRuntime } from '../utils/puzzles';
import { describePuzzleObjective } from '../utils/puzzles';
import { DIFFICULTY_BLURBS, DIFFICULTY_LABELS, type Difficulty, type Piece } from '../utils/reversiLogic';

export interface TacticalRightWingProps {
  playMode: 'two' | 'bot' | 'ladder' | 'puzzle';
  playerSide: Piece;
  difficulty: Difficulty;
  activeOpponent?: OpponentDef;
  series: SeriesMatch | null;
  puzzle: PuzzleRuntime | null;
  puzzlePlies: number;
  onOpenShortcuts: () => void;
  className?: string;
}

interface TacticalTactic {
  id: string;
  name: string;
  summary: string;
  body: string;
}

const TACTICAL_ARSENAL: TacticalTactic[] = [
  {
    id: 'quiet-moves',
    name: '安靜落子 (Quiet Move)',
    summary: '盡量翻盤內子，勿輕易翻邊界子',
    body: '翻轉越多外圍子，反而會為對手創造更多下子接觸面。開局與中盤盡量選擇翻轉少量子、靠近棋盤核心的「安靜手」，保持自己行動餘裕。',
  },
  {
    id: 'corner-lock',
    name: '角地鎖定 (Corner Lock)',
    summary: '四角永不被翻，穩扎永久子基石',
    body: '角地一旦佔領，對手永遠無法將其翻轉。圍繞角地延伸出的邊線子也將逐步轉為完全不可翻的「永久子（Stable Discs）」。',
  },
  {
    id: 'danger-squares',
    name: '避開 C/X 位 (Danger Zones)',
    summary: '角未拿前，切莫誤踩對角 X 位與相鄰 C 位',
    body: '角旁斜對角的 X 位（如 B2、G2、B7、G7）與貼邊 C 位（如 B1、A2）通常會直接為對手架好佔角的跳板，除非該角已由我方牢牢掌握。',
  },
  {
    id: 'parity-play',
    name: '奇偶終局 (Parity Control)',
    summary: '數盤面各區域空格，搶下奇數區最後一手',
    body: '在殘局收官階段，若某獨立空格區域為奇數格，先下的一方通常能下到該區域最後一手，將整條邊界或整區棋子全數收入囊中。',
  },
];

export function TacticalRightWing({
  playMode,
  playerSide,
  difficulty,
  activeOpponent,
  series,
  puzzle,
  puzzlePlies,
  onOpenShortcuts,
  className = '',
}: TacticalRightWingProps): ReactElement {
  const [expandedTactic, setExpandedTactic] = useState<string | null>('quiet-moves');

  return (
    <aside
      className={`flex flex-col gap-3.5 bg-stone-900/85 backdrop-blur-md border border-emerald-800/50 rounded-2xl p-4 shadow-xl text-left text-stone-200 ${className}`}
      aria-label="作戰情報與戰術錦囊"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-stone-700/70 pb-2">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-bold tracking-wide text-emerald-300 uppercase">
            右翼・情報與戰略庫
          </h2>
        </div>
        <button
          type="button"
          onClick={onOpenShortcuts}
          className="flex items-center gap-1 text-[11px] text-stone-400 hover:text-stone-200 bg-stone-800/80 px-2 py-0.5 rounded-md border border-stone-700 transition-colors"
          title="鍵盤快捷鍵矩陣"
        >
          <Keyboard className="w-3.5 h-3.5 text-stone-300" />
          <span>按 ? 導航</span>
        </button>
      </div>

      {/* 1. 對手情報檔案 (Dossier) */}
      <div className="bg-stone-950/70 border border-stone-800 rounded-xl p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-stone-300 flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
            作戰對手檔案
          </span>
          <span className="text-[11px] text-stone-400">
            執子：{playerSide === 'black' ? '我方執黑（先手）' : '我方執白（後手）'}
          </span>
        </div>

        {playMode === 'ladder' && activeOpponent && (
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span
                className="w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-sm bg-stone-800"
                style={{ borderColor: activeOpponent.accent, color: activeOpponent.accent }}
              >
                {activeOpponent.name.charAt(0)}
              </span>
              <div>
                <p className="text-sm font-bold" style={{ color: activeOpponent.accent }}>
                  {activeOpponent.name}
                </p>
                <p className="text-[11px] text-stone-400">{activeOpponent.tagline}</p>
              </div>
            </div>

            {/* Persona Dialogue Bubble */}
            <div className="bg-stone-900/90 border border-stone-700/70 rounded-lg p-2 text-xs italic text-stone-300 relative">
              「{activeOpponent.catchphrases.intro}」
            </div>

            {/* Style Breakdown */}
            <div className="space-y-1 pt-1 text-[11px]">
              <StyleBar
                label="搶角慾望"
                value={Math.min(100, (activeOpponent.style.cornerGreed ?? 25) * 1.6)}
                color="bg-amber-400"
              />
              <StyleBar
                label="機動壓制"
                value={Math.min(100, (activeOpponent.style.mobilityWeight ?? 4) * 6)}
                color="bg-sky-400"
              />
              <StyleBar
                label="翻子慾望"
                value={Math.min(100, (activeOpponent.style.discGreed ?? 0) * 8)}
                color="bg-rose-400"
              />
            </div>
          </div>
        )}

        {playMode === 'bot' && (
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-emerald-300">
                標準 AI・{DIFFICULTY_LABELS[difficulty]}
              </span>
              <span className="text-[11px] text-stone-400 font-mono">
                {difficulty === 'hard' ? '精確終局全解' : difficulty === 'normal' ? '深算 3 步' : '只看 1 步'}
              </span>
            </div>
            <p className="text-stone-400 text-[11px] leading-relaxed">
              {DIFFICULTY_BLURBS[difficulty]}
            </p>
          </div>
        )}

        {playMode === 'puzzle' && puzzle && (
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sky-300">
                殘局第 {puzzle.index + 1} 題：{puzzle.title}
              </span>
              <span className="text-[11px] text-amber-300 font-mono">
                {puzzlePlies} / {puzzle.maxPlies} 手
              </span>
            </div>
            <p className="text-stone-300 text-[11px]">
              🎯 目標：<span className="text-emerald-300">{describePuzzleObjective(puzzle)}</span>
            </p>
            <p className="text-stone-400 text-[10px] leading-snug">
              💡 提示：無提示、無悔棋通關可獲得 ★★★ 滿星認證。
            </p>
          </div>
        )}

        {playMode === 'two' && (
          <div className="space-y-1 text-xs text-stone-300">
            <p className="font-semibold text-emerald-300">雙人同機對決</p>
            <p className="text-[11px] text-stone-400">雙方輪流於棋盤上落子，考驗純粹的大局觀與邊角爭奪。</p>
          </div>
        )}
      </div>

      {/* 2. 系列賽進度 (Series Match Progress) */}
      {series && series.length > 1 && (
        <div className="bg-stone-950/70 border border-stone-800 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-amber-300 flex items-center gap-1">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              {seriesLabel(series.length)}
            </span>
            <span className="text-[11px] text-stone-400 font-mono">
              第 {series.gameIndex + 1} 局 / 共 {series.length} 局
            </span>
          </div>

          <div className="flex items-center justify-around bg-stone-900/60 p-2 rounded-lg border border-stone-800 text-xs">
            <div className="text-center">
              <p className="text-[10px] text-stone-400">我方勝場</p>
              <p className="text-base font-bold text-emerald-400">{series.playerWins}</p>
            </div>
            <span className="text-stone-600 font-bold">:</span>
            <div className="text-center">
              <p className="text-[10px] text-stone-400">和局</p>
              <p className="text-base font-bold text-stone-400">{series.draws}</p>
            </div>
            <span className="text-stone-600 font-bold">:</span>
            <div className="text-center">
              <p className="text-[10px] text-stone-400">對手勝場</p>
              <p className="text-base font-bold text-rose-400">{series.cpuWins}</p>
            </div>
          </div>
        </div>
      )}

      {/* 3. 四本柱戰術錦囊 (Tactical Arsenal) */}
      <div className="bg-stone-950/70 border border-stone-800 rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-emerald-300 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
            名宿大師戰術錦囊
          </span>
          <span className="text-[10px] text-stone-400">四本柱要訣</span>
        </div>

        <div className="space-y-1.5">
          {TACTICAL_ARSENAL.map((tactic) => {
            const isExpanded = expandedTactic === tactic.id;
            return (
              <div
                key={tactic.id}
                className="rounded-lg border border-stone-800 bg-stone-900/60 overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setExpandedTactic(isExpanded ? null : tactic.id)}
                  className="w-full flex items-center justify-between p-2 text-left text-xs hover:bg-stone-800/60 transition-colors"
                >
                  <span className="font-medium text-stone-200">{tactic.name}</span>
                  {isExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                  )}
                </button>
                {isExpanded && (
                  <div className="px-2.5 pb-2 text-[11px] text-stone-400 border-t border-stone-800/80 pt-1.5 space-y-1 bg-stone-950/30">
                    <p className="text-amber-200/90 font-medium">{tactic.summary}</p>
                    <p className="leading-relaxed text-stone-300">{tactic.body}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

function StyleBar({ label, value, color }: { label: string; value: number; color: string }): ReactElement {
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[10px] text-stone-400">
        <span>{label}</span>
        <span className="font-mono">{Math.round(value)}%</span>
      </div>
      <div className="h-1.5 w-full bg-stone-800 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}
