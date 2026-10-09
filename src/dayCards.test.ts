import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialData, dailyWorkedMinutes } from './domain.ts';
import { assertBackupWriteSize, MAX_BACKUP_IMPORT_BYTES, serializeBackup, validateImport } from './storage.ts';
import { assertDayVideoDuration, assertDayVideoFile, dayCardBackgroundForDate, MAX_DAY_VIDEO_BYTES, removeDayCardBackground, validDayVideoData } from './dayCardMedia.ts';
import type { DayCardBackground, DayCardPreferences } from './types.ts';

const date = '2026-10-07';
const webp = 'data:image/webp;base64,UklGRgAAAABXRUJQVlA4';
const webm = 'data:video/webm;base64,GkXfo4EAAAE=';
const picture: DayCardBackground = { kind: 'image', data: webp };
const video: DayCardBackground = { kind: 'video', data: webm, durationSeconds: 30 };

test('cards aggregate only saved work with precise midnight and dated entries', () => {
  const data = createInitialData(date);
  const midnight = new Date(2026, 9, 7, 0).getTime();
  data.sessions = [
    { id: 'split', intervals: [{ start: midnight - 30 * 60000, end: midnight + 45 * 60000 }], source: 'timer', note: '', questOccurrenceId: null },
    { id: 'dated', timing: 'duration', intervals: [], date, durationMinutes: 60, source: 'manual', note: '', questOccurrenceId: null },
  ];
  data.timer = { id: 'running', mode: 'stopwatch', durationMs: null, accumulatedMs: 0, intervals: [], runningSince: midnight, questOccurrenceId: null };
  assert.equal(dailyWorkedMinutes(data.sessions, date), 105);
  assert.equal(dailyWorkedMinutes(data.sessions, '2026-10-06'), 30);
  assert.equal(dailyWorkedMinutes(data.sessions, '2026-10-08'), 0);
});

test('all prior schemas retain history and v6 preserves every per-date background until replacement', () => {
  const base = createInitialData(date);
  base.journals = [{ date, text: 'Keep this', updatedAt: 1 }];
  for (const schemaVersion of [1, 2, 3, 4, 5]) {
    const restored = validateImport({ ...base, schemaVersion, profile: { ...base.profile, currentCampaignId: null } });
    assert.equal(restored.schemaVersion, 7);
    assert.deepEqual(restored.dayCardBackgrounds, {});
    assert.deepEqual(restored.dayCardPreferences, { backgrounds: [null, null], selectedIndex: null });
    assert.deepEqual(restored.journals, base.journals);
  }
  base.dayCardBackgrounds = { [date]: picture, '2026-10-06': video, '2026-10-05': picture };
  const legacy = validateImport({ ...base, schemaVersion: 6 });
  assert.deepEqual(legacy.dayCardBackgrounds, base.dayCardBackgrounds);
  assert.deepEqual(legacy.dayCardPreferences, { backgrounds: [null, null], selectedIndex: null });
  assert.equal(dayCardBackgroundForDate(legacy, date)?.kind, 'image');
  assert.equal(dayCardBackgroundForDate(legacy, '2026-10-06')?.kind, 'video');
  assert.deepEqual(legacy.journals, base.journals);
  assert.deepEqual(validateImport(JSON.parse(serializeBackup(base))).dayCardBackgrounds, base.dayCardBackgrounds);
  for (const background of [
    { kind: 'image', data: 'https://example.com/image.webp' },
    { kind: 'video', data: webm, durationSeconds: 30.001 },
    { kind: 'video', data: webm, durationSeconds: 0 },
    { kind: 'video', data: 'data:video/webm;base64,Y29ycnVwdA==', durationSeconds: 1 },
  ]) assert.throws(() => validateImport({ ...base, dayCardBackgrounds: { [date]: background } }), /Invalid backup/);
  assert.throws(() => validateImport({ ...base, dayCardBackgrounds: { '2026-02-30': base.dayCardBackgrounds[date] } }), /Invalid backup/);
});

test('zero, one, and two shared choices round trip and use the same selection on every date', () => {
  const base = createInitialData(date);
  for (const preferences of [
    { backgrounds: [null, null], selectedIndex: null },
    { backgrounds: [picture, null], selectedIndex: 0 },
    { backgrounds: [null, video], selectedIndex: 1 },
    { backgrounds: [picture, video], selectedIndex: 0 },
    { backgrounds: [picture, video], selectedIndex: 1 },
    { backgrounds: [picture, video], selectedIndex: null },
  ] satisfies DayCardPreferences[]) {
    const restored = validateImport(JSON.parse(serializeBackup({ ...base, dayCardPreferences: preferences })));
    assert.deepEqual(restored.dayCardPreferences, preferences);
    const selected = preferences.selectedIndex === null ? null : preferences.backgrounds[preferences.selectedIndex];
    for (const day of [date, '2026-10-06', '2026-10-05']) assert.deepEqual(dayCardBackgroundForDate(restored, day), selected);
    assert.deepEqual(restored.dayCardBackgrounds, {});
  }
});

test('shared preferences reject a third slot, missing or corrupt media, and invalid selections', () => {
  const base = createInitialData(date);
  for (const preferences of [
    { backgrounds: [picture, video, picture], selectedIndex: 0 },
    { backgrounds: [], selectedIndex: null },
    { backgrounds: [picture], selectedIndex: 0 },
    { backgrounds: [null, null], selectedIndex: 0 },
    { backgrounds: [picture, null], selectedIndex: 1 },
    { backgrounds: [picture, video], selectedIndex: 2 },
    { backgrounds: [picture, video], selectedIndex: 0.5 },
    { backgrounds: [picture, { kind: 'image', data: 'https://example.com/image.webp' }], selectedIndex: 0 },
    { backgrounds: [picture, { ...video, durationSeconds: 31 }], selectedIndex: 0 },
  ]) assert.throws(() => validateImport({ ...base, dayCardPreferences: preferences }), /Invalid backup/);
  assert.throws(() => validateImport({ ...base, dayCardPreferences: undefined }), /Invalid backup/);
  assert.throws(() => validateImport({ ...base, dayCardBackgrounds: { [date]: picture }, dayCardPreferences: { backgrounds: [picture, null], selectedIndex: 0 } }), /Invalid backup/);
});

test('removing a shared background preserves the other slot and chooses it only when needed', () => {
  const preferences: DayCardPreferences = { backgrounds: [picture, video], selectedIndex: 0 };
  const withoutSelected = removeDayCardBackground(preferences, 0);
  assert.deepEqual(withoutSelected, { backgrounds: [null, video], selectedIndex: 1 });
  assert.deepEqual(removeDayCardBackground(withoutSelected, 1), { backgrounds: [null, null], selectedIndex: null });
  assert.deepEqual(removeDayCardBackground(preferences, 1), { backgrounds: [picture, null], selectedIndex: 0 });
  assert.deepEqual(removeDayCardBackground({ ...preferences, selectedIndex: 1 }, 1), { backgrounds: [picture, null], selectedIndex: 0 });
  assert.equal(removeDayCardBackground({ ...preferences, selectedIndex: null }, 0).selectedIndex, null);
  assert.deepEqual(preferences, { backgrounds: [picture, video], selectedIndex: 0 });
});

test('short video boundaries reject corrupt types, byte counts, durations, and payloads', () => {
  assert.doesNotThrow(() => assertDayVideoFile({ type: 'video/mp4', size: MAX_DAY_VIDEO_BYTES }));
  assert.doesNotThrow(() => assertDayVideoDuration(30));
  for (const size of [0, -1, Number.NaN, MAX_DAY_VIDEO_BYTES + 1]) assert.throws(() => assertDayVideoFile({ type: 'video/webm', size }));
  assert.throws(() => assertDayVideoFile({ type: 'video/quicktime', size: 100 }));
  for (const duration of [0, -1, 30.01, Infinity, NaN]) assert.throws(() => assertDayVideoDuration(duration));
  assert.equal(validDayVideoData(webm), true);
  assert.equal(validDayVideoData('data:video/mp4;base64,AAAADGZ0eXBpc29t'), true);
  assert.equal(validDayVideoData('data:video/webm;base64,GkXfo4EAAAE'), false);
  assert.equal(validDayVideoData('data:text/html;base64,GkXfo4EAAAE='), false);
  const oversized = 'data:video/webm;base64,' + Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(MAX_DAY_VIDEO_BYTES - 3)]).toString('base64');
  assert.equal(validDayVideoData(oversized), false);
});

test('export-size guard counts UTF-8 bytes exactly and preserves over-limit legacy reads and reductions', () => {
  const base = createInitialData(date);
  base.journals = [{ date, text: '', updatedAt: 1 }];
  const overhead = new TextEncoder().encode(serializeBackup(base)).byteLength;
  const exact = { ...base, journals: [{ ...base.journals[0], text: 'a'.repeat(MAX_BACKUP_IMPORT_BYTES - overhead) }] };
  assert.doesNotThrow(() => assertBackupWriteSize(base, exact));
  const larger = { ...exact, journals: [{ ...exact.journals[0], text: exact.journals[0].text + 'é' }] };
  assert.throws(() => assertBackupWriteSize(base, larger), /32 MiB/);
  assert.doesNotThrow(() => assertBackupWriteSize(larger, larger));
  assert.doesNotThrow(() => assertBackupWriteSize(larger, exact));
});
