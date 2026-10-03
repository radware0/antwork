import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialData } from './domain.ts';
import { profileCareer, profileStatus } from './profile.ts';
import { dailySummary } from './ui.ts';
import { validateImport } from './storage.ts';
import type { AppData, WorkSession } from './types.ts';

type FlexibleSession = WorkSession & { campaignId: string | null; result: 'strong' | 'steady' | 'rough' | null };
type FlexibleCareer = ReturnType<typeof profileCareer> & { score: number; longestSession: { sessionId: string; minutes: number; day: string } | null; mostCampaign: { campaign: { id: string }; minutes: number } | null };

function session(id: string, start: number, minutes: number, extra: Partial<FlexibleSession> = {}): FlexibleSession {
  return {
    id, intervals: [{ start, end: start + minutes * 60_000 }], source: 'manual',
    questOccurrenceId: null, note: '', campaignId: null, result: null, ...extra,
  };
}

test('lifetime score awards one point per cumulative fifteen saved minutes', () => {
  const data = createInitialData('2026-09-25');
  const start = new Date(2026, 8, 25, 9).getTime();
  data.sessions = [session('fourteen', start, 14), session('one', start + 20 * 60_000, 1, { source: 'timer' })] as WorkSession[];
  assert.equal((profileCareer(data, start) as FlexibleCareer).score, 1);
  data.sessions.push(session('another-fourteen', start + 30 * 60_000, 14));
  assert.equal((profileCareer(data, start) as FlexibleCareer).score, 1);
  data.sessions.push(session('another-one', start + 50 * 60_000, 1));
  assert.equal((profileCareer(data, start) as FlexibleCareer).score, 2);
  data.sessions = data.sessions.filter(item => item.id !== 'another-fourteen');
  assert.equal((profileCareer(data, start) as FlexibleCareer).score, 1);
});

test('score preserves an exact fifteen-minute boundary across fragmented intervals', () => {
  const data = createInitialData('2026-09-25');
  const start = new Date(2026, 8, 25, 9).getTime();
  const durations = [21964, 87805, 91335, 14193, 48992, 91391, 544320];
  let cursor = start;
  const intervals = durations.map(duration => {
    const interval = { start: cursor, end: cursor + duration };
    cursor += duration + 1000;
    return interval;
  });
  data.sessions = [session('fragmented', start, 0, { intervals })] as WorkSession[];
  const career = profileCareer(data, start) as FlexibleCareer;
  assert.equal(career.totalMinutes, 15);
  assert.equal(career.score, 1);
});

test('career stats rank saved hours, include a saved current day, and aggregate direct campaign links', () => {
  const data = createInitialData('2026-09-25');
  data.campaigns = [
    { id: 'done', title: 'Finished build', note: 'Ship it', createdAt: 1, completedAt: 2 },
    { id: 'other', title: 'Side path', note: '', createdAt: 3, completedAt: null },
  ];
  const yesterday = new Date(2026, 8, 27, 9).getTime();
  const today = new Date(2026, 8, 28, 9).getTime();
  data.sessions = [
    session('build-a', yesterday, 60, { campaignId: 'done' }),
    session('build-b', yesterday + 2 * 60 * 60_000, 60, { campaignId: 'done', result: 'strong' }),
    session('other', today, 120, { campaignId: 'other', result: 'rough' }),
    session('free', today + 3 * 60 * 60_000, 150),
  ] as WorkSession[];
  const career = profileCareer(data, new Date(2026, 8, 28, 12).getTime()) as FlexibleCareer;
  assert.equal(career.bestDay?.day, '2026-09-28');
  assert.equal(career.bestDay?.minutes, 270);
  assert.equal(career.longestSession?.sessionId, 'free');
  assert.equal(career.longestSession?.minutes, 150);
  assert.equal(career.mostCampaign?.campaign.id, 'done');
  assert.equal(career.mostCampaign?.minutes, 120);
  assert.equal(career.score, 26);
});

test('profile status does not promote a selected campaign when no timer is active', () => {
  const data = createInitialData('2026-09-25');
  data.campaigns = [{ id: 'c', title: 'Campaign', note: '', createdAt: 1, completedAt: null }];
  const now = new Date(2026, 8, 28, 12).getTime();
  data.sessions = [session('today', now - 30 * 60_000, 30)] as WorkSession[];
  assert.deepEqual(profileStatus(data, now), { state: 'today', label: "Today's deep work", detail: '0.5h' });
  data.timer = { id: 't', mode: 'stopwatch', durationMs: null, accumulatedMs: 0, intervals: [], runningSince: now - 60_000, questOccurrenceId: null, campaignId: 'c' } as AppData['timer'];
  assert.equal(profileStatus(data, now).detail, 'Campaign');
  data.timer!.runningSince = null;
  assert.equal(profileStatus(data, now).state, 'paused');
});

test('flexible day summaries show live hours and keep rest and future days neutral', () => {
  const data = createInitialData('2026-09-25');
  const now = new Date(2026, 8, 28, 12).getTime();
  data.timer = { id: 't', mode: 'stopwatch', durationMs: null, accumulatedMs: 0, intervals: [], runningSince: now - 90 * 60_000, questOccurrenceId: null };
  assert.equal(dailySummary(data, '2026-09-28', now).minutes, 90);
  assert.equal(dailySummary(data, '2026-09-28', now).color, 'positive');
  assert.equal(dailySummary(data, '2026-09-27', now).color, 'neutral');
  assert.equal(dailySummary(data, '2026-09-29', now).color, 'neutral');
});

test('version two backups migrate quest-linked saved and active sessions to direct campaigns', () => {
  const old = createInitialData('2026-09-25') as unknown as Record<string, any>;
  old.schemaVersion = 2;
  old.setupComplete = false;
  old.profile = { ...old.profile, currentCampaignId: null };
  old.campaigns = [{ id: 'c', title: 'Build', note: '', createdAt: 1, completedAt: 2 }];
  old.quests = [{ id: 'q', title: 'Legacy quest', campaignId: 'c', stake: 5, recurrence: 'none', startDate: '2026-09-25', endDate: null, active: false }];
  old.occurrences = [{ id: 'o', questId: 'q', dueDate: '2026-09-25', completedAt: null }];
  old.sessions = [{ id: 'saved', source: 'manual', intervals: [{ start: 1000, end: 61000 }], note: 'kept', questOccurrenceId: 'o' }];
  old.timer = { id: 'active', mode: 'stopwatch', durationMs: null, accumulatedMs: 10, intervals: [{ start: 1000, end: 1010 }], runningSince: 2000, questOccurrenceId: 'o' };
  const migrated = validateImport(old) as unknown as AppData & { sessions: FlexibleSession[]; timer: NonNullable<AppData['timer']> & { campaignId: string | null } };
  assert.equal(migrated.schemaVersion, 5);
  assert.equal(migrated.setupComplete, true);
  assert.equal(migrated.sessions[0].campaignId, 'c');
  assert.equal(migrated.sessions[0].result, null);
  assert.equal(migrated.sessions[0].note, 'kept');
  assert.equal(migrated.timer?.campaignId, 'c');
  assert.equal(migrated.quests.length, 1);
  assert.deepEqual(migrated.sessions[0].intervals, [{ start: 1000, end: 61000 }]);
});

test('version one migration and version three backups preserve history and optional match results', () => {
  const base = createInitialData('2026-09-25') as unknown as Record<string, any>;
  delete base.profile;
  base.schemaVersion = 1;
  base.sessions = [{ id: 'legacy', source: 'manual', intervals: [{ start: 1000, end: 61000 }], note: '', questOccurrenceId: null }];
  const migrated = validateImport(base);
  assert.equal(migrated.schemaVersion, 5);
  assert.equal(migrated.setupComplete, true);
  assert.equal(migrated.sessions[0].id, 'legacy');
  assert.equal(migrated.profile.name, '');

  const v3 = createInitialData('2026-09-25') as unknown as AppData & { sessions: FlexibleSession[] };
  v3.campaigns.push({ id: 'c', title: 'Campaign', note: 'Description', createdAt: 1, completedAt: null });
  v3.sessions.push(session('rated', 1000, 45, { campaignId: 'c', result: 'steady' }));
  const roundTrip = validateImport(JSON.parse(JSON.stringify(v3))) as unknown as AppData & { sessions: FlexibleSession[] };
  assert.equal(roundTrip.schemaVersion, 5);
  assert.equal(roundTrip.sessions[0].campaignId, 'c');
  assert.equal(roundTrip.sessions[0].result, 'steady');
});
