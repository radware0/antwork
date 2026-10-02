import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialData } from './domain.ts';

test('chart series includes zero days and provisional time split across midnight', async () => {
  const { workHoursSeries } = await import('./chartData.ts').catch(() => ({} as { workHoursSeries?: (...args: any[]) => unknown }));
  assert.equal(typeof workHoursSeries, 'function');
  const now = new Date(2026, 8, 30, 0, 15).getTime();
  const data = createInitialData('2026-09-24');
  data.sessions.push({ id: 'saved', source: 'manual', timing: 'duration', date: '2026-09-29', durationMinutes: 60, intervals: [], questOccurrenceId: null, campaignId: null, result: null, note: '' });
  data.timer = { id: 'live', mode: 'stopwatch', durationMs: null, accumulatedMs: 0, intervals: [], runningSince: new Date(2026, 8, 29, 23, 30).getTime(), questOccurrenceId: null, campaignId: null };
  const series = workHoursSeries!(data, now, 7) as { day: string; minutes: number }[];
  assert.equal(series.length, 7);
  assert.deepEqual(series.slice(-3), [
    { day: '2026-09-28', minutes: 0 },
    { day: '2026-09-29', minutes: 90 },
    { day: '2026-09-30', minutes: 15 },
  ]);
  assert.equal((workHoursSeries!(data, now, 30) as unknown[]).length, 30);
});
