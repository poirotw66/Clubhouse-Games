import {
  type CheckersTacticalAnalysis,
} from '../utils/checkersLogic';
import { type OpponentDef } from '../utils/opponents';
import { type MatchState, type MatchLength } from '../utils/match';
import { type PuzzleDef } from '../utils/puzzles';
import { type CheckersProgress } from '../utils/storage';
import { BOARD_THEMES, type BoardThemeId } from '../types/checkersThemes';

interface ThreatRadarLeftProps {
  tactics: CheckersTacticalAnalysis;
  is3D: boolean;
  onToggle3D: () => void;
  showThreatLens: boolean;
  onToggleThreatLens: () => void;
  currentThemeId: BoardThemeId;
  onSelectTheme: (id: BoardThemeId) => void;
}

export function ThreatRadarLeft({
  tactics,
  is3D,
  onToggle3D,
  showThreatLens,
  onToggleThreatLens,
  currentThemeId,
  onSelectTheme,
}: ThreatRadarLeftProps) {
  return (
    <aside className="ck-wing ck-wing--left" aria-label="戰情雷達與局勢分析">
      <div className="ck-wing__title">
        <span className="text-amber-400">⚡</span>
        <span>戰情雷達與局勢分析</span>
      </div>

      {/* Visual Perspective & Lens Controls */}
      <div className="ck-wing__card">
        <span className="text-xs font-bold text-amber-200">視覺與戰術透視</span>
        <div className="flex gap-1.5 mt-1">
          <button
            type="button"
            onClick={onToggle3D}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all border ${
              is3D
                ? 'bg-amber-600/40 border-amber-400 text-amber-100 shadow-md'
                : 'bg-stone-800/80 border-stone-600 text-stone-300'
            }`}
          >
            {is3D ? '🎲 3D 實木透視' : '📐 2D 經典俯視'}
          </button>
          <button
            type="button"
            onClick={onToggleThreatLens}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all border ${
              showThreatLens
                ? 'bg-rose-600/40 border-rose-400 text-rose-100 shadow-md'
                : 'bg-stone-800/80 border-stone-600 text-stone-300'
            }`}
          >
            {showThreatLens ? '👁️ 威脅透視：開' : '👁️ 威脅透視：關'}
          </button>
        </div>

        {/* Board Finish Selector */}
        <div className="flex flex-col gap-1 mt-1.5">
          <span className="text-[11px] text-stone-300">棋盤實木工藝材質</span>
          <div className="grid grid-cols-3 gap-1">
            {(['walnut', 'obsidian', 'mahogany'] as BoardThemeId[]).map((tid) => (
              <button
                key={tid}
                type="button"
                onClick={() => onSelectTheme(tid)}
                className={`py-1 px-1 rounded text-[11px] font-medium border truncate transition-colors ${
                  currentThemeId === tid
                    ? 'border-amber-400 bg-amber-500/30 text-amber-100 font-bold'
                    : 'border-stone-700 bg-stone-900/60 text-stone-400 hover:text-stone-200'
                }`}
              >
                {BOARD_THEMES[tid].name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Advantage Radar Meter */}
      <div className="ck-wing__card">
        <div className="ck-wing__row">
          <span className="ck-wing__label">黑方勢力比</span>
          <span className="ck-wing__value text-amber-300">{tactics.blackAdvantagePct}%</span>
        </div>
        <div className="ck-bar-track">
          <div
            className="ck-bar-fill bg-gradient-to-r from-amber-500 via-yellow-400 to-emerald-400"
            style={{ width: `${tactics.blackAdvantagePct}%` }}
          />
        </div>
        <div className="ck-wing__row text-xs text-stone-300">
          <span>局勢評估</span>
          <span className="font-bold text-amber-200">{tactics.evaluationText}</span>
        </div>
      </div>

      {/* Forces Breakdown */}
      <div className="ck-wing__card">
        <span className="text-xs font-bold text-amber-200">兵力與封王</span>
        <div className="flex flex-col gap-1 mt-0.5 text-xs">
          <div className="ck-wing__row">
            <span className="ck-wing__label">黑方子力</span>
            <span className="ck-wing__value text-amber-300">
              {tactics.blackMen} 兵 {tactics.blackKings > 0 ? `· ${tactics.blackKings} 王` : ''}
            </span>
          </div>
          <div className="ck-wing__row">
            <span className="ck-wing__label">白方子力</span>
            <span className="ck-wing__value text-stone-300">
              {tactics.whiteMen} 兵 {tactics.whiteKings > 0 ? `· ${tactics.whiteKings} 王` : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Defense & Center Control */}
      <div className="ck-wing__card">
        <span className="text-xs font-bold text-amber-200">防守與中路控制</span>
        <div className="flex flex-col gap-1 mt-0.5 text-xs">
          <div className="ck-wing__row">
            <span className="ck-wing__label">黑方底線鐵壁</span>
            <span className="ck-wing__value">{tactics.blackBackRankGuard} 子固守</span>
          </div>
          <div className="ck-wing__row">
            <span className="ck-wing__label">白方底線鐵壁</span>
            <span className="ck-wing__value">{tactics.whiteBackRankGuard} 子固守</span>
          </div>
          <div className="ck-wing__row">
            <span className="ck-wing__label">中心格控制</span>
            <span className="ck-wing__value text-emerald-300">
              黑 {tactics.blackCenterControl} vs 白 {tactics.whiteCenterControl}
            </span>
          </div>
        </div>
      </div>

      {/* Tactical Threat Warning Banner */}
      <div
        className={
          tactics.isCaptureMandatory ||
          (tactics.oppCanCapture && tactics.oppMaxJumpHops >= 2)
            ? 'ck-intel-alert ck-intel-alert--alert'
            : 'ck-intel-alert'
        }
      >
        <div className="font-bold">{tactics.threatAlert}</div>
        <div className="text-xs mt-1 text-stone-300 leading-snug">
          {tactics.isCaptureMandatory
            ? '根據西洋跳棋規則，遇跳吃機會必須強制執行！'
            : '保護好後排底線，避免敵方兵力偷渡封王。'}
        </div>
      </div>

      {/* Keyboard Controls Guide */}
      <div className="ck-wing__card">
        <span className="text-xs font-bold text-stone-300 tracking-wider">實體鍵盤對弈</span>
        <div className="ck-key-guide-grid">
          <div className="ck-key-item">
            <kbd className="ck-key-badge">WASD</kbd>
            <span>移標</span>
          </div>
          <div className="ck-key-item">
            <kbd className="ck-key-badge">Space</kbd>
            <span>走子</span>
          </div>
          <div className="ck-key-item">
            <kbd className="ck-key-badge">Z</kbd>
            <span>悔棋</span>
          </div>
          <div className="ck-key-item">
            <kbd className="ck-key-badge">H</kbd>
            <span>提示</span>
          </div>
          <div className="ck-key-item">
            <kbd className="ck-key-badge">V</kbd>
            <span>視角</span>
          </div>
          <div className="ck-key-item">
            <kbd className="ck-key-badge">T</kbd>
            <span>透視</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

interface ThreatRadarRightProps {
  gameMode: string;
  opponent: OpponentDef;
  matchTarget: MatchLength;
  match: MatchState;
  activePuzzle: PuzzleDef;
  puzzleMoves: number;
  progress: CheckersProgress;
  totalOpponents: number;
}

export function ThreatRadarRight({
  gameMode,
  opponent,
  matchTarget,
  match,
  activePuzzle,
  puzzleMoves,
  progress,
  totalOpponents,
}: ThreatRadarRightProps) {
  return (
    <aside className="ck-wing ck-wing--right" aria-label="對手戰情與系列賽工坊">
      <div className="ck-wing__title">
        <span className="text-rose-400">🏆</span>
        <span>對手戰情與工坊</span>
      </div>

      <div className="ck-wing__card">
        <span className="text-xs font-bold text-rose-300">當前對弈模式</span>
        {gameMode === 'series' ? (
          <div className="flex flex-col gap-1.5 mt-1">
            <div className="ck-wing__row">
              <span className="ck-wing__label">系列賽目標</span>
              <span className="ck-wing__value text-amber-300 font-bold">
                搶 {matchTarget} 勝
              </span>
            </div>
            <div className="ck-wing__row">
              <span className="ck-wing__label">大比分</span>
              <span className="ck-wing__value text-emerald-300 font-bold">
                黑 {match.scoreA} : 白 {match.scoreB}
              </span>
            </div>
            <div className="ck-wing__row text-xs text-stone-400">
              <span>進行場次</span>
              <span>第 {match.gameIndex} 局</span>
            </div>
          </div>
        ) : gameMode === 'puzzle' ? (
          <div className="flex flex-col gap-1.5 mt-1">
            <div className="ck-wing__row">
              <span className="ck-wing__label">殘局謎題</span>
              <span className="ck-wing__value text-amber-200">{activePuzzle.name}</span>
            </div>
            <div className="ck-wing__row text-xs text-stone-400">
              <span>目標步數</span>
              <span>{activePuzzle.winIn} 步內必勝</span>
            </div>
            <div className="ck-wing__row text-xs text-stone-400">
              <span>已走步數</span>
              <span>{puzzleMoves} 步</span>
            </div>
          </div>
        ) : gameMode === 'bot' ? (
          <div className="flex flex-col gap-1.5 mt-1">
            <div className="ck-wing__row">
              <span className="ck-wing__label">對手</span>
              <span className="ck-wing__value text-rose-200 font-bold">{opponent.name}</span>
            </div>
            <div className="ck-wing__row text-xs text-stone-400">
              <span>風格</span>
              <span>{opponent.tagline}</span>
            </div>
            <div className="ck-wing__row text-xs text-stone-400">
              <span>開場口頭禪</span>
              <span className="text-right leading-tight text-amber-200">
                「{opponent.catchphrase.intro}」
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 mt-1">
            <div className="ck-wing__row">
              <span className="ck-wing__label">同機雙人對弈</span>
              <span className="ck-wing__value text-amber-200">自由對抗</span>
            </div>
            <div className="ck-wing__row text-xs text-stone-400">
              <span>回合交換</span>
              <span>輪流執子</span>
            </div>
          </div>
        )}
      </div>

      <div className="ck-wing__card">
        <span className="text-xs font-bold text-stone-300 tracking-wider">個人榮譽紀錄</span>
        <div className="flex flex-col gap-1 mt-1 text-xs">
          <div className="ck-wing__row">
            <span className="ck-wing__label">當前連勝</span>
            <span className="ck-wing__value text-amber-300">{progress.winStreak} 勝</span>
          </div>
          <div className="ck-wing__row">
            <span className="ck-wing__label">歷史最佳連勝</span>
            <span className="ck-wing__value">{progress.bestStreak} 勝</span>
          </div>
          <div className="ck-wing__row">
            <span className="ck-wing__label">系列賽勝場</span>
            <span className="ck-wing__value text-emerald-300">{progress.seriesWins} 場</span>
          </div>
          <div className="ck-wing__row">
            <span className="ck-wing__label">已解鎖對手</span>
            <span className="ck-wing__value">
              {progress.beatenOpponents.length + 1} / {totalOpponents}
            </span>
          </div>
        </div>
      </div>

      <div className="ck-wing__card">
        <span className="text-xs font-bold text-amber-300 tracking-wider">大師對弈錦囊</span>
        <div className="flex flex-col gap-2 mt-1 text-[11px] leading-relaxed text-stone-300">
          <div>
            <strong className="text-amber-200">🛡️ 底線鐵壁法則：</strong>
            未到勝負關鍵切勿移動底線四子，阻止敵方偷渡封王。
          </div>
          <div>
            <strong className="text-rose-200">🎯 誘餌雙殺陷阱：</strong>
            主動棄一子誘敵深入，隨後連跳反殺逆轉全局！
          </div>
          <div>
            <strong className="text-emerald-200">👑 中央王霸權：</strong>
            成王後第一時間壓制中央大斜線，封鎖對手活動半徑。
          </div>
        </div>
      </div>
    </aside>
  );
}

interface MobileTacticalBarProps {
  tactics: CheckersTacticalAnalysis;
  is3D: boolean;
  onToggle3D: () => void;
  showThreatLens: boolean;
  onToggleThreatLens: () => void;
}

export function MobileTacticalBar({
  tactics,
  is3D,
  onToggle3D,
  showThreatLens,
  onToggleThreatLens,
}: MobileTacticalBarProps) {
  return (
    <div className="ck-mobile-tactical mb-2 flex-col gap-1.5" role="status" aria-label="西洋跳棋戰情">
      <div className="w-full flex items-center justify-between text-xs">
        <span className="font-bold text-amber-300">黑方勢力 {tactics.blackAdvantagePct}%</span>
        <span
          className={
            tactics.isCaptureMandatory ? 'text-rose-300 font-bold' : 'text-stone-300'
          }
        >
          {tactics.isCaptureMandatory
            ? `⚔️ 強制跳吃 (${tactics.maxJumpHops} 連跳)`
            : tactics.evaluationText}
        </span>
        <span className="text-emerald-300 font-medium">
          {tactics.blackKings > 0 ? `黑 ${tactics.blackKings} 王` : '前鋒推進中'}
        </span>
      </div>

      <div className="w-full flex items-center justify-between gap-2 pt-1 border-t border-amber-900/40">
        <button
          type="button"
          onClick={onToggle3D}
          className={`px-2.5 py-1 rounded text-xs font-semibold border ${
            is3D
              ? 'bg-amber-600/40 border-amber-400 text-amber-200'
              : 'bg-stone-800/80 border-stone-600 text-stone-300'
          }`}
        >
          {is3D ? '🎲 3D 實木' : '📐 2D 俯視'}
        </button>
        <button
          type="button"
          onClick={onToggleThreatLens}
          className={`px-2.5 py-1 rounded text-xs font-semibold border ${
            showThreatLens
              ? 'bg-rose-600/40 border-rose-400 text-rose-200'
              : 'bg-stone-800/80 border-stone-600 text-stone-300'
          }`}
        >
          {showThreatLens ? '👁️ 威脅透視：開' : '👁️ 威脅透視：關'}
        </button>
      </div>
    </div>
  );
}
