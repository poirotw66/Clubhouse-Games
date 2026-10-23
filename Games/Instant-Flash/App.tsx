import React, { useEffect, useRef, useState } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { JuiceSettingsPanel } from '@clubhouse/shared/JuiceSettings';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { haptic } from '@clubhouse/shared/juice';
import { playLose, playWin } from '@clubhouse/shared/synthAudio';
import GameCanvas from './components/GameCanvas';
import { GameState, GameStats, PlayMode } from './types';
import {
  loadBest,
  saveBest,
  BestRecord,
  loadLadder,
  saveLadder,
  LadderProgress,
  applyLadderResult,
  applyDailyResult,
  dailyStreakFrom,
  isOpponentUnlocked,
} from './storage';
import {
  INTENSITY_LABELS,
  SCENARIO_BLURBS,
  SCENARIO_DEFAULT_INTENSITY,
  SCENARIO_IDS,
  SCENARIO_LABELS,
  VERSUS_POINTS_TO_WIN,
  type PracticeIntensity,
  type PracticeScenario,
} from './constants';
import { OPPONENTS, opponentByIndex, type OpponentDef } from './opponents';
import { dateKey, dailyOpponentIndex, dailySeedNumber } from './daily';
import { RANK_LABELS } from './ranks';
import { Sword, Info, Users, Calendar, Swords } from 'lucide-react';

type MenuView = 'home' | 'ladder' | 'practice';

export default function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [menuView, setMenuView] = useState<MenuView>('home');
  const [playMode, setPlayMode] = useState<PlayMode>('challenge');
  const [practiceIntensity, setPracticeIntensity] = useState<PracticeIntensity>(2);
  const [practiceScenario, setPracticeScenario] = useState<PracticeScenario>('mixed');
  const [ladderIndex, setLadderIndex] = useState(0);
  const [ladder, setLadder] = useState<LadderProgress>(() => loadLadder());
  const [runSeed, setRunSeed] = useState<number | null>(null);
  const [activeOpponent, setActiveOpponent] = useState<OpponentDef | null>(null);
  const [lastStats, setLastStats] = useState<GameStats | null>(null);
  const [best, setBest] = useState<BestRecord>(() => loadBest());
  const previousStateRef = useRef<GameState>(GameState.MENU);

  const today = dateKey();
  const streak = dailyStreakFrom(ladder, today);
  const dailyIdx = dailyOpponentIndex(today);
  const dailyOpp = opponentByIndex(dailyIdx);
  const todayDaily = ladder.dailyRecords.find((r) => r.date === today);

  const selectScenario = (id: PracticeScenario) => {
    setPracticeScenario(id);
    setPracticeIntensity(SCENARIO_DEFAULT_INTENSITY[id]);
  };

  const startChallenge = () => {
    setPlayMode('challenge');
    setActiveOpponent(null);
    setRunSeed(null);
    setLastStats(null);
    setGameState(GameState.PLAYING);
  };

  const startPractice = () => {
    setPlayMode('practice');
    setActiveOpponent(null);
    setRunSeed(null);
    setLastStats(null);
    setGameState(GameState.PLAYING);
  };

  const startDuel = (index: number) => {
    const opp = opponentByIndex(index);
    if (!opp || !isOpponentUnlocked(index, ladder.clearedCount)) return;
    setPlayMode('duel');
    setLadderIndex(index);
    setActiveOpponent(opp);
    setRunSeed(null);
    setLastStats(null);
    setMenuView('home');
    setGameState(GameState.PLAYING);
  };

  const startDaily = () => {
    const opp = opponentByIndex(dailyIdx);
    if (!opp) return;
    setPlayMode('daily');
    setLadderIndex(dailyIdx);
    setActiveOpponent(opp);
    setRunSeed(dailySeedNumber(today));
    setLastStats(null);
    setGameState(GameState.PLAYING);
  };

  const startVersus = () => {
    setPlayMode('versus');
    setActiveOpponent(null);
    setRunSeed(null);
    setLastStats(null);
    setGameState(GameState.PLAYING);
  };

  const baseTier: PracticeIntensity =
    playMode === 'practice'
      ? practiceIntensity
      : playMode === 'duel' || playMode === 'daily'
        ? ((activeOpponent?.baseTier ?? 0) as PracticeIntensity)
        : 0;
  const activeScenario: PracticeScenario =
    playMode === 'practice'
      ? practiceScenario
      : activeOpponent
        ? activeOpponent.scenario
        : 'mixed';

  const handleGameOver = (stats: GameStats) => {
    if (playMode === 'challenge') {
      setBest(saveBest(stats.score, stats.maxCombo));
    }

    if (playMode === 'duel' && activeOpponent) {
      const { progress, newlyCleared } = applyLadderResult(ladder, ladderIndex, {
        won: Boolean(stats.duelWon),
        bestReactionMs: stats.bestReactionMs,
        rank: stats.rank,
      });
      void newlyCleared;
      const saved = saveLadder(progress);
      setLadder(saved);
    }

    if (playMode === 'daily' && activeOpponent) {
      let progress = applyLadderResult(ladder, ladderIndex, {
        won: Boolean(stats.duelWon),
        bestReactionMs: stats.bestReactionMs,
        rank: stats.rank,
      }).progress;
      progress = applyDailyResult(progress, {
        date: today,
        won: Boolean(stats.duelWon),
        bestReactionMs: stats.bestReactionMs ?? 0,
        rank: stats.rank ?? 'C',
      });
      setLadder(saveLadder(progress));
    }

    setLastStats(stats);
    setGameState(GameState.GAMEOVER);
  };

  useEffect(() => {
    if (
      gameState === GameState.GAMEOVER &&
      previousStateRef.current !== GameState.GAMEOVER &&
      lastStats
    ) {
      if (playMode === 'practice' || playMode === 'versus') {
        /* no sting */
      } else if (
        (playMode === 'duel' || playMode === 'daily') &&
        lastStats.duelWon
      ) {
        playWin();
        haptic('win');
      } else if (
        (playMode === 'duel' || playMode === 'daily') &&
        lastStats.duelWon === false
      ) {
        playLose();
        haptic('error');
      } else if (lastStats.score >= 5000) {
        playWin();
        haptic('win');
      } else {
        playLose();
        haptic('error');
      }
    }
    previousStateRef.current = gameState;
  }, [gameState, lastStats, playMode]);

  const resultMeta = (() => {
    if (playMode === 'practice') {
      return {
        title: '練習結束',
        variant: 'neutral' as const,
        badge: SCENARIO_LABELS[practiceScenario],
        subtitle: `${SCENARIO_LABELS[practiceScenario]} · 強度 ${INTENSITY_LABELS[practiceIntensity]} · 不計入個人最佳`,
        primary: '再練習',
      };
    }
    if (playMode === 'versus') {
      const w = lastStats?.versusWinner;
      return {
        title: w === 1 ? '玩家一勝' : w === 2 ? '玩家二勝' : '對戰結束',
        variant: (w ? 'win' : 'neutral') as 'win' | 'neutral',
        badge: `先得 ${VERSUS_POINTS_TO_WIN}`,
        subtitle: '同機拔刀：左側 P1（A）／右側 P2（L）',
        primary: '再來一場',
      };
    }
    if (playMode === 'duel' || playMode === 'daily') {
      const won = Boolean(lastStats?.duelWon);
      const name = activeOpponent?.name ?? '對手';
      return {
        title: won ? `擊敗 ${name}！` : `敗給 ${name}`,
        variant: (won ? 'win' : 'lose') as 'win' | 'lose',
        badge: lastStats?.rank ? RANK_LABELS[lastStats.rank] : name,
        subtitle:
          playMode === 'daily'
            ? `每日對決 · ${today} · 連勝 ${dailyStreakFrom(ladder, today)}`
            : activeOpponent?.catchphrases[won ? 'lose' : 'win'] ?? '',
        primary: won ? '下一位' : '再挑戰',
      };
    }
    return {
      title:
        lastStats && lastStats.score >= 5000 ? '修練成功！' : '修練結束',
      variant: (lastStats && lastStats.score >= 5000 ? 'win' : 'lose') as
        | 'win'
        | 'lose',
      badge:
        lastStats && lastStats.score >= 10000
          ? '宗師'
          : lastStats && lastStats.score >= 5000
            ? '上級'
            : '見習',
      subtitle: '左右斬 · Perfect／Good 窗隨連段收斂 · 佯攻勿砍',
      primary: '再挑戰一次',
    };
  })();

  const restartSame = () => {
    if (playMode === 'practice') startPractice();
    else if (playMode === 'versus') startVersus();
    else if (playMode === 'daily') startDaily();
    else if (playMode === 'duel') startDuel(ladderIndex);
    else startChallenge();
  };

  const resultPrimary = () => {
    if (playMode === 'duel' && lastStats?.duelWon) {
      const next = ladderIndex + 1;
      if (next < OPPONENTS.length && isOpponentUnlocked(next, ladder.clearedCount)) {
        startDuel(next);
        return;
      }
    }
    restartSame();
  };

  return (
    <div className="w-full min-h-dvh h-screen bg-slate-950 flex flex-col overflow-hidden font-sans text-slate-200 select-none">
      <BackToMenu />
      <div className="fixed inset-0 crt-overlay z-50 pointer-events-none opacity-20" />

      {gameState === GameState.MENU && (
        <div className="absolute inset-0 flex items-start justify-center z-40 overflow-y-auto">
          <div
            className="fixed inset-0 bg-[#12182a] bg-cover bg-center"
            style={{ backgroundImage: `url(${import.meta.env.BASE_URL}dojo-bg.jpg)` }}
          />
          <div className="fixed inset-0 bg-slate-950/55" />
          <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_#3d4f6f55_0%,_transparent_55%)]" />
          <div className="fixed bottom-0 w-full h-1/2 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent" />

          <div className="relative z-10 text-center max-w-lg w-full p-6 md:p-8 animate-fade-in my-8">
            <div className="mb-4 inline-block p-4 rounded-full bg-slate-800/70 border border-emerald-500/40 shadow-2xl shadow-emerald-900/40">
              <Sword size={48} className="text-emerald-400" />
            </div>

            <h1 className="text-5xl md:text-6xl font-display font-black text-transparent bg-clip-text bg-gradient-to-br from-emerald-300 to-cyan-500 mb-2 drop-shadow-sm">
              剎那一閃
            </h1>
            <p className="text-slate-300 font-display tracking-[0.3em] mb-6 text-sm">
              武士反應訓練
            </p>

            {(best.highScore > 0 || best.maxCombo > 0 || streak > 0) && (
              <p className="mb-4 text-xs text-slate-400 font-display tracking-wider">
                個人最佳{' '}
                <span className="text-emerald-400 tabular-nums">
                  {best.highScore.toLocaleString()}
                </span>
                {' · '}
                連段{' '}
                <span className="text-amber-400 tabular-nums">{best.maxCombo}</span>
                {streak > 0 && (
                  <>
                    {' · '}
                    每日連勝{' '}
                    <span className="text-cyan-300 tabular-nums">{streak}</span>
                  </>
                )}
              </p>
            )}

            {menuView === 'home' && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setMenuView('ladder')}
                  className="w-full group relative px-8 py-4 bg-slate-100 text-slate-900 font-black font-display text-xl tracking-wider hover:bg-emerald-400 transition-colors flex items-center justify-center gap-2"
                >
                  <Swords size={22} />
                  對決階梯
                </button>

                <button
                  type="button"
                  onClick={startDaily}
                  className="w-full px-8 py-3 bg-slate-800/90 text-cyan-200 font-display font-bold text-lg tracking-wider border border-cyan-500/40 hover:bg-slate-700/90 transition-colors flex items-center justify-center gap-2"
                >
                  <Calendar size={18} />
                  每日對決
                  {dailyOpp && (
                    <span className="text-xs font-normal text-slate-400">
                      · {dailyOpp.name}
                      {todayDaily?.won ? ' ✓' : ''}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={startVersus}
                  className="w-full px-8 py-3 bg-slate-800/90 text-amber-200 font-display font-bold text-lg tracking-wider border border-amber-500/40 hover:bg-slate-700/90 transition-colors flex items-center justify-center gap-2"
                >
                  <Users size={18} />
                  雙人拔刀
                </button>

                <button
                  type="button"
                  onClick={startChallenge}
                  className="w-full px-8 py-3 bg-slate-800/90 text-slate-100 font-display font-bold text-lg tracking-wider border border-slate-500/50 hover:bg-slate-700/90 transition-colors"
                >
                  挑戰模式（無盡）
                </button>

                <button
                  type="button"
                  onClick={() => setMenuView('practice')}
                  className="w-full px-8 py-3 bg-slate-800/90 text-emerald-300 font-display font-bold text-lg tracking-wider border border-emerald-500/40 hover:bg-slate-700/90 transition-colors"
                >
                  練習設定
                </button>
              </div>
            )}

            {menuView === 'ladder' && (
              <div className="space-y-3 text-left">
                <button
                  type="button"
                  onClick={() => setMenuView('home')}
                  className="text-sm text-slate-400 hover:text-slate-200 font-display tracking-wider"
                >
                  ← 返回
                </button>
                <p className="text-slate-400 text-xs font-display tracking-wider">
                  擊敗對手解鎖下一位 · 頭目戰為最終關
                </p>
                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                  {OPPONENTS.map((op, index) => {
                    const unlocked = isOpponentUnlocked(index, ladder.clearedCount);
                    const cleared = Boolean(ladder.cleared[op.id]);
                    const ob = ladder.opponentBests[op.id];
                    return (
                      <div
                        key={op.id}
                        className={`rounded-lg border p-3 ${
                          unlocked
                            ? 'bg-slate-900/80 border-slate-600'
                            : 'bg-slate-950/60 border-slate-800 opacity-60'
                        }`}
                        style={unlocked ? { borderColor: op.accent } : undefined}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-display font-bold text-base" style={{ color: op.accent }}>
                              {index + 1}. {op.name}
                              {op.isBoss ? ' ⚔' : ''}
                              {cleared ? ' ✓' : ''}
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">{op.tagline}</div>
                            <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                              {op.blurb}
                            </div>
                            {ob && (
                              <div className="text-[11px] text-slate-400 mt-1 font-display">
                                {ob.rank ? RANK_LABELS[ob.rank] : '—'}
                                {ob.bestReactionMs != null && (
                                  <> · 最快 {ob.bestReactionMs}ms</>
                                )}
                                {' · '}
                                {ob.wins}勝
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            disabled={!unlocked}
                            onClick={() => startDuel(index)}
                            className={`min-h-[44px] min-w-[72px] px-3 py-2 text-sm font-display font-bold tracking-wider border ${
                              unlocked
                                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-100'
                                : 'bg-slate-800 border-slate-700 text-slate-500'
                            }`}
                          >
                            {unlocked ? '挑戰' : '鎖定'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {menuView === 'practice' && (
              <div className="rounded-lg border border-emerald-500/30 bg-slate-900/70 p-3 space-y-2 text-left">
                <button
                  type="button"
                  onClick={() => setMenuView('home')}
                  className="text-sm text-slate-400 hover:text-slate-200 font-display tracking-wider"
                >
                  ← 返回
                </button>
                <p className="text-slate-400 text-xs font-display tracking-wider">練習劇本</p>
                <div className="grid grid-cols-2 gap-2" role="group" aria-label="練習劇本">
                  {SCENARIO_IDS.map((id) => {
                    const selected = practiceScenario === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => selectScenario(id)}
                        aria-pressed={selected}
                        className={`min-h-[44px] px-2 py-2 text-left text-sm font-display font-bold tracking-wider border transition-colors ${
                          selected
                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-100'
                            : 'bg-slate-800/80 border-slate-600 text-slate-400 hover:bg-slate-700/80'
                        }`}
                      >
                        <span className="block">{SCENARIO_LABELS[id]}</span>
                        <span className="block text-[10px] font-normal text-slate-500 mt-0.5 leading-tight">
                          {SCENARIO_BLURBS[id]}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-slate-400 text-xs font-display tracking-wider pt-1">
                  練習強度
                </p>
                <div className="flex gap-2 justify-center" role="group" aria-label="練習強度">
                  {([0, 2, 4] as PracticeIntensity[]).map((tier) => {
                    const selected = practiceIntensity === tier;
                    return (
                      <button
                        key={tier}
                        type="button"
                        onClick={() => setPracticeIntensity(tier)}
                        aria-pressed={selected}
                        className={`flex-1 min-h-[44px] px-2 py-2 text-sm font-display font-bold tracking-wider border transition-colors ${
                          selected
                            ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                            : 'bg-slate-800/80 border-slate-600 text-slate-400 hover:bg-slate-700/80'
                        }`}
                      >
                        {INTENSITY_LABELS[tier]}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={startPractice}
                  className="w-full px-8 py-3 bg-slate-800/90 text-emerald-300 font-display font-bold text-lg tracking-wider border border-emerald-500/40 hover:bg-slate-700/90 transition-colors"
                >
                  開始練習
                </button>
              </div>
            )}

            <div className="mt-8 text-left bg-slate-900/85 p-5 rounded-lg border border-slate-600/60 text-sm text-slate-300 leading-relaxed shadow-xl">
              <div className="flex items-center gap-2 mb-2 text-emerald-400 font-bold uppercase">
                <Info size={16} /> 玩法說明
              </div>
              <ol className="list-decimal pl-5 space-y-2">
                <li>
                  按住 <strong className="text-cyan-300">左半／A</strong> 或{' '}
                  <strong className="text-amber-300">右半／D</strong> 進入拔刀待機。
                </li>
                <li>
                  看敵人暗器路線：<span className="text-cyan-300">上偏＝左斬</span>、
                  <span className="text-amber-300">下偏＝右斬</span>。
                </li>
                <li>
                  攻擊命中瞬間 <strong className="text-white">放開對應側</strong> 反擊。
                </li>
                <li>
                  <strong className="text-rose-300">佯攻</strong>
                  ：紅閃後暗器消失——不要放開，看破得分。
                </li>
                <li>太早放開／錯邊＝受罰；太晚＝受傷。</li>
              </ol>
              <p className="md:hidden text-emerald-400/90 text-xs mt-4 text-center">
                觸控：按住左或右半螢幕待機，放開即反擊
              </p>
              <div className="mt-4">
                <JuiceSettingsPanel compact />
              </div>
            </div>
          </div>
        </div>
      )}

      {gameState !== GameState.MENU && (
        <GameCanvas
          key={
            gameState === GameState.PLAYING
              ? `playing-${playMode}-${ladderIndex}-${baseTier}-${activeScenario}-${runSeed ?? 'r'}`
              : 'over'
          }
          gameActive={gameState === GameState.PLAYING}
          playMode={playMode}
          baseTier={baseTier}
          scenario={activeScenario}
          opponent={activeOpponent}
          seed={runSeed}
          onGameOver={handleGameOver}
        />
      )}

      {gameState === GameState.GAMEOVER && lastStats && (
        <ResultOverlay
          title={resultMeta.title}
          subtitle={resultMeta.subtitle}
          badge={resultMeta.badge}
          variant={resultMeta.variant}
          stats={[
            ...(playMode === 'versus'
              ? [
                  { label: '玩家一', value: lastStats.versusP1 },
                  { label: '玩家二', value: lastStats.versusP2 },
                ]
              : [
                  { label: '總分', value: lastStats.score.toLocaleString() },
                  { label: '最高連段', value: lastStats.maxCombo },
                  { label: 'Perfect', value: lastStats.perfects },
                  { label: 'Good', value: lastStats.goods },
                ]),
            ...(lastStats.bestReactionMs != null
              ? [{ label: '最快反應', value: `${lastStats.bestReactionMs} ms` }]
              : []),
            ...(lastStats.avgReactionMs != null
              ? [{ label: '平均反應', value: `${lastStats.avgReactionMs} ms` }]
              : []),
            ...(lastStats.rank
              ? [{ label: '評價', value: RANK_LABELS[lastStats.rank] }]
              : []),
            ...(playMode === 'practice'
              ? [
                  { label: '練習劇本', value: SCENARIO_LABELS[practiceScenario] },
                  { label: '練習強度', value: INTENSITY_LABELS[practiceIntensity] },
                ]
              : playMode === 'challenge'
                ? [
                    { label: '個人最佳分數', value: best.highScore.toLocaleString() },
                    { label: '個人最高連段', value: String(best.maxCombo) },
                  ]
                : playMode === 'daily'
                  ? [
                      { label: '每日連勝', value: String(dailyStreakFrom(ladder, today)) },
                      { label: '佯攻失誤', value: lastStats.feints },
                    ]
                  : playMode === 'duel'
                    ? [
                        { label: '錯邊', value: lastStats.wrongSides },
                        { label: '佯攻失誤', value: lastStats.feints },
                      ]
                    : []),
          ]}
          primaryLabel={resultMeta.primary}
          onPrimary={resultPrimary}
          secondaryLabel="主選單"
          onSecondary={() => {
            setGameState(GameState.MENU);
            setMenuView('home');
            setLastStats(null);
          }}
        />
      )}
    </div>
  );
}
