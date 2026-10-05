import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialData, setDayRating } from './domain.ts';
import { calendarSummary } from './ui.ts';
import { validateImport } from './storage.ts';
import type { DayQuality, WorkSession } from './types.ts';

const day = '2026-10-05';
const now = new Date(2026, 9, 5, 18).getTime();
const session = (minutes: number): WorkSession => ({ id: 'work', timing: 'duration', date: day,
  durationMinutes: minutes, intervals: [], source: 'manual', questOccurrenceId: null, note: 'Keep this', result: 'rough' });

test('whole-day ratings do not depend on work, sessions, or journals', () => {
  let data = createInitialData(day);
  assert.equal(calendarSummary(data, day, now).ratingLabel, 'Unrated');
  data = setDayRating(data, day, 'good', now);
  assert.equal(calendarSummary(data, day, now).color, 'quality-good');
  assert.equal(calendarSummary(data, day, now).minutes, 0);
  data.sessions = [session(360)];
  data.journals = [{ date: day, text: 'A good day outside work', updatedAt: now }];
  for (const rating of ['good', 'steady', 'rough'] as DayQuality[]) {
    data = setDayRating(data, day, rating, now);
    assert.equal(calendarSummary(data, day, now).color, 'quality-' + rating);
    assert.equal(calendarSummary(data, day, now).minutes, 360);
  }
  data = setDayRating(data, '2026-10-01', 'good', now);
  const cleared = setDayRating(data, day, null, now);
  assert.equal(calendarSummary(cleared, day, now).color, 'neutral');
  assert.equal(cleared.dailyRatings['2026-10-01'], 'good');
  assert.deepEqual(cleared.sessions, data.sessions);
  assert.deepEqual(cleared.journals, data.journals);
  assert.equal(data.dailyRatings[day], 'rough', 'changes are immutable');
});

test('hours mode uses exact boundaries and preserves the independent rating', () => {
  const data = setDayRating(createInitialData(day), day, 'rough', now);
  data.calendarMode = 'hours';
  for (const [minutes, color] of [[0, 'neutral'], [1, 'hours-light'], [119, 'hours-light'], [120, 'hours-medium'], [239, 'hours-medium'], [240, 'hours-dark'], [480, 'hours-dark']] as const) {
    data.sessions = minutes ? [session(minutes)] : [];
    assert.equal(calendarSummary(data, day, now).color, color, String(minutes));
  }
  data.calendarMode = 'quality';
  assert.equal(calendarSummary(data, day, now).color, 'quality-rough');
});

test('live timer crosses hours thresholds without affecting quality', () => {
  const data = createInitialData(day);
  data.timer = { id: 'live', mode: 'stopwatch', durationMs: null, accumulatedMs: 0, intervals: [], runningSince: now - 120 * 60000, questOccurrenceId: null };
  assert.equal(calendarSummary(data, day, now).color, 'neutral');
  data.calendarMode = 'hours';
  assert.equal(calendarSummary(data, day, now - 1).color, 'hours-light');
  assert.equal(calendarSummary(data, day, now).color, 'hours-medium');
});

test('future dates cannot be rated and remain neutral even with imported data', () => {
  const data = createInitialData(day);
  const future = '2026-10-06';
  assert.throws(() => setDayRating(data, future, 'good', now), /Future days/);
  data.dailyRatings[future] = 'good';
  data.sessions = [{ ...session(240), date: future }];
  for (const mode of ['quality', 'hours'] as const) {
    data.calendarMode = mode;
    const summary = calendarSummary(data, future, now);
    assert.equal(summary.future, true);
    assert.equal(summary.color, 'neutral');
    assert.equal(summary.rating, null);
  }
});

test('old backups default to unrated quality mode without altering history', () => {
  for (const schemaVersion of [1, 2, 3, 4, 5]) {
    const { dailyRatings: _ratings, calendarMode: _mode, ...original } = createInitialData(day);
    const work = { id: 'old', intervals: [{ start: now - 60000, end: now }], source: 'manual', questOccurrenceId: null, note: 'Original' };
    const journal = { date: day, text: 'Original journal', updatedAt: now };
    const data = validateImport({ ...original, schemaVersion, profile: { ...original.profile, currentCampaignId: null }, sessions: [work], journals: [journal] });
    assert.deepEqual(data.dailyRatings, {});
    assert.equal(data.calendarMode, 'quality');
    assert.deepEqual(data.sessions[0].intervals, work.intervals);
    assert.equal(data.sessions[0].note, work.note);
    assert.deepEqual(data.journals, [journal]);
  }
});

test('backup round trips preserve ratings and mode, and reject invalid entries', () => {
  const data = setDayRating(createInitialData(day), day, 'steady', now);
  data.calendarMode = 'hours';
  data.sessions = [session(120)];
  const parsed = validateImport(JSON.parse(JSON.stringify(data)));
  assert.deepEqual(parsed.dailyRatings, data.dailyRatings);
  assert.equal(parsed.calendarMode, 'hours');
  assert.equal(parsed.sessions[0].result, 'rough');
  assert.throws(() => validateImport({ ...data, dailyRatings: { [day]: 'strong' } }));
  assert.throws(() => validateImport({ ...data, dailyRatings: { '2026-02-30': 'good' } }));
  assert.throws(() => validateImport({ ...data, calendarMode: 'unknown' }));
});
