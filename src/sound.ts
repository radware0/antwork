import type { SoundPreferences } from './types.ts';

export function toggleSoundPreferences(current: SoundPreferences): SoundPreferences {
  const enabled = !(current.interfaceSounds || current.timerAlarm);
  return { interfaceSounds: enabled, timerAlarm: enabled };
}

export function createSoundGate(windowMs: number) {
  let lastPlayed = Number.NEGATIVE_INFINITY;
  return (at: number) => {
    if (at - lastPlayed < windowMs) return false;
    lastPlayed = at;
    return true;
  };
}

let audioContext: AudioContext | null = null;
const allowInterfaceSound = createSoundGate(100);

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  audioContext ??= new AudioContextClass();
  return audioContext;
}

function withRunningContext(play: (context: AudioContext) => void) {
  const context = getContext();
  if (!context) return;
  if (context.state === 'running') { play(context); return; }
  void context.resume().then(() => { if (context.state === 'running') play(context); }).catch(() => {});
}

function tone(context: AudioContext, frequency: number, duration: number, gainValue: number, offset = 0) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const start = context.currentTime + offset;
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

export function primeAudio(enabled: boolean) {
  if (!enabled) return;
  const context = getContext();
  if (context?.state === 'suspended') void context.resume().catch(() => {});
}

export function playInterfaceSound(enabled: boolean, force = false) {
  const at = typeof performance === 'undefined' ? Date.now() : performance.now();
  if (!enabled || (!force && !allowInterfaceSound(at))) return;
  withRunningContext(context => tone(context, 520, 0.045, 0.072));
}

export function playTimerAlarm(enabled: boolean) {
  if (!enabled) return;
  withRunningContext(context => {
    tone(context, 660, 0.16, 0.18);
    tone(context, 880, 0.2, 0.14, 0.12);
  });
}
