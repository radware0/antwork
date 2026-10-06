import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialData, settleCountdown, timerElapsedMs } from './domain.ts';
import { pauseDesktopTimer, saveDesktopPause } from './desktop.ts';
import type { DesktopBridge } from './desktop.ts';
import type { LedgerRepository } from './storage.ts';
import type { AppData } from './types.ts';

function runningData(): AppData {
  const data = createInitialData('2026-10-06');
  data.timer = { id: 'desktop-timer', mode: 'stopwatch', durationMs: null, accumulatedMs: 500, intervals: [{ start: 100, end: 600 }], runningSince: 1000, questOccurrenceId: null };
  data.journals = [{ date: '2026-10-06', text: 'Keep my history.', updatedAt: 1000 }];
  return data;
}

test('desktop pause excludes sleep and closure time while preserving history', () => {
  const original = runningData();
  const paused = pauseDesktopTimer(original, 4000);
  assert.equal(paused.timer!.runningSince, null);
  assert.equal(timerElapsedMs(paused.timer!, 100000), 3500);
  assert.deepEqual(paused.timer!.intervals, [{ start: 100, end: 600 }, { start: 1000, end: 4000 }]);
  assert.deepEqual(paused.journals, original.journals);
  assert.equal(original.timer!.runningSince, 1000);
  assert.equal(pauseDesktopTimer(paused, 100000), paused);
});

test('a countdown cannot finish from time spent asleep', () => {
  const data = runningData();
  data.timer = { ...data.timer!, mode: 'countdown', durationMs: 60000 };
  const paused = pauseDesktopTimer(data, 4000);
  assert.equal(settleCountdown(paused.timer!, 1000000), null);
});

test('missing checkpoint and backwards clocks cannot create invalid work intervals', () => {
  const paused = pauseDesktopTimer(runningData(), 0);
  assert.equal(paused.timer!.accumulatedMs, 500);
  assert.deepEqual(paused.timer!.intervals.at(-1), { start: 1000, end: 1000 });
  assert.throws(() => pauseDesktopTimer(runningData(), NaN), /Invalid desktop pause/);
});

test('desktop close is acknowledged only after a committed data write', async () => {
  const steps: string[] = [];
  let data = runningData();
  const store: LedgerRepository = {
    load: async () => data,
    replace: async value => value,
    update: async change => { data = change(data); await Promise.resolve(); steps.push('committed'); return data; },
  };
  const bridge: DesktopBridge = {
    openDocumentation: () => {},
    openTimer: () => {},
    controlWindow: () => {}, isWindowMaximized: async () => false, onMaximizedChanged: () => () => {},
    getPendingPause: async () => ({ id: 'close-request', at: 4000, reason: 'close' }),
    acknowledgePause: async id => { assert.equal(id, 'close-request'); steps.push('acknowledged'); return true; },
    reportTimer: () => {}, onPauseRequested: () => () => {}, onTimerDue: () => () => {},
    isWindowVisible: async () => true, onVisibilityChanged: () => () => {},
  };
  await saveDesktopPause(store, bridge);
  assert.deepEqual(steps, ['committed', 'acknowledged']);
  assert.equal(data.timer!.runningSince, null);
  store.update = async () => { throw new Error('Disk full'); };
  steps.length = 0;
  await assert.rejects(saveDesktopPause(store, bridge), /Disk full/);
  assert.deepEqual(steps, [], 'failed writes cannot acknowledge a close request');
});
