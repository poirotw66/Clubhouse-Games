import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { JuiceSettingsPanel } from '@clubhouse/shared/JuiceSettings';
import { BookOpen, Brain, Puzzle, Swords, Users } from 'lucide-react';
import type { ReactElement } from 'react';
import {
  SERIES_OPTIONS,
  seriesLabel,
  type SeriesLength,
} from '../utils/match';
import {
  OPPONENTS,
  type OpponentDef,
} from '../utils/opponents';
import { describePuzzleObjective, puzzleCount, type PuzzleDef } from '../utils/puzzles';
import { STRATEGY_PRIMER } from '../utils/teach';
import {
  DIFFICULTY_BLURBS,
  DIFFICULTY_LABELS,
  type Difficulty,
  type Piece,
} from '../utils/reversiLogic';
import type { LadderProgress } from '../utils/ladder';
import {
  formatStars,
  isOpponentUnlocked,
  isPuzzleUnlocked,
  puzzleStarTotal,
} from '../utils/ladder';

const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard'];

export type MenuView = 'home' | 'bot' | 'ladder' | 'puzzles' | 'strategy';

export interface MenuScreenProps {
  view: MenuView;
  setView: (v: MenuView) => void;
  showRules: boolean;
  setShowRules: (v: boolean) => void;
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;
  seriesLength: SeriesLength;
  setSeriesLength: (n: SeriesLength) => void;
  ladder: LadderProgress;
  puzzles: PuzzleDef[];
  winStreak: number;
  bestStreak: number;
  bestMargin: number;
  onTwoPlayer: () => void;
  onStartBot: (side: Piece) => void;
  onStartLadder: (index: number, side: Piece) => void;
  onStartPuzzle: (index: number) => void;
}

const shellStyle = {
  backgroundColor: '#022c22',
  backgroundImage: [
    'linear-gradient(rgba(2,44,34,0.78), rgba(2,26,18,0.88))',
    `url(${import.meta.env.BASE_URL}table-bg.jpg)`,
  ].join(', '),
};

export function MenuScreen({
  view,
  setView,
  showRules,
  setShowRules,
  difficulty,
  setDifficulty,
  seriesLength,
  setSeriesLength,
  ladder,
  puzzles,
  winStreak,
  bestStreak,
  bestMargin,
  onTwoPlayer,
  onStartBot,
  onStartLadder,
  onStartPuzzle,
}: MenuScreenProps): ReactElement {
  const solvedCount = Object.keys(ladder.puzzlesSolved).length;
  const starTotal = puzzleStarTotal(ladder);
  const starMax = puzzleCount() * 3;

  return (
    <div
      className="min-h-screen text-white flex flex-col items-center justify-center p-4 min-w-0 bg-cover bg-center"
      style={shellStyle}
    >
      <BackToMenu />
      <h1 className="text-2xl font-bold tracking-tight mb-2">黑白棋</h1>
      <p className="text-stone-400 text-xs mb-6">
        連勝 {winStreak} · 最佳 {bestStreak} · 勝差 {bestMargin} · 謎題 {solvedCount}/{puzzleCount()} · ★ {starTotal}/{starMax}
      </p>

      {view === 'home' && (
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            type="button"
            onClick={onTwoPlayer}
            className="flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-emerald-700 hover:bg-emerald-600 font-medium transition-colors"
          >
            <Users className="w-5 h-5" />
            雙人對戰
          </button>
          <button
            type="button"
            onClick={() => setView('bot')}
            className="flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-teal-800 hover:bg-teal-700 font-medium transition-colors"
          >
            <Swords className="w-5 h-5" />
            對戰電腦
          </button>
          <button
            type="button"
            onClick={() => setView('ladder')}
            className="flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-amber-800/90 hover:bg-amber-700 font-medium transition-colors"
          >
            <Brain className="w-5 h-5" />
            對手名冊
          </button>
          <button
            type="button"
            onClick={() => setView('puzzles')}
            className="flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-sky-900 hover:bg-sky-800 font-medium transition-colors"
          >
            <Puzzle className="w-5 h-5" />
            殘局謎題
          </button>
          <button
            type="button"
            onClick={() => setView('strategy')}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-stone-700 hover:bg-stone-600 font-medium transition-colors"
          >
            <BookOpen className="w-5 h-5" />
            戰略要點
          </button>
          <button
            type="button"
            onClick={() => setShowRules(true)}
            className="text-stone-400 text-sm underline underline-offset-2 mt-1"
          >
            規則說明
          </button>
        </div>
      )}

      {view === 'bot' && (
        <BotSetup
          difficulty={difficulty}
          setDifficulty={setDifficulty}
          seriesLength={seriesLength}
          setSeriesLength={setSeriesLength}
          onBack={() => setView('home')}
          onStart={onStartBot}
        />
      )}

      {view === 'ladder' && (
        <LadderSetup
          ladder={ladder}
          seriesLength={seriesLength}
          setSeriesLength={setSeriesLength}
          onBack={() => setView('home')}
          onStart={onStartLadder}
        />
      )}

      {view === 'puzzles' && (
        <PuzzleSetup
          puzzles={puzzles}
          ladder={ladder}
          onBack={() => setView('home')}
          onStart={onStartPuzzle}
        />
      )}

      {view === 'strategy' && (
        <div className="w-full max-w-md bg-stone-900/80 border border-stone-600 rounded-xl p-5 text-left">
          <h2 className="text-lg font-bold mb-3">戰略要點</h2>
          <ul className="space-y-3 text-sm text-stone-200">
            {STRATEGY_PRIMER.map((tip) => (
              <li key={tip.id}>
                <p className="font-semibold text-emerald-300">{tip.title}</p>
                <p className="text-stone-300">{tip.detail}</p>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setView('home')}
            className="mt-4 w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-medium"
          >
            返回
          </button>
        </div>
      )}

      {showRules && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-10"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rules-title"
        >
          <div className="bg-stone-800 rounded-xl max-w-md max-h-[85vh] overflow-y-auto p-6 text-left">
            <h2 id="rules-title" className="text-lg font-bold mb-3">規則說明</h2>
            <ul className="text-sm text-stone-200 space-y-2 list-disc pl-4">
              <li>8×8 棋盤，黑方先手。開局中央 2×2 為兩黑兩白（斜線相對）。</li>
              <li>輪到的一方在空格下子，新子須與己方另一子「夾住」至少一條線上的對方子，並將該線上被夾住的對方子全部翻成己色。</li>
              <li>無合法手時須 Pass，改由對方下；若雙方都無合法手則終局。</li>
              <li>終局時己色子數多者勝，相同則和局。</li>
            </ul>
            <div className="mt-4">
              <JuiceSettingsPanel />
            </div>
            <button
              type="button"
              onClick={() => setShowRules(false)}
              className="mt-4 w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-medium"
            >
              關閉
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BotSetup({
  difficulty,
  setDifficulty,
  seriesLength,
  setSeriesLength,
  onBack,
  onStart,
}: {
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;
  seriesLength: SeriesLength;
  setSeriesLength: (n: SeriesLength) => void;
  onBack: () => void;
  onStart: (side: Piece) => void;
}): ReactElement {
  return (
    <div className="w-full max-w-xs flex flex-col gap-4">
      <button type="button" onClick={onBack} className="text-sm text-stone-400 self-start">
        ← 返回
      </button>
      <p className="text-stone-300 text-sm">難度</p>
      <div className="flex gap-2" role="group" aria-label="電腦難度">
        {DIFFICULTIES.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setDifficulty(id)}
            aria-pressed={difficulty === id}
            title={DIFFICULTY_BLURBS[id]}
            className={`flex-1 px-2 py-2.5 rounded-xl border-2 text-sm font-medium transition-colors ${
              difficulty === id
                ? 'bg-emerald-700 border-emerald-400 text-white'
                : 'bg-stone-800 border-stone-600 text-stone-300 hover:bg-stone-700'
            }`}
          >
            {DIFFICULTY_LABELS[id]}
          </button>
        ))}
      </div>
      <p className="text-stone-500 text-xs">{DIFFICULTY_BLURBS[difficulty]}</p>

      <details className="rv-more-modes rounded-xl border border-stone-700/80 bg-stone-900/40 px-3 py-2" open={seriesLength > 1}>
        <summary className="min-h-[44px] cursor-pointer list-none touch-manipulation flex items-center justify-between gap-2 text-sm text-stone-300 font-medium">
          <span>更多賽制</span>
          <span className="text-xs font-normal text-stone-500">
            {seriesLength === 1 ? '目前：單局' : `目前：${seriesLabel(seriesLength)}`}
          </span>
        </summary>
        <div className="mt-2 flex gap-2" role="group" aria-label="系列賽長度">
          {SERIES_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setSeriesLength(n)}
              aria-pressed={seriesLength === n}
              className={`flex-1 px-2 py-2 min-h-[44px] rounded-xl border text-xs font-medium touch-manipulation ${
                seriesLength === n
                  ? 'bg-amber-700/50 border-amber-400 text-amber-100'
                  : 'bg-stone-800 border-stone-600 text-stone-300'
              }`}
            >
              {seriesLabel(n)}
            </button>
          ))}
        </div>
      </details>

      <p className="text-stone-300 text-sm mt-1">選擇執子</p>
      <div className="flex gap-4">
        <SideButton side="black" label="執黑" sub="先手" onClick={() => onStart('black')} />
        <SideButton side="white" label="執白" sub="後手" onClick={() => onStart('white')} />
      </div>
    </div>
  );
}

function LadderSetup({
  ladder,
  seriesLength,
  setSeriesLength,
  onBack,
  onStart,
}: {
  ladder: LadderProgress;
  seriesLength: SeriesLength;
  setSeriesLength: (n: SeriesLength) => void;
  onBack: () => void;
  onStart: (index: number, side: Piece) => void;
}): ReactElement {
  return (
    <div className="w-full max-w-sm flex flex-col gap-3">
      <button type="button" onClick={onBack} className="text-sm text-stone-400 self-start">
        ← 返回
      </button>
      <p className="text-sm text-stone-300">打贏解鎖下一位。每位對手風格不同。</p>
      <details className="rv-more-modes rounded-xl border border-stone-700/80 bg-stone-900/40 px-3 py-2 mb-1" open={seriesLength > 1}>
        <summary className="min-h-[44px] cursor-pointer list-none touch-manipulation flex items-center justify-between gap-2 text-xs text-stone-300 font-medium">
          <span>更多賽制</span>
          <span className="font-normal text-stone-500">
            {seriesLength === 1 ? '目前：單局' : `目前：${seriesLabel(seriesLength)}`}
          </span>
        </summary>
        <div className="mt-2 flex gap-2" role="group" aria-label="系列賽長度">
          {SERIES_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setSeriesLength(n)}
              aria-pressed={seriesLength === n}
              className={`flex-1 px-2 py-1.5 min-h-[44px] rounded-lg border text-xs touch-manipulation ${
                seriesLength === n
                  ? 'bg-amber-700/50 border-amber-400'
                  : 'bg-stone-800 border-stone-600'
              }`}
            >
              {seriesLabel(n)}
            </button>
          ))}
        </div>
      </details>
      <ul className="flex flex-col gap-2 max-h-[55vh] overflow-y-auto">
        {OPPONENTS.map((op, index) => (
          <OpponentCard
            key={op.id}
            op={op}
            index={index}
            unlocked={isOpponentUnlocked(index, ladder.clearedCount)}
            cleared={Boolean(ladder.cleared[op.id])}
            onChallenge={() => onStart(index, 'black')}
          />
        ))}
      </ul>
    </div>
  );
}

function OpponentCard({
  op,
  index,
  unlocked,
  cleared,
  onChallenge,
}: {
  op: OpponentDef;
  index: number;
  unlocked: boolean;
  cleared: boolean;
  onChallenge: () => void;
}): ReactElement {
  return (
    <li
      className={`rounded-xl border p-3 ${
        unlocked ? 'bg-stone-900/80 border-stone-600' : 'bg-stone-950/60 border-stone-800 opacity-60'
      }`}
      style={{ borderColor: unlocked ? op.accent : undefined }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">
            {index + 1}. {op.name}
            {cleared ? ' ✓' : ''}
          </p>
          <p className="text-xs text-stone-400">{op.tagline}</p>
          <p className="text-xs text-stone-300 mt-1">{op.blurb}</p>
        </div>
        <button
          type="button"
          disabled={!unlocked}
          onClick={onChallenge}
          className="shrink-0 px-3 py-2 rounded-lg bg-emerald-700 disabled:bg-stone-700 text-sm font-medium"
        >
          {unlocked ? '挑戰' : '鎖定'}
        </button>
      </div>
    </li>
  );
}

function PuzzleSetup({
  puzzles,
  ladder,
  onBack,
  onStart,
}: {
  puzzles: PuzzleDef[];
  ladder: LadderProgress;
  onBack: () => void;
  onStart: (index: number) => void;
}): ReactElement {
  return (
    <div className="w-full max-w-sm flex flex-col gap-3">
      <button type="button" onClick={onBack} className="text-sm text-stone-400 self-start">
        ← 返回
      </button>
      <p className="text-sm text-stone-300">
        固定殘局，逐題解鎖。無提示／無悔棋通關可拿 ★★★；選錯一手會立刻失敗。
      </p>
      <ul className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
        {puzzles.map((p, index) => {
          const unlocked = isPuzzleUnlocked(index, ladder);
          const done = Boolean(ladder.puzzlesSolved[p.id]);
          const stars = ladder.puzzleStars[p.id] ?? 0;
          return (
            <li key={p.id}>
              <button
                type="button"
                disabled={!unlocked}
                onClick={() => onStart(index)}
                aria-label={
                  unlocked
                    ? `${index + 1}. ${p.title}${done ? ` ${formatStars(stars)}` : ''}`
                    : `${index + 1}. ${p.title}（鎖定）`
                }
                className={`w-full text-left rounded-xl border p-3 transition-colors ${
                  unlocked
                    ? 'border-stone-600 bg-stone-900/80 hover:bg-stone-800'
                    : 'border-stone-800 bg-stone-950/60 opacity-60 cursor-not-allowed'
                }`}
              >
                <p className="font-semibold flex items-center justify-between gap-2">
                  <span>
                    {index + 1}. {p.title}
                    {done ? ' ✓' : unlocked ? '' : ' 🔒'}
                  </span>
                  <span className="text-amber-300 text-sm tracking-tight" aria-hidden="true">
                    {unlocked ? formatStars(stars) : '☆☆☆'}
                  </span>
                </p>
                <p className="text-xs text-emerald-300/90">{describePuzzleObjective(p)}</p>
                <p className="text-xs text-stone-400 mt-0.5">
                  {unlocked ? p.brief : '完成上一題後解鎖'}
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SideButton({
  side,
  label,
  sub,
  onClick,
}: {
  side: Piece;
  label: string;
  sub: string;
  onClick: () => void;
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1 px-6 py-4 rounded-xl bg-stone-800 hover:bg-stone-700 border-2 border-stone-600 transition-colors flex-1"
    >
      <span
        className={`w-10 h-10 rounded-full ring-2 bg-cover bg-center ${
          side === 'black' ? 'ring-stone-500' : 'ring-stone-400'
        }`}
        style={{
          backgroundColor: side === 'black' ? '#1c1917' : '#f8fafc',
          backgroundImage: `url(${import.meta.env.BASE_URL}piece-${side}.jpg)`,
        }}
      />
      <span className="font-medium">{label}</span>
      <span className="text-xs text-stone-400">{sub}</span>
    </button>
  );
}
