// Simple synth for game sound effects without external assets
const AudioContext = (window.AudioContext || (window as any).webkitAudioContext);
let ctx: AudioContext | null = null;

const SOUND_STORAGE_KEY = 'mls_sound_enabled';

export function getSoundEnabled(): boolean {
  const stored = localStorage.getItem(SOUND_STORAGE_KEY);
  if (stored === 'false') return false;
  return true;
}

export function setSoundEnabled(enabled: boolean): void {
  localStorage.setItem(SOUND_STORAGE_KEY, enabled ? 'true' : 'false');
}

const getCtx = () => {
  if (!ctx) {
    ctx = new AudioContext();
  }
  return ctx;
};

// Helper to create an oscillator node
const playTone = (freq: number, type: OscillatorType, duration: number, delay: number = 0, volume: number = 0.1) => {
  if (!getSoundEnabled()) return;
  const context = getCtx();
  if (context.state === 'suspended') context.resume();

  const osc = context.createOscillator();
  const gain = context.createGain();

  osc.type = type;
  osc.frequency.value = freq;

  osc.connect(gain);
  gain.connect(context.destination);

  const now = context.currentTime + delay;
  
  // Envelope
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc.start(now);
  osc.stop(now + duration + 0.1);
};

export const sounds = {
  pop: () => {
    // A cute "bloop" sound
    playTone(600, 'sine', 0.1, 0, 0.1);
    playTone(800, 'sine', 0.1, 0.05, 0.05);
  },
  pour: () => {
    if (!getSoundEnabled()) return;
    // Simulate liquid noise with white noise (approximated by rapid random freq) or sliding sine
    const context = getCtx();
    if (context.state === 'suspended') context.resume();
    
    const osc = context.createOscillator();
    const gain = context.createGain();
    
    osc.frequency.setValueAtTime(400, context.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, context.currentTime + 0.4);
    
    gain.gain.setValueAtTime(0.05, context.currentTime);
    gain.gain.linearRampToValueAtTime(0, context.currentTime + 0.4);
    
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start();
    osc.stop(context.currentTime + 0.4);
  },
  win: () => {
    // Major chord arpeggio
    const vol = 0.1;
    playTone(523.25, 'triangle', 0.4, 0, vol);   // C5
    playTone(659.25, 'triangle', 0.4, 0.1, vol); // E5
    playTone(783.99, 'triangle', 0.4, 0.2, vol); // G5
    playTone(1046.50, 'triangle', 0.8, 0.3, vol); // C6
  },
  error: () => {
    playTone(150, 'sawtooth', 0.2, 0, 0.05);
  },
  magic: () => {
    // Sparkle sound for reveal/shuffle
    const vol = 0.05;
    for(let i=0; i<5; i++) {
        playTone(1000 + (i*200), 'sine', 0.1, i*0.05, vol);
    }
  }
};