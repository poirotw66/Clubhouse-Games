import { useState, useCallback, useEffect, useRef } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { ScoreFlash } from '@clubhouse/shared/ScoreFlash';
import { playMove, playScore, playWin, playLose } from '@clubhouse/shared/synthAudio';
import type {
  DominoesState,
  EndId,
  MatchState,
  PlayerId,
  Difficulty,
  RuleVariant,
  MatchTarget,
} from './utils/dominoesLogic';
import {
  createInitialState,
  createMatchState,
  applyRoundToMatch,
  advanceMatchRound,
  playTile,
  drawTiles,
  pass,
  getChainEnds,
  getEndPip,
  getPlayableEnds,
  getPlayableTiles,
  getValidMoves,
  pickBotMove,
  handSum,
  sumOpenEnds,
  boardToChain,
  DIFFICULTY_LABELS,
  DIFFICULTY_BLURBS,
  RULE_LABELS,
  RULE_BLURBS,
  MATCH_TARGETS,
  DEFAULT_MATCH_TARGET,
} from './utils/dominoesLogic';
import {
  loadStats,
  saveStats,
  recordMatchResult,
  loadMatch,
  saveMatch,
  clearMatch,
  type DominoesStats,
} from './utils/storage';
import { DominoTile, PlacedDominoTile } from './components/DominoTile';
import {
  FirstRunGuide,
  hasSeenFirstRunGuide,
} from './components/FirstRunGuide';
import { RefreshCw, BookOpen, Users, Bot, Undo2, Lightbulb } from 'lucide-react';

type GameMode = 'two' | 'bot';

function persistMatchSnapshot(opts: {
  match: MatchState;
  ruleVariant: RuleVariant;
  difficulty: Difficulty;
  gameMode: GameMode;
}): void {
  if (opts.match.matchOver) {
    clearMatch();
    return;
  }
  saveMatch({
    scores: opts.match.scores,
    target: opts.match.target as MatchTarget,
    round: opts.match.round,
    ruleVariant: opts.ruleVariant,
    difficulty: opts.difficulty,
    gameMode: opts.gameMode,
  });
}

export default function App() {
  const saved = loadMatch();
  const initialStats = loadStats();
  const [gameMode, setGameMode] = useState<GameMode>(saved?.gameMode ?? 'bot');
  const [difficulty, setDifficulty] = useState<Difficulty>(
    saved?.difficulty ?? initialStats.lastDifficulty,
  );
  const [ruleVariant, setRuleVariant] = useState<RuleVariant>(
    saved?.ruleVariant ?? initialStats.lastRule ?? 'fives',
  );
  const [matchTarget, setMatchTarget] = useState<MatchTarget>(
    saved?.target ?? initialStats.lastTarget ?? DEFAULT_MATCH_TARGET,
  );
  const [match, setMatch] = useState<MatchState>(() => {
    if (saved) {
      return {
        scores: saved.scores,
        target: saved.target,
        round: saved.round,
        matchOver: false,
        matchWinner: null,
      };
    }
    return createMatchState(matchTarget);
  });
  const [state, setState] = useState<DominoesState>(() =>
    createInitialState(saved?.ruleVariant ?? 'fives'),
  );
  const [history, setHistory] = useState<DominoesState[]>([]);
  const [hintMove, setHintMove] = useState<{ tileId: number; end: EndId } | null>(
    null,
  );
  const [stats, setStats] = useState<DominoesStats>(initialStats);
  const [showRules, setShowRules] = useState(false);
  const [showFirstRun, setShowFirstRun] = useState(() => !hasSeenFirstRunGuide());
  const [selectedTileId, setSelectedTileId] = useState<number | null>(null);
  const [lastPlacedId, setLastPlacedId] = useState<number | null>(null);
  const [scoreFlash, setScoreFlash] = useState<{ text: string; key: number } | null>(
    null,
  );
  const [roundBanner, setRoundBanner] = useState(false);
  const botScheduled = useRef(false);
  const prevPhaseRef = useRef(state.phase);
  const matchRecordedRef = useRef(false);

  const currentHand = state.hands[state.currentPlayer];
  const playable = getPlayableTiles(currentHand, state.board);
  const playableIds = new Set(playable.map((t) => t.id));
  const ends = getChainEnds(state.board);
  const canPlayAny = playable.length > 0;
  const playableEndIds = getPlayableEnds(state.board);
  const openSum = sumOpenEnds(state.board);
  const chain = boardToChain(state.board);
  const showSpinnerCross =
    ruleVariant === 'fives' && state.board.spinnerActive;

  const isBotTurn =
    gameMode === 'bot' &&
    state.phase === 'playing' &&
    state.currentPlayer === 1;

  const humanCanAct =
    state.phase === 'playing' &&
    (gameMode === 'two' || state.currentPlayer === 0);

  const flashScore = useCallback((points: number) => {
    if (points <= 0) return;
    playScore();
    setScoreFlash({ text: `+${points}`, key: Date.now() });
  }, []);

  useEffect(() => {
    if (!isBotTurn || botScheduled.current) return;
    botScheduled.current = true;
    const timer = setTimeout(() => {
      const hand = state.hands[1];
      if (canPlay(hand, state.board)) {
        const move = pickBotMove(hand, state.board, state.hands[0].length, difficulty, {
          ruleVariant: state.ruleVariant,
          opponentLack: state.suspectedLack[0],
        });
        if (move) {
          const next = playTile(state, 1, move.tileId, move.end);
          if (next) {
            playMove();
            setLastPlacedId(move.tileId);
            if (next.lastPlayScore > 0 && next.phase === 'playing') {
              flashScore(next.lastPlayScore);
            }
            setState(next);
          }
        }
      } else if (state.ruleVariant === 'block') {
        const next = pass(state, 1);
        if (next) setState(next);
      } else {
        setState(drawTiles(state, 1));
      }
      botScheduled.current = false;
    }, 600);
    return () => {
      clearTimeout(timer);
      botScheduled.current = false;
    };
  }, [isBotTurn, state, difficulty, flashScore]);

  // Round over → apply to match; flash round bonus.
  useEffect(() => {
    if (state.phase === 'playing') {
      prevPhaseRef.current = 'playing';
      return;
    }
    if (prevPhaseRef.current !== 'playing') return;
    prevPhaseRef.current = state.phase;

    if (state.lastPlayScore > 0) {
      flashScore(state.lastPlayScore);
    }

    setMatch((prev) => {
      const next = applyRoundToMatch(prev, state.handScores);
      persistMatchSnapshot({
        match: next,
        ruleVariant,
        difficulty,
        gameMode,
      });
      return next;
    });
    setRoundBanner(true);
  }, [state.phase, state.handScores, state.lastPlayScore, ruleVariant, difficulty, gameMode, flashScore]);

  // Match over → record stats + sound once.
  useEffect(() => {
    if (!match.matchOver || matchRecordedRef.current) return;
    matchRecordedRef.current = true;
    clearMatch();
    if (gameMode === 'bot' && match.matchWinner !== null) {
      const won = match.matchWinner === 0;
      if (won) playWin();
      else playLose();
      setStats((prev) => {
        const next = recordMatchResult(prev, won, {
          rule: ruleVariant,
          difficulty,
          target: matchTarget,
        });
        saveStats(next);
        return next;
      });
    }
  }, [match.matchOver, match.matchWinner, gameMode, ruleVariant, difficulty, matchTarget]);

  const pushHistory = useCallback(() => {
    setHistory((h) => [...h, state]);
  }, [state]);

  const handlePlayAt = useCallback(
    (end: EndId) => {
      if (state.phase !== 'playing' || !selectedTileId) return;
      if (gameMode === 'bot' && state.currentPlayer !== 0) return;
      const next = playTile(state, state.currentPlayer, selectedTileId, end);
      if (next) {
        pushHistory();
        playMove();
        setLastPlacedId(selectedTileId);
        if (next.lastPlayScore > 0 && next.phase === 'playing') {
          flashScore(next.lastPlayScore);
        }
        setState(next);
        setSelectedTileId(null);
        setHintMove(null);
      }
    },
    [state, selectedTileId, gameMode, pushHistory, flashScore],
  );

  const handleDraw = useCallback(() => {
    if (state.phase !== 'playing' || canPlayAny) return;
    if (state.ruleVariant === 'block' || state.boneyard.length <= 2) return;
    if (gameMode === 'bot' && state.currentPlayer !== 0) return;
    pushHistory();
    setHintMove(null);
    setState(drawTiles(state, state.currentPlayer));
  }, [state, canPlayAny, gameMode, pushHistory]);

  const handlePass = useCallback(() => {
    if (state.phase !== 'playing' || canPlayAny) return;
    if (gameMode === 'bot' && state.currentPlayer !== 0) return;
    const next = pass(state, state.currentPlayer);
    if (!next) return;
    pushHistory();
    setHintMove(null);
    setState(next);
  }, [state, canPlayAny, gameMode, pushHistory]);

  const canUndo = history.length > 0 && !isBotTurn && state.phase === 'playing';

  const handleUndo = useCallback(() => {
    if (!canUndo) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setState(prev);
    setSelectedTileId(null);
    setHintMove(null);
    botScheduled.current = false;
  }, [canUndo, history]);

  const handleHint = useCallback(() => {
    if (!humanCanAct || !canPlayAny) return;
    const oppId: PlayerId = state.currentPlayer === 0 ? 1 : 0;
    const move = pickBotMove(
      state.hands[state.currentPlayer],
      state.board,
      state.hands[oppId].length,
      'hard',
      {
        ruleVariant: state.ruleVariant,
        opponentLack: state.suspectedLack[oppId],
      },
    );
    if (move) {
      setHintMove(move);
      setSelectedTileId(move.tileId);
    }
  }, [humanCanAct, canPlayAny, state]);

  const startFreshMatch = useCallback(
    (opts?: {
      variant?: RuleVariant;
      target?: MatchTarget;
      mode?: GameMode;
      diff?: Difficulty;
    }) => {
      const variant = opts?.variant ?? ruleVariant;
      const target = opts?.target ?? matchTarget;
      const mode = opts?.mode ?? gameMode;
      const diff = opts?.diff ?? difficulty;
      setRuleVariant(variant);
      setMatchTarget(target);
      setGameMode(mode);
      setDifficulty(diff);
      const nextMatch = createMatchState(target);
      setMatch(nextMatch);
      setState(createInitialState(variant));
      setHistory([]);
      setSelectedTileId(null);
      setHintMove(null);
      setLastPlacedId(null);
      setRoundBanner(false);
      setScoreFlash(null);
      botScheduled.current = false;
      prevPhaseRef.current = 'playing';
      matchRecordedRef.current = false;
      persistMatchSnapshot({
        match: nextMatch,
        ruleVariant: variant,
        difficulty: diff,
        gameMode: mode,
      });
    },
    [ruleVariant, matchTarget, gameMode, difficulty],
  );

  const handleNextRound = useCallback(() => {
    if (match.matchOver) {
      startFreshMatch();
      return;
    }
    setMatch((prev) => {
      const next = advanceMatchRound(prev);
      persistMatchSnapshot({
        match: next,
        ruleVariant,
        difficulty,
        gameMode,
      });
      return next;
    });
    setState(createInitialState(ruleVariant));
    setHistory([]);
    setSelectedTileId(null);
    setHintMove(null);
    setLastPlacedId(null);
    setRoundBanner(false);
    botScheduled.current = false;
    prevPhaseRef.current = 'playing';
  }, [match.matchOver, ruleVariant, difficulty, gameMode, startFreshMatch]);

  const isValidEnd = useCallback(
    (tileId: number, end: EndId) => {
      const moves = getValidMoves(
        state.hands[state.currentPlayer],
        state.board,
        state.ruleVariant,
      );
      return moves.some((m) => m.tileId === tileId && m.end === end);
    },
    [state.hands, state.currentPlayer, state.board, state.ruleVariant],
  );

  const statusMessage =
    state.phase === 'roundOver'
      ? state.roundEndReason === 'domino'
        ? `玩家 ${(state.winner! as number) + 1} 出完 · 本局 +${state.handScores[state.winner!]}`
        : `阻塞：玩家 ${(state.winner! as number) + 1} 點數較少 · 本局 +${state.handScores[state.winner!]}`
      : gameMode === 'bot'
        ? state.currentPlayer === 0
          ? '輪到你'
          : '電腦思考中…'
        : `玩家 ${state.currentPlayer + 1} 的回合`;

  const endHintClass = (end: EndId) =>
    hintMove && selectedTileId === hintMove.tileId && hintMove.end === end
      ? 'border-sky-400 bg-sky-500/20 text-sky-200'
      : 'border-slate-500 bg-slate-800/50 text-slate-400';

  const endButton = (end: EndId, label: string) => {
    if (!playableEndIds.includes(end)) return null;
    const pip = getEndPip(state.board, end);
    if (pip === null) return null;
    return (
      <button
        type="button"
        key={end}
        onClick={() => handlePlayAt(end)}
        disabled={
          state.phase !== 'playing' ||
          !selectedTileId ||
          (gameMode === 'bot' && state.currentPlayer !== 0) ||
          !isValidEnd(selectedTileId, end)
        }
        className={`flex flex-col items-center justify-center w-10 h-20 rounded border-2 border-dashed disabled:opacity-40 disabled:cursor-not-allowed hover:border-amber-500 hover:bg-slate-700/50 hover:text-amber-400 transition-colors touch-manipulation ${endHintClass(end)}`}
        title={`出在${label}`}
        aria-label={`出在${label}（${pip}）`}
      >
        <span className="text-lg font-bold">{pip}</span>
        <span className="text-xs">{label}</span>
      </button>
    );
  };

  const p1Label = gameMode === 'bot' ? '你' : '玩家 1';
  const p2Label = gameMode === 'bot' ? '電腦' : '玩家 2';

  return (
    <div
      className="min-h-screen text-white flex flex-col items-center p-4 min-w-0 bg-cover bg-center relative"
      style={{
        backgroundColor: '#0f172a',
        backgroundImage: [
          'linear-gradient(rgba(15,23,42,0.78), rgba(15,23,42,0.9))',
          `url(${import.meta.env.BASE_URL}table-bg.jpg)`,
        ].join(', '),
      }}
    >
      <BackToMenu />
      {showFirstRun && <FirstRunGuide onClose={() => setShowFirstRun(false)} />}
      {scoreFlash && (
        <ScoreFlash
          text={scoreFlash.text}
          tone="good"
          flashKey={scoreFlash.key}
          onDone={() => setScoreFlash(null)}
        />
      )}

      <header className="w-full max-w-2xl flex justify-between items-center mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-bold tracking-tight">西洋骨牌</h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-600">
            {gameMode === 'bot' ? '對戰電腦' : '雙人'}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-600">
            {RULE_LABELS[ruleVariant]}
          </span>
          {gameMode === 'bot' && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-amber-200 border border-amber-700/60">
              連勝 {stats.streak}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={handleUndo}
            disabled={!canUndo}
            className="min-h-[44px] min-w-[44px] p-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-40 disabled:pointer-events-none touch-manipulation inline-flex items-center justify-center"
            title="悔棋"
            aria-label="悔棋"
          >
            <Undo2 className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleHint}
            disabled={!humanCanAct || !canPlayAny}
            className="min-h-[44px] min-w-[44px] p-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-40 disabled:pointer-events-none touch-manipulation inline-flex items-center justify-center"
            title="提示"
            aria-label="提示"
          >
            <Lightbulb className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setShowRules(true)}
            className="min-h-[44px] min-w-[44px] p-2 rounded-lg hover:bg-white/10 transition-colors touch-manipulation inline-flex items-center justify-center"
            title="規則"
            aria-label="規則"
          >
            <BookOpen className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => startFreshMatch()}
            className="min-h-[44px] min-w-[44px] p-2 rounded-lg hover:bg-white/10 transition-colors touch-manipulation inline-flex items-center justify-center"
            title="新比賽"
            aria-label="新比賽"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Match scoreboard */}
      <div className="w-full max-w-md mb-3 rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3">
        <div className="flex justify-between text-xs text-slate-400 mb-1">
          <span>
            第 {match.round} 局 · 先達 {match.target} 分
          </span>
          <span>
            本局 {state.handScores[0]}–{state.handScores[1]}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <ScoreBar label={p1Label} score={match.scores[0]} target={match.target} accent="sky" />
          <ScoreBar label={p2Label} score={match.scores[1]} target={match.target} accent="amber" />
        </div>
        {gameMode === 'bot' && (
          <p className="mt-1.5 text-center text-[10px] text-slate-500">
            戰績 {stats.wins}勝 {stats.losses}敗
            {stats.bestStreak > 0 ? ` · 最佳連勝 ${stats.bestStreak}` : ''}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 mb-2 text-sm">
        <button
          type="button"
          onClick={() => startFreshMatch({ mode: 'two' })}
          className={`flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] rounded-full border touch-manipulation ${
            gameMode === 'two'
              ? 'border-sky-400 bg-sky-500/20 text-sky-100'
              : 'border-slate-600 bg-slate-800 text-slate-300'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>雙人</span>
        </button>
        <button
          type="button"
          onClick={() => startFreshMatch({ mode: 'bot' })}
          className={`flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] rounded-full border touch-manipulation ${
            gameMode === 'bot'
              ? 'border-amber-400 bg-amber-500/20 text-amber-100'
              : 'border-slate-600 bg-slate-800 text-slate-300'
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>對戰電腦</span>
        </button>
      </div>

      <div
        className="flex flex-wrap items-center justify-center gap-2 mb-2 text-xs"
        role="group"
        aria-label="規則變體"
      >
        <span className="text-slate-400">規則</span>
        {(['fives', 'draw', 'block'] as RuleVariant[]).map((id) => {
          const selected = ruleVariant === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => startFreshMatch({ variant: id })}
              aria-pressed={selected}
              title={RULE_BLURBS[id]}
              className={`px-3 py-1.5 min-h-[44px] rounded-full border touch-manipulation transition-colors ${
                selected
                  ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100'
                  : 'border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {RULE_LABELS[id]}
            </button>
          );
        })}
      </div>

      <div
        className="flex flex-wrap items-center justify-center gap-2 mb-2 text-xs"
        role="group"
        aria-label="比賽目標分"
      >
        <span className="text-slate-400">目標</span>
        {MATCH_TARGETS.map((t) => {
          const selected = matchTarget === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => startFreshMatch({ target: t })}
              aria-pressed={selected}
              className={`px-3 py-1.5 min-h-[44px] rounded-full border touch-manipulation transition-colors ${
                selected
                  ? 'border-violet-400 bg-violet-500/20 text-violet-100'
                  : 'border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {t} 分
            </button>
          );
        })}
      </div>

      {gameMode === 'bot' && (
        <div className="flex flex-col items-center gap-1 mb-3 text-xs">
          <div
            className="flex flex-wrap items-center justify-center gap-2"
            role="group"
            aria-label="電腦難度"
          >
            <span className="text-slate-400">電腦難度</span>
            {(['easy', 'normal', 'hard'] as Difficulty[]).map((id) => {
              const selected = difficulty === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => startFreshMatch({ diff: id })}
                  aria-pressed={selected}
                  title={DIFFICULTY_BLURBS[id]}
                  className={`px-3 py-1.5 min-h-[44px] rounded-full border touch-manipulation transition-colors ${
                    selected
                      ? 'border-amber-400 bg-amber-500/20 text-amber-100'
                      : 'border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {DIFFICULTY_LABELS[id]}
                </button>
              );
            })}
          </div>
          <p className="text-slate-500">{DIFFICULTY_BLURBS[difficulty]}</p>
        </div>
      )}

      <p className="text-slate-200 text-sm mb-2">{statusMessage}</p>

      {ruleVariant === 'fives' && (
        <p className="text-emerald-300/90 text-xs mb-2 tabular-nums">
          開放端點和：{openSum}
          {openSum > 0 && openSum % 5 === 0 ? ' · 可得分！' : ''}
        </p>
      )}

      {/* Board */}
      <div className="w-full max-w-2xl overflow-x-auto py-3 relative">
        {showSpinnerCross ? (
          <div className="flex flex-col items-center gap-1 min-h-[8rem]">
            <div className="flex items-center gap-1">
              {endButton('up', '上')}
              <div className="flex flex-col items-center gap-0.5">
                {[...state.board.arms.up].reverse().map((p) => (
                  <PlacedDominoTile
                    key={p.tile.id}
                    placed={{
                      tile: p.tile,
                      displayLeft: p.outward,
                      displayRight: p.inward,
                    }}
                    vertical
                    justPlaced={p.tile.id === lastPlacedId}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              {ends && endButton('left', '左')}
              <div className="flex items-center gap-0.5">
                {[...state.board.arms.left].reverse().map((p) => (
                  <PlacedDominoTile
                    key={p.tile.id}
                    placed={{
                      tile: p.tile,
                      displayLeft: p.outward,
                      displayRight: p.inward,
                    }}
                    justPlaced={p.tile.id === lastPlacedId}
                  />
                ))}
                {state.board.hub && (
                  <PlacedDominoTile
                    placed={state.board.hub}
                    spinner
                    justPlaced={state.board.hub.tile.id === lastPlacedId}
                  />
                )}
                {state.board.arms.right.map((p) => (
                  <PlacedDominoTile
                    key={p.tile.id}
                    placed={{
                      tile: p.tile,
                      displayLeft: p.inward,
                      displayRight: p.outward,
                    }}
                    justPlaced={p.tile.id === lastPlacedId}
                  />
                ))}
              </div>
              {ends && endButton('right', '右')}
            </div>
            <div className="flex items-center gap-1">
              <div className="flex flex-col items-center gap-0.5">
                {state.board.arms.down.map((p) => (
                  <PlacedDominoTile
                    key={p.tile.id}
                    placed={{
                      tile: p.tile,
                      displayLeft: p.inward,
                      displayRight: p.outward,
                    }}
                    vertical
                    justPlaced={p.tile.id === lastPlacedId}
                  />
                ))}
              </div>
              {endButton('down', '下')}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-0 min-h-[5rem]">
            {ends && endButton('left', '左')}
            <div className="flex items-center gap-0.5 flex-nowrap relative">
              {chain.map((placed) => (
                <PlacedDominoTile
                  key={placed.tile.id}
                  placed={placed}
                  justPlaced={placed.tile.id === lastPlacedId}
                  spinner={
                    state.board.spinnerActive &&
                    state.board.hub?.tile.id === placed.tile.id
                  }
                />
              ))}
              {scoreFlash && (
                <span
                  className="domino-score-callout absolute left-1/2 top-0 z-10 pointer-events-none font-black text-2xl text-emerald-300"
                  aria-hidden
                >
                  {scoreFlash.text}
                </span>
              )}
            </div>
            {ends && endButton('right', '右')}
          </div>
        )}
      </div>

      <p className="text-slate-400 text-xs mb-2">
        牌堆：{state.boneyard.length} 張
        {gameMode === 'bot' && (
          <span className="ml-3">電腦手牌：{state.hands[1].length}</span>
        )}
      </p>

      <div className="w-full max-w-2xl">
        <p className="text-slate-300 text-sm mb-2">
          {gameMode === 'bot' && state.currentPlayer === 1
            ? '電腦手牌'
            : `玩家 ${state.currentPlayer + 1} 手牌`}
          {state.phase === 'playing' && state.currentPlayer === 0 && gameMode === 'bot' && (
            <span className="ml-2 text-amber-400">
              {canPlayAny
                ? '選一張牌再點端點出牌'
                : ruleVariant === 'block'
                  ? '無法出牌，請跳過'
                  : '無法出牌，請抽牌'}
            </span>
          )}
        </p>
        {state.phase === 'playing' &&
          (gameMode === 'bot' && state.currentPlayer === 1 ? (
            <div className="flex gap-1 flex-wrap justify-center">
              {currentHand.map((t) => (
                <div
                  key={t.id}
                  className="rounded border-2 border-slate-600 bg-slate-700 w-12 h-24 flex items-center justify-center text-slate-500"
                >
                  ?
                </div>
              ))}
            </div>
          ) : (
            <div className="flex gap-2 flex-wrap justify-center items-end pb-4">
              {currentHand.map((t) => (
                <DominoTile
                  key={t.id}
                  tile={t}
                  vertical={false}
                  highlight={playableIds.has(t.id) && selectedTileId === t.id}
                  hint={hintMove?.tileId === t.id && selectedTileId !== t.id}
                  playable={
                    playableIds.has(t.id) &&
                    selectedTileId !== t.id &&
                    hintMove?.tileId !== t.id
                  }
                  size="normal"
                  onClick={() => {
                    if (!playableIds.has(t.id)) return;
                    setSelectedTileId(selectedTileId === t.id ? null : t.id);
                    if (hintMove && hintMove.tileId !== t.id) setHintMove(null);
                  }}
                />
              ))}
            </div>
          ))}
      </div>

      {state.phase === 'playing' &&
        !canPlayAny &&
        (gameMode === 'two' || state.currentPlayer === 0) &&
        ruleVariant !== 'block' &&
        state.boneyard.length > 2 && (
          <button
            type="button"
            onClick={handleDraw}
            className="mt-4 px-6 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 font-medium transition-colors touch-manipulation min-h-[44px]"
          >
            抽牌
          </button>
        )}

      {state.phase === 'playing' &&
        !canPlayAny &&
        (gameMode === 'two' || state.currentPlayer === 0) &&
        (ruleVariant === 'block' || state.boneyard.length <= 2) && (
          <button
            type="button"
            onClick={handlePass}
            className="mt-4 px-6 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 font-medium transition-colors touch-manipulation min-h-[44px]"
          >
            跳過
          </button>
        )}

      {/* Round result (match continues) */}
      {roundBanner && state.phase === 'roundOver' && !match.matchOver && (
        <ResultOverlay
          title={
            gameMode === 'bot'
              ? state.winner === 0
                ? '本局獲勝'
                : '本局落敗'
              : `玩家 ${(state.winner as PlayerId) + 1} 拿下本局`
          }
          subtitle={`${p1Label} ${match.scores[0]} — ${match.scores[1]} ${p2Label} · 目標 ${match.target}`}
          badge={state.roundEndReason === 'blocked' ? '阻塞結算' : '出完手牌'}
          variant={
            gameMode === 'bot'
              ? state.winner === 0
                ? 'win'
                : 'lose'
              : 'neutral'
          }
          stats={[
            { label: `${p1Label} 本局`, value: state.handScores[0] },
            { label: `${p2Label} 本局`, value: state.handScores[1] },
            { label: `${p1Label} 手牌點`, value: handSum(state.hands[0]) },
            { label: `${p2Label} 手牌點`, value: handSum(state.hands[1]) },
            { label: '規則', value: RULE_LABELS[ruleVariant] },
          ]}
          primaryLabel="下一局"
          onPrimary={handleNextRound}
        />
      )}

      {/* Match result */}
      {match.matchOver && (
        <ResultOverlay
          title={
            gameMode === 'bot'
              ? match.matchWinner === 0
                ? '比賽勝利！'
                : '比賽敗北'
              : `玩家 ${(match.matchWinner as PlayerId) + 1} 贏得比賽`
          }
          subtitle={`終場 ${match.scores[0]} — ${match.scores[1]}（先達 ${match.target}）`}
          badge="比賽結束"
          variant={
            gameMode === 'bot'
              ? match.matchWinner === 0
                ? 'win'
                : 'lose'
              : 'neutral'
          }
          stats={[
            { label: `${p1Label} 總分`, value: match.scores[0] },
            { label: `${p2Label} 總分`, value: match.scores[1] },
            { label: '局數', value: match.round },
            { label: '規則', value: RULE_LABELS[ruleVariant] },
            ...(gameMode === 'bot'
              ? [
                  { label: '連勝', value: String(stats.streak) },
                  { label: '生涯勝場', value: String(stats.wins) },
                ]
              : []),
          ]}
          primaryLabel="再打一場"
          onPrimary={() => startFreshMatch()}
        />
      )}

      {showRules && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-10"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dominoes-rules-title"
        >
          <div className="bg-slate-800 rounded-xl max-w-md max-h-[85vh] overflow-y-auto p-6 text-left">
            <h2 id="dominoes-rules-title" className="text-lg font-bold mb-3">
              規則說明（{RULE_LABELS[ruleVariant]}）
            </h2>
            <ul className="text-sm text-slate-200 space-y-2 list-disc pl-4">
              <li>雙六組 28 張牌，每人 7 張，其餘為牌堆。</li>
              <li>輪流出牌：選一張手牌與開放端點點數相同的一邊相接。</li>
              {ruleVariant === 'fives' ? (
                <>
                  <li>
                    五倍數（All Fives）：出牌後若所有開放端點點數和為 5
                    的倍數，立即得該和為分。雙張在端點時計兩倍；第一張雙張為轉軸，四邊可接。
                  </li>
                  <li>
                    一手結束：出完者得對手手牌點數和（四捨五入到 5）；阻塞時點數較少者得分。
                  </li>
                  <li>整場先累積到 {matchTarget} 分者勝（可選 61／100／150）。</li>
                </>
              ) : (
                <>
                  <li>
                    {ruleVariant === 'draw'
                      ? '摸牌制：無法出牌時從牌堆抽牌，直到能出或牌堆剩 2 張；之後才能跳過。'
                      : '封鎖制：無法出牌時直接跳過（不摸牌）；雙方都無法出牌即阻塞結算。'}
                  </li>
                  <li>
                    出完者得對手手牌點數和；阻塞時點數較少者得對手點數。整場先達{' '}
                    {matchTarget} 分勝。
                  </li>
                </>
              )}
            </ul>
            <p className="mt-3 text-xs text-slate-400">{RULE_BLURBS[ruleVariant]}</p>
            <button
              type="button"
              onClick={() => setShowRules(false)}
              className="mt-4 w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-medium touch-manipulation min-h-[44px]"
            >
              關閉
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreBar({
  label,
  score,
  target,
  accent,
}: {
  label: string;
  score: number;
  target: number;
  accent: 'sky' | 'amber';
}) {
  const pct = Math.min(100, (score / target) * 100);
  const bar =
    accent === 'sky' ? 'bg-sky-400' : 'bg-amber-400';
  return (
    <div>
      <div className="flex justify-between text-[11px] text-slate-300 mb-1">
        <span>{label}</span>
        <span className="tabular-nums">
          {score} / {target}
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-800 overflow-hidden border border-white/10">
        <div
          className={`h-full rounded-full transition-all duration-500 ${bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function canPlay(
  hand: DominoesState['hands'][0],
  board: DominoesState['board'],
): boolean {
  return getPlayableTiles(hand, board).length > 0;
}
