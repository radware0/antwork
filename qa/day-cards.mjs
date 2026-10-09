import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { chromium, _electron } from 'playwright-core';
import { createInitialData } from '../src/domain.ts';

const evidence = path.resolve('.qa', `day-cards-${randomUUID()}`);
await mkdir(evidence, { recursive: true });
const executable = process.env.ANTWORK_QA_EXECUTABLE;
let app, browser, context, page;
if (executable) {
  const env = { ...process.env, ANTWORK_TEST_USER_DATA_DIR: path.join(evidence, 'profile'), ANTWORK_TEST_DOWNLOAD_DIR: evidence };
  delete env.ELECTRON_RUN_AS_NODE;
  app = await _electron.launch({ executablePath: path.resolve(executable), args: ['--no-error-dialogs'], env });
  context = app.context(); page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => { const window = BrowserWindow.getAllWindows()[0]; window.setPosition(-10000, -10000); window.showInactive(); });
} else {
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'Asia/Singapore', acceptDownloads: true });
  page = await context.newPage();
  await page.goto(process.env.QA_BASE_URL ?? 'http://localhost:5174/');
}
page.setDefaultTimeout(15000);
await page.addInitScript(() => {
  window.dayQaUrls = new Set();
  const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = value => { const url = create(value); window.dayQaUrls.add(url); return url; };
  URL.revokeObjectURL = url => { window.dayQaUrls.delete(url); revoke(url); };
});
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const readData = () => page.evaluate(() => new Promise((resolve, reject) => {
  const request = indexedDB.open('work-ledger', 1);
  request.onsuccess = () => { const db = request.result; const get = db.transaction('documents').objectStore('documents').get('current'); get.onsuccess = () => { resolve(get.result); db.close(); }; get.onerror = () => reject(get.error); };
}));
const seed = async data => {
  await page.evaluate(value => new Promise((resolve, reject) => {
    const request = indexedDB.open('work-ledger', 1);
    request.onsuccess = () => { const db = request.result; const tx = db.transaction('documents', 'readwrite'); tx.objectStore('documents').put(value, 'current'); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); };
  }), data);
  await page.reload();
  await page.getByRole('heading', { name: 'Calendar', exact: true }).waitFor();
};
const emptyPreferences = { backgrounds: [null, null], selectedIndex: null };
const card = () => page.getByRole('dialog', { name: /^(Day card|Day-card backgrounds)$/ });
const openCard = async () => { await page.getByRole('button', { name: 'View day card', exact: true }).click(); await card().waitFor(); };
const customize = async () => { await card().getByRole('button', { name: 'Day-card backgrounds', exact: true }).click(); };
const upload = async (name, mimeType, buffer, slot = 1) => {
  await card().getByLabel(`Background ${slot} picture or video`, { exact: true }).setInputFiles({ name, mimeType, buffer });
  await page.waitForFunction(() => !document.querySelector('.day-card-modal input[type=file]')?.disabled);
};
const save = async () => { await card().getByRole('button', { name: 'Save backgrounds', exact: true }).click(); await page.getByRole('dialog', { name: 'Day card', exact: true }).waitFor(); };
const close = async () => { await card().getByRole('button', { name: 'Close', exact: true }).click(); await card().waitFor({ state: 'detached' }); };
const chooseDay = async (day, today) => {
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  if (day.slice(0, 7) < today.slice(0, 7)) await page.getByRole('button', { name: 'Previous month', exact: true }).click();
  if (day.slice(0, 7) > today.slice(0, 7)) await page.getByRole('button', { name: 'Next month', exact: true }).click();
  await page.locator('.calendar-interactive button.day-cell').filter({ has: page.locator('.day-number', { hasText: new RegExp('^' + Number(day.slice(-2)) + '$') }) }).click();
};
const failMediaWrites = () => page.evaluate(() => {
  const original = IDBObjectStore.prototype.put;
  window.restoreDayWrite = () => { IDBObjectStore.prototype.put = original; };
  IDBObjectStore.prototype.put = function(value, key) {
    if (value.dayCardPreferences?.backgrounds.some(Boolean)) throw new DOMException('Synthetic write failure', 'QuotaExceededError');
    return original.call(this, value, key);
  };
});

try {
  await page.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor();
  assert.ok(await page.title());
  const today = await page.evaluate(() => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; });
  const data = createInitialData(today);
  data.dailyRatings[today] = 'good';
  const midnight = await page.evaluate(() => new Date(new Date().setHours(0, 0, 0, 0)).getTime());
  const yesterday = await page.evaluate(midnight => { const date = new Date(midnight - 1); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }, midnight);
  data.sessions = [
    { id: 'midnight', intervals: [{ start: midnight - 30 * 60000, end: midnight + 45 * 60000 }], source: 'manual', questOccurrenceId: null, campaignId: null, result: null, note: 'Midnight work' },
    { id: 'dated', timing: 'duration', intervals: [], date: today, durationMinutes: 75, source: 'manual', questOccurrenceId: null, campaignId: null, result: 'rough', note: 'Dated work' },
  ];
  data.timer = { id: 'running', mode: 'stopwatch', durationMs: null, accumulatedMs: 0, intervals: [], runningSince: Date.now() - 3600000, questOccurrenceId: null, campaignId: null };
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Calendar', exact: true }).click();
  const legacy = { ...data, schemaVersion: 5 }; delete legacy.dayCardBackgrounds; delete legacy.dayCardPreferences;
  await seed(legacy);
  assert.equal((await readData()).schemaVersion, 7);
  assert.deepEqual((await readData()).dayCardBackgrounds, {});
  assert.deepEqual((await readData()).dayCardPreferences, emptyPreferences);
  await openCard();
  assert.equal(await card().locator('.day-card-hours').innerText(), '2.0h');
  assert.equal(await card().locator('.day-card-quality').innerText(), 'Good');
  assert.equal(await page.locator('dialog[open]').count(), 1);
  await close();
  for (const [action, expected] of [['Clear rating', 'Unrated'], ['Steady', 'Steady'], ['Rough', 'Rough'], ['Good', 'Good']]) {
    await page.getByRole('group', { name: 'Day rating', exact: true }).getByRole('button', { name: action, exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('.day-rating-options button').disabled);
    await openCard(); assert.equal(await card().locator('.day-card-quality').innerText(), expected); await close();
  }
  await openCard();

  const makePng = async color => Buffer.from(await page.evaluate(color => {
    const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 400;
    const paint = canvas.getContext('2d'); paint.fillStyle = color; paint.fillRect(0, 0, 600, 400);
    return canvas.toDataURL('image/png').split(',')[1];
  }, color), 'base64');
  const png = await makePng('#376585');
  const secondPng = await makePng('#9c4565');
  await customize(); await upload('day.png', 'image/png', png);
  await card().getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal(await card().locator('img.day-card-media').count(), 0);
  await customize(); await upload('day.png', 'image/png', png);
  await failMediaWrites();
  await card().getByRole('button', { name: 'Save backgrounds', exact: true }).click();
  await card().getByRole('alert').filter({ hasText: 'Synthetic write failure' }).waitFor();
  assert.equal(await card().locator('img.day-card-media').count(), 1);
  assert.deepEqual((await readData()).dayCardBackgrounds, {});
  assert.deepEqual((await readData()).dayCardPreferences, emptyPreferences);
  await page.evaluate(() => window.restoreDayWrite()); await save();
  assert.equal((await readData()).dayCardPreferences.backgrounds[0].kind, 'image');
  const picture = (await readData()).dayCardPreferences.backgrounds[0];
  await customize(); await card().getByRole('button', { name: 'Remove background 1', exact: true }).click(); await save();
  assert.deepEqual((await readData()).dayCardPreferences, emptyPreferences);
  await customize(); await upload('day.png', 'image/png', png); await save();

  await customize(); await upload('second.png', 'image/png', secondPng, 2);
  assert.equal(await card().locator('input[type=file]').count(), 2, 'exactly two reusable slots');
  for (const theme of ['black', 'white']) {
    await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
    for (const [width, height] of [[1440, 900], [390, 844]]) {
      if (app) await app.evaluate(({ BrowserWindow }, { width, height }) => BrowserWindow.getAllWindows()[0].setContentSize(width, height), { width, height });
      else await page.setViewportSize({ width, height });
      assert.ok(await card().evaluate(dialog => dialog.scrollWidth <= dialog.clientWidth + 1));
      await page.screenshot({ path: path.join(evidence, `editor-${theme}-${width}.png`) });
    }
  }
  await save();
  const secondPicture = (await readData()).dayCardPreferences.backgrounds[1];
  assert.notEqual(secondPicture.data, picture.data);
  assert.equal((await readData()).dayCardPreferences.selectedIndex, 1);
  await customize(); await card().getByRole('radio', { name: 'Use background 1', exact: true }).check();
  await card().getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal(await card().locator('img.day-card-media').getAttribute('src'), secondPicture.data);
  await customize(); await card().getByRole('radio', { name: 'Use background 1', exact: true }).check(); await save();
  await close(); await chooseDay(yesterday, today); await openCard();
  assert.equal(await card().locator('img.day-card-media').getAttribute('src'), picture.data, 'shared choice applies to another date');
  await customize(); await card().getByRole('radio', { name: 'Use background 2', exact: true }).check(); await save();
  await close(); await chooseDay(today, today); await openCard();
  assert.equal(await card().locator('img.day-card-media').getAttribute('src'), secondPicture.data, 'switching from another date updates all cards');
  await customize(); await card().getByRole('radio', { name: 'No background', exact: true }).check(); await save();
  assert.equal(await card().locator('img.day-card-media').count(), 0);
  assert.deepEqual((await readData()).dayCardPreferences.backgrounds, [picture, secondPicture]);
  await customize(); await card().getByRole('radio', { name: 'Use background 1', exact: true }).check();
  await card().getByRole('button', { name: 'Remove background 1', exact: true }).click(); await save();
  assert.equal((await readData()).dayCardPreferences.selectedIndex, 1, 'removing the selected choice selects the remaining background');
  assert.equal(await card().locator('img.day-card-media').getAttribute('src'), secondPicture.data);

  // Generate short clips with audio locally so silence is checked against a real soundtrack.
  const fixtureDir = path.resolve('.qa', 'day-card-fixtures'); await mkdir(fixtureDir, { recursive: true });
  if (!['mp4', 'webm'].every(extension => existsSync(path.join(fixtureDir, 'clip.' + extension)))) {
    const generator = await chromium.launch({ headless: true });
    try {
      const generatorPage = await generator.newPage(); await generatorPage.goto(process.env.QA_BASE_URL ?? 'http://localhost:5174/');
      for (const [extension, mimeType] of [['mp4', 'video/mp4'], ['webm', 'video/webm']]) {
        const bytes = Buffer.from(await generatorPage.evaluate(async mimeType => {
          const canvas = document.createElement('canvas'); canvas.width = 96; canvas.height = 64;
          const paint = canvas.getContext('2d'); const stream = canvas.captureStream(20);
          const audio = new AudioContext(); const oscillator = audio.createOscillator(); const destination = audio.createMediaStreamDestination(); oscillator.connect(destination); oscillator.start(); stream.addTrack(destination.stream.getAudioTracks()[0]);
          const recorder = new MediaRecorder(stream, { mimeType }); const chunks = [];
          recorder.ondataavailable = event => chunks.push(event.data);
          const done = new Promise(resolve => { recorder.onstop = resolve; });
          let frame = 0; const interval = setInterval(() => { paint.fillStyle = frame++ % 2 ? '#2277aa' : '#aa7722'; paint.fillRect(0, 0, 96, 64); }, 40);
          recorder.start(); await new Promise(resolve => setTimeout(resolve, 800)); recorder.stop(); await done;
          clearInterval(interval); stream.getTracks().forEach(track => track.stop()); oscillator.stop(); await audio.close();
          return Array.from(new Uint8Array(await new Blob(chunks).arrayBuffer()));
        }, mimeType));
        await writeFile(path.join(fixtureDir, 'clip.' + extension), bytes);
      }
    } finally { await generator.close(); }
  }
  for (const extension of ['mp4', 'webm']) {
    await customize(); await upload('clip.' + extension, 'video/' + extension, await readFile(path.join(fixtureDir, 'clip.' + extension))); await save();
    assert.equal((await readData()).dayCardPreferences.backgrounds[0].kind, 'video');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForFunction(() => { const video = document.querySelector('.day-card video'); return video && !video.paused && video.loop && video.muted && video.volume === 0 && video.currentTime > 0; });
    assert.equal(await card().getByRole('button', { name: /^(Play|Pause) video$/ }).count(), 0);
    assert.equal(await card().locator('video').evaluate(video => video.controls), false);
    await page.waitForFunction(() => { const video = document.querySelector('.day-card video'); video.qaPreviousTime ??= video.currentTime; const looped = video.currentTime < video.qaPreviousTime; video.qaPreviousTime = video.currentTime; return looped; });
    await page.evaluate(() => { const video = document.querySelector('.day-card video'); video.muted = false; video.volume = 1; });
    await page.waitForFunction(() => { const video = document.querySelector('.day-card video'); return video.muted && video.volume === 0; });
    if (app) {
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].hide());
      await page.waitForFunction(() => document.querySelector('.day-card video').paused);
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].showInactive());
    } else {
      await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
      assert.equal(await card().locator('video').evaluate(video => video.paused), true);
      await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => !document.querySelector('.day-card video').paused);
    await close(); assert.equal(await page.evaluate(() => window.dayQaUrls.size), 0);
    await openCard(); await page.waitForFunction(() => !document.querySelector('.day-card video').paused);
  }
  for (const theme of ['black', 'white']) {
    await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
    for (const [width, height] of [[1440, 900], [1366, 768], [390, 844]]) {
      if (app) await app.evaluate(({ BrowserWindow }, { width, height }) => BrowserWindow.getAllWindows()[0].setContentSize(width, height), { width, height });
      else await page.setViewportSize({ width, height });
      assert.ok(await card().evaluate(dialog => dialog.scrollWidth <= dialog.clientWidth + 1));
      await page.screenshot({ path: path.join(evidence, `${theme}-${width}.png`) });
    }
  }
  await customize(); await upload('corrupt.webm', 'video/webm', Buffer.from('invalid video'));
  await card().getByRole('alert').filter({ hasText: 'could not be opened' }).waitFor();
  await upload('large.mp4', 'video/mp4', Buffer.alloc(5 * 1024 * 1024 + 1));
  await card().getByRole('alert').filter({ hasText: '5 MiB' }).waitFor();
  const longClip = Buffer.from(await readFile(path.join(fixtureDir, 'clip.webm')));
  const durationIndex = longClip.indexOf(Buffer.from([0x44, 0x89])); assert.ok(durationIndex >= 0);
  if (longClip[durationIndex + 2] === 0x84) longClip.writeFloatBE(31000, durationIndex + 3);
  else { assert.equal(longClip[durationIndex + 2], 0x88); longClip.writeDoubleBE(31000, durationIndex + 3); }
  await upload('long.webm', 'video/webm', longClip); await card().getByRole('alert').filter({ hasText: '30 seconds' }).waitFor();
  await card().getByRole('button', { name: 'Cancel', exact: true }).click();
  await customize(); await upload('day.png', 'image/png', png); await page.keyboard.press('Escape'); await card().waitFor({ state: 'detached' });
  assert.equal((await readData()).dayCardPreferences.backgrounds[0].kind, 'video');
  await openCard();
  await close();
  const beforeTransition = await readData();
  const oldMedia = { ...beforeTransition, schemaVersion: 6, dayCardBackgrounds: { [today]: picture, [yesterday]: beforeTransition.dayCardPreferences.backgrounds[0], '2026-01-01': secondPicture } };
  delete oldMedia.dayCardPreferences;
  await seed(oldMedia);
  assert.equal((await readData()).schemaVersion, 7);
  assert.deepEqual((await readData()).dayCardBackgrounds, oldMedia.dayCardBackgrounds);
  assert.deepEqual((await readData()).dayCardPreferences, emptyPreferences);
  await openCard();
  assert.equal(await card().locator('img.day-card-media').getAttribute('src'), picture.data);
  await customize();
  assert.ok(await card().getByRole('button', { name: 'Save backgrounds', exact: true }).isDisabled());
  await card().getByRole('checkbox', { name: 'Replace all older per-date backgrounds', exact: true }).check();
  await card().getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.deepEqual((await readData()).dayCardBackgrounds, oldMedia.dayCardBackgrounds, 'cancel preserves all older media');
  await customize();
  assert.equal(await card().getByRole('checkbox', { name: 'Replace all older per-date backgrounds', exact: true }).isChecked(), false);
  if (!app) {
    const download = page.waitForEvent('download'); await card().getByRole('button', { name: 'Export JSON', exact: true }).click();
    const exported = await download; const exportedData = JSON.parse(await readFile(await exported.path(), 'utf8'));
    assert.deepEqual(exportedData.dayCardBackgrounds, oldMedia.dayCardBackgrounds, 'backup offer preserves every old background');
    assert.deepEqual(exportedData.dayCardPreferences, emptyPreferences);
  }
  await upload('clip.webm', 'video/webm', await readFile(path.join(fixtureDir, 'clip.webm')), 2);
  await card().getByRole('checkbox', { name: 'Replace all older per-date backgrounds', exact: true }).check();
  await failMediaWrites();
  await card().getByRole('button', { name: 'Save backgrounds', exact: true }).click();
  await card().getByRole('alert').filter({ hasText: 'Synthetic write failure' }).waitFor();
  assert.deepEqual((await readData()).dayCardBackgrounds, oldMedia.dayCardBackgrounds, 'failed replacement retains every old background');
  await page.evaluate(() => window.restoreDayWrite()); await save();
  assert.deepEqual((await readData()).dayCardBackgrounds, {});
  assert.equal((await readData()).dayCardPreferences.selectedIndex, 1);
  assert.deepEqual((await readData()).dayCardPreferences.backgrounds[0], picture, 'current old background can be reused without uploading');
  await close(); await chooseDay(yesterday, today); await openCard();
  await page.waitForFunction(() => !document.querySelector('.day-card video').paused);
  await close(); await chooseDay(today, today);

  const stored = await readData();
  const backup = JSON.stringify(stored, null, 2);
  await seed({ ...stored, dayCardPreferences: emptyPreferences });
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Profile', exact: true }).click();
  for (const background of [
    { kind: 'video', data: 'data:video/webm;base64,GkXfo4EAAAE=', durationSeconds: 1 },
    { kind: 'image', data: 'data:image/webp;base64,UklGRgAAAABXRUJQVlA4' },
  ]) {
    for (const legacy of [false, true]) {
      const invalid = legacy ? { ...stored, schemaVersion: 6, dayCardBackgrounds: { [today]: background } }
        : { ...stored, dayCardPreferences: { backgrounds: [background, stored.dayCardPreferences.backgrounds[1]], selectedIndex: 1 } };
      if (legacy) delete invalid.dayCardPreferences;
      await page.getByText('Import JSON', { exact: true }).locator('input').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(invalid)) });
      await page.getByRole('status').filter({ hasText: 'could not be opened' }).waitFor();
      assert.equal(await page.getByRole('dialog', { name: 'Replace local history', exact: true }).count(), 0);
      assert.deepEqual((await readData()).dayCardPreferences, emptyPreferences, 'inactive and legacy corrupt media cannot replace history');
    }
  }
  await page.getByText('Import JSON', { exact: true }).locator('input').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
  await page.getByRole('dialog', { name: 'Replace local history', exact: true }).getByRole('button', { name: 'Replace local history', exact: true }).click();
  await page.getByRole('dialog', { name: 'Replace local history', exact: true }).waitFor({ state: 'detached' });
  assert.deepEqual((await readData()).dayCardPreferences, stored.dayCardPreferences);
  assert.deepEqual((await readData()).sessions, stored.sessions);
  assert.deepEqual((await readData()).dailyRatings, stored.dailyRatings);
  if (!app) {
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export JSON', exact: true }).click();
    const exported = await download; const exportedData = JSON.parse(await readFile(await exported.path(), 'utf8'));
    assert.equal(exportedData.schemaVersion, 7);
    assert.deepEqual(exportedData.dayCardPreferences, stored.dayCardPreferences);
  }
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name: 'Calendar', exact: true }).click();
  await openCard(); await page.waitForFunction(() => !document.querySelector('.day-card video').paused); await close();
  await page.reload(); await page.getByRole('heading', { name: 'Calendar', exact: true }).waitFor();
  await openCard(); await page.waitForFunction(() => !document.querySelector('.day-card video').paused); await close();
  assert.deepEqual((await readData()).dayCardPreferences, stored.dayCardPreferences, 'shared choices survive restart');
  const nearLimit = { ...stored, dayCardPreferences: emptyPreferences, journals: [{ date: today, text: '', updatedAt: 1 }] };
  const overhead = Buffer.byteLength(JSON.stringify(nearLimit, null, 2)); nearLimit.journals[0].text = 'a'.repeat(32 * 1024 * 1024 - overhead - 20);
  await seed(nearLimit); await openCard(); await customize(); await upload('day.png', 'image/png', png);
  await card().getByRole('button', { name: 'Save backgrounds', exact: true }).click();
  await card().getByRole('alert').filter({ hasText: '32 MiB' }).waitFor();
  assert.deepEqual((await readData()).dayCardPreferences, emptyPreferences);
  assert.equal(await card().locator('img.day-card-media').count(), 1);
  await card().getByRole('button', { name: 'Cancel', exact: true }).click(); await close();
  await seed({ ...stored, sessions: [], timer: null });
  assert.equal(await page.getByRole('button', { name: 'View day card', exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Remove day background', exact: true }).count(), 0, 'shared media is independent of work dates');
  await page.getByRole('button', { name: 'Day-card backgrounds', exact: true }).click();
  assert.equal(await card().locator('.day-card-hours').count(), 0, 'global editor does not create an empty worked-day card');
  await card().getByRole('button', { name: 'Remove background 1', exact: true }).click();
  await card().getByRole('button', { name: 'Remove background 2', exact: true }).click();
  await card().getByRole('button', { name: 'Save backgrounds', exact: true }).click(); await card().waitFor({ state: 'detached' });
  assert.deepEqual((await readData()).dayCardPreferences, emptyPreferences, 'backgrounds remain removable without any saved work');
  await seed({ ...stored, sessions: [], timer: null, dayCardPreferences: emptyPreferences, dayCardBackgrounds: { [today]: picture } });
  await page.getByRole('button', { name: 'Remove day background', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('.day-summary button'));
  assert.equal((await readData()).dayCardBackgrounds[today], undefined);
  const tomorrow = await page.evaluate(() => { const date = new Date(); date.setDate(date.getDate() + 1); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; });
  await seed({ ...stored, sessions: [{ ...stored.sessions[1], date: tomorrow }], timer: null });
  if (tomorrow.slice(0, 7) !== today.slice(0, 7)) await page.getByRole('button', { name: 'Next month', exact: true }).click();
  await page.getByRole('button', { name: /future day$/ }).filter({ has: page.locator('.day-number', { hasText: new RegExp('^' + Number(tomorrow.slice(-2)) + '$') }) }).click();
  assert.equal(await page.getByRole('button', { name: 'View day card', exact: true }).count(), 0);
  assert.deepEqual(errors, []);
  await writeFile(path.join(evidence, 'result.json'), JSON.stringify({ passed: true, environment: app ? 'packaged Electron' : 'Chromium', checks: ['saved hours', 'v5/v6 migration', 'two shared choices', 'cross-date selection', 'no background', 'removal fallback', 'image drafts', 'write rollback', 'confirmed legacy replacement', 'legacy backup export', 'MP4/WebM silent loops', 'visibility', 'reduced motion', 'responsive cards and editor', 'invalid uploads and imports', 'backup restore', 'restart', 'backup limit', 'cleanup without work', 'legacy orphan cleanup'], screenshots: evidence }, null, 2));
  console.log('Day-card checks passed. Evidence: ' + evidence);
} finally {
  if (app) await app.close();
  else { await context.close(); await browser.close(); }
}
