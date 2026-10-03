import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { playInterfaceSound, playTimerAlarm } from './sound.ts';

type Tone = { frequency: number; waveform: string; start: number; stop: number; ramps: { value: number; at: number }[] };
const tones: Tone[] = [];
let context: TestAudioContext;
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');

// Web Audio is unavailable in Node; record the graph scheduled by real sound code.
class TestAudioContext {
  state = 'running'; currentTime = 0; destination = {};
  constructor() { context = this; }
  resume() { this.state = 'running'; return Promise.resolve(); }
  createOscillator() {
    const tone: Tone = { frequency: 0, waveform: '', start: 0, stop: 0, ramps: [] };
    tones.push(tone);
    const oscillator = {
      type: 'sine',
      frequency: { setValueAtTime(value: number) { tone.frequency = value; } },
      connect(node: { connect: (value: unknown) => unknown }) { return node; },
      start(at: number) { tone.start = at; tone.waveform = oscillator.type; },
      stop(at: number) { tone.stop = at; },
    };
    return oscillator;
  }
  createGain() {
    const tone = tones.at(-1)!;
    return {
      gain: {
        setValueAtTime(value: number, at: number) { tone.ramps.push({ value, at }); },
        exponentialRampToValueAtTime(value: number, at: number) { tone.ramps.push({ value, at }); },
      },
      connect(node: unknown) { return node; },
    };
  }
}

Object.defineProperty(globalThis, 'window', { configurable: true, value: { AudioContext: TestAudioContext } });
beforeEach(() => { tones.length = 0; if (context) context.state = 'running'; });
after(() => { if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow); else Reflect.deleteProperty(globalThis, 'window'); });

test('interface clicks schedule a louder short sine tone without lengthening the envelope', () => {
  playInterfaceSound(true, true);
  assert.deepEqual(tones, [{ frequency: 520, waveform: 'sine', start: 0, stop: 0.065,
    ramps: [{ value: 0.0001, at: 0 }, { value: 0.072, at: 0.008 }, { value: 0.0001, at: 0.045 }] }]);
});

test('countdown alarms retain two short notes at the louder output levels', () => {
  playTimerAlarm(true);
  assert.deepEqual(tones, [
    { frequency: 660, waveform: 'sine', start: 0, stop: 0.18,
      ramps: [{ value: 0.0001, at: 0 }, { value: 0.18, at: 0.008 }, { value: 0.0001, at: 0.16 }] },
    { frequency: 880, waveform: 'sine', start: 0.12, stop: 0.34,
      ramps: [{ value: 0.0001, at: 0.12 }, { value: 0.14, at: 0.128 }, { value: 0.0001, at: 0.32 }] },
  ]);
});

test('muted clicks and alarms create no audio nodes even for an explicit click preview', () => {
  playInterfaceSound(false, true);
  playTimerAlarm(false);
  assert.deepEqual(tones, []);
});

test('rapid interface clicks are dropped rather than scheduled for later', t => {
  let now = 1000;
  t.mock.method(performance, 'now', () => now);
  playInterfaceSound(true);
  now = 1099; playInterfaceSound(true);
  now = 1100; playInterfaceSound(true);
  assert.equal(tones.length, 2);
  assert.ok(tones.every(tone => tone.ramps[1].value === 0.072));
});

test('a suspended audio context resumes before playing a countdown alarm', async () => {
  context.state = 'suspended';
  playTimerAlarm(true);
  assert.equal(tones.length, 0);
  await Promise.resolve();
  assert.equal(context.state, 'running');
  assert.equal(tones.length, 2);
});
