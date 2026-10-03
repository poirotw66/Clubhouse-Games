import React, { useState, useEffect, useMemo } from 'react';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { GameState, BottleData, GameMode, type QpVariant } from '../types';
import {
  INITIAL_COINS,
  getCapacityForLevel,
  COST_SHUFFLE,
  COST_REVEAL,
  COST_ADD_BOTTLE,
  COST_UNDO,
  COST_HINT,
  persistQpBestMoves,
  loadQpBestMoves,
  qpDifficultyLabel,
  MIX_INTRO_STORAGE_KEY,
} from '../constants';
import {
  generateLevel,
  canPour,
  pourLiquid,
  checkLevelComplete,
  shuffleBottles,
  revealHiddenLayers,
  checkDeadlock,
  checkStateRepetition,
  isMixingPour,
  findHintMove,
  MIXING_MIN_LEVEL,
} from '../services/gameLogic';
import {
  getPackStage,
  materializePackStageAt,
  packStageCount,
  persistPackStageClear,
  loadPackProgress,
} from '../services/puzzlePack';
import {
  getMixStage,
  materializeMixStageAt,
  mixStageCount,
  persistMixStageClear,
  loadMixProgress,
} from '../services/mixChallengePack';
import { loadCoins, saveCoins } from '../services/economyService';
import { useDailyMissions } from '../hooks/useDailyMissions';
import { useDailyMissionsModal } from '../hooks/useDailyMissionsModal';
import { Bottle } from './Bottle';
import { TopBar } from './TopBar';
import { TargetArea } from './TargetArea';
import { BottomControls } from './BottomControls';
import { DailyMissions } from './DailyMissions';
import { Settings } from './Settings';
import { Background } from './Background';
import { RecipeHud } from './RecipeHud';
import { useNavigate, useLocation } from 'react-router-dom';
import { sounds } from '../utils/sound';
import { getBackgroundByLevel, getSavedBackground } from '../utils/backgrounds';
import { AlertTriangle, Home, RotateCcw, Repeat, ClipboardList } from 'lucide-react';

function hasSeenMixIntro(): boolean {
  try {
    return localStorage.getItem(MIX_INTRO_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function markMixIntroSeen(): void {
  try {
    localStorage.setItem(MIX_INTRO_STORAGE_KEY, '1');
  } catch {
    /* private mode */
  }
}

export default function Game() {
    const navigate = useNavigate();
    const location = useLocation();

    // Extract initial params from navigation state
    const initialMode: GameMode = location.state?.mode || 'adventure';
    const initialDifficulty = location.state?.difficultyLevel || 1;
    // Storage/nav id stays English (EASY/…); display via qpDifficultyLabel.
    const initialDifficultyLabel = location.state?.difficultyLabel || 'CUSTOM';
    const initialQpVariant: QpVariant = location.state?.qpVariant || 'normal';
    const initialMoveLimit: number | undefined =
      typeof location.state?.moveLimit === 'number' ? location.state.moveLimit : undefined;
    const initialTimeLimitSec: number | undefined =
      typeof location.state?.timeLimitSec === 'number' ? location.state.timeLimitSec : undefined;
    const initialPackStageIndex: number = (() => {
        const raw = location.state?.packStageIndex;
        const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? '0'), 10);
        if (!Number.isFinite(n) || n < 0) return 0;
        return Math.min(packStageCount() - 1, Math.floor(n));
    })();
    const initialMixStageIndex: number = (() => {
        const raw = location.state?.mixStageIndex;
        const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? '0'), 10);
        if (!Number.isFinite(n) || n < 0) return 0;
        return Math.min(mixStageCount() - 1, Math.floor(n));
    })();

    // Initialize state
    const [gameState, setGameState] = useState<GameState>(() => {
        const savedCoins = loadCoins(INITIAL_COINS);

        if (initialMode === 'puzzle_pack') {
            const { bottles, orders, stage } = materializePackStageAt(initialPackStageIndex);
            const isWin = checkLevelComplete(bottles, orders);
            return {
                mode: 'puzzle_pack',
                level: initialPackStageIndex,
                difficultyLabel: stage.id,
                coins: savedCoins,
                bottles,
                orders,
                initialBoardState: {
                    bottles: JSON.parse(JSON.stringify(bottles)),
                    orders: JSON.parse(JSON.stringify(orders)),
                },
                selectedBottleId: null,
                history: [],
                isWin,
            };
        }

        if (initialMode === 'mix_challenge') {
            const { bottles, orders, stage } = materializeMixStageAt(initialMixStageIndex);
            const isWin = checkLevelComplete(bottles, orders);
            return {
                mode: 'mix_challenge',
                level: initialMixStageIndex,
                difficultyLabel: stage.id,
                coins: savedCoins,
                bottles,
                orders,
                initialBoardState: {
                    bottles: JSON.parse(JSON.stringify(bottles)),
                    orders: JSON.parse(JSON.stringify(orders)),
                },
                selectedBottleId: null,
                history: [],
                isWin,
            };
        }

        // Determine level: if adventure, load from storage. If quick play, use passed prop.
        let startLevel = 1;
        if (initialMode === 'adventure') {
            const savedLevel = localStorage.getItem('mls_level');
            startLevel = savedLevel ? parseInt(savedLevel, 10) : 1;
        } else {
            startLevel = initialDifficulty;
        }

        const initialLevelState = generateLevel(startLevel);
        const isWin = checkLevelComplete(initialLevelState.bottles, initialLevelState.orders);

        return {
            mode: initialMode,
            level: startLevel,
            difficultyLabel: initialMode === 'quick_play' ? initialDifficultyLabel : undefined,
            coins: savedCoins,
            bottles: initialLevelState.bottles,
            orders: initialLevelState.orders,
            initialBoardState: {
                bottles: JSON.parse(JSON.stringify(initialLevelState.bottles)),
                orders: JSON.parse(JSON.stringify(initialLevelState.orders))
            },
            selectedBottleId: null,
            history: [],
            isWin: isWin,
        };
    });

    // --- Daily Missions State ---
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const { missions, hasNotifications, trackMissionProgress, claimMission } = useDailyMissions({
        currentCoins: gameState.coins,
    });
    const { isOpen: isMissionModalOpen, open: openMissionModal, close: closeMissionModal } = useDailyMissionsModal();

    // Intelligent Warning System
    const [warningState, setWarningState] = useState<{ type: 'deadlock' | 'loop' | null, message: string }>({ type: null, message: '' });

    const [hintIds, setHintIds] = useState<{ sourceId: string; targetId: string } | null>(null);
    const [mixFlashId, setMixFlashId] = useState<string | null>(null);
    const [showMixGuidance, setShowMixGuidance] = useState(() => {
        if (initialMode === 'mix_challenge') return true;
        if (initialMode === 'adventure' && !hasSeenMixIntro()) {
            const lvl = parseInt(localStorage.getItem('mls_level') || '1', 10);
            return lvl >= MIXING_MIN_LEVEL;
        }
        if (initialMode === 'quick_play' && initialDifficulty >= MIXING_MIN_LEVEL && !hasSeenMixIntro()) {
            return true;
        }
        return false;
    });
    const [isLose, setIsLose] = useState(false);
    const [loseReason, setLoseReason] = useState('');
    const [timeLeftSec, setTimeLeftSec] = useState<number | null>(
      initialQpVariant === 'timed' && initialTimeLimitSec ? initialTimeLimitSec : null,
    );

    const packStageName = useMemo(() => {
        if (gameState.mode === 'puzzle_pack') return getPackStage(gameState.level)?.name;
        if (gameState.mode === 'mix_challenge') return getMixStage(gameState.level)?.name;
        return undefined;
    }, [gameState.mode, gameState.level]);

    const mixTip = useMemo(() => {
        if (gameState.mode !== 'mix_challenge') return undefined;
        return getMixStage(gameState.level)?.tip;
    }, [gameState.mode, gameState.level]);

    const mixingOnBoard = useMemo(
      () => gameState.bottles.some((b) => b.mixingEnabled),
      [gameState.bottles],
    );

    // Background selection - use level-based or saved preference
    const currentBackground = useMemo(() => {
        if (gameState.mode === 'adventure') {
            return getBackgroundByLevel(gameState.level);
        }
        if (gameState.mode === 'puzzle_pack' || gameState.mode === 'mix_challenge') {
            return getBackgroundByLevel(gameState.level + 1);
        }
        return getSavedBackground();
    }, [gameState.level, gameState.mode]);

    // Save coins whenever they change (shared across modes)
    useEffect(() => {
        saveCoins(gameState.coins);
    }, [gameState.coins]);

    // Save level ONLY if in ADVENTURE mode
    useEffect(() => {
        if (gameState.mode === 'adventure') {
            localStorage.setItem('mls_level', gameState.level.toString());
        }
    }, [gameState.level, gameState.mode]);

    // Show mix guidance when adventure first crosses MIXING_MIN_LEVEL
    useEffect(() => {
        if (gameState.mode !== 'adventure') return;
        if (gameState.level >= MIXING_MIN_LEVEL && mixingOnBoard && !hasSeenMixIntro()) {
            setShowMixGuidance(true);
        }
    }, [gameState.mode, gameState.level, mixingOnBoard]);

    // State to track the specific match being processed { bottleId, orderIndex }
    const [processingMatch, setProcessingMatch] = useState<{ bottleId: string; orderIndex: number } | null>(null);
    const [celebratedWin, setCelebratedWin] = useState(false);
    const [qpBestMoves, setQpBestMoves] = useState<number | null>(() => {
      if (initialMode !== 'quick_play' || !initialDifficultyLabel) return null;
      const best = loadQpBestMoves()[initialDifficultyLabel];
      return best ?? null;
    });
    const [packBestMoves, setPackBestMoves] = useState<number | null>(() => {
      if (initialMode === 'puzzle_pack') {
        const stage = getPackStage(initialPackStageIndex);
        if (!stage) return null;
        return loadPackProgress().bestMoves[stage.id] ?? null;
      }
      if (initialMode === 'mix_challenge') {
        const stage = getMixStage(initialMixStageIndex);
        if (!stage) return null;
        return loadMixProgress().bestMoves[stage.id] ?? null;
      }
      return null;
    });

    // QP timed countdown
    useEffect(() => {
        if (initialQpVariant !== 'timed' || timeLeftSec == null) return;
        if (gameState.isWin || isLose || processingMatch) return;
        if (timeLeftSec <= 0) {
            setIsLose(true);
            setLoseReason('時間到！訂單還沒交完');
            return;
        }
        const t = window.setTimeout(() => setTimeLeftSec((s) => (s == null ? s : s - 1)), 1000);
        return () => window.clearTimeout(t);
    }, [timeLeftSec, initialQpVariant, gameState.isWin, isLose, processingMatch]);

    useEffect(() => {
        if (gameState.isWin && !celebratedWin) {
            sounds.win();
            setCelebratedWin(true);
            if (gameState.mode === 'quick_play' && gameState.difficultyLabel) {
              const moves = gameState.history.length;
              const best = persistQpBestMoves(gameState.difficultyLabel, moves);
              setQpBestMoves(best);
            }
            if (gameState.mode === 'puzzle_pack') {
              const moves = gameState.history.length;
              const next = persistPackStageClear(gameState.level, moves);
              const stage = getPackStage(gameState.level);
              if (stage) {
                setPackBestMoves(next.bestMoves[stage.id] ?? moves);
              }
            }
            if (gameState.mode === 'mix_challenge') {
              const moves = gameState.history.length;
              const next = persistMixStageClear(gameState.level, moves);
              const stage = getMixStage(gameState.level);
              if (stage) {
                setPackBestMoves(next.bestMoves[stage.id] ?? moves);
              }
            }
            return;
        }
        if (!gameState.isWin && celebratedWin) {
            setCelebratedWin(false);
        }
    }, [gameState.isWin, celebratedWin, gameState.mode, gameState.difficultyLabel, gameState.history.length, gameState.level]);

    // Clear mix flash
    useEffect(() => {
        if (!mixFlashId) return;
        const t = window.setTimeout(() => setMixFlashId(null), 550);
        return () => window.clearTimeout(t);
    }, [mixFlashId]);

    // --- Helper to update missions from game events ---
    const handleClaimMission = (missionId: string) => {
        const coinsDelta = claimMission(missionId);
        if (coinsDelta > 0) {
            setGameState(gs => ({ ...gs, coins: gs.coins + coinsDelta }));
        }
    };

    // --- CALCULATE VALID TARGETS ---
    const validTargets = useMemo(() => {
        if (!gameState.selectedBottleId) return new Set<string>();

        const source = gameState.bottles.find(b => b.id === gameState.selectedBottleId);
        if (!source) return new Set<string>();

        const targets = new Set<string>();
        gameState.bottles.forEach(target => {
            if (canPour(source, target)) {
                targets.add(target.id);
            }
        });
        return targets;
    }, [gameState.selectedBottleId, gameState.bottles]);

    const mixTargets = useMemo(() => {
        if (!gameState.selectedBottleId) return new Set<string>();
        const source = gameState.bottles.find(b => b.id === gameState.selectedBottleId);
        if (!source) return new Set<string>();
        const targets = new Set<string>();
        gameState.bottles.forEach(target => {
            if (isMixingPour(source, target)) targets.add(target.id);
        });
        return targets;
    }, [gameState.selectedBottleId, gameState.bottles]);

    // --- CHECK DEADLOCK & LOOPS ---
    useEffect(() => {
        if (gameState.isWin || isLose || processingMatch) {
            setWarningState({ type: null, message: '' });
            return;
        }

        const isDeadlock = checkDeadlock(gameState.bottles, gameState.history, gameState.orders);
        if (isDeadlock) {
            setWarningState({
                type: 'deadlock',
                message: '無路可走！試試提示、道具或重來？'
            });
            return;
        }

        const isLooping = checkStateRepetition(gameState.bottles, gameState.history);
        if (isLooping) {
            setWarningState({
                type: 'loop',
                message: '鬼打牆了？這步沒效喔！'
            });
            return;
        }

        setWarningState({ type: null, message: '' });
    }, [gameState.bottles, gameState.history, gameState.isWin, isLose, processingMatch]);

    // --- 1. DETECTION EFFECT ---
    useEffect(() => {
        if (gameState.isWin || isLose || processingMatch) return;

        const match = findMatch(gameState.bottles, gameState.orders);

        if (match) {
            setProcessingMatch(match);
            // Order delivery sting only — level win fanfare plays once via isWin effect.
            setTimeout(() => sounds.score(), 100);
        }
    }, [gameState.bottles, gameState.orders, gameState.isWin, isLose, processingMatch]);

    // --- 2. EXECUTION EFFECT ---
    useEffect(() => {
        if (!processingMatch) return;

        const { bottleId, orderIndex } = processingMatch;

        const timer = setTimeout(() => {
            setGameState(prev => {
                const bottleExists = prev.bottles.some(b => b.id === bottleId);
                if (!bottleExists) return prev;

                // SNAPSHOT BEFORE DELIVERY: Add current state to history so Undo can bring the bottle back
                const historySnapshot = {
                    bottles: JSON.parse(JSON.stringify(prev.bottles)),
                    orders: JSON.parse(JSON.stringify(prev.orders))
                };
                const newHistory = [...prev.history, historySnapshot];

                let currentBottles = [...prev.bottles];
                let currentOrders = [...prev.orders];

                if (currentOrders[orderIndex]) {
                    currentOrders[orderIndex] = { ...currentOrders[orderIndex], isCompleted: true };
                }

                currentBottles = currentBottles.filter(b => b.id !== bottleId);

                const nextLockedIndex = currentOrders.findIndex(o => o.isLocked);
                if (nextLockedIndex !== -1) {
                    currentOrders[nextLockedIndex] = { ...currentOrders[nextLockedIndex], isLocked: false };
                }

                const isWin = checkLevelComplete(currentBottles, currentOrders);

                if (isWin) {
                    // TRACK MISSION: WIN_LEVEL
                    trackMissionProgress('WIN_LEVEL');
                }

                return {
                    ...prev,
                    bottles: currentBottles,
                    orders: currentOrders,
                    history: newHistory,
                    isWin
                };
            });

            setProcessingMatch(null);
        }, 800);

        return () => clearTimeout(timer);
    }, [processingMatch]);

    const findMatch = (bottles: BottleData[], orders: any[]) => {
        for (let i = 0; i < orders.length; i++) {
            const order = orders[i];
            if (!order.isCompleted && !order.isLocked) {
                const bottle = bottles.find(b =>
                    b.isCompleted &&
                    b.layers.length > 0 &&
                    b.layers[0].color === order.color
                );
                if (bottle) {
                    return { bottleId: bottle.id, orderIndex: i };
                }
            }
        }
        return null;
    };

    const startLevel = (levelInput: number) => {
        setIsLose(false);
        setLoseReason('');
        setHintIds(null);
        if (initialQpVariant === 'timed' && initialTimeLimitSec) {
            setTimeLeftSec(initialTimeLimitSec);
        }

        if (gameState.mode === 'puzzle_pack') {
            const { bottles, orders, stage } = materializePackStageAt(levelInput);
            const isWin = checkLevelComplete(bottles, orders);
            setGameState(prev => ({
                ...prev,
                level: levelInput,
                difficultyLabel: stage.id,
                bottles,
                orders,
                initialBoardState: {
                    bottles: JSON.parse(JSON.stringify(bottles)),
                    orders: JSON.parse(JSON.stringify(orders)),
                },
                selectedBottleId: null,
                history: [],
                isWin,
            }));
            setProcessingMatch(null);
            setWarningState({ type: null, message: '' });
            const best = loadPackProgress().bestMoves[stage.id];
            setPackBestMoves(best ?? null);
            return;
        }

        if (gameState.mode === 'mix_challenge') {
            const { bottles, orders, stage } = materializeMixStageAt(levelInput);
            const isWin = checkLevelComplete(bottles, orders);
            setGameState(prev => ({
                ...prev,
                level: levelInput,
                difficultyLabel: stage.id,
                bottles,
                orders,
                initialBoardState: {
                    bottles: JSON.parse(JSON.stringify(bottles)),
                    orders: JSON.parse(JSON.stringify(orders)),
                },
                selectedBottleId: null,
                history: [],
                isWin,
            }));
            setProcessingMatch(null);
            setWarningState({ type: null, message: '' });
            setShowMixGuidance(true);
            const best = loadMixProgress().bestMoves[stage.id];
            setPackBestMoves(best ?? null);
            return;
        }

        const { bottles, orders } = generateLevel(levelInput);
        const isWin = checkLevelComplete(bottles, orders);
        setGameState(prev => ({
            ...prev,
            level: levelInput,
            bottles: bottles,
            orders: orders,
            initialBoardState: {
                bottles: JSON.parse(JSON.stringify(bottles)),
                orders: JSON.parse(JSON.stringify(orders))
            },
            selectedBottleId: null,
            history: [],
            isWin: isWin
        }));
        setProcessingMatch(null);
        setWarningState({ type: null, message: '' });
    };

    const handleNextLevel = () => {
        sounds.pop();
        if (gameState.mode === 'adventure') {
            const nextLevel = gameState.level + 1;
            setGameState(prev => ({ ...prev, level: nextLevel }));
            startLevel(nextLevel);
        } else if (gameState.mode === 'puzzle_pack') {
            const nextIndex = gameState.level + 1;
            if (nextIndex >= packStageCount()) {
                navigate('/');
                return;
            }
            startLevel(nextIndex);
        } else if (gameState.mode === 'mix_challenge') {
            const nextIndex = gameState.level + 1;
            if (nextIndex >= mixStageCount()) {
                navigate('/');
                return;
            }
            startLevel(nextIndex);
        } else {
            startLevel(gameState.level);
        }
    };

    const handleRestart = () => {
        if (window.confirm("重新開始本關卡?")) {
            setIsLose(false);
            setLoseReason('');
            setHintIds(null);
            if (initialQpVariant === 'timed' && initialTimeLimitSec) {
                setTimeLeftSec(initialTimeLimitSec);
            }
            if (gameState.initialBoardState) {
                const resetBottles = JSON.parse(JSON.stringify(gameState.initialBoardState.bottles));
                const resetOrders = JSON.parse(JSON.stringify(gameState.initialBoardState.orders));
                const isWin = checkLevelComplete(resetBottles, resetOrders);

                setGameState(prev => ({
                    ...prev,
                    bottles: resetBottles,
                    orders: resetOrders,
                    selectedBottleId: null,
                    history: [],
                    isWin
                }));
                setProcessingMatch(null);
                setWarningState({ type: null, message: '' });
                return;
            }
            startLevel(gameState.level);
        }
    }

    const handleBottleClick = (bottleId: string) => {
        if (gameState.isWin || isLose || processingMatch) return;

        setGameState(prev => {
            const { selectedBottleId, bottles, orders } = prev;

            if (!selectedBottleId) {
                const bottle = bottles.find(b => b.id === bottleId);
                if (!bottle || bottle.layers.length === 0 || bottle.isCompleted) return prev;

                sounds.pop();
                setHintIds(null);
                return { ...prev, selectedBottleId: bottleId };
            }

            if (selectedBottleId === bottleId) {
                sounds.pop();
                return { ...prev, selectedBottleId: null };
            }

            const sourceIndex = bottles.findIndex(b => b.id === selectedBottleId);
            const targetIndex = bottles.findIndex(b => b.id === bottleId);

            if (sourceIndex === -1 || targetIndex === -1) return { ...prev, selectedBottleId: null };

            const source = bottles[sourceIndex];
            const target = bottles[targetIndex];

            if (canPour(source, target)) {
                // Valid Move
                trackMissionProgress('POUR'); // TRACK MISSION: POUR

                const historySnapshot = {
                    bottles: JSON.parse(JSON.stringify(bottles)),
                    orders: JSON.parse(JSON.stringify(orders))
                };
                const newHistory = [...prev.history, historySnapshot];

                const mixing = isMixingPour(source, target);
                const { newSource, newTarget } = pourLiquid(source, target);
                if (mixing) {
                    sounds.mix();
                    setMixFlashId(newTarget.id);
                } else {
                    sounds.pour();
                }
                setHintIds(null);

                let currentBottles = [...bottles];
                currentBottles[sourceIndex] = newSource;
                currentBottles[targetIndex] = newTarget;

                const isTargetNewlyCompleted = newTarget.isCompleted && !target.isCompleted;
                if (isTargetNewlyCompleted) {
                    const match = findMatch(currentBottles, orders);
                    if (!match) {
                        sounds.pop();
                    }
                }

                const isWin = checkLevelComplete(currentBottles, orders);

                if (isWin) {
                    trackMissionProgress('WIN_LEVEL');
                }

                // QP move-limit fail (count player pours = history length after this pour)
                if (
                  !isWin &&
                  prev.mode === 'quick_play' &&
                  initialQpVariant === 'moves' &&
                  initialMoveLimit != null &&
                  newHistory.length >= initialMoveLimit
                ) {
                    setIsLose(true);
                    setLoseReason(`已用完 ${initialMoveLimit} 步`);
                }

                return {
                    ...prev,
                    bottles: currentBottles,
                    selectedBottleId: null,
                    history: newHistory,
                    isWin
                };
            } else {
                const targetBottle = bottles[targetIndex];
                if (!targetBottle.isCompleted && targetBottle.layers.length > 0) {
                    sounds.pop();
                    return { ...prev, selectedBottleId: bottleId };
                }
                sounds.error();
                return { ...prev, selectedBottleId: null };
            }
        });
    };

    const handleUndo = () => {
        if (processingMatch || isLose) return;
        setGameState(prev => {
            if (prev.history.length === 0) {
                sounds.error();
                return prev;
            }
            if (prev.coins < COST_UNDO) {
                sounds.error();
                return prev;
            }

            sounds.pop();
            trackMissionProgress('USE_ITEM'); // TRACK MISSION
            setHintIds(null);

            const previousState = prev.history[prev.history.length - 1];
            const newHistory = prev.history.slice(0, -1);

            return {
                ...prev,
                coins: prev.coins - COST_UNDO,
                bottles: previousState.bottles,
                orders: previousState.orders,
                selectedBottleId: null,
                history: newHistory
            };
        });
    };

    const handleAddBottle = () => {
        if (processingMatch || isLose) return;
        setGameState(prev => {
            if (prev.coins < COST_ADD_BOTTLE) {
                sounds.error();
                return prev;
            }
            sounds.magic();
            trackMissionProgress('USE_ITEM'); // TRACK MISSION

            const capacity =
              prev.mode === 'puzzle_pack'
                ? (getPackStage(prev.level)?.capacity ?? 4)
                : prev.mode === 'mix_challenge'
                  ? (getMixStage(prev.level)?.capacity ?? 4)
                  : getCapacityForLevel(prev.level);

            const newBottle: BottleData = {
                id: Math.random().toString(),
                layers: [],
                capacity,
                isCompleted: false,
                mixingEnabled: prev.bottles.some((b) => b.mixingEnabled),
            };
            return {
                ...prev,
                coins: prev.coins - COST_ADD_BOTTLE,
                bottles: [...prev.bottles, newBottle]
            };
        });
    };

    const handleShuffle = () => {
        if (processingMatch || isLose) return;

        setGameState(prev => {
            if (prev.coins < COST_SHUFFLE) {
                sounds.error();
                return prev;
            }

            sounds.magic();
            trackMissionProgress('USE_ITEM'); // TRACK MISSION
            setHintIds(null);

            const historySnapshot = {
                bottles: JSON.parse(JSON.stringify(prev.bottles)),
                orders: JSON.parse(JSON.stringify(prev.orders))
            };
            const newHistory = [...prev.history, historySnapshot];

            const shuffledBottles = shuffleBottles(prev.bottles);

            return {
                ...prev,
                coins: prev.coins - COST_SHUFFLE,
                bottles: shuffledBottles,
                selectedBottleId: null,
                history: newHistory
            };
        });
    };

    const handleReveal = () => {
        if (processingMatch || isLose) return;

        setGameState(prev => {
            if (prev.coins < COST_REVEAL) {
                sounds.error();
                return prev;
            }

            sounds.magic();
            trackMissionProgress('USE_ITEM'); // TRACK MISSION

            const historySnapshot = {
                bottles: JSON.parse(JSON.stringify(prev.bottles)),
                orders: JSON.parse(JSON.stringify(prev.orders))
            };
            const newHistory = [...prev.history, historySnapshot];

            const revealedBottles = revealHiddenLayers(prev.bottles);

            return {
                ...prev,
                coins: prev.coins - COST_REVEAL,
                bottles: revealedBottles,
                selectedBottleId: null,
                history: newHistory
            }
        });
    };

    const handleHint = () => {
        if (processingMatch || gameState.isWin || isLose) return;
        if (gameState.coins < COST_HINT) {
            sounds.error();
            return;
        }
        const hint = findHintMove(gameState.bottles, gameState.orders);
        if (!hint) {
            sounds.error();
            setWarningState({ type: 'deadlock', message: '暫時找不到提示步，試試道具？' });
            return;
        }
        sounds.pop();
        trackMissionProgress('USE_ITEM');
        setHintIds(hint);
        setGameState((prev) => ({
          ...prev,
          coins: prev.coins - COST_HINT,
          selectedBottleId: hint.sourceId,
        }));
    };

    const dismissMixGuidance = () => {
        markMixIntroSeen();
        setShowMixGuidance(false);
    };

    const challengeStatus = useMemo(() => {
        if (gameState.mode !== 'quick_play') return undefined;
        if (initialQpVariant === 'moves' && initialMoveLimit != null) {
            const used = gameState.history.length;
            return `剩餘步數 ${Math.max(0, initialMoveLimit - used)}`;
        }
        if (initialQpVariant === 'timed' && timeLeftSec != null) {
            const m = Math.floor(timeLeftSec / 60);
            const s = timeLeftSec % 60;
            return `剩餘 ${m}:${s.toString().padStart(2, '0')}`;
        }
        return undefined;
    }, [gameState.mode, gameState.history.length, initialQpVariant, initialMoveLimit, timeLeftSec]);

    const stageCount =
      gameState.mode === 'mix_challenge' ? mixStageCount() : packStageCount();

    return (
        <div className="relative w-full h-screen flex flex-col items-center justify-between text-white overflow-hidden font-sans">

            {/* Dynamic Background */}
            <Background background={currentBackground} />

            {/* Top Bar Container - Unified Design */}
            <div className="w-full relative z-50 safe-top">
                <div className="w-full flex items-center gap-2 md:gap-3 px-3 md:px-6 pt-3 md:pt-4 pb-2 md:pb-3 safe-left safe-right">
                    {/* Left: Action Buttons - Unified Card Style */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                            onClick={() => navigate('/')}
                            className="touch-target w-10 h-10 md:w-11 md:h-11 rounded-xl bg-white/10 backdrop-blur-xl flex items-center justify-center text-white/70 active:bg-white/20 transition-all border border-white/20 shadow-lg touch-active"
                            aria-label="回主頁"
                        >
                            <Home size={18} className="md:w-5 md:h-5" />
                        </button>
                        <button
                            onClick={handleRestart}
                            className="touch-target w-10 h-10 md:w-11 md:h-11 rounded-xl bg-white/10 backdrop-blur-xl flex items-center justify-center text-white/70 active:bg-white/20 transition-all border border-white/20 shadow-lg touch-active"
                            aria-label="重新開始"
                        >
                            <RotateCcw size={18} className="md:w-5 md:h-5" />
                        </button>
                        <button
                            onClick={openMissionModal}
                            className="touch-target w-10 h-10 md:w-11 md:h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg border border-white/20 relative touch-active"
                            aria-label="每日任務"
                        >
                            <ClipboardList size={18} className="md:w-5 md:h-5" />
                            {hasNotifications && (
                                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 md:w-3 md:h-3 bg-red-500 rounded-full border-2 border-white/20"></span>
                            )}
                        </button>
                    </div>

                    {/* Center: TopBar Component - Takes remaining space */}
                    <div className="flex-1 min-w-0">
                        <TopBar
                            level={
                              gameState.mode === 'puzzle_pack' || gameState.mode === 'mix_challenge'
                                ? gameState.level + 1
                                : gameState.level
                            }
                            mode={gameState.mode}
                            difficultyLabel={gameState.difficultyLabel}
                            packStageName={packStageName}
                            coins={gameState.coins}
                            onSettings={() => setShowSettingsModal(true)}
                            challengeStatus={challengeStatus}
                        />
                    </div>
                </div>
            </div>

            <div className="flex-1 w-full max-w-lg flex flex-col items-center justify-start z-10 px-3 md:px-4 safe-left safe-right pt-2 md:pt-0 overflow-hidden">

                <TargetArea
                    orders={gameState.orders}
                />

                {mixingOnBoard && (
                  <RecipeHud showIrreversibleWarning={showMixGuidance} />
                )}

                {mixTip && (
                  <div className="mb-2 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-400/30 text-amber-100 text-[11px] md:text-xs font-bold text-center max-w-md">
                    {mixTip}
                  </div>
                )}

                {/* DYNAMIC HINT NOTIFICATION - Unified Card Style */}
                {warningState.type && !gameState.isWin && !isLose && (
                    <div className={`
                    animate-bounce-short mb-3 md:mb-4 backdrop-blur-xl border px-4 py-2.5 rounded-2xl flex items-center gap-2.5 shadow-lg transition-all mx-2
                    ${warningState.type === 'deadlock'
                            ? 'bg-red-500/20 border-red-500/30 text-red-100'
                            : 'bg-yellow-500/20 border-yellow-500/30 text-yellow-100'}
                `}>
                        {warningState.type === 'deadlock' ? <AlertTriangle size={20} className="md:w-5 md:h-5" /> : <Repeat size={20} className="md:w-5 md:h-5" />}
                        <span className="text-xs md:text-sm font-bold">{warningState.message}</span>
                    </div>
                )}

                <div className="w-full flex-1 flex items-end pb-4 md:pb-8 relative overflow-y-auto no-scrollbar">
                    <div className="w-full flex flex-wrap justify-center gap-x-4 gap-y-6 md:gap-x-6 md:gap-y-8 content-end">
                        {gameState.bottles.map(bottle => (
                            <Bottle
                                key={bottle.id}
                                bottle={bottle}
                                isSelected={gameState.selectedBottleId === bottle.id}
                                isValidTarget={validTargets.has(bottle.id)}
                                isMixTarget={mixTargets.has(bottle.id)}
                                isMixingFlash={mixFlashId === bottle.id}
                                isHinted={
                                  hintIds != null &&
                                  (hintIds.sourceId === bottle.id || hintIds.targetId === bottle.id)
                                }
                                isFlying={processingMatch?.bottleId === bottle.id}
                                onClick={() => handleBottleClick(bottle.id)}
                            />
                        ))}
                    </div>
                </div>
            </div>

            <BottomControls
                onUndo={handleUndo}
                onShuffle={handleShuffle}
                onAddBottle={handleAddBottle}
                onReveal={handleReveal}
                onHint={handleHint}
            />

            {/* First mix unlock guidance */}
            {showMixGuidance && mixingOnBoard && !gameState.isWin && !isLose && (
              <div className="absolute inset-x-0 bottom-28 z-[45] flex justify-center px-4 pointer-events-none">
                <div className="pointer-events-auto max-w-sm w-full rounded-2xl bg-[#2d2d44]/95 border border-amber-400/40 shadow-2xl p-4">
                  <p className="text-amber-300 text-xs font-bold tracking-wider mb-1">混色已解鎖</p>
                  <p className="text-white text-sm font-bold mb-2">
                    配方在上方。混色不可逆——確認訂單再開倒。
                  </p>
                  <button
                    type="button"
                    onClick={dismissMixGuidance}
                    className="w-full min-h-[44px] rounded-xl bg-amber-500 font-bold text-[#1a1a2e] active:scale-[0.98]"
                  >
                    知道了
                  </button>
                </div>
              </div>
            )}

            {/* --- MODALS --- */}
            <DailyMissions
                isOpen={isMissionModalOpen}
                onClose={closeMissionModal}
                missions={missions}
                onClaim={handleClaimMission}
            />

            <Settings
                isOpen={showSettingsModal}
                onClose={() => setShowSettingsModal(false)}
            />

            {gameState.isWin && (
                <ResultOverlay
                    title="完成訂單！"
                    subtitle={
                      gameState.mode === 'adventure'
                        ? `第 ${gameState.level} 關完成`
                        : gameState.mode === 'puzzle_pack'
                          ? `${packStageName ?? '關卡包'}完成`
                          : gameState.mode === 'mix_challenge'
                            ? `${packStageName ?? '混合挑戰'}完成`
                          : `${qpDifficultyLabel(gameState.difficultyLabel)} 完成`
                    }
                    badge="太棒了！"
                    variant="win"
                    stats={[
                        {
                          label:
                            gameState.mode === 'puzzle_pack'
                              ? '關卡包'
                              : gameState.mode === 'mix_challenge'
                                ? '混合挑戰'
                                : '關卡',
                          value:
                            gameState.mode === 'puzzle_pack' || gameState.mode === 'mix_challenge'
                              ? `${gameState.level + 1}/${stageCount}`
                              : gameState.level,
                        },
                        { label: '金幣', value: gameState.coins },
                        { label: '瓶子數', value: gameState.bottles.length },
                        { label: '倒次', value: gameState.history.length },
                        ...(gameState.mode === 'quick_play' && qpBestMoves != null
                          ? [{ label: '最佳倒次', value: qpBestMoves }]
                          : []),
                        ...((gameState.mode === 'puzzle_pack' || gameState.mode === 'mix_challenge') &&
                        packBestMoves != null
                          ? [{ label: '最佳倒次', value: packBestMoves }]
                          : []),
                    ]}
                    primaryLabel={
                      gameState.mode === 'adventure'
                        ? '下一關'
                        : gameState.mode === 'puzzle_pack' || gameState.mode === 'mix_challenge'
                          ? gameState.level + 1 >= stageCount
                            ? '回主頁'
                            : '下一關'
                          : '再來一局'
                    }
                    onPrimary={handleNextLevel}
                />
            )}

            {isLose && !gameState.isWin && (
                <ResultOverlay
                    title="挑戰失敗"
                    subtitle={loseReason || '再試一次吧'}
                    badge="加油！"
                    variant="lose"
                    stats={[
                        { label: '倒次', value: gameState.history.length },
                        ...(initialMoveLimit != null
                          ? [{ label: '步數上限', value: initialMoveLimit }]
                          : []),
                        ...(initialTimeLimitSec != null
                          ? [{ label: '時限（秒）', value: initialTimeLimitSec }]
                          : []),
                    ]}
                    primaryLabel="再來一局"
                    onPrimary={() => {
                      setIsLose(false);
                      setLoseReason('');
                      if (gameState.initialBoardState) {
                        const resetBottles = JSON.parse(JSON.stringify(gameState.initialBoardState.bottles));
                        const resetOrders = JSON.parse(JSON.stringify(gameState.initialBoardState.orders));
                        setGameState((prev) => ({
                          ...prev,
                          bottles: resetBottles,
                          orders: resetOrders,
                          selectedBottleId: null,
                          history: [],
                          isWin: false,
                        }));
                        if (initialQpVariant === 'timed' && initialTimeLimitSec) {
                          setTimeLeftSec(initialTimeLimitSec);
                        }
                      } else {
                        startLevel(gameState.level);
                      }
                    }}
                />
            )}
        </div>
    );
}
