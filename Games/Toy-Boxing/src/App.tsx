import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Timer, Heart, Shield, Zap, User, Monitor, Play, RotateCcw } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Constants ---
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 400;
const BOXER_WIDTH = 60;
const BOXER_HEIGHT = 120;
const GROUND_Y = 350;
const MOVE_SPEED = 4;
const ROUND_TIME = 60; // seconds

// --- Sound Utility ---
const playSound = (type: 'hit' | 'block' | 'parry' | 'super') => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'parry') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.1);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === 'hit') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'super') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.3);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    }
  } catch (e) {
    // Audio context might be blocked or not supported
  }
};

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
  color: string;
  name: string;
  isDizzy: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

const createInitialBoxer = (id: 'player' | 'cpu'): Boxer => ({
  id,
  x: id === 'player' ? 200 : 600,
  y: GROUND_Y - BOXER_HEIGHT,
  health: 100,
  maxHealth: 100,
  stamina: 100,
  maxStamina: 100,
  superMeter: 0,
  maxSuperMeter: 100,
  score: 0,
  action: Action.IDLE,
  actionTimer: 0,
  facing: id === 'player' ? 1 : -1,
  color: id === 'player' ? '#3b82f6' : '#ef4444',
  name: id === 'player' ? 'Player 1' : 'CPU',
  isDizzy: false
});

// --- Game Component ---
export default function ToyBoxing() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'round_end' | 'game_over'>('menu');
  const [winner, setWinner] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  
  // Use refs for the game engine to keep it stable
  const engineRef = useRef({
    player: createInitialBoxer('player'),
    cpu: createInitialBoxer('cpu'),
    timeLeft: ROUND_TIME,
    round: 1,
    particles: [] as Particle[],
    screenShake: 0,
    timeScale: 1.0,
    isKO: false,
    parryEffect: null as { x: number, y: number, life: number } | null
  });

  // State for UI rendering
  const [uiState, setUiState] = useState({
    playerHealth: 100,
    playerStamina: 100,
    playerSuper: 0,
    playerScore: 0,
    cpuHealth: 100,
    cpuStamina: 100,
    cpuSuper: 0,
    cpuScore: 0,
    timeLeft: ROUND_TIME,
    round: 1
  });

  const keysPressed = useRef<Set<string>>(new Set());

  // --- Input Handling ---
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

  // --- Game Loop ---
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const update = (time: number) => {
      const deltaTime = Math.min((time - lastTime) / 1000, 0.1) * engineRef.current.timeScale;
      lastTime = time;

      if (gameState === 'playing' && countdown === null) {
        // Update Timer
        engineRef.current.timeLeft -= deltaTime;
        if (engineRef.current.timeLeft <= 0) {
          engineRef.current.timeLeft = 0;
          handleRoundEnd();
        }

        if (engineRef.current.screenShake > 0) {
          engineRef.current.screenShake -= deltaTime * 5;
        }

        // Update Engine
        const { player, cpu } = engineRef.current;
        engineRef.current.player = updateBoxerLogic(player, cpu, keysPressed.current, deltaTime);
        engineRef.current.cpu = updateCpuLogic(cpu, player, deltaTime);
        
        checkCollisions();

        // Update Particles
        engineRef.current.particles = engineRef.current.particles
          .map(p => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vy: p.vy + 0.2, // Gravity
            life: p.life - 0.02
          }))
          .filter(p => p.life > 0);

        // Sync to UI State
        setUiState({
          playerHealth: isNaN(engineRef.current.player.health) ? 0 : engineRef.current.player.health,
          playerStamina: isNaN(engineRef.current.player.stamina) ? 0 : engineRef.current.player.stamina,
          playerSuper: isNaN(engineRef.current.player.superMeter) ? 0 : engineRef.current.player.superMeter,
          playerScore: engineRef.current.player.score,
          cpuHealth: isNaN(engineRef.current.cpu.health) ? 0 : engineRef.current.cpu.health,
          cpuStamina: isNaN(engineRef.current.cpu.stamina) ? 0 : engineRef.current.cpu.stamina,
          cpuSuper: isNaN(engineRef.current.cpu.superMeter) ? 0 : engineRef.current.cpu.superMeter,
          cpuScore: engineRef.current.cpu.score,
          timeLeft: isNaN(engineRef.current.timeLeft) ? 0 : engineRef.current.timeLeft,
          round: engineRef.current.round
        });
      }

      render();
      animationFrameId = requestAnimationFrame(update);
    };

    console.log("Game loop effect running. State:", gameState);
    animationFrameId = requestAnimationFrame(update);
    return () => {
      console.log("Cleaning up game loop effect");
      cancelAnimationFrame(animationFrameId);
    };
  }, [gameState, countdown]);

  // Initial render
  useEffect(() => {
    render();
  }, []);

  const handleRoundEnd = () => {
    console.log("Round ended. Current round:", engineRef.current.round);
    if (engineRef.current.round >= 3 || engineRef.current.player.health <= 0 || engineRef.current.cpu.health <= 0) {
      setGameState('game_over');
      determineWinner();
    } else {
      setGameState('round_end');
    }
  };

  const determineWinner = () => {
    const { player, cpu } = engineRef.current;
    console.log("Determining winner. Player health:", player.health, "CPU health:", cpu.health);
    if (player.health <= 0) setWinner('CPU');
    else if (cpu.health <= 0) setWinner('Player 1');
    else if (player.score > cpu.score) setWinner('Player 1');
    else if (cpu.score > player.score) setWinner('CPU');
    else setWinner('Draw');
  };

  const startNewGame = () => {
    console.log("startNewGame triggered");
    engineRef.current = {
      player: createInitialBoxer('player'),
      cpu: createInitialBoxer('cpu'),
      timeLeft: ROUND_TIME,
      round: 1,
      particles: [],
      screenShake: 0,
      timeScale: 1.0,
      isKO: false,
      parryEffect: null
    };
    setWinner(null);
    startCountdown();
  };

  const nextRound = () => {
    console.log("nextRound triggered");
    engineRef.current.player = { 
      ...engineRef.current.player, 
      health: Math.min(engineRef.current.player.health + 30, 100), 
      x: 200, 
      action: Action.IDLE, 
      actionTimer: 0 
    };
    engineRef.current.cpu = { 
      ...engineRef.current.cpu, 
      health: Math.min(engineRef.current.cpu.health + 30, 100), 
      x: 600, 
      action: Action.IDLE, 
      actionTimer: 0 
    };
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

  // --- Logic Helpers ---
  const updateBoxerLogic = (boxer: Boxer, opponent: Boxer, keys: Set<string>, dt: number): Boxer => {
    let next = { ...boxer };

    // Stamina Regeneration
    if (next.action === Action.IDLE || next.action === Action.BLOCK) {
      next.stamina = Math.min(next.maxStamina, next.stamina + dt * 35);
    }

    if (next.actionTimer > 0) {
      next.actionTimer -= dt;
      if (next.actionTimer <= 0) next.action = Action.IDLE;
    }

    if (next.action === Action.KO || next.action === Action.HIT || next.action === Action.STAGGER) return next;

    if (next.action === Action.IDLE || next.action === Action.BLOCK) {
      if (keys.has('KeyA')) next.x -= MOVE_SPEED;
      if (keys.has('KeyD')) next.x += MOVE_SPEED;
      next.x = Math.max(0, Math.min(CANVAS_WIDTH - BOXER_WIDTH, next.x));
      next.facing = next.x < opponent.x ? 1 : -1;
    }

    if (next.action === Action.IDLE) {
      if (keys.has('KeyJ') && next.stamina >= 10) { 
        next.action = Action.JAB; 
        next.actionTimer = 0.2; 
        next.stamina -= 10;
      }
      else if (keys.has('KeyK') && next.stamina >= 25) { 
        next.action = Action.HOOK; 
        next.actionTimer = 0.4; 
        next.stamina -= 25;
      }
      else if (keys.has('KeyL') && next.superMeter >= 100) {
        playSound('super');
        next.action = Action.HOOK; // Reuse hook animation for super
        next.actionTimer = 0.6;
        next.superMeter = 0;
      }
      else if (keys.has('KeyS')) { next.action = Action.BLOCK; }
      else if (keys.has('KeyW') && next.stamina >= 15) { 
        next.action = Action.DODGE; 
        next.actionTimer = 0.3; 
        next.stamina -= 15;
      }
      else if (keys.has('KeyI') && next.stamina >= 10) { 
        next.action = Action.PARRY; 
        next.actionTimer = 0.2; // Very tight window
        next.stamina -= 10;
      }
    } else if (next.action === Action.BLOCK && !keys.has('KeyS')) {
      next.action = Action.IDLE;
    }

    return next;
  };

  const updateCpuLogic = (boxer: Boxer, opponent: Boxer, dt: number): Boxer => {
    let next = { ...boxer };
    
    // Stamina Regeneration
    if (next.action === Action.IDLE || next.action === Action.BLOCK) {
      next.stamina = Math.min(next.maxStamina, next.stamina + dt * 30);
    }

    if (next.actionTimer > 0) {
      next.actionTimer -= dt;
      if (next.actionTimer <= 0) next.action = Action.IDLE;
    }
    if (next.action === Action.KO || next.action === Action.HIT || next.action === Action.STAGGER) return next;

    const dist = Math.abs(next.x - opponent.x);
    next.facing = next.x < opponent.x ? 1 : -1;

    if (next.action === Action.IDLE) {
      if (dist > 120) {
        next.x += (opponent.x > next.x ? 1 : -1) * (MOVE_SPEED * 0.7);
      } else {
        const rand = Math.random();
        if (rand < 0.02 && next.stamina >= 10) { 
          next.action = Action.JAB; 
          next.actionTimer = 0.2; 
          next.stamina -= 10;
        }
        else if (rand < 0.03 && next.stamina >= 25) { 
          next.action = Action.HOOK; 
          next.actionTimer = 0.4; 
          next.stamina -= 25;
        }
        else if (rand < 0.01 && next.superMeter >= 100) {
          playSound('super');
          next.action = Action.HOOK;
          next.actionTimer = 0.6;
          next.superMeter = 0;
        }
        else if (rand < 0.04) { next.action = Action.BLOCK; next.actionTimer = 0.5; }
        else if (rand < 0.05 && next.stamina >= 15 && opponent.action !== Action.IDLE) {
          // CPU Dodge attempt
          next.action = Action.DODGE;
          next.actionTimer = 0.3;
          next.stamina -= 15;
        }
        else if (rand < 0.01 && next.stamina >= 10 && opponent.action !== Action.IDLE) {
          // CPU Parry attempt if opponent is attacking (reduced chance)
          next.action = Action.PARRY;
          next.actionTimer = 0.2;
          next.stamina -= 10;
        }
      }
    }
    next.x = Math.max(0, Math.min(CANVAS_WIDTH - BOXER_WIDTH, next.x));
    return next;
  };

  const checkCollisions = () => {
    if (engineRef.current.isKO) return;
    const { player, cpu } = engineRef.current;

    const spawnParticles = (x: number, y: number, color: string, isSuper: boolean = false) => {
      const count = isSuper ? 20 : 8;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * (isSuper ? 15 : 8) + 2;
        engineRef.current.particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1.0 + Math.random() * 0.5,
          color
        });
      }
    };

    const processHit = (attacker: Boxer, defender: Boxer) => {
      if (attacker.action !== Action.JAB && attacker.action !== Action.HOOK) return null;
      if (attacker.actionTimer < 0.1) return null;

      const reach = attacker.action === Action.JAB ? 80 : 60;
      let damage = attacker.action === Action.JAB ? 5 : 12;
      let score = attacker.action === Action.JAB ? 10 : 25;

      // Super Move Check (if actionTimer was set higher)
      const isSuper = attacker.actionTimer > 0.4;
      if (isSuper) {
        damage *= 2.5;
        score *= 3;
      }

      const attackerHandX = attacker.facing === 1 ? attacker.x + BOXER_WIDTH : attacker.x;
      const inRange = attacker.facing === 1 
        ? (attackerHandX + reach >= defender.x && attackerHandX <= defender.x + BOXER_WIDTH)
        : (attackerHandX - reach <= defender.x + BOXER_WIDTH && attackerHandX >= defender.x);

      if (inRange && defender.action !== Action.DODGE) {
        // Parry Check
        if (defender.action === Action.PARRY) {
          playSound('parry');
          spawnParticles(attackerHandX, defender.y + 30, '#60a5fa', true); // Blue flash for parry
          engineRef.current.screenShake = 0.8;
          engineRef.current.parryEffect = { x: defender.x + BOXER_WIDTH / 2, y: defender.y - 20, life: 1.0 };
          return {
            defenderUpdate: {
              stamina: Math.min(defender.maxStamina, defender.stamina + 20),
              superMeter: Math.min(100, defender.superMeter + 15),
              action: Action.IDLE,
              actionTimer: 0
            },
            attackerUpdate: {
              action: Action.STAGGER,
              actionTimer: 0.6, // Reduced stagger duration
            }
          };
        }

        const isBlocked = defender.action === Action.BLOCK;
        if (isSuper) playSound('super');
        else if (isBlocked) playSound('hit');
        else playSound('hit');
        
        // Counter Hit Check
        const isCounter = defender.action === Action.JAB || defender.action === Action.HOOK;
        if (isCounter) {
          damage *= 1.5;
          score *= 1.5;
          spawnParticles(defender.x + BOXER_WIDTH/2, defender.y + BOXER_HEIGHT/2, '#fbbf24', isSuper); // Gold sparks
        }

        const finalDamage = isBlocked ? damage * 0.2 : damage;
        const newHealth = Math.max(0, defender.health - finalDamage);
        
        spawnParticles(attackerHandX, defender.y + 30, isCounter ? '#f59e0b' : '#ffffff', isSuper);
        engineRef.current.screenShake = isSuper ? 1.0 : 0.4;

        return {
          defenderUpdate: {
            health: newHealth,
            action: newHealth <= 0 ? Action.KO : (isBlocked ? defender.action : Action.HIT),
            actionTimer: newHealth <= 0 ? 2.0 : 0.2,
            superMeter: Math.min(100, defender.superMeter + finalDamage * 0.5)
          },
          attackerUpdate: {
            score: attacker.score + (isBlocked ? 0 : Math.floor(score)),
            superMeter: Math.min(100, attacker.superMeter + (isBlocked ? 2 : 10)),
            actionTimer: 0 // Prevent multi-hit
          }
        };
      }
      return null;
    };

    const playerHit = processHit(player, cpu);
    if (playerHit) {
      engineRef.current.cpu = { ...cpu, ...playerHit.defenderUpdate };
      engineRef.current.player = { ...player, ...playerHit.attackerUpdate };
      if (engineRef.current.cpu.health <= 0 && !engineRef.current.isKO) {
        triggerKO();
      }
    }

    const cpuHit = processHit(engineRef.current.cpu, engineRef.current.player);
    if (cpuHit) {
      engineRef.current.player = { ...engineRef.current.player, ...cpuHit.defenderUpdate };
      engineRef.current.cpu = { ...engineRef.current.cpu, ...cpuHit.attackerUpdate };
      if (engineRef.current.player.health <= 0 && !engineRef.current.isKO) {
        triggerKO();
      }
    }
  };

  const triggerKO = () => {
    engineRef.current.isKO = true;
    engineRef.current.timeScale = 0.25;
    engineRef.current.screenShake = 2.0;
    
    // Massive particle burst
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
        color: '#ef4444'
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
      ctx.translate(Math.random() * amt - amt/2, Math.random() * amt - amt/2);
    }

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y);
    
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 4;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y - 40 - i * 40);
      ctx.lineTo(CANVAS_WIDTH, GROUND_Y - 40 - i * 40);
      ctx.stroke();
    }

    const drawBoxer = (b: Boxer) => {
      ctx.save();
      
      // Calculate animation progress (0 to 1)
      const totalTime = b.action === Action.JAB ? 0.2 : (b.action === Action.HOOK ? 0.4 : (b.action === Action.DODGE ? 0.3 : (b.action === Action.PARRY ? 0.2 : (b.action === Action.STAGGER ? 0.6 : 1))));
      const progress = b.actionTimer > 0 ? (totalTime - b.actionTimer) / totalTime : 0;
      
      // Base position with slight bounce
      let bounce = Math.sin(Date.now() / 200) * 2;
      ctx.translate(b.x + BOXER_WIDTH / 2, b.y + BOXER_HEIGHT / 2 + bounce);
      
      // Shadow (scales with jump/dodge)
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      const shadowScale = b.action === Action.DODGE ? 1.2 : 1;
      ctx.ellipse(0, BOXER_HEIGHT / 2 - bounce, 30 * shadowScale, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body Rotation/Leaning
      if (b.action === Action.JAB) {
        ctx.rotate(b.facing * progress * 0.1); // Lean forward
      } else if (b.action === Action.HOOK) {
        ctx.rotate(b.facing * Math.sin(progress * Math.PI) * 0.2); // Swing rotation
      } else if (b.action === Action.HIT) {
        ctx.translate(Math.random() * 6 - 3, Math.random() * 6 - 3);
        ctx.rotate(b.facing * -0.15);
      } else if (b.action === Action.KO) {
        const elapsed = 2.0 - b.actionTimer;
        const fallProgress = Math.min(1, elapsed / 0.8);
        ctx.rotate(b.facing * -Math.PI / 2 * fallProgress);
        ctx.translate(0, (BOXER_HEIGHT / 2) * fallProgress);
      } else if (b.action === Action.PARRY) {
        ctx.rotate(b.facing * -0.05);
      } else if (b.action === Action.STAGGER) {
        ctx.rotate(b.facing * -0.3);
        ctx.translate(Math.random() * 4 - 2, 0);
      }
      
      // Body
      ctx.fillStyle = b.color;
      if (b.action === Action.HIT) {
        // Flash white and add a glow
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ffffff';
      } else if (b.action === Action.PARRY) {
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#60a5fa';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(-BOXER_WIDTH / 2, -BOXER_HEIGHT / 2, BOXER_WIDTH, BOXER_HEIGHT);
      } else if (b.action === Action.STAGGER) {
        ctx.fillStyle = '#71717a'; // Grayed out
      }
      ctx.fillRect(-BOXER_WIDTH / 2, -BOXER_HEIGHT / 2, BOXER_WIDTH, BOXER_HEIGHT);
      ctx.shadowBlur = 0; // Reset shadow
      
      // Head
      ctx.fillStyle = '#fde047';
      ctx.fillRect(-15, -BOXER_HEIGHT / 2 - 30, 30, 30);

      // Dizzy Stars / Stun Effect
      if (b.action === Action.KO || b.action === Action.HIT || b.action === Action.STAGGER) {
        const starsCount = b.action === Action.KO ? 5 : (b.action === Action.STAGGER ? 4 : 3);
        const radius = b.action === Action.STAGGER ? 30 : 40;
        const time = performance.now() / 200;
        for (let i = 0; i < starsCount; i++) {
          const angle = time + (i * Math.PI * 2) / starsCount;
          const sx = Math.cos(angle) * radius;
          const sy = Math.sin(angle) * radius * 0.3 - 50;
          ctx.fillStyle = b.action === Action.STAGGER ? '#60a5fa' : '#fde047';
          ctx.beginPath();
          ctx.arc(sx, sy, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Eyes
      ctx.fillStyle = '#000';
      const eyeX = b.facing === 1 ? 5 : -10;
      ctx.fillRect(eyeX, -BOXER_HEIGHT / 2 - 20, 5, 5);

      // Arms / Actions
      ctx.fillStyle = b.color;
      const gloveColor = b.id === 'player' ? '#1d4ed8' : '#b91c1c';
      
      if (b.action === Action.JAB) {
        // Snap animation: fast extension, slower retraction
        let ext;
        if (progress < 0.3) {
          ext = (progress / 0.3) * 70; // Fast out
        } else {
          ext = 70 - ((progress - 0.3) / 0.7) * 70; // Slower back
        }
        
        ctx.fillStyle = b.color;
        ctx.fillRect(b.facing === 1 ? 20 : -20 - ext, -20, ext, 15);
        ctx.fillStyle = gloveColor;
        ctx.fillRect(b.facing === 1 ? 20 + ext : -35 - ext, -25, 22, 28); // Slightly larger glove
      } else if (b.action === Action.HOOK) {
        // Wind-up and swing
        const windUp = 0.3;
        let angle;
        if (progress < windUp) {
          // Pull back
          angle = -(progress / windUp) * 0.5;
          ctx.rotate(b.facing * -0.1);
        } else {
          // Swing through
          const swingProgress = (progress - windUp) / (1 - windUp);
          angle = -0.5 + swingProgress * (Math.PI + 0.5);
          ctx.rotate(b.facing * swingProgress * 0.3);
        }
        
        const x = Math.cos(angle) * 55 * b.facing;
        const y = -Math.sin(angle) * 35;
        
        ctx.fillStyle = b.color;
        // Arm arc
        ctx.beginPath();
        ctx.lineWidth = 14;
        ctx.lineCap = 'round';
        ctx.strokeStyle = b.color;
        ctx.arc(b.facing === 1 ? 20 : -20, -10, 45, Math.PI, Math.PI + angle * b.facing, b.facing === -1);
        ctx.stroke();

        ctx.fillStyle = gloveColor;
        ctx.beginPath();
        ctx.arc(b.facing === 1 ? 20 + x : -20 + x, -10 + y, 18, 0, Math.PI * 2);
        ctx.fill();
      } else if (b.action === Action.BLOCK) {
        ctx.fillStyle = gloveColor;
        // Two gloves in front
        ctx.fillRect(b.facing === 1 ? 15 : -35, -45, 20, 30);
        ctx.fillRect(b.facing === 1 ? 5 : -25, -35, 20, 30);
      } else if (b.action === Action.DODGE) {
        ctx.translate(0, 30 * Math.sin(progress * Math.PI));
      } else if (b.action === Action.IDLE) {
        // Idle gloves
        ctx.fillStyle = gloveColor;
        ctx.fillRect(b.facing === 1 ? 15 : -35, -10, 15, 20);
        ctx.fillRect(b.facing === 1 ? -30 : 15, -10, 15, 20);
      }

      ctx.restore();
    };

    drawBoxer(engineRef.current.player);
    drawBoxer(engineRef.current.cpu);

    // Draw Parry Effect
    if (engineRef.current.parryEffect) {
      const p = engineRef.current.parryEffect;
      ctx.save();
      
      // Ripple
      ctx.strokeStyle = `rgba(96, 165, 250, ${p.life})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y + 50, (1 - p.life) * 120, 0, Math.PI * 2);
      ctx.stroke();

      // Punchy Text
      ctx.font = 'black 48px "Anton", sans-serif';
      ctx.fillStyle = `rgba(255, 255, 255, ${p.life})`;
      ctx.textAlign = 'center';
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#60a5fa';
      ctx.scale(1 + (1 - p.life) * 0.5, 1 + (1 - p.life) * 0.5);
      ctx.fillText('PARRY!', p.x / (1 + (1 - p.life) * 0.5), (p.y - (1.0 - p.life) * 80) / (1 + (1 - p.life) * 0.5));
      ctx.restore();
      
      p.life -= 0.03;
      if (p.life <= 0) engineRef.current.parryEffect = null;
    }

    // Draw Particles
    engineRef.current.particles.forEach(p => {
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    ctx.restore(); // End screen shake

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

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans selection:bg-blue-500/30">
      {/* Header / HUD */}
      <header className="max-w-5xl mx-auto p-6 flex justify-between items-center border-b border-white/10">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-600 rounded-xl shadow-lg shadow-blue-900/20">
            <User className="w-6 h-6" />
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-bold uppercase tracking-widest text-blue-400">Player 1</h2>
            <div className="flex items-center gap-2">
              <div className="w-48 h-3 bg-neutral-800 rounded-full overflow-hidden border border-white/5">
                <motion.div 
                  className="h-full bg-emerald-500" 
                  animate={{ width: `${uiState.playerHealth}%` }}
                />
              </div>
              <span className="text-xs font-mono w-8">{Math.ceil(uiState.playerHealth)}</span>
            </div>
            {/* Stamina & Super Bars */}
            <div className="flex gap-2">
              <div className="w-24 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-amber-400" 
                  animate={{ width: `${uiState.playerStamina}%` }}
                />
              </div>
              <div className="w-24 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                <motion.div 
                  className={`h-full ${uiState.playerSuper >= 100 ? 'bg-fuchsia-400 shadow-[0_0_8px_rgba(232,121,249,0.8)]' : 'bg-fuchsia-800'}`} 
                  animate={{ width: `${uiState.playerSuper}%` }}
                />
              </div>
            </div>
            <p className="text-xl font-black mt-1 tracking-tighter italic">SCORE: {uiState.playerScore}</p>
          </div>
        </div>

        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2 text-amber-400 mb-1">
            <Trophy className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-widest">Round {uiState.round}</span>
          </div>
          <div className="bg-neutral-900 px-6 py-2 rounded-2xl border border-white/10 flex items-center gap-3 shadow-inner">
            <Timer className="w-5 h-5 text-neutral-500" />
            <span className="text-3xl font-black font-mono tabular-nums">
              {Math.floor(uiState.timeLeft / 60)}:{(uiState.timeLeft % 60).toFixed(0).padStart(2, '0')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-right">
          <div className="flex flex-col gap-1 text-right items-end">
            <h2 className="text-sm font-bold uppercase tracking-widest text-red-400">CPU</h2>
            <div className="flex items-center gap-2 flex-row-reverse">
              <div className="w-48 h-3 bg-neutral-800 rounded-full overflow-hidden border border-white/5">
                <motion.div 
                  className="h-full bg-rose-500" 
                  animate={{ width: `${uiState.cpuHealth}%` }}
                />
              </div>
              <span className="text-xs font-mono w-8">{Math.ceil(uiState.cpuHealth)}</span>
            </div>
            {/* Stamina & Super Bars */}
            <div className="flex gap-2 flex-row-reverse">
              <div className="w-24 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-amber-400" 
                  animate={{ width: `${uiState.cpuStamina}%` }}
                />
              </div>
              <div className="w-24 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                <motion.div 
                  className={`h-full ${uiState.cpuSuper >= 100 ? 'bg-fuchsia-400 shadow-[0_0_8px_rgba(232,121,249,0.8)]' : 'bg-fuchsia-800'}`} 
                  animate={{ width: `${uiState.cpuSuper}%` }}
                />
              </div>
            </div>
            <p className="text-xl font-black mt-1 tracking-tighter italic">SCORE: {uiState.cpuScore}</p>
          </div>
          <div className="p-3 bg-red-600 rounded-xl shadow-lg shadow-red-900/20">
            <Monitor className="w-6 h-6" />
          </div>
        </div>
      </header>

      {/* Game Area */}
      <main className="max-w-5xl mx-auto mt-8 relative">
        <div className="relative bg-neutral-900 rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
          <canvas 
            ref={canvasRef} 
            width={CANVAS_WIDTH} 
            height={CANVAS_HEIGHT}
            className="w-full h-auto block"
          />

          {/* Overlays */}
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
                className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-12 text-center"
              >
                <h1 className="text-7xl font-black italic tracking-tighter mb-4 uppercase">
                  Toy <span className="text-blue-500">Boxing</span>
                </h1>
                <p className="text-neutral-400 max-w-md mb-8">
                  Step into the ring! Use <span className="text-white font-bold">WASD</span> to move, 
                  <span className="text-white font-bold"> J/K</span> for attacks, 
                  <span className="text-white font-bold"> S</span> to Block, and 
                  <span className="text-white font-bold"> I</span> for a <span className="text-blue-400 font-bold">PARRY</span>!
                </p>
                <button 
                  onClick={startNewGame}
                  className="group relative px-8 py-4 bg-blue-600 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-500 transition-all active:scale-95"
                >
                  <span className="flex items-center gap-2">
                    <Play className="w-5 h-5 fill-current" />
                    Start Match
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
                <p className="text-neutral-300 mb-8">Get ready for the next round...</p>
                <button 
                  onClick={nextRound}
                  className="px-8 py-4 bg-amber-500 text-black rounded-2xl font-black uppercase tracking-widest hover:bg-amber-400 transition-all"
                >
                  Next Round
                </button>
              </motion.div>
            )}

            {gameState === 'game_over' && (
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="absolute inset-0 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center"
              >
                <Trophy className="w-20 h-20 text-amber-400 mb-6" />
                <h2 className="text-6xl font-black italic mb-2 uppercase">Match Over</h2>
                <div className="text-3xl font-bold text-blue-400 mb-8 uppercase tracking-widest">
                  Winner: {winner}
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={startNewGame}
                    className="flex items-center gap-2 px-8 py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest hover:bg-neutral-200 transition-all"
                  >
                    <RotateCcw className="w-5 h-5" />
                    Rematch
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Controls Guide */}
        <div className="mt-8 grid grid-cols-3 gap-6">
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
        &copy; 2026 Toy Boxing Arcade System • All Rights Reserved
      </footer>
    </div>
  );
}
