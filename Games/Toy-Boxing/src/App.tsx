import React, { useEffect, useRef, useState } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { haptic } from '@clubhouse/shared/juice';
import { playGoal, playLose, playWin } from '@clubhouse/shared/synthAudio';
import { TouchButton, touchControlsWrapClass } from '@clubhouse/shared/TouchButton';
import { AnimatePresence, motion } from 'motion/react';
import { Heart, Play, Shield, Trophy, Timer, Zap } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  CHARACTERS,
  characterPortraitUrl,
  getCharacter,
  preloadFighterBodies,
  ringFloorImage,
  ringSkyImage,
  type CharacterDef,
  type CharacterId,
} from './characters';
import {
  applyStun,
  effectiveStaminaRegen,
  emptyHabit,
  isStunKo,
  recordPlayerHeight,
  resolveHit,
  startAttack,
  tickAttack,
  tickBodyFatigue,
  tickStun,
  type ActiveAttack,
  type AttackOverrides,
  type HabitMemory,
  type Height,
} from './combat';
import {
  DIFFICULTY,
  DIFFICULTY_BLURBS,
  DIFFICULTY_LABELS,
  decideCpuIntent,
  nextThinkDelay,
  resolveStyle,
  type Difficulty,
} from './cpuAi';
import { BOXER_HEIGHT, BOXER_WIDTH, drawToyBoxer } from './drawBoxer';
import {
  FirstRunGuide,
  hasSeenFirstRunGuide,
} from './components/FirstRunGuide';
import {
  applyLeagueLoss,
  applyLeagueWin,
  continueLeagueIndex,
  isLeagueComplete,
  isOpponentUnlocked,
  leagueTitle,
  loadLeague,
  saveLeague,
  type LeagueProgress,
} from './league';
import { OPPONENTS, getOpponent, type OpponentId } from './opponents';
import {
  playBlock,
  playDodge,
  playImpact,
  playStunWarn,
  playWhoosh,
  playWrongBlock,
} from './boxingAudio';
import {
  loadStats,
  modeStats,
  recordResult,
  saveStats,
  withDifficulty,
  type CareerStats,
  type FightOutcome,
} from './stats';

preloadFighterBodies();

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 400;
const GROUND_Y = 350;
const MOVE_SPEED = 4;
const ROUND_TIME = 60;
const HIT_STOP_LIGHT = 0.045;
const HIT_STOP_HEAVY = 0.09;
const HIT_STOP_KO = 0.18;

enum Action {
  IDLE = 'IDLE',
  JAB = 'JAB',
  HOOK = 'HOOK',
  SIGNATURE = 'SIGNATURE',
  BLOCK = 'BLOCK',
  DODGE = 'DODGE',
  HIT = 'HIT',
  KO = 'KO',
  PARRY = 'PARRY',
  STAGGER = 'STAGGER',
}

type PlayMode = 'free' | 'league';

interface Boxer {
  id: 'player' | 'cpu';
  x: number;
  y: number;
  health: number;
  maxHealth: number;
  stamina: number;
  maxStamina: number;
  superMeter: number;
  maxSuperMeter: number;
  stunMeter: number;
  bodyFatigue: number;
  score: number;
  action: Action;
  actionTimer: number;
  facing: 1 | -1;
  characterId: CharacterId;
  power: number;
  speed: number;
  staminaRegen: number;
  name: string;
  thinkTimer: number;
  height: Height;
  attack: ActiveAttack | null;
  guardHeight: Height | null;
  lastHitTaken: Height | null;
  feintLeft: number;
  whooshPlayed: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

function createBoxer(
  id: 'player' | 'cpu',
  characterId: CharacterId,
  overrides?: Partial<Pick<Boxer, 'name' | 'power' | 'speed' | 'health' | 'maxHealth' | 'staminaRegen'>>,
): Boxer {
  const c = getCharacter(characterId);
  const health = overrides?.health ?? c.health;
  return {
    id,
    x: id === 'player' ? 200 : 600,
    y: GROUND_Y - BOXER_HEIGHT,
    health,
    maxHealth: overrides?.maxHealth ?? health,
    stamina: 100,
    maxStamina: 100,
    superMeter: 0,
    maxSuperMeter: 100,
    stunMeter: 0,
    bodyFatigue: 0,
    score: 0,
    action: Action.IDLE,
    actionTimer: 0,
    facing: id === 'player' ? 1 : -1,
    characterId,
    power: overrides?.power ?? c.power,
    speed: overrides?.speed ?? c.speed,
    staminaRegen: overrides?.staminaRegen ?? c.staminaRegen,
    name: overrides?.name ?? c.name,
    thinkTimer: 0.15,
    height: 'high',
    attack: null,
    guardHeight: null,
    lastHitTaken: null,
    feintLeft: 0,
    whooshPlayed: false,
  };
}

function createCpuFromOpponent(opponentId: OpponentId): Boxer {
  const opp = getOpponent(opponentId);
  return createBoxer('cpu', opp.visual, {
    name: opp.name,
    power: opp.power,
    speed: opp.speed,
    health: opp.health,
    maxHealth: opp.health,
    staminaRegen: opp.staminaRegen,
  });
}

function lowHeld(keys: Set<string>): boolean {
  return keys.has('ArrowDown') || keys.has('KeyC') || keys.has('ShiftLeft') || keys.has('ShiftRight');
}

export default function ToyBoxing() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'round_end' | 'game_over'>('menu');
  const [winner, setWinner] = useState<string | null>(null);
  const [winRoute, setWinRoute] = useState<'health' | 'stun' | 'decision' | null>(null);
  const prevGameStateRef = useRef(gameState);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [playerCharId, setPlayerCharId] = useState<CharacterId>('bot');
  const [cpuCharId, setCpuCharId] = useState<CharacterId>('bear');
  const [careerStats, setCareerStats] = useState<CareerStats>(() => loadStats());
  const [difficulty, setDifficulty] = useState<Difficulty>(() => loadStats().lastDifficulty);
  const [showFirstRun, setShowFirstRun] = useState(() => !hasSeenFirstRunGuide());
  const [playMode, setPlayMode] = useState<PlayMode>('league');
  const [league, setLeague] = useState<LeagueProgress>(() => loadLeague());
  const [leagueIndex, setLeagueIndex] = useState(() => continueLeagueIndex(loadLeague().clearedCount));
  const [menuTab, setMenuTab] = useState<'league' | 'free'>('league');
  /** Brief on-ring coaching line at fight start (opponent style / height tip). */
  const [fightTip, setFightTip] = useState<string | null>(null);

  const settingsRef = useRef({
    difficulty,
    playerCharId,
    cpuCharId,
    playMode,
    leagueIndex,
  });
  settingsRef.current = { difficulty, playerCharId, cpuCharId, playMode, leagueIndex };
  const careerMode = modeStats(careerStats, difficulty);
  const activeOpponent = OPPONENTS[leagueIndex] ?? OPPONENTS[0];

  const chooseDifficulty = (d: Difficulty) => {
    setDifficulty(d);
    setCareerStats((prev) => {
      const next = withDifficulty(prev, d);
      saveStats(next);
      return next;
    });
  };

  const engineRef = useRef({
    player: createBoxer('player', 'bot'),
    cpu: createBoxer('cpu', 'bear'),
    timeLeft: ROUND_TIME,
    round: 1,
    particles: [] as Particle[],
    screenShake: 0,
    timeScale: 1.0,
    hitStop: 0,
    isKO: false,
    parryEffect: null as { x: number; y: number; life: number; text: string } | null,
    habit: emptyHabit() as HabitMemory,
    floatTexts: [] as { x: number; y: number; text: string; life: number; color: string }[],
    koReason: null as 'health' | 'stun' | null,
  });

  const [uiState, setUiState] = useState({
    playerHealth: 100,
    playerMaxHealth: 100,
    playerStamina: 100,
    playerSuper: 0,
    playerStun: 0,
    playerScore: 0,
    playerName: '藍拳機器人',
    playerHeight: 'high' as Height,
    cpuHealth: 100,
    cpuMaxHealth: 100,
    cpuStamina: 100,
    cpuSuper: 0,
    cpuStun: 0,
    cpuScore: 0,
    cpuName: '紅絨熊仔',
    cpuHeight: 'high' as Height,
    timeLeft: ROUND_TIME,
    round: 1,
  });

  const keysPressed = useRef<Set<string>>(new Set());
  const gameStateRef = useRef(gameState);
  const countdownRef = useRef(countdown);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    countdownRef.current = countdown;
  }, [countdown]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      keysPressed.current.add(e.code);
    };
    const handleKeyUp = (e: KeyboardEvent) => keysPressed.current.delete(e.code);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();
    let lastUiSync = 0;

    const syncUi = (force = false) => {
      const now = performance.now();
      if (!force && now - lastUiSync < 80) return;
      lastUiSync = now;
      const eng = engineRef.current;
      setUiState({
        playerHealth: eng.player.health,
        playerMaxHealth: eng.player.maxHealth,
        playerStamina: eng.player.stamina,
        playerSuper: eng.player.superMeter,
        playerStun: eng.player.stunMeter,
        playerScore: eng.player.score,
        playerName: eng.player.name,
        playerHeight: eng.player.height,
        cpuHealth: eng.cpu.health,
        cpuMaxHealth: eng.cpu.maxHealth,
        cpuStamina: eng.cpu.stamina,
        cpuSuper: eng.cpu.superMeter,
        cpuStun: eng.cpu.stunMeter,
        cpuScore: eng.cpu.score,
        cpuName: eng.cpu.name,
        cpuHeight: eng.cpu.height,
        timeLeft: eng.timeLeft,
        round: eng.round,
      });
    };

    const update = (time: number) => {
      const rawDt = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      if (gameStateRef.current === 'playing' && countdownRef.current === null) {
        const eng = engineRef.current;

        if (eng.hitStop > 0) {
          eng.hitStop -= rawDt;
          // Freeze sim during hit-stop; still allow shake decay visually.
          if (eng.screenShake > 0) eng.screenShake -= rawDt * 8;
          render();
          animationFrameId = requestAnimationFrame(update);
          return;
        }

        const deltaTime = rawDt * eng.timeScale;
        eng.timeLeft -= deltaTime;
        if (eng.timeLeft <= 0) {
          eng.timeLeft = 0;
          handleRoundEnd();
        }

        if (eng.screenShake > 0) eng.screenShake -= deltaTime * 5;

        eng.player = updateBoxerLogic(eng.player, eng.cpu, keysPressed.current, deltaTime);
        eng.cpu = updateCpuLogic(
          eng.cpu,
          eng.player,
          deltaTime,
          settingsRef.current.difficulty,
          settingsRef.current.playMode === 'league'
            ? (OPPONENTS[settingsRef.current.leagueIndex]?.id ?? null)
            : null,
        );

        checkCollisions();

        eng.particles = eng.particles
          .map((p) => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vy: p.vy + 0.2,
            life: p.life - 0.02,
          }))
          .filter((p) => p.life > 0);

        eng.floatTexts = eng.floatTexts
          .map((t) => ({ ...t, y: t.y - 0.6, life: t.life - 0.02 }))
          .filter((t) => t.life > 0);

        syncUi();
      }

      render();
      animationFrameId = requestAnimationFrame(update);
    };

    animationFrameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  useEffect(() => {
    render();
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [gameState]);

  useEffect(() => {
    if (gameState === 'game_over' && prevGameStateRef.current !== 'game_over') {
      if (winner === 'player') {
        playWin();
        haptic('win');
      } else if (winner === 'cpu') {
        playLose();
        haptic('error');
      }

      if (winner === 'player' || winner === 'cpu' || winner === 'draw') {
        const outcome: FightOutcome =
          winner === 'player' ? 'win' : winner === 'cpu' ? 'loss' : 'draw';
        setCareerStats((prev) => {
          const next = recordResult(prev, outcome, difficulty);
          saveStats(next);
          return next;
        });

        if (settingsRef.current.playMode === 'league') {
          const idx = settingsRef.current.leagueIndex;
          setLeague((prev) => {
            if (winner === 'player') {
              const { progress } = applyLeagueWin(prev, idx, engineRef.current.player.score);
              saveLeague(progress);
              return progress;
            }
            const progress = applyLeagueLoss(prev, idx);
            saveLeague(progress);
            return progress;
          });
        }
      }
    }
    prevGameStateRef.current = gameState;
  }, [gameState, winner, difficulty]);

  const handleRoundEnd = () => {
    if (
      engineRef.current.round >= 3
      || engineRef.current.player.health <= 0
      || engineRef.current.cpu.health <= 0
      || isStunKo(engineRef.current.player.stunMeter)
      || isStunKo(engineRef.current.cpu.stunMeter)
    ) {
      setGameState('game_over');
      determineWinner();
    } else {
      setGameState('round_end');
    }
  };

  const determineWinner = () => {
    const { player, cpu, koReason } = engineRef.current;
    if (player.health <= 0 || isStunKo(player.stunMeter)) {
      setWinner('cpu');
      setWinRoute(isStunKo(player.stunMeter) && player.health > 0 ? 'stun' : 'health');
    } else if (cpu.health <= 0 || isStunKo(cpu.stunMeter)) {
      setWinner('player');
      setWinRoute(
        koReason === 'stun' || (isStunKo(cpu.stunMeter) && cpu.health > 0) ? 'stun' : 'health',
      );
    } else if (player.score > cpu.score) {
      setWinner('player');
      setWinRoute('decision');
    } else if (cpu.score > player.score) {
      setWinner('cpu');
      setWinRoute('decision');
    } else {
      setWinner('draw');
      setWinRoute(null);
    }
  };

  const startFight = (mode: PlayMode, oppIndex?: number) => {
    setPlayMode(mode);
    setWinRoute(null);
    const idx = oppIndex ?? leagueIndex;
    if (mode === 'league') setLeagueIndex(idx);

    let cpu: Boxer;
    let cpuVisual: CharacterId;
    let tip: string;
    if (mode === 'league') {
      const opp = OPPONENTS[idx] ?? OPPONENTS[0];
      cpu = createCpuFromOpponent(opp.id);
      cpuVisual = opp.visual;
      setCpuCharId(cpuVisual);
      tip = `${opp.name}：${opp.tagline}　「${opp.catchphrases.intro}」`;
    } else {
      const prefer = cpuCharId === playerCharId ? 'bear' : cpuCharId;
      const id = prefer === playerCharId ? 'bear' : prefer;
      cpu = createBoxer('cpu', id);
      cpuVisual = id;
      setCpuCharId(id);
      tip = '記住：擋對大幅減傷，擋錯幾乎白擋。讀拳套後拉的上／下角標！';
    }

    const player = createBoxer('player', playerCharId);
    engineRef.current = {
      player,
      cpu,
      timeLeft: ROUND_TIME,
      round: 1,
      particles: [],
      screenShake: 0,
      timeScale: 1.0,
      hitStop: 0,
      isKO: false,
      parryEffect: null,
      habit: emptyHabit(),
      floatTexts: [],
      koReason: null,
    };
    // Sync HUD immediately — otherwise countdown still shows the previous bout's names/bars.
    setUiState({
      playerHealth: player.health,
      playerMaxHealth: player.maxHealth,
      playerStamina: player.stamina,
      playerSuper: player.superMeter,
      playerStun: player.stunMeter,
      playerScore: 0,
      playerName: player.name,
      playerHeight: 'high',
      cpuHealth: cpu.health,
      cpuMaxHealth: cpu.maxHealth,
      cpuStamina: cpu.stamina,
      cpuSuper: cpu.superMeter,
      cpuStun: cpu.stunMeter,
      cpuScore: 0,
      cpuName: cpu.name,
      cpuHeight: 'high',
      timeLeft: ROUND_TIME,
      round: 1,
    });
    setWinner(null);
    setFightTip(tip);
    startCountdown();
  };

  const nextRound = () => {
    const heal = (b: Boxer): Boxer => ({
      ...b,
      health: Math.min(b.health + b.maxHealth * 0.3, b.maxHealth),
      stunMeter: Math.max(0, b.stunMeter * 0.45),
      bodyFatigue: Math.max(0, b.bodyFatigue * 0.5),
      x: b.id === 'player' ? 200 : 600,
      action: Action.IDLE,
      actionTimer: 0,
      thinkTimer: 0.2,
      attack: null,
      guardHeight: null,
      feintLeft: 0,
      whooshPlayed: false,
    });
    engineRef.current.player = heal(engineRef.current.player);
    engineRef.current.cpu = heal(engineRef.current.cpu);
    engineRef.current.timeLeft = ROUND_TIME;
    engineRef.current.round += 1;
    engineRef.current.particles = [];
    engineRef.current.screenShake = 0;
    engineRef.current.timeScale = 1.0;
    engineRef.current.hitStop = 0;
    engineRef.current.isKO = false;
    engineRef.current.koReason = null;
    const { player, cpu, round, timeLeft } = engineRef.current;
    setUiState((prev) => ({
      ...prev,
      playerHealth: player.health,
      playerStamina: player.stamina,
      playerStun: player.stunMeter,
      playerName: player.name,
      cpuHealth: cpu.health,
      cpuStamina: cpu.stamina,
      cpuStun: cpu.stunMeter,
      cpuName: cpu.name,
      timeLeft,
      round,
    }));
    startCountdown();
  };

  const startCountdown = () => {
    setGameState('playing');
    setCountdown(3);
  };

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      const timer = setTimeout(() => setCountdown(null), 1000);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    if (!fightTip || gameState !== 'playing' || countdown !== null) return;
    const timer = setTimeout(() => setFightTip(null), 4200);
    return () => clearTimeout(timer);
  }, [fightTip, gameState, countdown]);

  const beginAttack = (
    boxer: Boxer,
    kind: 'jab' | 'hook' | 'signature',
    height: Height,
    isSuper = false,
    overrides?: AttackOverrides,
    announce?: string,
  ): Boxer => {
    const attack = startAttack(kind, height, isSuper, overrides);
    const action =
      kind === 'jab' ? Action.JAB : kind === 'hook' ? Action.HOOK : Action.SIGNATURE;
    if (boxer.id === 'player') {
      engineRef.current.habit = recordPlayerHeight(engineRef.current.habit, height);
    }
    playWhoosh();
    if (announce) {
      engineRef.current.floatTexts.push({
        x: boxer.x + BOXER_WIDTH / 2,
        y: boxer.y - 8,
        text: announce,
        life: 1.15,
        color: '#e879f9',
      });
    }
    return {
      ...boxer,
      action,
      actionTimer: attack.profile.windup + attack.profile.active + attack.profile.recovery,
      attack,
      height: attack.height,
      stamina: Math.max(0, boxer.stamina - attack.profile.staminaCost),
      superMeter: isSuper || kind === 'signature' ? 0 : boxer.superMeter,
      whooshPlayed: true,
      guardHeight: null,
    };
  };

  const updateBoxerLogic = (
    boxer: Boxer,
    opponent: Boxer,
    keys: Set<string>,
    dt: number,
  ): Boxer => {
    let next = { ...boxer };
    const move = MOVE_SPEED * next.speed;
    const stanceLow = lowHeld(keys);
    if (next.action === Action.IDLE || next.action === Action.BLOCK) {
      next.height = stanceLow ? 'low' : 'high';
    }

    if (next.action === Action.IDLE || next.action === Action.BLOCK) {
      const regen = effectiveStaminaRegen(next.staminaRegen, next.bodyFatigue);
      next.stamina = Math.min(next.maxStamina, next.stamina + dt * 35 * regen);
    }
    next.bodyFatigue = tickBodyFatigue(next.bodyFatigue, dt);
    next.stunMeter = tickStun(next.stunMeter, dt, false);

    if (next.attack) {
      const stepped = tickAttack(next.attack, dt);
      next.attack = stepped;
      if (!stepped) {
        next.action = Action.IDLE;
        next.actionTimer = 0;
        next.whooshPlayed = false;
      } else {
        next.actionTimer = Math.max(0.01, next.actionTimer - dt);
      }
      return next;
    }

    if (next.actionTimer > 0) {
      next.actionTimer -= dt;
      if (next.actionTimer <= 0) {
        next.action = Action.IDLE;
        next.guardHeight = null;
      }
    }

    if (next.action === Action.KO || next.action === Action.HIT || next.action === Action.STAGGER) {
      return next;
    }

    if (next.action === Action.IDLE || next.action === Action.BLOCK) {
      if (keys.has('KeyA')) next.x -= move;
      if (keys.has('KeyD')) next.x += move;
      next.x = Math.max(0, Math.min(CANVAS_WIDTH - BOXER_WIDTH, next.x));
      next.facing = next.x < opponent.x ? 1 : -1;
    }

    if (next.action === Action.IDLE) {
      const height: Height = stanceLow ? 'low' : 'high';
      // Consume discrete action keys so holding does not turbo-fire (feel + anti jab-spam).
      if (keys.has('KeyJ') && next.stamina >= 10) {
        keys.delete('KeyJ');
        next = beginAttack(next, 'jab', height);
      } else if (keys.has('KeyK') && next.stamina >= 25) {
        keys.delete('KeyK');
        next = beginAttack(next, 'hook', height);
      } else if (keys.has('KeyL') && next.superMeter >= 100) {
        keys.delete('KeyL');
        playGoal();
        const sig = getCharacter(next.characterId);
        next = beginAttack(next, 'signature', height, true, undefined, sig.signatureName);
      } else if (keys.has('KeyS')) {
        next.action = Action.BLOCK;
        next.guardHeight = height;
        next.height = height;
      } else if (keys.has('KeyW') && next.stamina >= 15) {
        keys.delete('KeyW');
        next.action = Action.DODGE;
        next.actionTimer = 0.3;
        next.stamina -= 15;
        playDodge();
      } else if (keys.has('KeyI') && next.stamina >= 10) {
        keys.delete('KeyI');
        next.action = Action.PARRY;
        next.actionTimer = 0.2;
        next.stamina -= 10;
        next.guardHeight = height;
        next.height = height;
      }
    } else if (next.action === Action.BLOCK) {
      if (!keys.has('KeyS')) {
        next.action = Action.IDLE;
        next.guardHeight = null;
      } else {
        next.guardHeight = stanceLow ? 'low' : 'high';
        next.height = next.guardHeight;
      }
    }

    return next;
  };

  const updateCpuLogic = (
    boxer: Boxer,
    opponent: Boxer,
    dt: number,
    diff: Difficulty,
    opponentId: OpponentId | null,
  ): Boxer => {
    let next = { ...boxer };
    const style = resolveStyle(diff, opponentId);

    if (next.action === Action.IDLE || next.action === Action.BLOCK) {
      const regen = effectiveStaminaRegen(next.staminaRegen, next.bodyFatigue);
      next.stamina = Math.min(next.maxStamina, next.stamina + dt * 30 * regen);
    }
    next.bodyFatigue = tickBodyFatigue(next.bodyFatigue, dt);
    next.stunMeter = tickStun(next.stunMeter, dt, false);

    // Feint: cancel jab wind-up into block mid-tell.
    if (next.feintLeft > 0 && next.attack && next.attack.phase === 'windup') {
      next.feintLeft -= dt;
      if (next.feintLeft <= 0) {
        next.attack = null;
        next.action = Action.BLOCK;
        next.actionTimer = 0.4;
        next.guardHeight = preferredCpuGuard(next, opponent);
        next.height = next.guardHeight;
        next.whooshPlayed = false;
        return next;
      }
    }

    if (next.attack) {
      const stepped = tickAttack(next.attack, dt);
      next.attack = stepped;
      if (!stepped) {
        next.action = Action.IDLE;
        next.actionTimer = 0;
        next.whooshPlayed = false;
      } else {
        next.actionTimer = Math.max(0.01, next.actionTimer - dt);
      }
      next.x = Math.max(0, Math.min(CANVAS_WIDTH - BOXER_WIDTH, next.x));
      return next;
    }

    if (next.actionTimer > 0) {
      next.actionTimer -= dt;
      if (next.actionTimer <= 0) {
        next.action = Action.IDLE;
        next.guardHeight = null;
      }
    }
    if (next.action === Action.KO || next.action === Action.HIT || next.action === Action.STAGGER) {
      return next;
    }

    const dist = Math.abs(next.x - opponent.x);
    next.facing = next.x < opponent.x ? 1 : -1;

    const oppInWindup = Boolean(opponent.attack && opponent.attack.phase === 'windup');
    const oppAttacking =
      opponent.action === Action.JAB
      || opponent.action === Action.HOOK
      || opponent.action === Action.SIGNATURE
      || oppInWindup;
    const urgent = oppAttacking && dist < 130 && next.action === Action.IDLE;

    next.thinkTimer -= dt;
    if (!urgent && next.thinkTimer > 0 && next.action !== Action.IDLE) {
      next.x = Math.max(0, Math.min(CANVAS_WIDTH - BOXER_WIDTH, next.x));
      return next;
    }
    if (!urgent && next.thinkTimer > 0 && next.action === Action.IDLE) {
      if (dist > style.preferredDist + 40) {
        next.x += (opponent.x > next.x ? 1 : -1) * MOVE_SPEED * next.speed * style.moveSpeed * 0.6;
      }
      next.x = Math.max(0, Math.min(CANVAS_WIDTH - BOXER_WIDTH, next.x));
      return next;
    }

    if (next.action === Action.IDLE || urgent) {
      const intent = decideCpuIntent({
        dist,
        stamina: next.stamina,
        superMeter: next.superMeter,
        opponentAction: oppInWindup ? 'WINDUP' : opponent.action,
        opponentHeight: opponent.attack?.height ?? opponent.height,
        opponentInWindup: oppInWindup,
        lastHitHeight: next.lastHitTaken,
        habit: engineRef.current.habit,
        difficulty: diff,
        opponentId,
      });

      if (intent.type === 'move') {
        const toward = opponent.x > next.x ? 1 : -1;
        next.x += toward * intent.dir * MOVE_SPEED * next.speed * intent.speed;
        next.thinkTimer = nextThinkDelay(style, Math.random) * 0.45;
      } else if (intent.type === 'act') {
        if (intent.clearSuper) playGoal();
        if (intent.action === 'JAB' || intent.action === 'HOOK' || intent.action === 'SIGNATURE') {
          const kind =
            intent.action === 'JAB' ? 'jab' : intent.action === 'HOOK' ? 'hook' : 'signature';
          let overrides: AttackOverrides | undefined;
          let announce: string | undefined;
          if (kind === 'signature' && opponentId) {
            const sig = getOpponent(opponentId).signature;
            overrides = {
              windup: sig.windup,
              height: sig.height,
              unblockable: sig.unblockable,
              bodyFatigue: sig.height === 'low' ? 0.28 : 0.08,
              stunBuild: sig.height === 'high' ? 40 : 8,
            };
            announce = sig.name;
          }
          next = beginAttack(
            next,
            kind,
            overrides?.height ?? intent.height,
            Boolean(intent.clearSuper) || kind === 'signature',
            overrides,
            announce,
          );
          // Longer cancel window so feints are readable, not a blink.
          if (intent.feint) next.feintLeft = 0.16 + Math.random() * 0.14;
        } else if (intent.action === 'BLOCK') {
          next.action = Action.BLOCK;
          next.actionTimer = 0.4 + Math.random() * 0.25;
          next.guardHeight = intent.height;
          next.height = intent.height;
        } else if (intent.action === 'DODGE') {
          next.action = Action.DODGE;
          next.actionTimer = 0.3;
          next.stamina = Math.max(0, next.stamina - intent.staminaCost);
          playDodge();
        } else if (intent.action === 'PARRY') {
          next.action = Action.PARRY;
          next.actionTimer = 0.2;
          next.stamina = Math.max(0, next.stamina - intent.staminaCost);
          next.guardHeight = intent.height;
          next.height = intent.height;
        }
        next.thinkTimer = nextThinkDelay(style, Math.random);
      } else {
        next.thinkTimer = nextThinkDelay(style, Math.random);
      }
    }

    next.x = Math.max(0, Math.min(CANVAS_WIDTH - BOXER_WIDTH, next.x));
    return next;
  };

  const preferredCpuGuard = (cpu: Boxer, player: Boxer): Height => {
    if (player.attack) return player.attack.height;
    return cpu.lastHitTaken ?? 'high';
  };

  const pushFloat = (x: number, y: number, text: string, color: string) => {
    engineRef.current.floatTexts.push({ x, y, text, life: 1, color });
  };

  const checkCollisions = () => {
    if (engineRef.current.isKO) return;
    const { player, cpu } = engineRef.current;

    const spawnParticles = (x: number, y: number, color: string, isSuper = false) => {
      const count = isSuper ? 20 : 8;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * (isSuper ? 15 : 8) + 2;
        engineRef.current.particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1.0 + Math.random() * 0.5,
          color,
        });
      }
    };

    const processHit = (attacker: Boxer, defender: Boxer) => {
      if (!attacker.attack || attacker.attack.phase !== 'active' || attacker.attack.resolved) {
        return null;
      }

      const reach = attacker.attack.kind === 'jab' ? 80 : 70;
      const attackerHandX = attacker.facing === 1 ? attacker.x + BOXER_WIDTH : attacker.x;
      const inRange =
        attacker.facing === 1
          ? attackerHandX + reach >= defender.x && attackerHandX <= defender.x + BOXER_WIDTH
          : attackerHandX - reach <= defender.x + BOXER_WIDTH && attackerHandX >= defender.x;

      if (!inRange) return null;

      const outcome = resolveHit({
        attack: attacker.attack,
        attackerPower: attacker.power,
        defenderGuarding: defender.action === Action.BLOCK,
        defenderGuardHeight: defender.guardHeight ?? defender.height,
        defenderDodging: defender.action === Action.DODGE,
        defenderParrying: defender.action === Action.PARRY,
        defenderParryHeight: defender.guardHeight ?? defender.height,
        defenderAttacking: Boolean(defender.attack && defender.attack.phase !== 'recovery'),
      });

      const markedAttack = { ...attacker.attack, resolved: true };
      const hitY =
        attacker.attack.height === 'high' ? defender.y + 20 : defender.y + BOXER_HEIGHT * 0.55;

      if (outcome.type === 'dodged') {
        playDodge();
        pushFloat(defender.x + BOXER_WIDTH / 2, hitY, '閃！', '#86efac');
        return {
          attackerUpdate: { attack: markedAttack },
          defenderUpdate: {},
        };
      }

      if (outcome.type === 'parry') {
        playImpact(0.35);
        haptic('success', 0.85);
        spawnParticles(attackerHandX, hitY, '#60a5fa', true);
        engineRef.current.screenShake = 0.85;
        engineRef.current.hitStop = HIT_STOP_LIGHT;
        engineRef.current.parryEffect = {
          x: defender.x + BOXER_WIDTH / 2,
          y: defender.y - 20,
          life: 1.0,
          text: '撥招！',
        };
        pushFloat(defender.x + BOXER_WIDTH / 2, hitY - 10, '撥招', '#93c5fd');
        return {
          attackerUpdate: {
            attack: null,
            action: Action.STAGGER,
            actionTimer: outcome.staggerTime,
            whooshPlayed: false,
          },
          defenderUpdate: {
            stamina: Math.min(defender.maxStamina, defender.stamina + outcome.staminaBonus),
            superMeter: Math.min(100, defender.superMeter + outcome.superBonus),
            action: Action.IDLE,
            actionTimer: 0,
            attack: null,
          },
        };
      }

      if (outcome.type === 'hit') {
        const strength = Math.min(1, outcome.damage / 18);
        if (outcome.blocked && outcome.guardCorrect) playBlock();
        else if (outcome.blocked && outcome.guardCorrect === false) playWrongBlock();
        else playImpact(outcome.isSuper ? 1 : 0.35 + strength);

        if (outcome.isSuper) haptic('impact', 1.15);
        else if (outcome.blocked) haptic('tap', 0.4);
        else haptic('impact', 0.55 + strength * 0.35);

        const newHealth = Math.max(0, defender.health - outcome.damage);
        const newStun = applyStun(defender.stunMeter, outcome.stunGain);
        const newFatigue = Math.min(0.7, defender.bodyFatigue + outcome.bodyFatigue);
        const stunKo = isStunKo(newStun);
        const dead = newHealth <= 0 || stunKo;

        if (newStun >= 70 && defender.stunMeter < 70) playStunWarn();

        spawnParticles(
          attackerHandX,
          hitY,
          outcome.isCounter ? '#f59e0b' : outcome.blocked ? '#94a3b8' : '#ffffff',
          outcome.isSuper,
        );
        engineRef.current.screenShake = outcome.isSuper ? 1.15 : outcome.blocked ? 0.25 : 0.55;
        engineRef.current.hitStop = outcome.isSuper
          ? HIT_STOP_HEAVY
          : outcome.blocked
            ? HIT_STOP_LIGHT * 0.5
            : HIT_STOP_LIGHT + strength * 0.04;

        if (outcome.blocked && outcome.guardCorrect === false) {
          pushFloat(defender.x + BOXER_WIDTH / 2, hitY, '擋錯！', '#fb923c');
        } else if (!outcome.blocked && attacker.attack.height === 'high') {
          pushFloat(defender.x + BOXER_WIDTH / 2, hitY - 8, '暈+', '#fde047');
        } else if (!outcome.blocked && attacker.attack.height === 'low') {
          pushFloat(defender.x + BOXER_WIDTH / 2, hitY, '耗氣', '#fdba74');
        }
        if (outcome.isCounter) pushFloat(defender.x + BOXER_WIDTH / 2, hitY - 24, '反擊', '#fbbf24');

        return {
          attackerUpdate: {
            attack: markedAttack,
            score: attacker.score + outcome.score,
            superMeter: Math.min(100, attacker.superMeter + (outcome.blocked ? 2 : 10)),
          },
          defenderUpdate: {
            health: newHealth,
            stunMeter: newStun,
            bodyFatigue: newFatigue,
            lastHitTaken: attacker.attack.height,
            action: dead ? Action.KO : outcome.blocked ? defender.action : Action.HIT,
            actionTimer: dead ? 2.0 : 0.22,
            attack: dead || !outcome.blocked ? null : defender.attack,
            superMeter: Math.min(100, defender.superMeter + outcome.damage * 0.5),
          },
          koReason: stunKo && newHealth > 0 ? ('stun' as const) : ('health' as const),
        };
      }

      return {
        attackerUpdate: { attack: markedAttack },
        defenderUpdate: {},
      };
    };

    const playerHit = processHit(player, cpu);
    if (playerHit) {
      engineRef.current.cpu = { ...cpu, ...playerHit.defenderUpdate };
      engineRef.current.player = { ...player, ...playerHit.attackerUpdate };
      if (
        (engineRef.current.cpu.health <= 0 || isStunKo(engineRef.current.cpu.stunMeter))
        && !engineRef.current.isKO
      ) {
        engineRef.current.koReason = playerHit.koReason ?? 'health';
        triggerKO();
      }
    }

    const cpuHit = processHit(engineRef.current.cpu, engineRef.current.player);
    if (cpuHit) {
      engineRef.current.player = { ...engineRef.current.player, ...cpuHit.defenderUpdate };
      engineRef.current.cpu = { ...engineRef.current.cpu, ...cpuHit.attackerUpdate };
      if (
        (engineRef.current.player.health <= 0 || isStunKo(engineRef.current.player.stunMeter))
        && !engineRef.current.isKO
      ) {
        engineRef.current.koReason = cpuHit.koReason ?? 'health';
        triggerKO();
      }
    }
  };

  const triggerKO = () => {
    engineRef.current.isKO = true;
    engineRef.current.timeScale = 0.28;
    engineRef.current.screenShake = 2.0;
    engineRef.current.hitStop = HIT_STOP_KO;
    playImpact(1);
    haptic('impact', 1.25);

    const { player, cpu } = engineRef.current;
    const koVictim =
      player.health <= 0 || isStunKo(player.stunMeter) ? player : cpu;
    for (let i = 0; i < 50; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 20 + 5;
      engineRef.current.particles.push({
        x: koVictim.x + BOXER_WIDTH / 2,
        y: koVictim.y + BOXER_HEIGHT / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 2.0,
        color: '#ef4444',
      });
    }

    setTimeout(() => {
      handleRoundEnd();
    }, 3500);
  };

  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.save();
    if (engineRef.current.screenShake > 0) {
      const amt = engineRef.current.screenShake * 12;
      ctx.translate(Math.random() * amt - amt / 2, Math.random() * amt - amt / 2);
    }

    const skyImg = ringSkyImage();
    if (skyImg.complete && skyImg.naturalWidth > 0) {
      ctx.drawImage(skyImg, 0, 0, CANVAS_WIDTH, GROUND_Y);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, GROUND_Y);
    } else {
      ctx.fillStyle = 'rgba(59, 130, 246, 0.06)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, GROUND_Y);
    }

    const floorImg = ringFloorImage();
    if (floorImg.complete && floorImg.naturalWidth > 0) {
      ctx.drawImage(floorImg, 0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
      ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y);
    } else {
      const floor = ctx.createLinearGradient(0, GROUND_Y, 0, CANVAS_HEIGHT);
      floor.addColorStop(0, '#334155');
      floor.addColorStop(1, '#1e293b');
      ctx.fillStyle = floor;
      ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y);
    }

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 4;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y - 40 - i * 40);
      ctx.lineTo(CANVAS_WIDTH, GROUND_Y - 40 - i * 40);
      ctx.stroke();
    }

    const paint = (b: Boxer) => {
      drawToyBoxer(ctx, {
        x: b.x,
        y: b.y,
        facing: b.facing,
        action: b.action,
        actionTimer: b.actionTimer,
        character: getCharacter(b.characterId),
        height: b.attack?.height ?? b.height,
        attack: b.attack,
        stunRatio: b.stunMeter / 100,
      });
    };

    paint(engineRef.current.player);
    paint(engineRef.current.cpu);

    if (engineRef.current.parryEffect) {
      const p = engineRef.current.parryEffect;
      ctx.save();
      ctx.strokeStyle = `rgba(96, 165, 250, ${p.life})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y + 50, (1 - p.life) * 120, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = 'black 40px "Anton", sans-serif';
      ctx.fillStyle = `rgba(255, 255, 255, ${p.life})`;
      ctx.textAlign = 'center';
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#60a5fa';
      const s = 1 + (1 - p.life) * 0.5;
      ctx.scale(s, s);
      ctx.fillText(p.text, p.x / s, (p.y - (1.0 - p.life) * 80) / s);
      ctx.restore();
      p.life -= 0.03;
      if (p.life <= 0) engineRef.current.parryEffect = null;
    }

    engineRef.current.particles.forEach((p) => {
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    engineRef.current.floatTexts.forEach((t) => {
      ctx.save();
      ctx.globalAlpha = Math.min(1, t.life);
      ctx.fillStyle = t.color;
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(t.text, t.x, t.y);
      ctx.restore();
    });

    ctx.restore();

    if (engineRef.current.isKO) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 100px "Anton", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#000000';
      const label = engineRef.current.koReason === 'stun' ? '頭擊ＫＯ！' : 'K.O.!';
      ctx.fillText(label, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      ctx.restore();
    }
  };

  const playerHpPct = (uiState.playerHealth / Math.max(1, uiState.playerMaxHealth)) * 100;
  const cpuHpPct = (uiState.cpuHealth / Math.max(1, uiState.cpuMaxHealth)) * 100;

  const CharCard = ({
    c,
    selected,
    onSelect,
  }: {
    c: CharacterDef;
    selected: boolean;
    onSelect: () => void;
  }) => (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'rounded-2xl border p-3 text-left transition-all',
        selected
          ? 'border-blue-400 bg-blue-500/20 shadow-[0_0_0_1px_rgba(96,165,250,0.5)]'
          : 'border-white/10 bg-neutral-900/80 hover:border-white/25',
      )}
    >
      <div
        className="mb-2 h-20 rounded-xl overflow-hidden bg-neutral-950"
        style={{ background: `linear-gradient(180deg, ${c.accent}33, #0a0a0a)` }}
      >
        <img
          src={characterPortraitUrl(c.id)}
          alt=""
          className="w-full h-full object-cover object-top"
          draggable={false}
        />
      </div>
      <div className="text-sm font-black tracking-tight">{c.name}</div>
      <div className="text-[11px] text-neutral-400 mt-0.5">{c.tagline}</div>
      <div className="text-[10px] text-fuchsia-300/90 mt-1">{c.signatureName}</div>
    </button>
  );

  const winRouteLabel =
    winRoute === 'stun'
      ? '頭擊ＫＯ'
      : winRoute === 'health'
        ? '體力擊倒'
        : winRoute === 'decision'
          ? '判定勝'
          : null;

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans selection:bg-blue-500/30 overflow-x-hidden">
      <BackToMenu />
      {showFirstRun && <FirstRunGuide onClose={() => setShowFirstRun(false)} />}
      <header className="max-w-5xl mx-auto p-4 sm:p-6 flex flex-col gap-4 md:flex-row md:justify-between md:items-center border-b border-white/10">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
          <img
            src={characterPortraitUrl(playerCharId)}
            alt=""
            className="rounded-xl shadow-lg shrink-0 w-11 h-11 object-cover border border-white/10"
            draggable={false}
          />
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            <h2 className="text-sm font-bold uppercase tracking-widest text-blue-400 truncate">
              {uiState.playerName}
              <span className="ml-2 text-[10px] text-neutral-400 normal-case tracking-normal">
                {uiState.playerHeight === 'high' ? '上段' : '下段'}
              </span>
            </h2>
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-full max-w-48 h-3 bg-neutral-800 rounded-full overflow-hidden border border-white/5">
                <motion.div className="h-full bg-emerald-500" animate={{ width: `${playerHpPct}%` }} />
              </div>
              <span className="text-xs font-mono w-8 shrink-0">{Math.ceil(uiState.playerHealth)}</span>
            </div>
            <div className="flex gap-2 max-w-48" aria-label="耐力、暈眩、必殺">
              <div className="flex-1 min-w-0">
                <p className="text-[9px] leading-none text-amber-200/80 mb-0.5">耐力</p>
                <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden" title="耐力">
                  <motion.div className="h-full bg-amber-400" animate={{ width: `${uiState.playerStamina}%` }} />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] leading-none text-yellow-200/80 mb-0.5">暈眩</p>
                <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden" title="暈眩">
                  <motion.div
                    className="h-full bg-yellow-400"
                    animate={{ width: `${uiState.playerStun}%` }}
                  />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] leading-none text-fuchsia-200/80 mb-0.5">必殺</p>
                <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden" title="必殺">
                  <motion.div
                    className={`h-full ${uiState.playerSuper >= 100 ? 'bg-fuchsia-400 shadow-[0_0_8px_rgba(232,121,249,0.8)]' : 'bg-fuchsia-800'}`}
                    animate={{ width: `${uiState.playerSuper}%` }}
                  />
                </div>
              </div>
            </div>
            <p className="text-lg sm:text-xl font-black mt-1 tracking-tighter italic">
              分數：{uiState.playerScore}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center shrink-0 self-center">
          <div className="flex items-center gap-2 text-amber-400 mb-1">
            <Trophy className="w-4 h-4" />
            <span className="text-xs font-bold tracking-widest">第 {uiState.round} 回合</span>
          </div>
          <div className="text-[10px] text-neutral-500 mb-1 uppercase tracking-widest">
            {playMode === 'league' ? leagueTitle() : DIFFICULTY_LABELS[difficulty]}
          </div>
          <div className="bg-neutral-900 px-4 sm:px-6 py-2 rounded-2xl border border-white/10 flex items-center gap-3 shadow-inner">
            <Timer className="w-5 h-5 text-neutral-500" />
            <span className="text-2xl sm:text-3xl font-black font-mono tabular-nums">
              {Math.floor(uiState.timeLeft / 60)}:
              {String(Math.min(59, Math.max(0, Math.floor(uiState.timeLeft % 60)))).padStart(2, '0')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4 text-right min-w-0 flex-1 md:justify-end">
          <div className="flex flex-col gap-1 text-right items-end min-w-0 flex-1">
            <h2 className="text-sm font-bold uppercase tracking-widest text-red-400 truncate max-w-full">
              {uiState.cpuName}
              <span className="ml-2 text-[10px] text-neutral-400 normal-case tracking-normal">
                {uiState.cpuHeight === 'high' ? '上段' : '下段'}
              </span>
            </h2>
            <div className="flex items-center gap-2 flex-row-reverse min-w-0 w-full justify-start">
              <div className="w-full max-w-48 h-3 bg-neutral-800 rounded-full overflow-hidden border border-white/5">
                <motion.div className="h-full bg-rose-500" animate={{ width: `${cpuHpPct}%` }} />
              </div>
              <span className="text-xs font-mono w-8 shrink-0">{Math.ceil(uiState.cpuHealth)}</span>
            </div>
            <div className="flex gap-2 flex-row-reverse max-w-48 ml-auto" aria-label="耐力、暈眩、必殺">
              <div className="flex-1 min-w-0">
                <p className="text-[9px] leading-none text-amber-200/80 mb-0.5 text-right">耐力</p>
                <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                  <motion.div className="h-full bg-amber-400" animate={{ width: `${uiState.cpuStamina}%` }} />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] leading-none text-yellow-200/80 mb-0.5 text-right">暈眩</p>
                <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                  <motion.div className="h-full bg-yellow-400" animate={{ width: `${uiState.cpuStun}%` }} />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] leading-none text-fuchsia-200/80 mb-0.5 text-right">必殺</p>
                <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full ${uiState.cpuSuper >= 100 ? 'bg-fuchsia-400 shadow-[0_0_8px_rgba(232,121,249,0.8)]' : 'bg-fuchsia-800'}`}
                    animate={{ width: `${uiState.cpuSuper}%` }}
                  />
                </div>
              </div>
            </div>
            <p className="text-lg sm:text-xl font-black mt-1 tracking-tighter italic">
              分數：{uiState.cpuScore}
            </p>
          </div>
          <img
            src={characterPortraitUrl(cpuCharId)}
            alt=""
            className="rounded-xl shadow-lg shrink-0 w-11 h-11 object-cover border border-white/10"
            draggable={false}
          />
        </div>
      </header>

      <main className="max-w-5xl mx-auto mt-4 sm:mt-8 px-2 sm:px-0 relative w-full">
        <div className="relative bg-neutral-900 rounded-3xl overflow-hidden border border-white/10 shadow-2xl w-full">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="w-full max-w-full h-auto block"
          />

          <AnimatePresence>
            {countdown !== null && (
              <motion.div
                key="countdown"
                initial={{ scale: 2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <span className="text-9xl font-black italic text-amber-500 drop-shadow-[0_0_20px_rgba(245,158,11,0.5)]">
                  {countdown > 0 ? countdown : 'FIGHT!'}
                </span>
              </motion.div>
            )}

            {fightTip && gameState === 'playing' && countdown === null && (
              <motion.div
                key="fight-tip"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute top-3 left-3 right-3 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:max-w-lg pointer-events-none z-10"
              >
                <p className="rounded-xl border border-amber-400/40 bg-black/75 px-3 py-2 text-center text-xs sm:text-sm text-amber-100 shadow-lg">
                  {fightTip}
                </p>
              </motion.div>
            )}

            {gameState === 'menu' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-start sm:justify-center p-4 sm:p-8 overflow-y-auto"
              >
                <h1 className="text-4xl sm:text-6xl font-black italic tracking-tighter mb-2 uppercase text-center">
                  Toy <span className="text-blue-500">Boxing</span>
                </h1>
                <p className="text-neutral-400 max-w-lg mb-3 text-center text-sm">
                  上／下段猜拳・讀預備動作・打腹耗氣或打臉ＫＯ。↓／Ｃ 下段，Ｓ 格擋，Ｊ／Ｋ 出拳，Ｗ 閃，Ｉ 撥招，Ｌ 招牌拳
                </p>

                <div className="flex gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() => setMenuTab('league')}
                    className={cn(
                      'px-4 py-2 rounded-xl text-sm font-black tracking-wider border min-h-[44px]',
                      menuTab === 'league'
                        ? 'bg-amber-500 text-black border-amber-300'
                        : 'bg-neutral-900 border-white/10 text-neutral-300',
                    )}
                  >
                    聯賽階梯
                  </button>
                  <button
                    type="button"
                    onClick={() => setMenuTab('free')}
                    className={cn(
                      'px-4 py-2 rounded-xl text-sm font-black tracking-wider border min-h-[44px]',
                      menuTab === 'free'
                        ? 'bg-blue-600 text-white border-blue-400'
                        : 'bg-neutral-900 border-white/10 text-neutral-300',
                    )}
                  >
                    自由對戰
                  </button>
                </div>

                <div className="w-full max-w-2xl mb-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">
                    你的玩具
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {CHARACTERS.map((c) => (
                      <CharCard
                        key={c.id}
                        c={c}
                        selected={playerCharId === c.id}
                        onSelect={() => {
                          setPlayerCharId(c.id);
                          if (cpuCharId === c.id) setCpuCharId(c.id === 'bot' ? 'bear' : 'bot');
                        }}
                      />
                    ))}
                  </div>
                </div>

                {menuTab === 'league' ? (
                  <div className="w-full max-w-2xl mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-500">
                        {leagueTitle()}
                      </h3>
                      <p className="text-xs text-amber-300/90">
                        進度 {league.clearedCount}/{OPPONENTS.length}
                        {isLeagueComplete(league) ? ' · 全數通關！' : ''}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {OPPONENTS.map((opp, index) => {
                        const unlocked = isOpponentUnlocked(index, league.clearedCount);
                        const cleared = Boolean(league.cleared[opp.id]);
                        const selected = leagueIndex === index;
                        return (
                          <button
                            key={opp.id}
                            type="button"
                            disabled={!unlocked}
                            onClick={() => unlocked && setLeagueIndex(index)}
                            className={cn(
                              'rounded-2xl border p-3 text-left transition-all min-h-[44px]',
                              !unlocked && 'opacity-45 cursor-not-allowed',
                              selected && unlocked
                                ? 'border-amber-400 bg-amber-500/15'
                                : 'border-white/10 bg-neutral-900/80',
                            )}
                          >
                            <div className="flex gap-3 items-start">
                              <img
                                src={characterPortraitUrl(opp.visual)}
                                alt=""
                                className="w-12 h-12 rounded-lg object-cover border border-white/10"
                                draggable={false}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-black">
                                    {unlocked ? opp.name : '？？？'}
                                  </span>
                                  {cleared && (
                                    <span className="text-[10px] text-emerald-400 font-bold">已擊敗</span>
                                  )}
                                </div>
                                <p className="text-[11px] text-neutral-400 mt-0.5">
                                  {unlocked ? opp.tagline : '打贏前一位解鎖'}
                                </p>
                                {unlocked && (
                                  <p className="text-[10px] text-fuchsia-300/90 mt-1">
                                    招牌：{opp.signature.name} · {opp.signature.blurb}
                                  </p>
                                )}
                                {unlocked && (
                                  <p className="text-[10px] text-neutral-500 mt-0.5 italic">
                                    「{opp.catchphrases.taunt}」
                                  </p>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-3 text-center text-sm text-amber-200/90">
                      vs {activeOpponent.name} — {activeOpponent.catchphrases.intro}
                    </p>
                    <div className="flex justify-center mt-3">
                      <button
                        type="button"
                        onClick={() => startFight('league', leagueIndex)}
                        className="group relative px-8 py-4 bg-amber-500 text-black rounded-2xl font-black uppercase tracking-widest hover:bg-amber-400 transition-all active:scale-95 min-h-[44px]"
                      >
                        <span className="flex items-center gap-2">
                          <Play className="w-5 h-5 fill-current" />
                          挑戰聯賽
                        </span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-full max-w-2xl mb-4">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">
                        對手造型
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {CHARACTERS.map((c) => (
                          <CharCard
                            key={`cpu-${c.id}`}
                            c={c}
                            selected={cpuCharId === c.id}
                            onSelect={() => {
                              if (c.id === playerCharId) return;
                              setCpuCharId(c.id);
                            }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="w-full max-w-md mb-4">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2 text-center">
                        難度
                      </h3>
                      <div className="flex gap-2 justify-center">
                        {(['easy', 'normal', 'hard'] as Difficulty[]).map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => chooseDifficulty(d)}
                            className={cn(
                              'px-4 py-2 rounded-xl text-sm font-black uppercase tracking-wider border transition-all min-h-[44px]',
                              difficulty === d
                                ? 'bg-amber-500 text-black border-amber-300'
                                : 'bg-neutral-900 border-white/10 text-neutral-300 hover:border-white/30',
                            )}
                          >
                            {DIFFICULTY_LABELS[d]}
                          </button>
                        ))}
                      </div>
                      <p className="mt-2 text-center text-sm text-amber-300/90 font-medium">
                        {DIFFICULTY_BLURBS[difficulty]}
                      </p>
                      <p className="text-center text-xs text-neutral-500 mt-1">
                        連勝 {careerMode.winStreak} · 最佳 {careerMode.bestWinStreak} · 勝{' '}
                        {careerMode.wins} · 負 {careerMode.losses}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => startFight('free')}
                      className="group relative px-8 py-4 bg-blue-600 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-500 transition-all active:scale-95 min-h-[44px]"
                    >
                      <span className="flex items-center gap-2">
                        <Play className="w-5 h-5 fill-current" />
                        開始對戰
                      </span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => setShowFirstRun(true)}
                  className="mt-3 px-4 py-3 rounded-2xl text-sm font-bold tracking-wider border border-white/15 text-neutral-300 hover:border-blue-400/50 hover:text-blue-200 transition-all min-h-[44px]"
                >
                  操作教學
                </button>
              </motion.div>
            )}

            {gameState === 'round_end' && (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center"
              >
                <h2 className="text-5xl font-black italic mb-2">第 {uiState.round} 回合結束</h2>
                <p className="text-neutral-300 mb-8">準備下一回合…</p>
                <button
                  type="button"
                  onClick={nextRound}
                  className="px-8 py-4 bg-amber-500 text-black rounded-2xl font-black tracking-widest hover:bg-amber-400 transition-all min-h-[44px]"
                >
                  下一回合
                </button>
              </motion.div>
            )}

            {gameState === 'game_over' && (
              <ResultOverlay
                title={
                  winner === 'player'
                    ? `${uiState.playerName} 獲勝！`
                    : winner === 'cpu'
                      ? `${uiState.cpuName} 獲勝`
                      : '平手'
                }
                variant={winner === 'player' ? 'win' : winner === 'cpu' ? 'lose' : 'neutral'}
                stats={[
                  { label: uiState.playerName, value: uiState.playerScore },
                  { label: uiState.cpuName, value: uiState.cpuScore },
                  ...(winRouteLabel ? [{ label: '勝利方式', value: winRouteLabel }] : []),
                  {
                    label: playMode === 'league' ? '聯賽進度' : '難度',
                    value:
                      playMode === 'league'
                        ? `${league.clearedCount}/${OPPONENTS.length}`
                        : DIFFICULTY_LABELS[difficulty],
                  },
                  { label: '連勝', value: careerMode.winStreak },
                  { label: '最佳連勝', value: careerMode.bestWinStreak },
                ]}
                onPrimary={() => {
                  setFightTip(null);
                  setGameState('menu');
                }}
                primaryLabel="再選一局"
              />
            )}
          </AnimatePresence>
        </div>

        {gameState === 'playing' && (
          <div className={`${touchControlsWrapClass} mt-4`}>
            <div className="flex gap-2 justify-center w-full">
              <TouchButton
                label="←"
                ariaLabel="向左"
                onPress={() => keysPressed.current.add('KeyA')}
                onRelease={() => keysPressed.current.delete('KeyA')}
              />
              <TouchButton
                label="→"
                ariaLabel="向右"
                onPress={() => keysPressed.current.add('KeyD')}
                onRelease={() => keysPressed.current.delete('KeyD')}
              />
              <TouchButton
                label="下段"
                ariaLabel="下段（按住）"
                onPress={() => keysPressed.current.add('ArrowDown')}
                onRelease={() => keysPressed.current.delete('ArrowDown')}
                accent
              />
            </div>
            <div className="flex flex-wrap gap-2 justify-center w-full">
              <TouchButton label="刺拳" ariaLabel="刺拳" onPress={() => keysPressed.current.add('KeyJ')} onRelease={() => keysPressed.current.delete('KeyJ')} />
              <TouchButton label="勾拳" ariaLabel="勾拳" onPress={() => keysPressed.current.add('KeyK')} onRelease={() => keysPressed.current.delete('KeyK')} />
              <TouchButton label="格擋" ariaLabel="格擋（依段）" onPress={() => keysPressed.current.add('KeyS')} onRelease={() => keysPressed.current.delete('KeyS')} />
              <TouchButton label="閃避" ariaLabel="閃避" onPress={() => keysPressed.current.add('KeyW')} onRelease={() => keysPressed.current.delete('KeyW')} />
              <TouchButton label="撥招" ariaLabel="撥招（須對段）" onPress={() => keysPressed.current.add('KeyI')} onRelease={() => keysPressed.current.delete('KeyI')} />
              <TouchButton label="招牌" ariaLabel="招牌拳" onPress={() => keysPressed.current.add('KeyL')} onRelease={() => keysPressed.current.delete('KeyL')} accent />
            </div>
          </div>
        )}

        <div
          className={cn(
            'mt-8 grid grid-cols-1 md:grid-cols-3 gap-6',
            // On phones during a bout, touch buttons already teach — hide the tall kbd panels.
            gameState === 'playing' && 'hidden sm:grid',
          )}
        >
          <div className="bg-neutral-900/50 p-6 rounded-2xl border border-white/5">
            <h3 className="text-xs font-bold tracking-widest text-neutral-500 mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4" /> 移動・段位
            </h3>
            <div className="flex gap-2 flex-wrap">
              <kbd className="px-3 py-2 bg-neutral-800 rounded-lg border border-white/10 font-mono text-sm">A</kbd>
              <kbd className="px-3 py-2 bg-neutral-800 rounded-lg border border-white/10 font-mono text-sm">D</kbd>
              <kbd className="px-3 py-2 bg-orange-900/40 border-orange-500/40 rounded-lg border font-mono text-sm text-orange-300">↓/C</kbd>
              <span className="text-sm text-neutral-400 ml-2 self-center">左右・下段</span>
            </div>
          </div>
          <div className="bg-neutral-900/50 p-6 rounded-2xl border border-white/5">
            <h3 className="text-xs font-bold tracking-widest text-neutral-500 mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4" /> 防禦
            </h3>
            <div className="flex gap-2 flex-wrap">
              <kbd className="px-3 py-2 bg-neutral-800 rounded-lg border border-white/10 font-mono text-sm">S</kbd>
              <kbd className="px-3 py-2 bg-neutral-800 rounded-lg border border-white/10 font-mono text-sm">W</kbd>
              <kbd className="px-3 py-2 bg-blue-900/50 border-blue-500/50 rounded-lg border font-mono text-sm text-blue-400">I</kbd>
              <span className="text-sm text-neutral-400 ml-2 self-center">格擋（依段）／閃／撥</span>
            </div>
          </div>
          <div className="bg-neutral-900/50 p-6 rounded-2xl border border-white/5">
            <h3 className="text-xs font-bold tracking-widest text-neutral-500 mb-4 flex items-center gap-2">
              <Heart className="w-4 h-4" /> 攻擊路線
            </h3>
            <div className="flex flex-col gap-2 text-sm text-neutral-300">
              <p>Ｊ／Ｋ：刺拳／勾拳（搭配 ↓ 打腹）</p>
              <p>打臉累積暈眩 → 頭擊ＫＯ；打腹削耐力回復</p>
              <p>
                <kbd className="px-2 py-1 bg-neutral-800 rounded border border-white/10 font-mono text-xs">L</kbd>
                {' '}招牌拳：長預備、無法格擋、可閃避
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="max-w-5xl mx-auto mt-12 pb-12 text-center text-neutral-600 text-xs tracking-[0.2em]">
        玩具拳擊 · 聯賽階梯・上／下段心機戰
      </footer>
    </div>
  );
}
