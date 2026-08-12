import React, { useState, useEffect, useRef } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { playCapture, playGoal, playLose, playWin } from '@clubhouse/shared/synthAudio';
import { TouchButton, touchControlsWrapClass } from '@clubhouse/shared/TouchButton';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Timer, Heart, Shield, Zap, Play } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  CHARACTERS,
  characterPortraitUrl,
  getCharacter,
  pickCpuOpponent,
  preloadFighterBodies,
  ringFloorImage,
  ringSkyImage,
  type CharacterDef,
  type CharacterId,
} from './characters';
import {
  DIFFICULTY,
  DIFFICULTY_LABELS,
  decideCpuIntent,
  nextThinkDelay,
  type Difficulty,
} from './cpuAi';
import { BOXER_HEIGHT, BOXER_WIDTH, drawToyBoxer } from './drawBoxer';

preloadFighterBodies();
import {
  loadStats,
  recordResult,
  saveStats,
  withDifficulty,
  type CareerStats,
  type FightOutcome,
} from './stats';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 400;
const GROUND_Y = 350;
const MOVE_SPEED = 4;
const ROUND_TIME = 60;

enum Action {
  IDLE = 'IDLE',
  JAB = 'JAB',
  HOOK = 'HOOK',
  BLOCK = 'BLOCK',
  DODGE = 'DODGE',
  HIT = 'HIT',
  KO = 'KO',
  PARRY = 'PARRY',
  STAGGER = 'STAGGER',
}

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
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

const createBoxer = (id: 'player' | 'cpu', characterId: CharacterId): Boxer => {
  const c = getCharacter(characterId);
  return {
    id,
    x: id === 'player' ? 200 : 600,
    y: GROUND_Y - BOXER_HEIGHT,
    health: c.health,
    maxHealth: c.health,
    stamina: 100,
    maxStamina: 100,
    superMeter: 0,
    maxSuperMeter: 100,
    score: 0,
    action: Action.IDLE,
    actionTimer: 0,
    facing: id === 'player' ? 1 : -1,
    characterId,
    power: c.power,
    speed: c.speed,
    staminaRegen: c.staminaRegen,
    name: c.name,
    thinkTimer: 0.15,
  };
};

export default function ToyBoxing() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'round_end' | 'game_over'>('menu');
  const [winner, setWinner] = useState<string | null>(null);
  const prevGameStateRef = useRef(gameState);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [playerCharId, setPlayerCharId] = useState<CharacterId>('bot');
  const [cpuCharId, setCpuCharId] = useState<CharacterId>('bear');
  const [careerStats, setCareerStats] = useState<CareerStats>(() => loadStats());
  const [difficulty, setDifficulty] = useState<Difficulty>(
    () => loadStats().lastDifficulty,
  );

  const settingsRef = useRef({ difficulty, playerCharId, cpuCharId });
  settingsRef.current = { difficulty, playerCharId, cpuCharId };

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
    isKO: false,
    parryEffect: null as { x: number; y: number; life: number } | null,
  });

  const [uiState, setUiState] = useState({
    playerHealth: 100,
    playerMaxHealth: 100,
    playerStamina: 100,
    playerSuper: 0,
    playerScore: 0,
    playerName: '藍拳機器人',
    cpuHealth: 100,
    cpuMaxHealth: 100,
    cpuStamina: 100,
    cpuSuper: 0,
    cpuScore: 0,
    cpuName: '紅絨熊仔',
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
    const handleKeyDown = (e: KeyboardEvent) => keysPressed.current.add(e.code);
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
      if (!force && now - lastUiSync < 100) return;
      lastUiSync = now;
      const eng = engineRef.current;
      setUiState({
        playerHealth: eng.player.health,
        playerMaxHealth: eng.player.maxHealth,
        playerStamina: eng.player.stamina,
        playerSuper: eng.player.superMeter,
        playerScore: eng.player.score,
        playerName: eng.player.name,
        cpuHealth: eng.cpu.health,
        cpuMaxHealth: eng.cpu.maxHealth,
        cpuStamina: eng.cpu.stamina,
        cpuSuper: eng.cpu.superMeter,
        cpuScore: eng.cpu.score,
        cpuName: eng.cpu.name,
        timeLeft: eng.timeLeft,
        round: eng.round,
      });
    };

    const update = (time: number) => {
      const deltaTime = Math.min((time - lastTime) / 1000, 0.1) * engineRef.current.timeScale;
      lastTime = time;

      if (gameStateRef.current === 'playing' && countdownRef.current === null) {
        engineRef.current.timeLeft -= deltaTime;
        if (engineRef.current.timeLeft <= 0) {
          engineRef.current.timeLeft = 0;
          handleRoundEnd();
        }

        if (engineRef.current.screenShake > 0) {
          engineRef.current.screenShake -= deltaTime * 5;
        }

        const { player, cpu } = engineRef.current;
        engineRef.current.player = updateBoxerLogic(player, cpu, keysPressed.current, deltaTime);
        engineRef.current.cpu = updateCpuLogic(
          engineRef.current.cpu,
          engineRef.current.player,
          deltaTime,
          settingsRef.current.difficulty,
        );

        checkCollisions();

        engineRef.current.particles = engineRef.current.particles
          .map((p) => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vy: p.vy + 0.2,
            life: p.life - 0.02,
          }))
          .filter((p) => p.life > 0);

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
    if (gameState === 'game_over' && prevGameStateRef.current !== 'game_over') {
      if (winner === 'player') playWin();
      else if (winner === 'cpu') playLose();

      // Always vs CPU in this build — gate here if 2P is added later.
      if (winner === 'player' || winner === 'cpu' || winner === 'draw') {
        const outcome: FightOutcome =
          winner === 'player' ? 'win' : winner === 'cpu' ? 'loss' : 'draw';
        setCareerStats((prev) => {
          const next = recordResult(prev, outcome);
          saveStats(next);
          return next;
        });
      }
    }
    prevGameStateRef.current = gameState;
  }, [gameState, winner]);

  const handleRoundEnd = () => {
    if (
      engineRef.current.round >= 3
      || engineRef.current.player.health <= 0
      || engineRef.current.cpu.health <= 0
    ) {
      setGameState('game_over');
      determineWinner();
    } else {
      setGameState('round_end');
    }
  };

  const determineWinner = () => {
    const { player, cpu } = engineRef.current;
    if (player.health <= 0) setWinner('cpu');
    else if (cpu.health <= 0) setWinner('player');
    else if (player.score > cpu.score) setWinner('player');
    else if (cpu.score > player.score) setWinner('cpu');
    else setWinner('draw');
  };

  const startNewGame = () => {
    const cpuId = pickCpuOpponent(playerCharId, cpuCharId);
    setCpuCharId(cpuId);
    engineRef.current = {
      player: createBoxer('player', playerCharId),
      cpu: createBoxer('cpu', cpuId),
      timeLeft: ROUND_TIME,
      round: 1,
      particles: [],
      screenShake: 0,
      timeScale: 1.0,
      isKO: false,
      parryEffect: null,
    };
    setWinner(null);
    startCountdown();
  };

  const nextRound = () => {
    const heal = (b: Boxer): Boxer => ({
      ...b,
      health: Math.min(b.health + b.maxHealth * 0.3, b.maxHealth),
      x: b.id === 'player' ? 200 : 600,
      action: Action.IDLE,
      actionTimer: 0,
      thinkTimer: 0.2,
    });
    engineRef.current.player = heal(engineRef.current.player);
    engineRef.current.cpu = heal(engineRef.current.cpu);
    engineRef.current.timeLeft = ROUND_TIME;
    engineRef.current.round += 1;
    engineRef.current.particles = [];
    engineRef.current.screenShake = 0;
    engineRef.current.timeScale = 1.0;
    engineRef.current.isKO = false;
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

  const updateBoxerLogic = (
    boxer: Boxer,
    opponent: Boxer,
    keys: Set<string>,
    dt: number,
  ): Boxer => {
    const next = { ...boxer };
    const move = MOVE_SPEED * next.speed;

    if (next.action === Action.IDLE || next.action === Action.BLOCK) {
      next.stamina = Math.min(next.maxStamina, next.stamina + dt * 35 * next.staminaRegen);
    }

    if (next.actionTimer > 0) {
      next.actionTimer -= dt;
      if (next.actionTimer <= 0) next.action = Action.IDLE;
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
      if (keys.has('KeyJ') && next.stamina >= 10) {
        next.action = Action.JAB;
        next.actionTimer = 0.2;
        next.stamina -= 10;
      } else if (keys.has('KeyK') && next.stamina >= 25) {
        next.action = Action.HOOK;
        next.actionTimer = 0.4;
        next.stamina -= 25;
      } else if (keys.has('KeyL') && next.superMeter >= 100) {
        playGoal();
        next.action = Action.HOOK;
        next.actionTimer = 0.6;
        next.superMeter = 0;
      } else if (keys.has('KeyS')) {
        next.action = Action.BLOCK;
      } else if (keys.has('KeyW') && next.stamina >= 15) {
        next.action = Action.DODGE;
        next.actionTimer = 0.3;
        next.stamina -= 15;
      } else if (keys.has('KeyI') && next.stamina >= 10) {
        next.action = Action.PARRY;
        next.actionTimer = 0.2;
        next.stamina -= 10;
      }
    } else if (next.action === Action.BLOCK && !keys.has('KeyS')) {
      next.action = Action.IDLE;
    }

    return next;
  };

  const updateCpuLogic = (
    boxer: Boxer,
    opponent: Boxer,
    dt: number,
    diff: Difficulty,
  ): Boxer => {
    const next = { ...boxer };
    const cfg = DIFFICULTY[diff];

    if (next.action === Action.IDLE || next.action === Action.BLOCK) {
      next.stamina = Math.min(next.maxStamina, next.stamina + dt * 30 * next.staminaRegen);
    }

    if (next.actionTimer > 0) {
      next.actionTimer -= dt;
      if (next.actionTimer <= 0) next.action = Action.IDLE;
    }
    if (next.action === Action.KO || next.action === Action.HIT || next.action === Action.STAGGER) {
      return next;
    }

    const dist = Math.abs(next.x - opponent.x);
    next.facing = next.x < opponent.x ? 1 : -1;

    const playerAttacking = opponent.action === Action.JAB || opponent.action === Action.HOOK;
    const urgent = playerAttacking && dist < 130 && next.action === Action.IDLE;

    next.thinkTimer -= dt;
    if (!urgent && next.thinkTimer > 0 && next.action !== Action.IDLE) {
      next.x = Math.max(0, Math.min(CANVAS_WIDTH - BOXER_WIDTH, next.x));
      return next;
    }
    if (!urgent && next.thinkTimer > 0 && next.action === Action.IDLE) {
      // Keep drifting toward preferred range between thinks.
      if (dist > cfg.preferredDist + 40) {
        next.x += (opponent.x > next.x ? 1 : -1) * MOVE_SPEED * next.speed * cfg.moveSpeed * 0.6;
      }
      next.x = Math.max(0, Math.min(CANVAS_WIDTH - BOXER_WIDTH, next.x));
      return next;
    }

    if (next.action === Action.IDLE || urgent) {
      const intent = decideCpuIntent({
        dist,
        stamina: next.stamina,
        superMeter: next.superMeter,
        opponentAction: opponent.action,
        difficulty: diff,
      });

      if (intent.type === 'move') {
        const toward = opponent.x > next.x ? 1 : -1;
        next.x += toward * intent.dir * MOVE_SPEED * next.speed * intent.speed;
        next.thinkTimer = nextThinkDelay(cfg, Math.random) * 0.45;
      } else if (intent.type === 'act') {
        if (intent.clearSuper) playGoal();
        next.action = Action[intent.action];
        next.actionTimer = intent.timer;
        next.stamina = Math.max(0, next.stamina - intent.staminaCost);
        if (intent.clearSuper) next.superMeter = 0;
        next.thinkTimer = nextThinkDelay(cfg, Math.random);
      } else {
        next.thinkTimer = nextThinkDelay(cfg, Math.random);
      }
    }

    next.x = Math.max(0, Math.min(CANVAS_WIDTH - BOXER_WIDTH, next.x));
    return next;
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
      if (attacker.action !== Action.JAB && attacker.action !== Action.HOOK) return null;
      if (attacker.actionTimer < 0.1) return null;

      const reach = attacker.action === Action.JAB ? 80 : 60;
      let damage = (attacker.action === Action.JAB ? 5 : 12) * attacker.power;
      let score = attacker.action === Action.JAB ? 10 : 25;
      const isSuper = attacker.actionTimer > 0.4;
      if (isSuper) {
        damage *= 2.5;
        score *= 3;
      }

      const attackerHandX = attacker.facing === 1 ? attacker.x + BOXER_WIDTH : attacker.x;
      const inRange =
        attacker.facing === 1
          ? attackerHandX + reach >= defender.x && attackerHandX <= defender.x + BOXER_WIDTH
          : attackerHandX - reach <= defender.x + BOXER_WIDTH && attackerHandX >= defender.x;

      if (inRange && defender.action !== Action.DODGE) {
        if (defender.action === Action.PARRY) {
          playCapture();
          spawnParticles(attackerHandX, defender.y + 30, '#60a5fa', true);
          engineRef.current.screenShake = 0.8;
          engineRef.current.parryEffect = {
            x: defender.x + BOXER_WIDTH / 2,
            y: defender.y - 20,
            life: 1.0,
          };
          return {
            defenderUpdate: {
              stamina: Math.min(defender.maxStamina, defender.stamina + 20),
              superMeter: Math.min(100, defender.superMeter + 15),
              action: Action.IDLE,
              actionTimer: 0,
            },
            attackerUpdate: {
              action: Action.STAGGER,
              actionTimer: 0.6,
            },
          };
        }

        const isBlocked = defender.action === Action.BLOCK;
        if (isSuper) playGoal();
        else playCapture();

        const isCounter = defender.action === Action.JAB || defender.action === Action.HOOK;
        if (isCounter) {
          damage *= 1.5;
          score *= 1.5;
          spawnParticles(
            defender.x + BOXER_WIDTH / 2,
            defender.y + BOXER_HEIGHT / 2,
            '#fbbf24',
            isSuper,
          );
        }

        const finalDamage = isBlocked ? damage * 0.2 : damage;
        const newHealth = Math.max(0, defender.health - finalDamage);

        spawnParticles(attackerHandX, defender.y + 30, isCounter ? '#f59e0b' : '#ffffff', isSuper);
        engineRef.current.screenShake = isSuper ? 1.0 : 0.4;

        return {
          defenderUpdate: {
            health: newHealth,
            action: newHealth <= 0 ? Action.KO : isBlocked ? defender.action : Action.HIT,
            actionTimer: newHealth <= 0 ? 2.0 : 0.2,
            superMeter: Math.min(100, defender.superMeter + finalDamage * 0.5),
          },
          attackerUpdate: {
            score: attacker.score + (isBlocked ? 0 : Math.floor(score)),
            superMeter: Math.min(100, attacker.superMeter + (isBlocked ? 2 : 10)),
            actionTimer: 0,
          },
        };
      }
      return null;
    };

    const playerHit = processHit(player, cpu);
    if (playerHit) {
      engineRef.current.cpu = { ...cpu, ...playerHit.defenderUpdate };
      engineRef.current.player = { ...player, ...playerHit.attackerUpdate };
      if (engineRef.current.cpu.health <= 0 && !engineRef.current.isKO) triggerKO();
    }

    const cpuHit = processHit(engineRef.current.cpu, engineRef.current.player);
    if (cpuHit) {
      engineRef.current.player = { ...engineRef.current.player, ...cpuHit.defenderUpdate };
      engineRef.current.cpu = { ...engineRef.current.cpu, ...cpuHit.attackerUpdate };
      if (engineRef.current.player.health <= 0 && !engineRef.current.isKO) triggerKO();
    }
  };

  const triggerKO = () => {
    engineRef.current.isKO = true;
    engineRef.current.timeScale = 0.25;
    engineRef.current.screenShake = 2.0;

    const { player, cpu } = engineRef.current;
    const koVictim = player.health <= 0 ? player : cpu;
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
      const amt = engineRef.current.screenShake * 10;
      ctx.translate(Math.random() * amt - amt / 2, Math.random() * amt - amt / 2);
    }

    // Ring floor + sky plates
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
      ctx.font = 'black 48px "Anton", sans-serif';
      ctx.fillStyle = `rgba(255, 255, 255, ${p.life})`;
      ctx.textAlign = 'center';
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#60a5fa';
      const s = 1 + (1 - p.life) * 0.5;
      ctx.scale(s, s);
      ctx.fillText('PARRY!', p.x / s, (p.y - (1.0 - p.life) * 80) / s);
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

    ctx.restore();

    if (engineRef.current.isKO) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 120px "Anton", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#000000';
      ctx.fillText('K.O.!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
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
    </button>
  );

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans selection:bg-blue-500/30 overflow-x-hidden">
      <BackToMenu />
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
            </h2>
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-full max-w-48 h-3 bg-neutral-800 rounded-full overflow-hidden border border-white/5">
                <motion.div className="h-full bg-emerald-500" animate={{ width: `${playerHpPct}%` }} />
              </div>
              <span className="text-xs font-mono w-8 shrink-0">{Math.ceil(uiState.playerHealth)}</span>
            </div>
            <div className="flex gap-2 max-w-48">
              <div className="flex-1 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                <motion.div className="h-full bg-amber-400" animate={{ width: `${uiState.playerStamina}%` }} />
              </div>
              <div className="flex-1 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full ${uiState.playerSuper >= 100 ? 'bg-fuchsia-400 shadow-[0_0_8px_rgba(232,121,249,0.8)]' : 'bg-fuchsia-800'}`}
                  animate={{ width: `${uiState.playerSuper}%` }}
                />
              </div>
            </div>
            <p className="text-lg sm:text-xl font-black mt-1 tracking-tighter italic">
              SCORE: {uiState.playerScore}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center shrink-0 self-center">
          <div className="flex items-center gap-2 text-amber-400 mb-1">
            <Trophy className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-widest">Round {uiState.round}</span>
          </div>
          <div className="text-[10px] text-neutral-500 mb-1 uppercase tracking-widest">
            {DIFFICULTY_LABELS[difficulty]}
          </div>
          <div className="bg-neutral-900 px-4 sm:px-6 py-2 rounded-2xl border border-white/10 flex items-center gap-3 shadow-inner">
            <Timer className="w-5 h-5 text-neutral-500" />
            <span className="text-2xl sm:text-3xl font-black font-mono tabular-nums">
              {Math.floor(uiState.timeLeft / 60)}:{(uiState.timeLeft % 60).toFixed(0).padStart(2, '0')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4 text-right min-w-0 flex-1 md:justify-end">
          <div className="flex flex-col gap-1 text-right items-end min-w-0 flex-1">
            <h2 className="text-sm font-bold uppercase tracking-widest text-red-400 truncate max-w-full">
              {uiState.cpuName}
            </h2>
            <div className="flex items-center gap-2 flex-row-reverse min-w-0 w-full justify-start">
              <div className="w-full max-w-48 h-3 bg-neutral-800 rounded-full overflow-hidden border border-white/5">
                <motion.div className="h-full bg-rose-500" animate={{ width: `${cpuHpPct}%` }} />
              </div>
              <span className="text-xs font-mono w-8 shrink-0">{Math.ceil(uiState.cpuHealth)}</span>
            </div>
            <div className="flex gap-2 flex-row-reverse max-w-48 ml-auto">
              <div className="flex-1 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                <motion.div className="h-full bg-amber-400" animate={{ width: `${uiState.cpuStamina}%` }} />
              </div>
              <div className="flex-1 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full ${uiState.cpuSuper >= 100 ? 'bg-fuchsia-400 shadow-[0_0_8px_rgba(232,121,249,0.8)]' : 'bg-fuchsia-800'}`}
                  animate={{ width: `${uiState.cpuSuper}%` }}
                />
              </div>
            </div>
            <p className="text-lg sm:text-xl font-black mt-1 tracking-tighter italic">
              SCORE: {uiState.cpuScore}
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
                <p className="text-neutral-400 max-w-lg mb-4 text-center text-sm">
                  選角色與難度後開戰。WASD 移動・J/K 出拳・S 格擋・W 閃避・I 格檔反擊・L 必殺
                </p>
                <p className="text-amber-400/90 text-sm font-bold mb-4 tracking-wide">
                  連勝 {careerStats.winStreak} · 勝 {careerStats.wins} · 負 {careerStats.losses}
                  {careerStats.draws > 0 ? ` · 和 ${careerStats.draws}` : ''}
                </p>

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
                          if (cpuCharId === c.id) setCpuCharId(pickCpuOpponent(c.id));
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div className="w-full max-w-2xl mb-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2">
                    對手
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

                <div className="w-full max-w-md mb-6">
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
                          'px-4 py-2 rounded-xl text-sm font-black uppercase tracking-wider border transition-all',
                          difficulty === d
                            ? 'bg-amber-500 text-black border-amber-300'
                            : 'bg-neutral-900 border-white/10 text-neutral-300 hover:border-white/30',
                        )}
                      >
                        {DIFFICULTY_LABELS[d]}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={startNewGame}
                  className="group relative px-8 py-4 bg-blue-600 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-500 transition-all active:scale-95"
                >
                  <span className="flex items-center gap-2">
                    <Play className="w-5 h-5 fill-current" />
                    開始對戰
                  </span>
                </button>
              </motion.div>
            )}

            {gameState === 'round_end' && (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center"
              >
                <h2 className="text-5xl font-black italic mb-2 uppercase">Round {uiState.round} Over</h2>
                <p className="text-neutral-300 mb-8">準備下一回合…</p>
                <button
                  type="button"
                  onClick={nextRound}
                  className="px-8 py-4 bg-amber-500 text-black rounded-2xl font-black uppercase tracking-widest hover:bg-amber-400 transition-all"
                >
                  Next Round
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
                  { label: '難度', value: DIFFICULTY_LABELS[difficulty] },
                  { label: '連勝', value: careerStats.winStreak },
                  { label: '生涯勝場', value: careerStats.wins },
                ]}
                onPrimary={() => setGameState('menu')}
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
                ariaLabel="Move left"
                onPress={() => keysPressed.current.add('KeyA')}
                onRelease={() => keysPressed.current.delete('KeyA')}
              />
              <TouchButton
                label="→"
                ariaLabel="Move right"
                onPress={() => keysPressed.current.add('KeyD')}
                onRelease={() => keysPressed.current.delete('KeyD')}
              />
            </div>
            <div className="flex flex-wrap gap-2 justify-center w-full">
              <TouchButton label="J" ariaLabel="Jab" onPress={() => keysPressed.current.add('KeyJ')} onRelease={() => keysPressed.current.delete('KeyJ')} />
              <TouchButton label="K" ariaLabel="Hook" onPress={() => keysPressed.current.add('KeyK')} onRelease={() => keysPressed.current.delete('KeyK')} />
              <TouchButton label="S" ariaLabel="Block" onPress={() => keysPressed.current.add('KeyS')} onRelease={() => keysPressed.current.delete('KeyS')} />
              <TouchButton label="W" ariaLabel="Dodge" onPress={() => keysPressed.current.add('KeyW')} onRelease={() => keysPressed.current.delete('KeyW')} />
              <TouchButton label="I" ariaLabel="Parry" onPress={() => keysPressed.current.add('KeyI')} onRelease={() => keysPressed.current.delete('KeyI')} />
              <TouchButton label="L" ariaLabel="Super" onPress={() => keysPressed.current.add('KeyL')} onRelease={() => keysPressed.current.delete('KeyL')} accent />
            </div>
          </div>
        )}

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-neutral-900/50 p-6 rounded-2xl border border-white/5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-4 flex items-center gap-2">
              <Zap className="w-4 h-4" /> Movement
            </h3>
            <div className="flex gap-2">
              <kbd className="px-3 py-2 bg-neutral-800 rounded-lg border border-white/10 font-mono text-sm">A</kbd>
              <kbd className="px-3 py-2 bg-neutral-800 rounded-lg border border-white/10 font-mono text-sm">D</kbd>
              <span className="text-sm text-neutral-400 ml-2 self-center">Left / Right</span>
            </div>
          </div>
          <div className="bg-neutral-900/50 p-6 rounded-2xl border border-white/5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4" /> Defense
            </h3>
            <div className="flex gap-2">
              <kbd className="px-3 py-2 bg-neutral-800 rounded-lg border border-white/10 font-mono text-sm">W</kbd>
              <kbd className="px-3 py-2 bg-neutral-800 rounded-lg border border-white/10 font-mono text-sm">S</kbd>
              <kbd className="px-3 py-2 bg-blue-900/50 border-blue-500/50 rounded-lg border font-mono text-sm text-blue-400">I</kbd>
              <span className="text-sm text-neutral-400 ml-2 self-center">Dodge / Block / Parry</span>
            </div>
          </div>
          <div className="bg-neutral-900/50 p-6 rounded-2xl border border-white/5">
            <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-4 flex items-center gap-2">
              <Heart className="w-4 h-4" /> Offense
            </h3>
            <div className="flex flex-col gap-3">
              <div className="flex gap-2 items-center">
                <kbd className="px-3 py-2 bg-neutral-800 rounded-lg border border-white/10 font-mono text-sm">J</kbd>
                <kbd className="px-3 py-2 bg-neutral-800 rounded-lg border border-white/10 font-mono text-sm">K</kbd>
                <span className="text-sm text-neutral-400 ml-2">Jab / Hook</span>
              </div>
              <div className="flex gap-2 items-center">
                <kbd className="px-3 py-2 bg-neutral-800 rounded-lg border border-white/10 font-mono text-sm">L</kbd>
                <span className="text-sm text-fuchsia-400 ml-2 font-bold">SUPER MOVE</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="max-w-5xl mx-auto mt-12 pb-12 text-center text-neutral-600 text-xs uppercase tracking-[0.2em]">
        Toy Boxing • 選角色・選難度・進擂台
      </footer>
    </div>
  );
}
