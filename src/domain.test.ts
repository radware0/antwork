import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  splitMinutesByDay,
  dailyHourDelta,
  questPointsForDate,
  generateOccurrences,
  settleCountdown,
  freezePastTargets,
  createInitialData,
} from './domain.ts';
import type { Quest, QuestOccurrence, WorkSession, ActiveTimer } from './types.ts';

describe('work history', () => {
  it('splits a session across local midnight', () => {
    const start = new Date(2026, 8, 26, 23, 30).getTime();
    const end = new Date(2026, 8, 27, 0, 30).getTime();
    assert.deepEqual(splitMinutesByDay([{ start, end }]),{
      '2026-09-26': 30,
      '2026-09-27': 30,
    });
  });

  it('compares only recorded minutes against a frozen target', () => {
    const day = '2026-09-26';
    const start = new Date(2026, 8, 26, 9, 0).getTime();
    const sessions: WorkSession[] = [{ id: 's1', intervals: [{ start, end: start + 4 * 3600000 }], source: 'manual', questOccurrenceId: null, note: '' }];
    assert.equal(dailyHourDelta(sessions, day, 6), -2);
    assert.equal(dailyHourDelta(sessions, day, 0), 4);
  });
});

describe('quest ledger', () => {
  it('posts one due-day loss and one late completion gain', () => {
    const occurrences: QuestOccurrence[] = [{ id: 'q1:2026-09-24', questId: 'q1', dueDate: '2026-09-24', completedAt: new Date(2026, 8, 26, 11).getTime() }];
    const stakes = { q1: 10 };
    assert.equal(questPointsForDate(occurrences, stakes, '2026-09-24', '2026-09-27'), -10);
    assert.equal(questPointsForDate(occurrences, stakes, '2026-09-26', '2026-09-27'), 10);
  });

  it('generates separate daily and weekly occurrences without duplicates', () => {
    const quests: Quest[] = [
      { id: 'd', title: 'Write', campaignId: null, stake: 5, recurrence: 'daily', startDate: '2026-09-25', endDate: null, active: true },
      { id: 'w', title: 'Review', campaignId: null, stake: 10, recurrence: 'weekly', startDate: '2026-09-25', endDate: null, active: true },
    ];
    const once = generateOccurrences(quests, [], '2026-09-25', '2026-10-02');
    assert.equal(once.filter(item => item.questId === 'd').length, 8);
    assert.equal(once.filter(item => item.questId === 'w').length, 2);
    assert.equal(generateOccurrences(quests, once, '2026-09-25', '2026-10-02').length, 10);
  });
});

describe('timer recovery', () => {
  it('ends a countdown at its deadline after a missed browser tick', () => {
    const start = new Date(2026, 8, 26, 9).getTime();
    const timer: ActiveTimer = { id: 't', mode: 'countdown', durationMs: 25 * 60000, accumulatedMs: 0, intervals: [], runningSince: start, questOccurrenceId: null };
    const result = settleCountdown(timer, start + 40 * 60000);
    assert.deepEqual(result?.intervals, [{ start, end: start + 25 * 60000 }]);
  });
});

describe('historical corrections', () => {
  it('preserves yesterday’s target when the weekly schedule changes', () => {
    const data = createInitialData('2026-09-25');
    data.weeklyTargets = [0, 6, 6, 6, 6, 6, 0];
    const frozen = freezePastTargets(data, '2026-09-27');
    assert.equal(frozen.dailyTargets['2026-09-25'], 6);
    assert.equal(frozen.dailyTargets['2026-09-26'], 0);
  });
});
