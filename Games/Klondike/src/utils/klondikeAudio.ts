// Native Web Audio engine for Klondike Solitaire
// Zero external dependencies; creates crisp card flicks, snaps, ascending cascades, and Vegas bass drops.

class KlondikeAudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
  }

  /**
   * Crisp card flick / slide sound (noise burst with bandpass filter).
   */
  public playCardFlick(): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const bufferSize = ctx.sampleRate * 0.05; // 50ms noise
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.Q.setValueAtTime(2.5, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      whiteNoise.start(now);
      whiteNoise.stop(now + 0.05);
    } catch {
      // Audio fallback silent
    }
  }

  /**
   * Satisfying physical card snap/thud onto table or column.
   */
  public playCardSnap(): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      // Low thud oscillator
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.06);

      const oscGain = ctx.createGain();
      oscGain.gain.setValueAtTime(0.3, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      // Short tap click
      const clickOsc = ctx.createOscillator();
      clickOsc.type = 'triangle';
      clickOsc.frequency.setValueAtTime(900, now);
      clickOsc.frequency.exponentialRampToValueAtTime(200, now + 0.03);

      const clickGain = ctx.createGain();
      clickGain.gain.setValueAtTime(0.15, now);
      clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

      osc.connect(oscGain);
      oscGain.connect(ctx.destination);
      clickOsc.connect(clickGain);
      clickGain.connect(ctx.destination);

      osc.start(now);
      clickOsc.start(now);
      osc.stop(now + 0.065);
      clickOsc.stop(now + 0.035);
    } catch {
      // Audio fallback silent
    }
  }

  /**
   * Vegas-style ascending cascade arpeggio when cards move to Foundation.
   * Pitch dynamically increases with total foundation cards count.
   */
  public playFoundationAscent(totalFoundationCards: number): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      // Pentatonic scale frequencies starting from C4 up to C7
      const pentatonic = [
        261.63, 293.66, 329.63, 392.00, 440.00, // C4 - A4
        523.25, 587.33, 659.25, 783.99, 880.00, // C5 - A5
        1046.50, 1174.66, 1318.51, 1567.98, 1760.00, // C6 - A6
        2093.00, // C7
      ];

      const noteIdx = Math.min(pentatonic.length - 1, Math.max(0, totalFoundationCards % pentatonic.length));
      const freq = pentatonic[noteIdx];

      // Primary chime
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      // Harmonic shimmer
      const overtone = ctx.createOscillator();
      overtone.type = 'sine';
      overtone.frequency.setValueAtTime(freq * 2, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      const overtoneGain = ctx.createGain();
      overtoneGain.gain.setValueAtTime(0.12, now);
      overtoneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      overtone.connect(overtoneGain);
      gain.connect(ctx.destination);
      overtoneGain.connect(ctx.destination);

      osc.start(now);
      overtone.start(now);
      osc.stop(now + 0.3);
      overtone.stop(now + 0.22);
    } catch {
      // Audio fallback silent
    }
  }

  /**
   * Vegas bass drop: dramatic sub-bass impact for big victories and streaks.
   */
  public playVegasBassDrop(): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.exponentialRampToValueAtTime(32, now + 0.55);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.65);
    } catch {
      // Audio fallback silent
    }
  }

  /**
   * Rapid riffle shuffle sound when starting or redealing game.
   */
  public playRiffleShuffle(): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const pulses = 8;
      for (let i = 0; i < pulses; i++) {
        const timeOffset = i * 0.035;
        setTimeout(() => {
          this.playCardFlick();
        }, timeOffset * 1000);
      }
    } catch {
      // Audio fallback silent
    }
  }

  /**
   * Celebratory Vegas victory fanfare with chords and sparkling bells.
   */
  public playVictoryFanfare(): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    this.playVegasBassDrop();

    const chords = [
      [523.25, 659.25, 783.99],       // C Major
      [587.33, 739.99, 880.00],       // D Major
      [659.25, 830.61, 987.77],       // E Major
      [783.99, 987.77, 1174.66, 1567.98], // G Major arpeggio climax
    ];

    chords.forEach((chord, step) => {
      setTimeout(() => {
        const now = ctx.currentTime;
        chord.forEach((freq) => {
          const osc = ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now);

          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0.14, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now);
          osc.stop(now + 0.45);
        });
      }, step * 160);
    });
  }

  /**
   * Single sparkling firework pop for cascade ceremony.
   */
  public playFireworkPop(): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320 + Math.random() * 200, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.12);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.13);
    } catch {
      // Audio fallback silent
    }
  }
}

export const klondikeAudio = new KlondikeAudioEngine();
