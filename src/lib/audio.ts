// Simple synthesized sound effects using the Web Audio API

let audioCtx: AudioContext | null = null;

const getAudioContext = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
};

let isMuted = false;

export const setMuted = (muted: boolean) => { isMuted = muted; };
export const getMuted = () => isMuted;

const playTone = (frequency: number, type: OscillatorType, duration: number, vol = 0.1) => {
  if (isMuted) return;
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

    gainNode.gain.setValueAtTime(vol, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start();
    oscillator.stop(ctx.currentTime + duration);
  } catch (e) {
    console.error("Audio error", e);
  }
};

export const playSelectSound = () => playTone(600, 'sine', 0.1, 0.05);

export const playConfirmSound = () => {
    playTone(400, 'square', 0.1, 0.05);
    setTimeout(() => playTone(800, 'square', 0.15, 0.05), 100);
};

export const playWinSound = () => {
    playTone(523.25, 'triangle', 0.1, 0.1); // C5
    setTimeout(() => playTone(659.25, 'triangle', 0.1, 0.1), 100); // E5
    setTimeout(() => playTone(783.99, 'triangle', 0.1, 0.1), 200); // G5
    setTimeout(() => playTone(1046.50, 'triangle', 0.4, 0.1), 300); // C6
};

export const playLoseSound = () => {
    playTone(300, 'sawtooth', 0.2, 0.1);
    setTimeout(() => playTone(250, 'sawtooth', 0.2, 0.1), 200);
    setTimeout(() => playTone(200, 'sawtooth', 0.5, 0.1), 400); // Low
};

export const playTossSound = () => {
    playTone(800, 'sine', 0.05, 0.05);
    setTimeout(() => playTone(900, 'sine', 0.05, 0.05), 50);
};

export const initAudio = () => {
    getAudioContext();
};
