/**
 * High-fidelity procedural Web Audio synthesizer for Connect Four Arcade Dropper.
 * Zero external audio files; 100% deterministic, ultra-low latency synthesis.
 */

import type { MoveQuality } from './connect4Logic';

class ArcadeAudioManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private heartbeatInterval: number | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('clubhouse:connect-four:muted');
      if (saved !== null) {
        this.isMuted = saved === 'true';
      }
    }
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (this.isMuted) return null;

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (typeof window !== 'undefined') {
      localStorage.setItem('clubhouse:connect-four:muted', String(muted));
    }
    if (muted) {
      this.stopHeartbeat();
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Multi-layer physical token drop sound:
   * 1. High frequency acrylic click / snap
   * 2. Resonant body thump with pitch modulated by drop depth (row)
   * 3. Micro-bounce secondary tick
   */
  public playChuteDrop(row: number, maxRows: number): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const depthRatio = Math.max(0, Math.min(1, row / (maxRows - 1 || 1)));

    // Deep rows produce a deeper, heavier bass impact; top rows produce a lighter snap
    const baseFreq = 95 + (1 - depthRatio) * 110; // ~95Hz (bottom row) to ~205Hz (top row)
    const clickFreq = 1400 + (1 - depthRatio) * 900; // ~1400Hz to ~2300Hz

    // 1. Acrylic impact snap (short bandpass burst)
    const snapOsc = ctx.createOscillator();
    const snapGain = ctx.createGain();
    snapOsc.type = 'triangle';
    snapOsc.frequency.setValueAtTime(clickFreq, now);
    snapOsc.frequency.exponentialRampToValueAtTime(clickFreq * 0.4, now + 0.04);

    snapGain.gain.setValueAtTime(0.18, now);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    snapOsc.connect(snapGain);
    snapGain.connect(ctx.destination);
    snapOsc.start(now);
    snapOsc.stop(now + 0.055);

    // 2. Heavy cabinet body thump
    const bodyOsc = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    bodyOsc.type = 'sine';
    bodyOsc.frequency.setValueAtTime(baseFreq, now);
    bodyOsc.frequency.exponentialRampToValueAtTime(baseFreq * 0.7, now + 0.12);

    bodyGain.gain.setValueAtTime(0.24, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    bodyOsc.connect(bodyGain);
    bodyGain.connect(ctx.destination);
    bodyOsc.start(now);
    bodyOsc.stop(now + 0.15);

    // 3. Micro-bounce secondary tick (60ms later)
    const bounceNow = now + 0.065;
    const bounceOsc = ctx.createOscillator();
    const bounceGain = ctx.createGain();
    bounceOsc.type = 'triangle';
    bounceOsc.frequency.setValueAtTime(clickFreq * 0.8, bounceNow);
    bounceGain.gain.setValueAtTime(0.08, bounceNow);
    bounceGain.gain.exponentialRampToValueAtTime(0.001, bounceNow + 0.035);

    bounceOsc.connect(bounceGain);
    bounceGain.connect(ctx.destination);
    bounceOsc.start(bounceNow);
    bounceOsc.stop(bounceNow + 0.04);
  }

  /**
   * Dramatic pop-out sound when pulling a chip from the bottom tray.
   */
  public playPopOut(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(380, now + 0.09);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  /**
   * Laser hum / crosshair lock-on sound when threat ray triggers.
   */
  public playLaserHum(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(640, now + 0.15);

    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  /**
   * Double heartbeat pulse (lub-dub) indicating imminent kill threat.
   */
  public playHeartbeatOnce(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // First lub
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(65, now);
    gain1.gain.setValueAtTime(0.18, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.09);

    // Second dub (130ms later)
    const dubTime = now + 0.13;
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(54, dubTime);
    gain2.gain.setValueAtTime(0.15, dubTime);
    gain2.gain.exponentialRampToValueAtTime(0.001, dubTime + 0.1);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(dubTime);
    osc2.stop(dubTime + 0.11);
  }

  /**
   * Start recurring heartbeat when a fatal threat is on the board.
   */
  public startHeartbeat(): void {
    if (this.heartbeatInterval !== null || this.isMuted) return;
    this.playHeartbeatOnce();
    this.heartbeatInterval = window.setInterval(() => {
      this.playHeartbeatOnce();
    }, 1200);
  }

  public stopHeartbeat(): void {
    if (this.heartbeatInterval !== null) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Move quality audio celebration / warning.
   */
  public playMoveQualityFanfare(quality: MoveQuality): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    switch (quality) {
      case 'win': {
        // Triumphant rising arpeggio
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, idx) => {
          const t = now + idx * 0.08;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(0.16, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.3);
        });
        break;
      }
      case 'brilliant': {
        // Sparkling twin high bell chord
        [880, 1108.73, 1318.51].forEach((freq, idx) => {
          const t = now + idx * 0.04;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(0.14, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.36);
        });
        break;
      }
      case 'defense': {
        // Solid metallic shield strike
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(349.23, now); // F4
        osc.frequency.exponentialRampToValueAtTime(523.25, now + 0.08); // C5
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.23);
        break;
      }
      case 'strong': {
        // Confident upward power tone
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(392, now); // G4
        osc.frequency.exponentialRampToValueAtTime(587.33, now + 0.1); // D5
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.17);
        break;
      }
      case 'blunder': {
        // Warning dissonant drop buzz
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(311.13, now); // Eb4
        osc.frequency.exponentialRampToValueAtTime(196, now + 0.18); // G3
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.24);
        break;
      }
      case 'inaccuracy': {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(280, now);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.1);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.13);
        break;
      }
      default:
        // Normal move - subtle tactile tick
        break;
    }
  }

  /**
   * Bottom gate mechanical release sound with chips tumbling out into tray.
   */
  public playGateReleaseCascade(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. Mechanical spring latch pop
    const latchOsc = ctx.createOscillator();
    const latchGain = ctx.createGain();
    latchOsc.type = 'triangle';
    latchOsc.frequency.setValueAtTime(220, now);
    latchOsc.frequency.exponentialRampToValueAtTime(80, now + 0.08);
    latchGain.gain.setValueAtTime(0.25, now);
    latchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    latchOsc.connect(latchGain);
    latchGain.connect(ctx.destination);
    latchOsc.start(now);
    latchOsc.stop(now + 0.11);

    // 2. Cascading coins clatter (6 micro bursts)
    const clatterDelays = [0.06, 0.11, 0.15, 0.19, 0.24, 0.29];
    clatterDelays.forEach((delay, i) => {
      const t = now + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = i % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(300 + Math.random() * 400, t);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.07);
    });
  }
}

export const arcadeAudio = new ArcadeAudioManager();
