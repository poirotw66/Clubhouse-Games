/**
 * Thin plain-JS bridge onto ClubhouseSynthAudio (bundled from
 * shared/synthAudio.ts by build.mjs). Game-specific blips (rotate / land / pop)
 * stay local; win / lose / move / all-clear come from the shared kit.
 * Exposed as window.PuyoAudio.
 */
(function (global) {
  'use strict';

  var Shared = global.ClubhouseSynthAudio;
  var AudioContextCtor = global.AudioContext || global.webkitAudioContext;
  var context = null;
  var muted = false;

  // Musical pentatonic scale degrees (C5, D5, E5, G5, A5, C6, D6, E6, G6, A6, C7...)
  var PENTATONIC_SEMITONES = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33, 36];
  var BASE_PITCH_C5 = 523.25;

  function getContext() {
    if (!AudioContextCtor) return null;
    if (!context) context = new AudioContextCtor();
    if (context.state === 'suspended') context.resume();
    return context;
  }

  function playTone(frequency, type, duration, delay, volume, bendToFreq) {
    if (muted) return;
    var ctx = getContext();
    if (!ctx) return;

    var oscillator = ctx.createOscillator();
    var gain = ctx.createGain();
    oscillator.type = type;
    var start = ctx.currentTime + (delay || 0);

    if (bendToFreq && typeof bendToFreq === 'number' && bendToFreq > 0) {
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.frequency.exponentialRampToValueAtTime(bendToFreq, start + duration);
    } else {
      oscillator.frequency.setValueAtTime(frequency, start);
    }

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  }

  function callShared(name) {
    if (muted || !Shared || typeof Shared[name] !== 'function') return;
    Shared[name]();
  }

  function playMove() {
    callShared('playMove');
  }

  function playRotate() {
    if (muted) return;
    playTone(560, 'triangle', 0.05, 0, 0.05);
    playTone(700, 'sine', 0.04, 0.03, 0.035);
  }

  function playLand() {
    if (muted) return;
    playTone(220, 'triangle', 0.07, 0, 0.06);
    playTone(160, 'sine', 0.09, 0.02, 0.05);
  }

  /**
   * Determine the sensory escalation tier for a given chain count.
   * Tier 1 (chains 1-2): Fundamental crisp bubble pop
   * Tier 2 (chains 3-4): Major 3rd harmonic chime sparkle
   * Tier 3 (chains 5-6): Sub-bass resonance punch + high octave shimmer
   * Tier 4 (chains 7+): Sakurai Mega Chain triumphant chord blast & arpeggiated sparkle
   */
  function getChainTier(chain) {
    var c = Math.max(1, Number(chain) || 1);
    if (c >= 7) return 4;
    if (c >= 5) return 3;
    if (c >= 3) return 2;
    return 1;
  }

  /**
   * Calculate precise musical pitch, frequencies and harmonic chord targets
   * along the pentatonic scale.
   */
  function getChainPitch(chain) {
    var c = Math.max(1, Number(chain) || 1);
    var index = Math.min(c - 1, PENTATONIC_SEMITONES.length - 1);
    var semitones = PENTATONIC_SEMITONES[index];
    var baseFreq = BASE_PITCH_C5 * Math.pow(2, semitones / 12);
    var thirdFreq = baseFreq * Math.pow(2, 4 / 12); // Major 3rd (+4 semitones)
    var fifthFreq = baseFreq * Math.pow(2, 7 / 12); // Perfect 5th (+7 semitones)
    var octaveFreq = baseFreq * 2;                 // Octave shimmer (+12 semitones)

    return {
      chain: c,
      index: index,
      semitones: semitones,
      baseFreq: Math.round(baseFreq * 100) / 100,
      thirdFreq: Math.round(thirdFreq * 100) / 100,
      fifthFreq: Math.round(fifthFreq * 100) / 100,
      octaveFreq: Math.round(octaveFreq * 100) / 100,
      tier: getChainTier(c),
    };
  }

  /**
   * Parameters for 7+ chain mega-burst screen shake, particle density and haptic feedback.
   */
  function getMegaBurstParams(chain) {
    var c = Math.max(1, Number(chain) || 1);
    var isMega = c >= 7;
    var extra = Math.max(0, c - 7);
    return {
      chain: c,
      isMega: isMega,
      tier: getChainTier(c),
      shakeIntensity: isMega ? Math.min(3.2, 2.2 + extra * 0.25) : 0,
      confettiCount: isMega ? Math.min(75, 42 + extra * 8) : 0,
      burstParticleCount: isMega ? Math.min(32, 18 + extra * 3) : 0,
      subBassFreq: isMega ? 65.41 : (c >= 5 ? 130.81 : null),
      sparkleArpeggioCount: isMega ? 4 : (c >= 3 ? 1 : 0),
    };
  }

  /**
   * Pop pitch climbs with the chain number in a sparkling musical pentatonic scale
   * with harmonic overtones, bass punch and cascading mega-burst arpeggios
   * (Sakurai Stress & Release / coordinate-audio-visual-priority).
   */
  function playPop(chain) {
    if (muted) return;
    var pitch = getChainPitch(chain);
    var baseFreq = pitch.baseFreq;
    var tier = pitch.tier;

    // Fundamental bubble pulse: crisp initial transient with gentle upward chirp
    playTone(baseFreq * 0.94, 'triangle', 0.11, 0, 0.11, baseFreq);
    // Fifth harmonic overtone for bubble brightness
    playTone(baseFreq * 1.5, 'sine', 0.13, 0.02, 0.07);

    // Tier 2 (Chain >= 3): Add major 3rd harmonic chime (sparkle resolution)
    if (tier >= 2) {
      playTone(pitch.thirdFreq, 'sine', 0.16, 0.04, 0.065);
    }

    // Tier 3 (Chain >= 5): Add sub-bass resonance punch + high octave shimmer
    if (tier >= 3) {
      playTone(130.81, 'triangle', 0.18, 0, 0.13); // Deep C3 resonance punch
      playTone(pitch.octaveFreq, 'sine', 0.20, 0.07, 0.08); // High octave shimmer
    }

    // Tier 4 (Chain >= 7): SAKURAI MEGA CHAIN - Triumphant chord blast + cascading sparkle arpeggio!
    if (tier >= 4) {
      // 1. Visceral sub-bass C2 impact
      playTone(65.41, 'sine', 0.32, 0, 0.17);

      // 2. Triumphant full major chord resonance (Root + Major 3rd + Perfect 5th)
      playTone(pitch.fifthFreq, 'triangle', 0.26, 0.04, 0.095);
      playTone(pitch.thirdFreq, 'triangle', 0.24, 0.02, 0.08);

      // 3. Ascending sparkling arpeggio flourish (cascading arcade glissando)
      playTone(pitch.octaveFreq, 'sine', 0.22, 0.06, 0.085);
      playTone(pitch.fifthFreq * 2, 'sine', 0.26, 0.10, 0.075);
      playTone(baseFreq * 3, 'sine', 0.30, 0.14, 0.065);
      playTone(baseFreq * 4, 'sine', 0.34, 0.18, 0.055);
    }
  }

  function playAllClear() {
    callShared('playWin');
  }

  function playWin() {
    callShared('playWin');
  }

  function playLose() {
    callShared('playLose');
  }

  function setMuted(value) {
    muted = !!value;
  }

  function isMuted() {
    return muted;
  }

  global.PuyoAudio = {
    PENTATONIC_SEMITONES: PENTATONIC_SEMITONES,
    BASE_PITCH_C5: BASE_PITCH_C5,
    getChainTier: getChainTier,
    getChainPitch: getChainPitch,
    getMegaBurstParams: getMegaBurstParams,
    playMove: playMove,
    playRotate: playRotate,
    playLand: playLand,
    playPop: playPop,
    playAllClear: playAllClear,
    playWin: playWin,
    playLose: playLose,
    setMuted: setMuted,
    isMuted: isMuted,
  };
})(typeof window !== 'undefined' ? window : this);
