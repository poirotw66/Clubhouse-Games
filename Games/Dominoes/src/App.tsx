import { useState, useCallback, useEffect, useRef } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { playMove, playWin, playLose } from '@clubhouse/shared/synthAudio';
import type { DominoesState, PlayerId, Difficulty, RuleVariant } from './utils/dominoesLogic';
import {
  createInitialState,
  playTile,
  drawTiles,
  pass,
  getChainEnds,
  getPlayableTiles,
  getValidMoves,
  pickBotMove,
  handSum,
  DIFFICULTY_LABELS,
} from './utils/dominoesLogic';
import { DominoTile, PlacedDominoTile } from './components/DominoTile';
import { RefreshCw, BookOpen, Users, Bot, Undo2, Lightbulb } from 'lucide-react';

type GameMode = 'two' | 'bot';

const STREAK_KEY = 'clubhouse-dominoes-win-streak';

function loadStreak(): number {
  try {
    const n = Number(localStorage.getItem(STREAK_KEY));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

function saveStreak(n: number): void {
  try {
    localStorage.setItem(STREAK_KEY, String(Math.max(0, Math.floor(n))));
  } catch {
    /* ignore quota / private mode */
  }
}

const RULE_LABELS: Record<RuleVariant, string> = {
  draw: '摸牌制',
  block: '封鎖制',
};

export default function App() {
  const [gameMode, setGameMode] = useState<GameMode>('two');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [ruleVariant, setRuleVariant] = useState<RuleVariant>('draw');
  const [state, setState] = useState<DominoesState>(() => createInitialState('draw'));
  const [history, setHistory] = useState<DominoesState[]>([]);
  const [hintMove, setHintMove] = useState<{ tileId: number; end: 'left' | 'right' } | null>(
    null,
  );
  const [winStreak, setWinStreak] = useState(loadStreak);
  const [showRules, setShowRules] = useState(false);
  const [selectedTileId, setSelectedTileId] = useState<number | null>(null);
  const botScheduled = useRef(false);
  const prevPhaseRef = useRef(state.phase);

  const currentHand = state.hands[state.currentPlayer];
  const playable = getPlayableTiles(currentHand, state.chain);
  const playableIds = new Set(playable.map((t) => t.id));
  const ends = getChainEnds(state.chain);
  const canPlayAny = playable.length > 0;

  const isBotTurn =
    gameMode === 'bot' &&
    state.phase === 'playing' &&
    state.currentPlayer === 1;

  const humanCanAct =
    state.phase === 'playing' &&
    (gameMode === 'two' || state.currentPlayer === 0);

  useEffect(() => {
    if (!isBotTurn || botScheduled.current) return;
    botScheduled.current = true;
    const timer = setTimeout(() => {
      const hand = state.hands[1];
      if (canPlay(hand, state.chain)) {
        const oppId: PlayerId = state.currentPlayer === 0 ? 1 : 0;
        const move = pickBotMove(hand, state.chain, state.hands[oppId].length, difficulty);
        if (move) {
          const next = playTile(state, 1, move.tileId, move.end);
          if (next) {
            playMove();
            setState(next);
          }
        }
      } else if (state.ruleVariant === 'draw') {
        setState(drawTiles(state, 1));
      } else {
        const next = pass(state, 1);
        if (next) setState(next);
      }
      botScheduled.current = false;
    }, 600);
    return () => {
      clearTimeout(timer);
      botScheduled.current = false;
    };
  }, [isBotTurn, state, difficulty]);

  useEffect(() => {
    if (state.phase === 'playing') {
      prevPhaseRef.current = 'playing';
      return;
    }
    if (prevPhaseRef.current === 'playing') {
      if (gameMode === 'bot' && state.winner !== null) {
        if (state.winner === 0) {
          playWin();
          setWinStreak((prev) => {
            const next = prev + 1;
            saveStreak(next);
            return next;
          });
        } else {
          playLose();
          setWinStreak(0);
          saveStreak(0);
        }
      }
    }
    prevPhaseRef.current = state.phase;
  }, [state.phase, state.winner, gameMode]);

  const pushHistory = useCallback(() => {
    // Snapshot before the human action so one undo also rolls back a following bot reply.
    setHistory((h) => [...h, state]);
  }, [state]);

  const handlePlayAt = useCallback(
    (end: 'left' | 'right') => {
      if (state.phase !== 'playing' || !selectedTileId) return;
      if (gameMode === 'bot' && state.currentPlayer !== 0) return;
      const next = playTile(state, state.currentPlayer, selectedTileId, end);
      if (next) {
        pushHistory();
        playMove();
        setState(next);
        setSelectedTileId(null);
        setHintMove(null);
      }
    },
    [state, selectedTileId, gameMode, pushHistory]
  );

  const handleDraw = useCallback(() => {
    if (state.phase !== 'playing' || canPlayAny) return;
    if (state.ruleVariant !== 'draw' || state.boneyard.length <= 2) return;
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
    // ponytail: no undo after game over — streak already written.
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
    // Hard tier: zero blunder rate so the hint is a real recommendation.
    const oppId: PlayerId = state.currentPlayer === 0 ? 1 : 0;
    const move = pickBotMove(
      state.hands[state.currentPlayer],
      state.chain,
      state.hands[oppId].length,
      'hard',
    );
    if (move) {
      setHintMove(move);
      setSelectedTileId(move.tileId);
    }
  }, [humanCanAct, canPlayAny, state]);

  const handleNewGame = useCallback((nextVariant: RuleVariant = ruleVariant) => {
    setRuleVariant(nextVariant);
    setState(createInitialState(nextVariant));
    setHistory([]);
    setSelectedTileId(null);
    setHintMove(null);
    botScheduled.current = false;
    prevPhaseRef.current = 'playing';
  }, [ruleVariant]);

  const isValidEnd = useCallback(
    (tileId: number, end: 'left' | 'right') => {
      const moves = getValidMoves(state.hands[state.currentPlayer], state.chain);
      return moves.some((m) => m.tileId === tileId && m.end === end);
    },
    [state.hands, state.currentPlayer, state.chain]
  );

  const statusMessage =
    state.phase === 'won'
      ? `玩家 ${(state.winner! as number) + 1} 出完手牌獲勝`
      : state.phase === 'blocked'
        ? `阻塞：玩家 ${(state.winner! as number) + 1} 手牌點數較少獲勝（${handSum(state.hands[0])} vs ${handSum(state.hands[1])}）`
        : gameMode === 'bot'
          ? state.currentPlayer === 0
            ? '輪到你'
            : '電腦思考中…'
          : `玩家 ${state.currentPlayer + 1} 的回合`;

  const humanWon =
    gameMode === 'bot' && state.winner === 0;
  const resultTitle =
    state.phase === 'won'
      ? gameMode === 'bot'
        ? humanWon
          ? '你贏了！'
          : '電腦獲勝'
        : `玩家 ${(state.winner as PlayerId) + 1} 獲勝`
      : state.phase === 'blocked'
        ? gameMode === 'bot'
          ? humanWon
            ? '你贏了！'
            : '電腦獲勝'
          : `玩家 ${(state.winner as PlayerId) + 1} 獲勝`
        : '';

  const resultVariant =
    gameMode === 'bot' && state.winner !== null
      ? state.winner === 0
        ? 'win'
        : 'lose'
      : 'neutral';

  const endHintClass = (end: 'left' | 'right') =>
    hintMove &&
    selectedTileId === hintMove.tileId &&
    hintMove.end === end
      ? 'border-sky-400 bg-sky-500/20 text-sky-200'
      : 'border-slate-500 bg-slate-800/50 text-slate-400';

  return (
    <div
      className="min-h-screen text-white flex flex-col items-center p-4 min-w-0 bg-cover bg-center"
      style={{
        backgroundColor: '#0f172a',
        backgroundImage: [
          'linear-gradient(rgba(15,23,42,0.78), rgba(15,23,42,0.9))',
          `url(${import.meta.env.BASE_URL}table-bg.jpg)`,
        ].join(', '),
      }}
    >
      <BackToMenu />
      <header className="w-full max-w-2xl flex justify-between items-center mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-bold tracking-tight">西洋骨牌 Dominoes</h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-600">
            {gameMode === 'bot' ? '對戰電腦' : '雙人'}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-600">
            {RULE_LABELS[ruleVariant]}
          </span>
          {gameMode === 'bot' && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-amber-200 border border-amber-700/60">
              連勝 {winStreak}
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
            onClick={() => handleNewGame()}
            className="min-h-[44px] min-w-[44px] p-2 rounded-lg hover:bg-white/10 transition-colors touch-manipulation inline-flex items-center justify-center"
            title="新遊戲"
            aria-label="新遊戲"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-center gap-2 mb-2 text-sm">
        <button
          type="button"
          onClick={() => {
            setGameMode('two');
            handleNewGame();
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] rounded-full border touch-manipulation ${
            gameMode === 'two' ? 'border-sky-400 bg-sky-500/20 text-sky-100' : 'border-slate-600 bg-slate-800 text-slate-300'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>雙人</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setGameMode('bot');
            handleNewGame();
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] rounded-full border touch-manipulation ${
            gameMode === 'bot' ? 'border-amber-400 bg-amber-500/20 text-amber-100' : 'border-slate-600 bg-slate-800 text-slate-300'
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
        {(['draw', 'block'] as RuleVariant[]).map((id) => {
          const selected = ruleVariant === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => handleNewGame(id)}
              aria-pressed={selected}
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

      {gameMode === 'bot' && (
        <div
          className="flex flex-wrap items-center justify-center gap-2 mb-4 text-xs"
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
                onClick={() => {
                  setDifficulty(id);
                  handleNewGame();
                }}
                aria-pressed={selected}
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
      )}

      <p className="text-slate-200 text-sm mb-4">{statusMessage}</p>

      {/* Board: chain with left/right drop targets */}
      <div className="w-full max-w-2xl overflow-x-auto py-4">
        <div className="flex items-center justify-center gap-0 min-h-[5rem]">
          {ends && (
            <button
              type="button"
              onClick={() => handlePlayAt('left')}
              disabled={
                state.phase !== 'playing' ||
                !selectedTileId ||
                (gameMode === 'bot' && state.currentPlayer !== 0) ||
                !isValidEnd(selectedTileId, 'left')
              }
              className={`flex flex-col items-center justify-center w-10 h-20 rounded border-2 border-dashed disabled:opacity-40 disabled:cursor-not-allowed hover:border-amber-500 hover:bg-slate-700/50 hover:text-amber-400 transition-colors touch-manipulation ${endHintClass('left')}`}
              title="Play on left"
              aria-label={`Play selected tile on left (${ends.left})`}
            >
              <span className="text-lg font-bold">{ends.left}</span>
              <span className="text-xs">左</span>
            </button>
          )}
          <div className="flex items-center gap-0.5 flex-nowrap">
            {state.chain.map((placed) => (
              <PlacedDominoTile key={placed.tile.id} placed={placed} size="small" />
            ))}
          </div>
          {ends && (
            <button
              type="button"
              onClick={() => handlePlayAt('right')}
              disabled={
                state.phase !== 'playing' ||
                !selectedTileId ||
                (gameMode === 'bot' && state.currentPlayer !== 0) ||
                !isValidEnd(selectedTileId, 'right')
              }
              className={`flex flex-col items-center justify-center w-10 h-20 rounded border-2 border-dashed disabled:opacity-40 disabled:cursor-not-allowed hover:border-amber-500 hover:bg-slate-700/50 hover:text-amber-400 transition-colors touch-manipulation ${endHintClass('right')}`}
              title="Play on right"
              aria-label={`Play selected tile on right (${ends.right})`}
            >
              <span className="text-lg font-bold">{ends.right}</span>
              <span className="text-xs">右</span>
            </button>
          )}
        </div>
      </div>

      {/* Boneyard count */}
      <p className="text-slate-400 text-xs mb-2">牌堆：{state.boneyard.length} 張</p>

      {/* Current player hand */}
      <div className="w-full max-w-2xl">
        <p className="text-slate-300 text-sm mb-2">
          {gameMode === 'bot' && state.currentPlayer === 1
            ? '電腦手牌'
            : `玩家 ${state.currentPlayer + 1} 手牌`}
          {state.phase === 'playing' && state.currentPlayer === 0 && gameMode === 'bot' && (
            <span className="ml-2 text-amber-400">
              {canPlayAny
                ? '選一張牌再點左/右端出牌'
                : ruleVariant === 'draw'
                  ? '無法出牌，請抽牌'
                  : '無法出牌，請跳過'}
            </span>
          )}
        </p>
        {state.phase === 'playing' &&
          (gameMode === 'bot' && state.currentPlayer === 1 ? (
            <div className="flex gap-1 flex-wrap justify-center">
              {currentHand.map((t) => (
                <div key={t.id} className="rounded border-2 border-slate-600 bg-slate-700 w-12 h-24 flex items-center justify-center text-slate-500">
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
                  playable={playableIds.has(t.id) && selectedTileId !== t.id && hintMove?.tileId !== t.id}
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
        ruleVariant === 'draw' &&
        state.boneyard.length > 2 && (
          <button
            type="button"
            onClick={handleDraw}
            className="mt-4 px-6 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 font-medium transition-colors touch-manipulation"
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
            className="mt-4 px-6 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 font-medium transition-colors touch-manipulation"
          >
            跳過
          </button>
        )}

      {state.phase !== 'playing' && (
        <ResultOverlay
          title={resultTitle}
          subtitle={
            state.phase === 'blocked'
              ? `手牌點數：${handSum(state.hands[0])} vs ${handSum(state.hands[1])}`
              : undefined
          }
          badge={state.phase === 'blocked' ? '阻塞和局' : '出完手牌'}
          variant={resultVariant}
          stats={[
            { label: '玩家 1 手牌', value: handSum(state.hands[0]) },
            { label: '玩家 2 手牌', value: handSum(state.hands[1]) },
            {
              label: '模式',
              value: gameMode === 'bot' ? '對戰電腦' : '雙人',
            },
            { label: '規則', value: RULE_LABELS[ruleVariant] },
            ...(gameMode === 'bot'
              ? [{ label: '連勝', value: String(winStreak) }]
              : []),
          ]}
          onPrimary={() => {
            handleNewGame();
          }}
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
              <li>輪流出牌：選一張手牌與桌面線的「左端」或「右端」點數相同的一邊相接。</li>
              <li>
                {ruleVariant === 'draw'
                  ? '摸牌制：無法出牌時從牌堆抽牌，直到能出或牌堆剩 2 張；之後才能跳過。'
                  : '封鎖制：無法出牌時直接跳過（不摸牌）；雙方都無法出牌即阻塞結算。'}
              </li>
              <li>先出完手牌者勝；若阻塞（雙方皆無法出牌），手牌點數和較少者勝。</li>
            </ul>
            <button
              type="button"
              onClick={() => setShowRules(false)}
              className="mt-4 w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-medium touch-manipulation"
            >
              關閉
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function canPlay(hand: DominoesState['hands'][0], chain: DominoesState['chain']): boolean {
  return getPlayableTiles(hand, chain).length > 0;
}
