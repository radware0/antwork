import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialData } from './domain.ts';
import { validateImport } from './storage.ts';
import * as profileMedia from './profileMedia.ts';

test('version four backups default missing sound preferences to muted and preserve explicit choices', () => {
  const legacyV4 = createInitialData('2026-09-29') as unknown as Record<string, unknown>;
  delete legacyV4.preferences;
  const normalized = validateImport(legacyV4) as unknown as { preferences?: { interfaceSounds: boolean; timerAlarm: boolean } };
  assert.deepEqual(normalized.preferences, { interfaceSounds: false, timerAlarm: false });

  const enabled = validateImport({ ...legacyV4, preferences: { interfaceSounds: true, timerAlarm: true } }) as unknown as { preferences: unknown };
  assert.deepEqual(enabled.preferences, { interfaceSounds: true, timerAlarm: true });
});

test('new workspaces start Black with both sounds enabled', () => {
  const data = createInitialData('2026-09-29');
  assert.equal(data.theme, 'black');
  assert.deepEqual(data.preferences, { interfaceSounds: true, timerAlarm: true });
});

test('saved System appearance becomes Black and White remains White without changing work', () => {
  const old = createInitialData('2026-09-29');
  old.sessions.push({ id: 'logged', source: 'manual', timing: 'duration', date: '2026-09-29', durationMinutes: 30, intervals: [], questOccurrenceId: null, campaignId: null, result: null, note: '' });
  (old as unknown as { theme: string }).theme = 'system';
  const black = validateImport(old);
  assert.equal(black.theme, 'black');
  assert.deepEqual(black.sessions, old.sessions);
  const white = validateImport({ ...old, theme: 'white' });
  assert.equal(white.theme, 'white');
  assert.deepEqual(white.sessions, old.sessions);
});

test('saved Slate appearance becomes Black without changing imported history or mute settings', () => {
  const old = createInitialData('2026-09-29');
  (old as unknown as { theme: string }).theme = 'slate';
  old.preferences = { interfaceSounds: false, timerAlarm: false };
  old.journals.push({ date: '2026-09-29', text: 'Still here', updatedAt: 1 });
  const migrated = validateImport(old);
  assert.equal(migrated.theme, 'black');
  assert.deepEqual(migrated.preferences, { interfaceSounds: false, timerAlarm: false });
  assert.deepEqual(migrated.journals, old.journals);
});

test('the global sound control mutes both sounds and unmutes a previously silent install', async () => {
  const sound = await import('./sound.ts') as typeof import('./sound.ts') & { toggleSoundPreferences?: (value: { interfaceSounds: boolean; timerAlarm: boolean }) => { interfaceSounds: boolean; timerAlarm: boolean } };
  assert.equal(typeof sound.toggleSoundPreferences, 'function');
  assert.deepEqual(sound.toggleSoundPreferences!({ interfaceSounds: true, timerAlarm: false }), { interfaceSounds: false, timerAlarm: false });
  assert.deepEqual(sound.toggleSoundPreferences!({ interfaceSounds: false, timerAlarm: false }), { interfaceSounds: true, timerAlarm: true });
});

test('profile crop geometry covers the output and clamps pan without empty edges', () => {
  const cropSourceRect = (profileMedia as unknown as {
    cropSourceRect?: (width: number, height: number, kind: 'avatar' | 'banner', crop: { zoom: number; x: number; y: number }) => { x: number; y: number; width: number; height: number };
  }).cropSourceRect;
  assert.equal(typeof cropSourceRect, 'function');
  assert.deepEqual(cropSourceRect!(1200, 800, 'avatar', { zoom: 1, x: 0, y: 0 }), { x: 200, y: 0, width: 800, height: 800 });
  assert.deepEqual(cropSourceRect!(1200, 800, 'avatar', { zoom: 1, x: 4, y: -4 }), { x: 400, y: 0, width: 800, height: 800 });
  assert.deepEqual(cropSourceRect!(1200, 800, 'avatar', { zoom: 2, x: 0, y: 0 }), { x: 400, y: 200, width: 400, height: 400 });
  assert.deepEqual(cropSourceRect!(1600, 1200, 'banner', { zoom: 1, x: 0, y: 0 }), { x: 0, y: 300, width: 1600, height: 600 });
});

test('banner frame preview uses the same centered cover crop as the displayed banner', () => {
  const coverSourceRect = (profileMedia as unknown as {
    coverSourceRect?: (width: number, height: number, frameWidth: number, frameHeight: number) => { x: number; y: number; width: number; height: number };
  }).coverSourceRect;
  assert.equal(typeof coverSourceRect, 'function');
  assert.deepEqual(coverSourceRect!(1600, 600, 1200, 168), { x: 0, y: 188, width: 1600, height: 224 });
  assert.deepEqual(coverSourceRect!(1600, 600, 320, 120), { x: 0, y: 0, width: 1600, height: 600 });
});

test('interface sound rate gate drops clicks inside one hundred milliseconds without queuing them', async () => {
  const sound = await import('./sound.ts').catch(() => ({} as Record<string, unknown>));
  const createSoundGate = (sound as { createSoundGate?: (windowMs: number) => (at: number) => boolean }).createSoundGate;
  assert.equal(typeof createSoundGate, 'function');
  const allow = createSoundGate!(100);
  assert.equal(allow(1000), true);
  assert.equal(allow(1099), false);
  assert.equal(allow(1100), true);
  assert.equal(allow(1101), false);
});

test('expired countdown settlement identifies exactly one transaction owner', async () => {
  const settlement = await import('./timerSettlement.ts').catch(() => ({} as Record<string, unknown>));
  const settleExpiredCountdown = (settlement as {
    settleExpiredCountdown?: (data: ReturnType<typeof createInitialData>, timerId: string, now: number) => { data: ReturnType<typeof createInitialData>; settled: boolean };
  }).settleExpiredCountdown;
  assert.equal(typeof settleExpiredCountdown, 'function');
  const now = new Date(2026, 8, 29, 12).getTime();
  const data = createInitialData('2026-09-29');
  data.timer = { id: 'countdown', mode: 'countdown', durationMs: 60_000, accumulatedMs: 0, intervals: [], runningSince: now - 61_000, questOccurrenceId: null, campaignId: null };
  const first = settleExpiredCountdown!(data, 'countdown', now);
  assert.equal(first.settled, true);
  assert.equal(first.data.timer, null);
  assert.equal(first.data.pendingReviewId, 'countdown');
  assert.equal(first.data.sessions.filter(item => item.id === 'countdown').length, 1);
  const second = settleExpiredCountdown!(first.data, 'countdown', now + 1000);
  assert.equal(second.settled, false);
  assert.equal(second.data.sessions.filter(item => item.id === 'countdown').length, 1);
});
