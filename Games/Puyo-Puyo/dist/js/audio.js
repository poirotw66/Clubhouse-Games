/**
 * WebAudio blips, mirroring shared/synthAudio.ts so this game sounds like the rest of the suite.
 * Plain script (no bundler) — exposed as window.PuyoAudio.
 */
(function (global) {
  'use strict';

  var AudioContextCtor = global.AudioContext || global.webkitAudioContext;
  var context = null;
  var muted = false;

  function getContext() {
    if (!AudioContextCtor) return null;
    if (!context) context = new AudioContextCtor();
    if (context.state === 'suspended') context.resume();
    return context;
  }

  function playTone(frequency, type, duration, delay, volume) {
    if (muted) return;
    var ctx = getContext();
    if (!ctx) return;

    var oscillator = ctx.createOscillator();
    var gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    oscillator.connect(gain);
    gain.connect(ctx.destination);

    var start = ctx.currentTime + (delay || 0);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  }

  /** Soft tap when the pair shifts sideways. */
  function playMove() {
    playTone(440, 'sine', 0.05, 0, 0.05);
  }

  function playRotate() {
    playTone(560, 'triangle', 0.05, 0, 0.05);
    playTone(700, 'sine', 0.04, 0.03, 0.035);
  }

  function playLand() {
    playTone(220, 'triangle', 0.07, 0, 0.06);
    playTone(160, 'sine', 0.09, 0.02, 0.05);
  }

  /** Pop pitch climbs with the chain number, the way the arcade games do it. */
  function playPop(chain) {
    var step = Math.min(chain - 1, 11);
    var base = 523.25 * Math.pow(2, step / 12);
    playTone(base, 'triangle', 0.1, 0, 0.09);
    playTone(base * 1.5, 'sine', 0.13, 0.05, 0.07);
  }

  function playAllClear() {
    playTone(523.25, 'triangle', 0.35, 0, 0.1);
    playTone(659.25, 'triangle', 0.35, 0.1, 0.09);
    playTone(783.99, 'triangle', 0.35, 0.2, 0.08);
    playTone(1046.5, 'triangle', 0.55, 0.3, 0.07);
  }

  function playLose() {
    playTone(220, 'sawtooth', 0.25, 0, 0.06);
    playTone(165, 'sawtooth', 0.35, 0.12, 0.05);
  }

  function setMuted(value) {
    muted = !!value;
  }

  function isMuted() {
    return muted;
  }

  global.PuyoAudio = {
    playMove: playMove,
    playRotate: playRotate,
    playLand: playLand,
    playPop: playPop,
    playAllClear: playAllClear,
    playLose: playLose,
    setMuted: setMuted,
    isMuted: isMuted,
  };
})(window);
