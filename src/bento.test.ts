import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialData, dailyWorkedMinutes, sessionDurationMs, sessionDays } from './domain.ts';
import { profileCareer } from './profile.ts';
import { validateImport } from './storage.ts';
import { dailySummary } from './ui.ts';
import type { WorkSession } from './types.ts';

const duration = (minutes: number): WorkSession => ({ id: 'duration', timing: 'duration', date: '2026-09-29',
  durationMinutes: minutes, intervals: [], source: 'manual', note: '', questOccurrenceId: null, campaignId: null, result: null });

test('dated durations combine with precise midnight intervals without fabricated times', () => {
  const data = createInitialData('2026-09-28');
  const start = new Date(2026, 8, 28, 23, 50).getTime();
  data.sessions = [duration(14), { id: 'timed', timing: 'intervals', intervals: [{ start, end: start + 20 * 60000 }],
    source: 'timer', questOccurrenceId: null, note: '' }];
  assert.equal(dailyWorkedMinutes(data.sessions, '2026-09-28'), 10);
  assert.equal(dailyWorkedMinutes(data.sessions, '2026-09-29'), 24);
  assert.equal(profileCareer(data, start + 86400000).score, 2);
  data.sessions[0].durationMinutes = 9;
  assert.equal(profileCareer(data, start + 86400000).score, 1);
  data.sessions.pop();
  assert.equal(profileCareer(data, start + 86400000).score, 0);
  assert.deepEqual(sessionDays(duration(1440)), { '2026-09-29': 1440 });
});

test('duration entries participate in campaign stats, best day, longest session and cumulative Score', () => {
  const data = createInitialData('2026-09-29');
  data.campaigns = [{ id: 'c', title: 'Build', note: 'App', createdAt: 1, completedAt: 2 }];
  data.sessions = [{ ...duration(14), campaignId: 'c' }, { ...duration(1), id: 'one', campaignId: 'c' }];
  const now = new Date(2026, 8, 29, 12).getTime();
  const career = profileCareer(data, now);
  assert.equal(career.score, 1);
  assert.equal(career.bestDay?.minutes, 15);
  assert.equal(career.longestSession?.minutes, 14);
  assert.equal(career.mostCampaign?.minutes, 15);
  assert.equal(sessionDurationMs(duration(1)), 60000);
  data.sessions[0].result = 'rough';
  assert.equal(profileCareer(data, now).score, 1);
});

test('version four round-trips durations, username, images and precise sessions', () => {
  const data = createInitialData('2026-09-29');
  data.profile.username = ' @Night_Ant ';
  data.profile.avatar = 'data:image/webp;base64,' + Buffer.from('RIFF0000WEBP').toString('base64');
  data.sessions = [duration(60), { id: 'precise', source: 'timer', timing: 'intervals',
    intervals: [{ start: 1000.25, end: 61000.75 }], note: 'Keep precision', questOccurrenceId: null }];
  const parsed = validateImport(data);
  assert.equal(parsed.profile.username, 'night_ant');
  assert.equal(parsed.sessions[1].intervals[0].start, 1000.25);
  assert.deepEqual(validateImport(JSON.parse(JSON.stringify(parsed))), parsed);
  for (const invalid of [0, -1, 0.5, 1441, NaN]) assert.throws(() => validateImport({ ...data, sessions: [duration(invalid)] }));
  for (const invalid of ['ab', 'a-b', 'two words', 'a'.repeat(25)]) assert.throws(() => validateImport({ ...data, profile: { ...data.profile, username: invalid } }));
  assert.throws(() => validateImport({ ...data, sessions: [{ ...duration(5), intervals: [{ start: 1, end: 2 }] }] }));
  assert.throws(() => validateImport({ ...data, sessions: [{ ...duration(5), date: '2026-02-30' }] }));
});

test('versions one through three preserve old history and acquire empty local handles', () => {
  const original = { id: 'legacy', intervals: [{ start: 1000.25, end: 900999.75 }], source: 'manual', questOccurrenceId: null, note: 'kept' };
  for (const schemaVersion of [1, 2, 3]) {
    const base = createInitialData('2026-09-29');
    const migrated = validateImport({ ...base, schemaVersion, profile: { ...base.profile, currentCampaignId: null }, sessions: [original] });
    assert.equal(migrated.schemaVersion, 7);
    assert.equal(migrated.profile.username, '');
    assert.equal(migrated.sessions[0].timing, 'intervals');
    assert.deepEqual(migrated.sessions[0].intervals, original.intervals);
    assert.deepEqual(validateImport(JSON.parse(JSON.stringify(migrated))), migrated);
  }
});

test('live time crosses midnight while a dated duration remains on its chosen day', () => {
  const data = createInitialData('2026-09-29');
  data.sessions = [duration(30)];
  const start = new Date(2026, 8, 29, 23, 50).getTime();
  const now = start + 20 * 60000;
  data.timer = { id: 'live', mode: 'stopwatch', durationMs: null, accumulatedMs: 0, intervals: [], runningSince: start, questOccurrenceId: null };
  assert.equal(dailySummary(data, '2026-09-29', now).minutes, 40);
  assert.equal(dailySummary(data, '2026-09-30', now).minutes, 10);
  assert.equal(profileCareer(data, now).score, 2);
});
