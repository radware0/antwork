import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { _electron } from 'playwright-core';
import { createRequire } from 'node:module';

const oldExecutable = process.env.ANTWORK_QA_OLD_EXECUTABLE;
const newExecutable = process.env.ANTWORK_QA_EXECUTABLE;
assert.ok(oldExecutable && newExecutable, 'Set both old and new QA executable paths.');
const directory = path.resolve('.qa', 'upgrade-' + randomUUID());
await mkdir(directory, { recursive: true });
const env = { ...process.env, ANTWORK_TEST_USER_DATA_DIR: path.join(directory, 'profile'), ANTWORK_TEST_DOWNLOAD_DIR: directory };
delete env.ELECTRON_RUN_AS_NODE;
const asar = createRequire(import.meta.url)('@electron/asar');
const version = executable => JSON.parse(asar.extractFile(path.join(path.dirname(executable), 'resources', 'app.asar'), 'package.json')).version;
const oldVersion = version(oldExecutable);
assert.ok(['1.0.0', '1.1.0'].includes(oldVersion)); assert.equal(version(newExecutable), '1.1.0');
let app;
const open = async executable => {
  app = await _electron.launch({ executablePath: path.resolve(executable), args: ['--no-error-dialogs'], env });
  const page = await app.firstWindow();
  await page.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor();
  return page;
};
const read = page => page.evaluate(() => new Promise(resolve => {
  const request = indexedDB.open('work-ledger', 1);
  request.onsuccess = () => { const db = request.result; const get = db.transaction('documents').objectStore('documents').get('current'); get.onsuccess = () => { resolve(get.result); db.close(); }; };
}));
try {
  let page = await open(oldExecutable);
  const baseline = await read(page); assert.equal(baseline.schemaVersion, oldVersion === '1.0.0' ? 5 : 6);
  const image = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 32; canvas.getContext('2d').fillRect(0, 0, 32, 32); return canvas.toDataURL('image/webp'); });
  const now = Date.now(), date = baseline.setupDate;
  if (baseline.schemaVersion === 6) baseline.dayCardBackgrounds = {
    [date]: { kind: 'image', data: image },
    '2000-01-01': { kind: 'image', data: image },
    '2000-01-02': { kind: 'image', data: image },
  };
  baseline.profile = { ...baseline.profile, name: 'Synthetic upgrade user', bio: 'Keep local identity', avatar: image };
  baseline.dailyRatings = { [date]: 'steady' }; baseline.calendarMode = 'hours';
  baseline.timerPanel = { ...baseline.timerPanel, image, imageOpacity: 72, imageBlur: 4, preferredWidth: 720, preferredHeight: 500 };
  baseline.preferences = { interfaceSounds: false, timerAlarm: false };
  baseline.journals = [{ date, text: 'Preserve the private test journal', updatedAt: now }];
  baseline.campaigns = [{ id: 'project', title: 'Upgrade check', note: '', createdAt: now, completedAt: null }];
  baseline.sessions = [
    { id: 'precise', intervals: [{ start: now - 3600123, end: now - 1800045 }], source: 'manual', note: 'Keep precise endpoints', questOccurrenceId: null, campaignId: 'project', result: 'strong' },
    { id: 'duration', timing: 'duration', date, durationMinutes: 75, intervals: [], source: 'manual', note: 'Keep dated work', questOccurrenceId: null, campaignId: null, result: null },
  ];
  baseline.timer = { id: 'active', mode: 'stopwatch', durationMs: null, accumulatedMs: 0, intervals: [], runningSince: now - 60000, questOccurrenceId: null, campaignId: 'project' };
  await page.evaluate(data => new Promise(resolve => {
    const request = indexedDB.open('work-ledger', 1);
    request.onsuccess = () => { const db = request.result; const tx = db.transaction('documents', 'readwrite'); tx.objectStore('documents').put(data, 'current'); tx.oncomplete = () => { db.close(); resolve(); }; };
  }), baseline);
  await page.reload(); await page.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor();
  const saved = await read(page);
  await app.close(); app = null;
  page = await open(newExecutable);
  const migrated = await read(page);
  assert.equal(migrated.schemaVersion, 7); assert.deepEqual(migrated.dayCardBackgrounds, saved.dayCardBackgrounds ?? {});
  assert.deepEqual(migrated.dayCardPreferences, { backgrounds: [null, null], selectedIndex: null });
  for (const field of ['sessions', 'journals', 'dailyRatings', 'calendarMode', 'profile', 'timerPanel', 'preferences', 'campaigns']) assert.deepEqual(migrated[field], saved[field], field + ' survives upgrade');
  assert.equal(migrated.timer.id, 'active'); assert.equal(migrated.timer.runningSince, null);
  assert.ok(migrated.timer.accumulatedMs >= saved.timer.accumulatedMs);
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Calendar', exact: true }).click();
  await page.getByRole('button', { name: 'View day card', exact: true }).click();
  await page.getByRole('dialog', { name: 'Day card', exact: true }).waitFor();
  assert.equal(await page.locator('.day-card-quality').innerText(), 'Steady');
  await writeFile(path.join(directory, 'result.json'), JSON.stringify({ passed: true, oldVersion, newVersion: '1.1.0', newSchemaVersion: 7, checks: ['precise and dated hours', 'journals', 'ratings', 'identity', 'images', 'settings', 'campaigns', 'paused timer', 'day card', 'older per-date background preservation'], installerReplacementTested: false }, null, 2));
  console.log(`Same-profile v${oldVersion}-to-refreshed-v1.1.0 app upgrade passed. Evidence: ${directory}`);
} finally { if (app) await app.close(); }
