import React, { useState, useEffect, useMemo } from 'react';
import { GameState, BottleData, GameMode } from '../types';
import { INITIAL_COINS, getCapacityForLevel, COST_SHUFFLE, COST_REVEAL, COST_ADD_BOTTLE, COST_UNDO } from '../constants';
import { generateLevel, canPour, pourLiquid, checkLevelComplete, shuffleBottles, revealHiddenLayers, checkDeadlock, checkStateRepetition } from '../services/gameLogic';
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
import { useNavigate, useLocation } from 'react-router-dom';
import { sounds } from '../utils/sound';
import { getBackgroundByLevel, getSavedBackground } from '../utils/backgrounds';
import { AlertTriangle, Home, RotateCcw, Repeat, ClipboardList } from 'lucide-react';

export default function Game() {
    const navigate = useNavigate();
    const location = useLocation();

    // Extract initial params from navigation state
    const initialMode: GameMode = location.state?.mode || 'adventure';
    const initialDifficulty = location.state?.difficultyLevel || 1;
    const initialDifficultyLabel = location.state?.difficultyLabel || 'CUSTOM';

    // Initialize state
    const [gameState, setGameState] = useState<GameState>(() => {
        // Determine level: if adventure, load from storage. If quick play, use passed prop.
        let startLevel = 1;
        if (initialMode === 'adventure') {
            const savedLevel = localStorage.getItem('mls_level');
            startLevel = savedLevel ? parseInt(savedLevel, 10) : 1;
        } else {
            startLevel = initialDifficulty;
        }

        const savedCoins = loadCoins(INITIAL_COINS);

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

    // Background selection - use level-based or saved preference
    const currentBackground = useMemo(() => {
        if (gameState.mode === 'adventure') {
            return getBackgroundByLevel(gameState.level);
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

    // State to track the specific match being processed { bottleId, orderIndex }
    const [processingMatch, setProcessingMatch] = useState<{ bottleId: string; orderIndex: number } | null>(null);

    // (Removed initial startLevel call as it's now done in useState initializer)

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

    // --- CHECK DEADLOCK & LOOPS ---
    useEffect(() => {
        if (gameState.isWin || processingMatch) {
            setWarningState({ type: null, message: '' });
            return;
        }

        const isDeadlock = checkDeadlock(gameState.bottles, gameState.history, gameState.orders);
        if (isDeadlock) {
            setWarningState({
                type: 'deadlock',
                message: '無路可走！試試道具或重來？'
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
    }, [gameState.bottles, gameState.history, gameState.isWin, processingMatch]);

    // --- 1. DETECTION EFFECT ---
    useEffect(() => {
        if (gameState.isWin || processingMatch) return;

        const match = findMatch(gameState.bottles, gameState.orders);

        if (match) {
            setProcessingMatch(match);
            setTimeout(() => sounds.win(), 100);
        }
    }, [gameState.bottles, gameState.orders, gameState.isWin, processingMatch]);

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
        } else {
            startLevel(gameState.level);
        }
    };

    const handleRestart = () => {
        if (window.confirm("重新開始本關卡?")) {
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
        if (gameState.isWin || processingMatch) return;

        setGameState(prev => {
            const { selectedBottleId, bottles, orders } = prev;

            if (!selectedBottleId) {
                const bottle = bottles.find(b => b.id === bottleId);
                if (!bottle || bottle.layers.length === 0 || bottle.isCompleted) return prev;

                sounds.pop();
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

                const { newSource, newTarget } = pourLiquid(source, target);
                sounds.pour();

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
        if (processingMatch) return;
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
        if (processingMatch) return;
        setGameState(prev => {
            if (prev.coins < COST_ADD_BOTTLE) {
                sounds.error();
                return prev;
            }
            sounds.magic();
            trackMissionProgress('USE_ITEM'); // TRACK MISSION

            const newBottle: BottleData = {
                id: Math.random().toString(),
                layers: [],
                capacity: getCapacityForLevel(prev.level),
                isCompleted: false
            };
            return {
                ...prev,
                coins: prev.coins - COST_ADD_BOTTLE,
                bottles: [...prev.bottles, newBottle]
            };
        });
    };

    const handleShuffle = () => {
        if (processingMatch) return;

        setGameState(prev => {
            if (prev.coins < COST_SHUFFLE) {
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
        if (processingMatch) return;

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
                            aria-label="Home"
                        >
                            <Home size={18} className="md:w-5 md:h-5" />
                        </button>
                        <button
                            onClick={handleRestart}
                            className="touch-target w-10 h-10 md:w-11 md:h-11 rounded-xl bg-white/10 backdrop-blur-xl flex items-center justify-center text-white/70 active:bg-white/20 transition-all border border-white/20 shadow-lg touch-active"
                            aria-label="Restart"
                        >
                            <RotateCcw size={18} className="md:w-5 md:h-5" />
                        </button>
                        <button
                            onClick={openMissionModal}
                            className="touch-target w-10 h-10 md:w-11 md:h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg border border-white/20 relative touch-active"
                            aria-label="Daily Missions"
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
                            level={gameState.level}
                            mode={gameState.mode}
                            difficultyLabel={gameState.difficultyLabel}
                            coins={gameState.coins}
                            onSettings={() => setShowSettingsModal(true)}
                        />
                    </div>
                </div>
            </div>

            <div className="flex-1 w-full max-w-lg flex flex-col items-center justify-start z-10 px-3 md:px-4 safe-left safe-right pt-2 md:pt-0">

                <TargetArea
                    orders={gameState.orders}
                />

                {/* DYNAMIC HINT NOTIFICATION - Unified Card Style */}
                {warningState.type && !gameState.isWin && (
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

                <div className="w-full flex-1 flex items-end pb-4 md:pb-8 relative">
                    <div className="w-full flex flex-wrap justify-center gap-x-4 gap-y-6 md:gap-x-6 md:gap-y-8 content-end">
                        {gameState.bottles.map(bottle => (
                            <Bottle
                                key={bottle.id}
                                bottle={bottle}
                                isSelected={gameState.selectedBottleId === bottle.id}
                                isValidTarget={validTargets.has(bottle.id)}
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
            />

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
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-500 safe-top safe-bottom safe-left safe-right">
                    <div className="bg-white/10 p-6 md:p-8 rounded-2xl md:rounded-3xl border border-white/20 shadow-2xl flex flex-col items-center text-center max-w-sm mx-3 md:mx-4">
                        <div className="text-5xl md:text-6xl mb-3 md:mb-4">🏆</div>
                        <h2 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-400 mb-2">
                            AWESOME!
                        </h2>
                        <p className="text-gray-300 mb-6 md:mb-8 text-sm md:text-base">完成訂單！</p>

                        <button
                            onClick={handleNextLevel}
                            className="touch-target w-full py-3.5 md:py-4 bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg md:rounded-xl text-lg md:text-xl font-bold shadow-lg active:scale-95 transition-transform touch-active"
                        >
                            {gameState.mode === 'adventure' ? '下一關' : '再來一局'}
                        </button>

                        <button
                            onClick={() => navigate('/')}
                            className="touch-target mt-3 md:mt-4 text-white/50 active:text-white underline text-xs md:text-sm py-2"
                        >
                            回首頁
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
