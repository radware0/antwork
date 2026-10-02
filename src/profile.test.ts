import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialData } from './domain.ts';
import { profileCareer, profileStatus } from './profile.ts';

test('campaign hours include repeated quest-linked sessions and exclude free work', () => {
  const data = createInitialData('2026-09-25');
  data.campaigns = [
    { id: 'a', title: 'Ship app', note: '', createdAt: 1, completedAt: 2 },
    { id: 'b', title: 'Write book', note: '', createdAt: 3, completedAt: null },
  ];
  data.quests = [
    { id: 'qa', title: 'Build', campaignId: 'a', stake: 5, recurrence: 'daily', startDate: '2026-09-25', endDate: null, active: true },
    { id: 'qb', title: 'Draft', campaignId: 'b', stake: 5, recurrence: 'none', startDate: '2026-09-25', endDate: null, active: true },
  ];
  data.occurrences = [
    { id: 'one', questId: 'qa', dueDate: '2026-09-25', completedAt: null },
    { id: 'two', questId: 'qa', dueDate: '2026-09-26', completedAt: null },
    { id: 'three', questId: 'qb', dueDate: '2026-09-25', completedAt: null },
  ];
  const start = new Date(2026, 8, 25, 9).getTime();
  data.sessions = [
    { id: 's1', source: 'manual', questOccurrenceId: 'one', note: '', intervals: [{ start, end: start + 3600000 }] },
    { id: 's2', source: 'timer', questOccurrenceId: 'two', note: '', intervals: [{ start, end: start + 7200000 }] },
    { id: 's3', source: 'manual', questOccurrenceId: 'three', note: '', intervals: [{ start, end: start + 5400000 }] },
    { id: 'free', source: 'timer', questOccurrenceId: null, note: '', intervals: [{ start, end: start + 1800000 }] },
  ];
  const first = profileCareer(data, new Date(2026, 8, 28).getTime());
  assert.equal(first.totalMinutes, 300);
  assert.equal(first.campaignMinutes.a, 180);
  assert.equal(first.campaignMinutes.b, 90);
  assert.equal(first.mostCampaign?.campaign.id, 'a');
  data.sessions[0].intervals[0].end += 3600000;
  assert.equal(profileCareer(data, new Date(2026, 8, 28).getTime()).campaignMinutes.a, 240);
});

test('best day ranks saved hours and accepts a saved current day', () => {
  const data = createInitialData('2026-09-25');
  data.dailyTargets = { '2026-09-25': 4, '2026-09-26': 4, '2026-09-27': 4 };
  const first = new Date(2026, 8, 25, 9).getTime();
  const second = new Date(2026, 8, 26, 9).getTime();
  data.sessions = [
    { id: 'six', source: 'manual', questOccurrenceId: null, note: '', intervals: [{ start: first, end: first + 21600000 }] },
    { id: 'one', source: 'manual', questOccurrenceId: null, note: '', intervals: [{ start: second, end: second + 3600000 }] },
  ];
  const now = new Date(2026, 8, 28, 12).getTime();
  assert.equal(profileCareer(data, now).bestDay?.day, '2026-09-25');
  data.sessions.push({ id: 'today', source: 'manual', questOccurrenceId: null, note: '', intervals: [{ start: new Date(2026, 8, 28, 9).getTime(), end: new Date(2026, 8, 28, 17).getTime() }] });
  assert.equal(profileCareer(data, now).bestDay?.day, '2026-09-28');
  assert.equal(profileCareer(data, now).bestDay?.minutes, 480);
});

test('live status shows timer campaign and never surfaces a selected mission', () => {
  const data = createInitialData('2026-09-25');
  data.campaigns = [
    { id: 'a', title: 'Ship app', note: '', createdAt: 1, completedAt: null },
    { id: 'b', title: 'Write book', note: '', createdAt: 2, completedAt: null },
  ];
  data.quests = [{ id: 'qa', title: 'Build', campaignId: 'a', stake: 5, recurrence: 'none', startDate: '2026-09-25', endDate: null, active: true }];
  data.occurrences = [{ id: 'one', questId: 'qa', dueDate: '2026-09-25', completedAt: null }];
  const now = new Date(2026, 8, 28, 12).getTime();
  data.timer = { id: 't', mode: 'stopwatch', durationMs: null, accumulatedMs: 0, intervals: [], runningSince: now - 1800000, questOccurrenceId: 'one' };
  assert.deepEqual(profileStatus(data, now), { state: 'running', label: 'Locked in', detail: 'Ship app', elapsedMs: 1800000 });
  data.timer.runningSince = null;
  data.timer.accumulatedMs = 1800000;
  assert.equal(profileStatus(data, now).state, 'paused');
  data.timer = null;
  assert.equal(profileStatus(data, now).detail, '0.0h');
  assert.equal(profileStatus(data, now).state, 'today');
});
